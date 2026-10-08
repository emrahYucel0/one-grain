import { flags } from '../debug/parity';
import { GLSL3, Matrix3, Mesh, NormalBlending, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, Vector2, Vector3, Vector4, type IUniform, type WebGLRenderer } from 'three';
import { LOUPE, LOUPE_PATTERNS, LOUPE_SHAPES, type LoupeLook } from '../story/loupe';
import { WORLDS } from '../story/worlds';
import { loupeShaders } from '../shaders';

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

/**
 * The loupe's lens (shaders/loupe.glsl): raymarched into its own square of the canvas after the post
 * chain, inside the frame's renderer (no second WebGL context), masked to a circle and blended over the
 * picture (premultiplied alpha). Its ring, connector line and caption are DOM (ui/loupe.ts).
 */
export class LoupePass {
  private readonly u: Record<string, IUniform>;
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly saved = new Vector4();
  private readonly rot = new Matrix3();

  constructor() {
    const side = (s: 'A' | 'B'): Record<string, IUniform> => ({
      [`u${s}1`]: { value: new Vector4() }, [`u${s}2`]: { value: new Vector4() }, [`u${s}3`]: { value: new Vector4() },
      [`uCol${s}`]: { value: new Vector3() }, [`uGlow${s}`]: { value: new Vector3() }, [`uEnv${s}`]: { value: new Vector3() },
    });
    this.u = {
      uRes: { value: new Vector2(1, 1) }, uOrigin: { value: new Vector2() }, uTime: { value: 0 }, uK: { value: 0 }, uOp: { value: 0 },
      uRot: { value: this.rot }, uZero: { value: 0 }, ...side('A'), ...side('B'),
    };
    const material = new ShaderMaterial({
      glslVersion: GLSL3, uniforms: this.u, transparent: true, premultipliedAlpha: true, blending: NormalBlending,
      depthTest: false, depthWrite: false, ...loupeShaders,
    });
    const mesh = new Mesh(new PlaneGeometry(2, 2), material);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
  }

  /** whether the lens's program is compiled (until then nothing is drawn) */
  ready = false;
  private preparing = false;

  /**
   * Compile the lens's program once the scene is running, never in the way of the first frame: it is a
   * raymarcher, and the first screen does not need it. In parallel where the browser can
   * (KHR_parallel_shader_compile); otherwise in an idle moment a few seconds in. ?parity and capture:
   * at once, so every measured frame has it.
   */
  prepare(renderer: WebGLRenderer): void {
    if (this.preparing) return;
    this.preparing = true;
    // compiled and linked now: one invisible draw into a single pixel (a browser links a program at its
    // first draw), so the cost lands here and not in the first frame that shows the loupe
    const now = (): void => {
      renderer.setRenderTarget(null);
      renderer.compile(this.scene, this.camera);
      const auto = renderer.autoClear;
      this.u.uOp!.value = 0;
      renderer.getViewport(this.saved);
      renderer.autoClear = false;
      renderer.setViewport(0, 0, 1, 1);
      renderer.render(this.scene, this.camera);
      renderer.setViewport(this.saved);
      renderer.autoClear = auto;
      this.ready = true;
    };
    if (flags.parity) now();
    else if (renderer.extensions.has('KHR_parallel_shader_compile')) {
      renderer.setRenderTarget(null);
      void renderer.compileAsync(this.scene, this.camera).then(() => { this.ready = true; }, () => {});
    } else setTimeout(() => (typeof requestIdleCallback === 'function' ? requestIdleCallback(now, { timeout: 2000 }) : now()), 3000);
  }

  /** Draws onto the canvas (the current target must be the screen), restoring the viewport after. */
  render(renderer: WebGLRenderer, f: LoupeFrame): void {
    const u = this.u, A = PACKED[f.a]!, B = PACKED[f.b]!, dpr = renderer.getPixelRatio();
    for (const [s, P] of [['A', A], ['B', B]] as const) {
      (u[`u${s}1`]!.value as Vector4).copy(P.m1); (u[`u${s}2`]!.value as Vector4).copy(P.m2); (u[`u${s}3`]!.value as Vector4).copy(P.m3);
      (u[`uCol${s}`]!.value as Vector3).copy(P.col); (u[`uGlow${s}`]!.value as Vector3).copy(P.glow); (u[`uEnv${s}`]!.value as Vector3).copy(P.env);
    }
    u.uK!.value = f.k; u.uOp!.value = f.op; u.uTime!.value = f.time;
    const cy = Math.cos(f.yaw), sy = Math.sin(f.yaw), cx = Math.cos(f.tilt), sx = Math.sin(f.tilt);
    this.rot.set(cy, 0, sy, sx * sy, cx, -sx * cy, -cx * sy, sx, cx * cy); // v27's turn: about y, then tilted about x
    // the lens's square, in CSS pixels from the canvas's bottom left (three scales the viewport by the pixel ratio)
    const h = renderer.domElement.height / dpr, side = 2 * f.r, left = f.x - f.r, bottom = h - f.y - f.r;
    (u.uRes!.value as Vector2).set(Math.round(side * dpr), Math.round(side * dpr));
    (u.uOrigin!.value as Vector2).set(Math.round(left * dpr), Math.round(bottom * dpr));
    renderer.getViewport(this.saved);
    renderer.setViewport(Math.round(left * dpr) / dpr, Math.round(bottom * dpr) / dpr, Math.round(side * dpr) / dpr, Math.round(side * dpr) / dpr);
    renderer.render(this.scene, this.camera);
    renderer.setViewport(this.saved);
  }
}
