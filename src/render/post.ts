import { flags } from '../debug/parity';
import {
  DepthTexture, GLSL3, HalfFloatType, LinearFilter, Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, Vector2, WebGLRenderTarget,
  type IUniform, type Texture, type WebGLRenderer,
} from 'three';
import type { GpuTimer } from '../core/gpu-timer';
import { postShaders, type ShaderPair } from '../shaders';

/** What the composite needs from the frame. */
export interface PostFrame {
  bloom: boolean;
  dof: boolean;
  /** vignette and film grain */
  grade: boolean;
  near: number;
  far: number;
  /** camera → hero distance: the depth of field focuses on the grain */
  focus: number;
  /** the world's depth-of-field scale (story/lights.ts `dof`): below 1, more is in focus */
  dofScale: number;
  /** shader time (the film grain moves with it) */
  time: number;
  /** false under reduced motion: the film grain stands still */
  grainMoves: boolean;
}

class FullscreenPass {
  readonly u: Record<string, IUniform>;
  readonly scene = new Scene();
  constructor(shaders: ShaderPair, uniforms: Record<string, IUniform>, geometry: PlaneGeometry) {
    this.u = uniforms;
    const material = new ShaderMaterial({ glslVersion: GLSL3, uniforms, depthTest: false, depthWrite: false, ...shaders });
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
  }
}

const half = { type: HalfFloatType, depthBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter } as const;

/**
 * The HDR post chain (v10). The scene renders into a half-float target with a depth texture; then
 *   bloom      bright pass (luminance above .95) into quarter resolution, a Gaussian blur there,
 *              copied down to eighth resolution and blurred again (two levels)
 *   dof        half resolution, 12 taps, focused on the camera → hero distance
 *   composite  depth of field, bloom, shoulder tone curve, vignette, film grain, display gamma
 * Each step is timed on the GPU as its own pass.
 */
export class PostChain {
  /** depth of field at 1/dofRes of the drawing buffer (2 = half; ?dofres measures others) */
  private readonly dofRes = flags.dofRes;
  /** the scene is drawn here (linear HDR) */
  readonly scene: WebGLRenderTarget;
  private readonly bloomA: WebGLRenderTarget;
  private readonly bloomA2: WebGLRenderTarget;
  private readonly bloomB: WebGLRenderTarget;
  private readonly bloomB2: WebGLRenderTarget;
  private readonly dofTarget: WebGLRenderTarget;
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly bright: FullscreenPass;
  private readonly blur: FullscreenPass;
  private readonly dof: FullscreenPass;
  private readonly composite: FullscreenPass;
  private readonly size = new Vector2();

  constructor() {
    this.scene = new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: true });
    this.scene.depthTexture = new DepthTexture(1, 1);
    this.bloomA = new WebGLRenderTarget(1, 1, half); this.bloomA2 = new WebGLRenderTarget(1, 1, half);
    this.bloomB = new WebGLRenderTarget(1, 1, half); this.bloomB2 = new WebGLRenderTarget(1, 1, half);
    this.dofTarget = new WebGLRenderTarget(1, 1, half);
    const geo = new PlaneGeometry(2, 2);
    this.bright = new FullscreenPass(postShaders.bright, { uTex: { value: this.scene.texture }, uTh: { value: .95 } }, geo);
    this.blur = new FullscreenPass(postShaders.blur, { uTex: { value: null }, uDir: { value: new Vector2() } }, geo);
    const depth = (): Record<string, IUniform> => ({ uDepth: { value: this.scene.depthTexture }, uNear: { value: .05 }, uFar: { value: 200 }, uFocus: { value: 10 }, uRange: { value: 4 } });
    this.dof = new FullscreenPass(postShaders.dof, {
      uColor: { value: this.scene.texture }, ...depth(), uMaxBlur: { value: 3 }, uTexel: { value: new Vector2() },
    }, geo);
    this.composite = new FullscreenPass(postShaders.composite, {
      uColor: { value: this.scene.texture }, ...depth(), uBloomA: { value: this.bloomA.texture }, uBloomB: { value: this.bloomB.texture }, uDof: { value: this.dofTarget.texture },
      uBloom: { value: .75 }, uUseDof: { value: 1 }, uUseBloom: { value: 1 }, uUseGrade: { value: 1 }, uTime: { value: 0 }, uGrainOn: { value: 1 },
    }, geo);
  }

  /** Match the drawing buffer (cheap when unchanged; call every frame). */
  fit(renderer: WebGLRenderer): void {
    const b = renderer.getDrawingBufferSize(new Vector2());
    if (b.equals(this.size)) return;
    this.size.copy(b);
    const w = b.x, h = b.y, q = (n: number): number => Math.max(1, n);
    this.scene.setSize(w, h);
    this.bloomA.setSize(q(w >> 2), q(h >> 2)); this.bloomA2.setSize(q(w >> 2), q(h >> 2));
    this.bloomB.setSize(q(w >> 3), q(h >> 3)); this.bloomB2.setSize(q(w >> 3), q(h >> 3));
    const d = this.dofRes;
    this.dofTarget.setSize(q(Math.floor(w / d)), q(Math.floor(h / d))); // d = 2: w >> 1, as before
    (this.dof.u.uTexel!.value as Vector2).set(2 / w, 2 / h); // the taps' spacing stays the half-resolution one: the same blur radius at any ?dofres
  }

  render(renderer: WebGLRenderer, timer: GpuTimer, f: PostFrame): void {
    if (f.bloom) {
      timer.begin('bloom');
      this.run(renderer, this.bright, this.bloomA);
      this.blurInto(renderer, this.bloomA, this.bloomA2, 1, 0);
      this.blurInto(renderer, this.bloomA2, this.bloomA, 0, 1);
      this.blurInto(renderer, this.bloomA, this.bloomB, 0, 0); // copy down a level
      this.blurInto(renderer, this.bloomB, this.bloomB2, 1, 0);
      this.blurInto(renderer, this.bloomB2, this.bloomB, 0, 1);
      timer.end();
    }
    const range = Math.max(1.5, f.focus * .35) / Math.max(.2, f.dofScale);
    for (const p of [this.dof, this.composite]) {
      p.u.uNear!.value = f.near; p.u.uFar!.value = f.far; p.u.uFocus!.value = f.focus; p.u.uRange!.value = range;
    }
    if (f.dof) {
      timer.begin('dof');
      this.run(renderer, this.dof, this.dofTarget);
      timer.end();
    }
    const u = this.composite.u;
    u.uUseDof!.value = f.dof ? 1 : 0; u.uUseBloom!.value = f.bloom ? 1 : 0; u.uUseGrade!.value = f.grade ? 1 : 0;
    u.uTime!.value = f.time; u.uGrainOn!.value = f.grainMoves ? 1 : 0;
    timer.begin('composite');
    this.run(renderer, this.composite, null);
    timer.end();
  }

  private blurInto(renderer: WebGLRenderer, from: WebGLRenderTarget, to: WebGLRenderTarget, dx: number, dy: number): void {
    this.blur.u.uTex!.value = from.texture as Texture;
    (this.blur.u.uDir!.value as Vector2).set(dx / from.width, dy / from.height);
    this.run(renderer, this.blur, to);
  }

  private run(renderer: WebGLRenderer, pass: FullscreenPass, target: WebGLRenderTarget | null): void {
    renderer.setRenderTarget(target);
    renderer.render(pass.scene, this.camera);
  }
}
