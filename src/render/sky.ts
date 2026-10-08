import {
  Color, GLSL3, HalfFloatType, LinearFilter, Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, UnsignedByteType, Vector2, Vector3, WebGLRenderTarget,
  type IUniform, type WebGLRenderer,
} from 'three';
import { SKY_LEVEL, type SkyState } from '../core/sky';
import { skyCopyShaders, skyShaders } from '../shaders';
import type { CompileOne } from './post';

/** What the sky pass needs from the frame. */
export interface SkyFrame {
  state: SkyState;
  /** the stage colour, linear: the sky is mixed over it by its amount */
  stage: Vector3;
  /** shader time: the clouds drift with it (it stands still under reduced motion) */
  time: number;
  /** drawing-buffer width / height */
  aspect: number;
}

/** Below this amount the sky is not drawn at all (the stage colour is the clear colour). */
export const SKY_MIN = .002;
/** The sky is drawn at 1/SCALE of the drawing buffer each way and stretched (bilinear): it is soft, and the
 * depth of field blurs it fully anyway (it has no depth). A sixteenth of the pixels (docs/perf.md, Phase 7). */
const SCALE = 4;

/**
 * The sky (shaders/sky.glsl): drawn at a quarter of the resolution into its own target (`render`, before the
 * HDR target is bound), then stretched over the HDR target after the grains and before the hero grain
 * (`draw`), on the far plane with the depth test: only where no grain is, so it costs what shows.
 */
export class SkyPass {
  private readonly u: Record<string, IUniform>;
  private readonly scene = new Scene();
  private readonly copyScene = new Scene();
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly target: WebGLRenderTarget;
  private readonly size = new Vector2();

  constructor(hdr = true) {
    this.target = new WebGLRenderTarget(1, 1, { type: hdr ? HalfFloatType : UnsignedByteType, depthBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter });
    this.u = {
      uZenith: { value: new Color() }, uLow: { value: new Color() }, uSunC: { value: new Color() }, uCloudC: { value: new Color() },
      uStage: { value: new Vector3() }, uGround: { value: new Color() }, uSun: { value: new Vector2() },
      uHorizon: { value: .5 }, uAmount: { value: 0 }, uSunI: { value: 0 }, uSunS: { value: .1 }, uCloud: { value: 0 },
      uTime: { value: 0 }, uAspect: { value: 1 }, uLevel: { value: SKY_LEVEL },
    };
    const geometry = new PlaneGeometry(2, 2);
    const sky = new Mesh(geometry, new ShaderMaterial({ glslVersion: GLSL3, uniforms: this.u, depthTest: false, depthWrite: false, ...skyShaders }));
    // on the far plane, depth-tested (less or equal): written only where no grain is
    const copy = new Mesh(geometry, new ShaderMaterial({ glslVersion: GLSL3, uniforms: { uTex: { value: this.target.texture } }, depthTest: true, depthWrite: false, ...skyCopyShaders }));
    sky.frustumCulled = copy.frustumCulled = false;
    this.scene.add(sky); this.copyScene.add(copy);
  }

  /** Both programs, against the targets they draw to; `main` is the HDR target. */
  compile(renderer: WebGLRenderer, one: CompileOne, main: WebGLRenderTarget): Promise<unknown> {
    renderer.setRenderTarget(this.target); const a = one(this.scene, this.camera);
    renderer.setRenderTarget(main); const b = one(this.copyScene, this.camera);
    return Promise.all([a, b]);
  }

  /** The sky at low resolution, into its own target (call before binding the HDR target). */
  render(renderer: WebGLRenderer, f: SkyFrame): void {
    const b = renderer.getDrawingBufferSize(this.size), w = Math.max(1, Math.ceil(b.x / SCALE)), h = Math.max(1, Math.ceil(b.y / SCALE));
    if (this.target.width !== w || this.target.height !== h) this.target.setSize(w, h);
    const u = this.u, s = f.state;
    (u.uZenith!.value as Color).copy(s.zenith); (u.uLow!.value as Color).copy(s.low); (u.uGround!.value as Color).copy(s.ground);
    (u.uSunC!.value as Color).copy(s.sunColour); (u.uCloudC!.value as Color).copy(s.cloudColour);
    (u.uSun!.value as Vector2).copy(s.sun); (u.uStage!.value as Vector3).copy(f.stage);
    u.uHorizon!.value = s.horizon; u.uAmount!.value = s.amount; u.uSunI!.value = s.sunIntensity; u.uSunS!.value = s.sunSize;
    u.uCloud!.value = s.clouds; u.uTime!.value = f.time; u.uAspect!.value = f.aspect;
    renderer.setRenderTarget(this.target);
    renderer.render(this.scene, this.camera);
  }

  /** Stretches it over the current target where nothing has been drawn (no clear; after the grains). */
  draw(renderer: WebGLRenderer): void { renderer.render(this.copyScene, this.camera); }
}
