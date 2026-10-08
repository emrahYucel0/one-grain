import { flags } from '../debug/parity';
import {
  GLSL3, LinearFilter, Matrix3, Mesh, NoBlending, NormalBlending, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, Vector2, Vector3, Vector4, WebGLRenderTarget,
  type IUniform, type WebGLRenderer,
} from 'three';
import { LOUPE, LOUPE_PATTERNS, LOUPE_SHAPES, type LoupeLook } from '../story/loupe';
import { WORLDS } from '../story/worlds';
import { loupeBlitShaders, loupeShaders } from '../shaders';

/** Where and how the loupe is drawn this frame (ui/loupe.ts). */
export interface LoupeFrame {
  /** the lens's centre and radius on the canvas, CSS pixels from its top left */
  x: number;
  y: number;
  r: number;
  /** opacity, 0..1 (nothing is drawn below .005) */
  op: number;
  /** the two looks (world indices) and the blend between them */
  a: number;
  b: number;
  k: number;
  /** shader time (the molten drop and projected light move with it) */
  time: number;
  /** turning angles, radians: about the vertical, and the tilt that shows the crystal's faces */
  yaw: number;
  tilt: number;
}

if (LOUPE.length !== WORLDS.length) throw new Error(`story/loupe.ts has ${LOUPE.length} looks for ${WORLDS.length} worlds`);

const pack = (l: LoupeLook): { m1: Vector4; m2: Vector4; m3: Vector4; col: Vector3; glow: Vector3; env: Vector3 } => ({
  m1: new Vector4(l.round, l.wear, l.frost, l.gloss),
  m2: new Vector4(l.glass, l.milk, l.metal, l.emission),
  m3: new Vector4(LOUPE_SHAPES.indexOf(l.shape), LOUPE_PATTERNS.indexOf(l.pattern), l.speckle, l.panels ?? 0),
  col: new Vector3(...l.colour), glow: new Vector3(...l.glow), env: new Vector3(...l.env),
});
const PACKED = LOUPE.map(pack);
/** each look's bounding radius in the lens's space (the shapes in shaders/loupe.glsl, divided by 1.6, plus a margin) */
const BOUND = LOUPE.map((l) => ({ grain: 1.42 + (.9 - 1.42) * Math.min(1, l.round / .85) + .09 * l.wear, lump: .95, drop: .8, crystal: 1.42, disc: 1.02, pixel: 1.02 })[l.shape]);

/**
 * The loupe's lens (shaders/loupe.glsl), inside the frame's renderer (no second WebGL context): raymarched
 * into its own small target, then laid over the finished picture in its square of the canvas, masked to a
 * circle (premultiplied alpha). Each frame marches half of the lens's pixels, in a checkerboard of 4×4
 * blocks that alternates (the other half keeps the previous frame's; an integrated GPU shades 16 pixels
 * together, so only whole blocks left out save work), and a quarter of them in a transition, where it
 * moves and fades: the lens turns slowly, so this cuts its cost, peak included, without a visible difference. A new pair of looks, a new size, or a lens that was not on
 * screen the frame before is marched whole. Its ring, connector line and caption are DOM (ui/loupe.ts).
 */
export class LoupePass {
  private readonly u: Record<string, IUniform>;
  private readonly scene = new Scene();
  private readonly blitScene = new Scene();
  private readonly blitU: Record<string, IUniform>;
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly target = new WebGLRenderTarget(1, 1, { depthBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter });
  private readonly saved = new Vector4();
  private readonly rot = new Matrix3();
  /** what the target holds: the looks and size it was marched for, and whether the last frame drew it */
  private held = '';
  private shownLast = false;
  private phase = 0;

  constructor() {
    const side = (s: 'A' | 'B'): Record<string, IUniform> => ({
      [`u${s}1`]: { value: new Vector4() }, [`u${s}2`]: { value: new Vector4() }, [`u${s}3`]: { value: new Vector4() },
      [`uCol${s}`]: { value: new Vector3() }, [`uGlow${s}`]: { value: new Vector3() }, [`uEnv${s}`]: { value: new Vector3() },
    });
    this.u = {
      uRes: { value: new Vector2(1, 1) }, uTime: { value: 0 }, uK: { value: 0 }, uPhase: { value: -1 }, uCycle: { value: 2 },
      uRot: { value: this.rot }, uZero: { value: 0 }, uBound: { value: 1.5 }, ...side('A'), ...side('B'),
    };
    const geometry = new PlaneGeometry(2, 2);
    const march = new Mesh(geometry, new ShaderMaterial({ glslVersion: GLSL3, uniforms: this.u, blending: NoBlending, depthTest: false, depthWrite: false, ...loupeShaders }));
    this.blitU = { uTex: { value: this.target.texture }, uOp: { value: 0 } };
    const blit = new Mesh(geometry, new ShaderMaterial({
      glslVersion: GLSL3, uniforms: this.blitU, transparent: true, premultipliedAlpha: true, blending: NormalBlending, depthTest: false, depthWrite: false, ...loupeBlitShaders,
    }));
    march.frustumCulled = blit.frustumCulled = false;
    this.scene.add(march); this.blitScene.add(blit);
  }

  /** whether the lens's programs are compiled (until then nothing is drawn) */
  ready = false;
  private preparing = false;

  /**
   * Compile the lens's programs once the scene is running, never in the way of the first frame: it is a
   * raymarcher, and the first screen does not need it. In parallel where the browser can
   * (KHR_parallel_shader_compile); otherwise in an idle moment a few seconds in. ?parity and capture:
   * at once, so every measured frame has it.
   */
  prepare(renderer: WebGLRenderer): void {
    if (this.preparing) return;
    this.preparing = true;
    // compiled and linked now: one invisible march of a single pixel (a browser links a program at its
    // first draw), so the cost lands here and not in the first frame that shows the loupe
    const now = (): void => {
      renderer.setRenderTarget(this.target);
      renderer.compile(this.scene, this.camera);
      renderer.render(this.scene, this.camera);
      renderer.setRenderTarget(null);
      renderer.compile(this.blitScene, this.camera);
      this.held = '';
      this.ready = true;
    };
    if (flags.parity) now();
    else if (renderer.extensions.has('KHR_parallel_shader_compile')) {
      renderer.setRenderTarget(this.target);
      const a = renderer.compileAsync(this.scene, this.camera);
      renderer.setRenderTarget(null);
      void Promise.all([a, renderer.compileAsync(this.blitScene, this.camera)]).then(() => { this.ready = true; }, () => {});
    } else setTimeout(() => (typeof requestIdleCallback === 'function' ? requestIdleCallback(now, { timeout: 2000 }) : now()), 3000);
  }

  /** Nothing drawn this frame: the next lens is marched whole. */
  skip(): void { this.shownLast = false; }

  /** Marches (half of) the lens and lays it over the canvas; the current target must be the screen. */
  render(renderer: WebGLRenderer, f: LoupeFrame): void {
    const u = this.u, A = PACKED[f.a]!, B = PACKED[f.b]!, dpr = renderer.getPixelRatio();
    for (const [s, P] of [['A', A], ['B', B]] as const) {
      (u[`u${s}1`]!.value as Vector4).copy(P.m1); (u[`u${s}2`]!.value as Vector4).copy(P.m2); (u[`u${s}3`]!.value as Vector4).copy(P.m3);
      (u[`uCol${s}`]!.value as Vector3).copy(P.col); (u[`uGlow${s}`]!.value as Vector3).copy(P.glow); (u[`uEnv${s}`]!.value as Vector3).copy(P.env);
    }
    u.uK!.value = f.k; u.uTime!.value = f.time;
    u.uBound!.value = Math.max(f.k < 1 ? BOUND[f.a]! : 0, f.k > 0 ? BOUND[f.b]! : 0);
    const cy = Math.cos(f.yaw), sy = Math.sin(f.yaw), cx = Math.cos(f.tilt), sx = Math.sin(f.tilt);
    this.rot.set(cy, 0, sy, sx * sy, cx, -sx * cy, -cx * sy, sx, cx * cy); // v27's turn: about y, then tilted about x
    // the lens's square, in device pixels, and in CSS pixels from the canvas's bottom left (three scales the viewport)
    const px = Math.max(2, Math.round(2 * f.r * dpr)), h = renderer.domElement.height / dpr;
    const left = Math.round((f.x - f.r) * dpr) / dpr, bottom = Math.round((h - f.y - f.r) * dpr) / dpr;
    const key = `${f.a} ${f.b} ${px}`, whole = !this.shownLast || key !== this.held;
    if (this.target.width !== px) this.target.setSize(px, px);
    (u.uRes!.value as Vector2).set(px, px);
    renderer.getViewport(this.saved);
    renderer.setRenderTarget(this.target);
    if (whole) { renderer.setClearColor(0x000000, 0); renderer.clear(); }
    // at rest half the blocks a frame; in a transition, where it moves and fades, a quarter
    const cycle = f.k > 0 && f.k < 1 ? 4 : 2;
    this.phase = (this.phase + 1) % cycle;
    u.uCycle!.value = cycle; u.uPhase!.value = whole ? -1 : this.phase;
    renderer.render(this.scene, this.camera);
    this.held = key; this.shownLast = true;
    renderer.setRenderTarget(null);
    this.blitU.uOp!.value = f.op;
    renderer.setViewport(left, bottom, px / dpr, px / dpr);
    renderer.render(this.blitScene, this.camera);
    renderer.setViewport(this.saved);
  }
}
