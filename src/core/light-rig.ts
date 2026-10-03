import { Vector3 } from 'three';
import { LIGHTS, type LightRig } from '../story/lights';
import type { Vec3 } from '../story/types';
import { WORLDS } from '../story/worlds';

/** The light rig as it is this frame: two worlds' rigs blended. */
export interface RigState {
  keyDir: Vector3;
  keyCol: Vector3;
  sky: Vector3;
  ground: Vector3;
  rim: Vector3;
  pointPos: Vector3;
  pointCol: Vector3;
  pointRange: number;
  /** each world's gloss; the shader blends them per grain with its own progress */
  specA: number;
  specB: number;
  /** half-size of the shadow frustum */
  shadow: number;
  /** each world's material look (story/lights.ts); blended per grain like the gloss */
  glowA: number; glowB: number;
  raysA: number; raysB: number;
  pixA: number; pixB: number;
  waterA: number; waterB: number;
  /** depth-of-field scale, blended with the rig */
  dof: number;
}

const rigOf = (i: number): LightRig => {
  const r = LIGHTS[WORLDS[i]!.slug];
  if (!r) throw new Error(`no light rig for "${WORLDS[i]!.slug}"`);
  return r;
};

/** a → b by k, landing exactly on b at k = 1 (rest states must be exact). */
const mix = (out: Vector3, a: Vec3 | Vector3, b: Vec3 | Vector3, k: number): Vector3 => {
  const [ax, ay, az] = a instanceof Vector3 ? [a.x, a.y, a.z] : a, [bx, by, bz] = b instanceof Vector3 ? [b.x, b.y, b.z] : b;
  return k >= 1 ? out.set(bx, by, bz) : out.set(ax + (bx - ax) * k, ay + (by - ay) * k, az + (bz - az) * k);
};
const num = (a: number, b: number, k: number): number => (k >= 1 ? b : a + (b - a) * k);

/**
 * Blends the light rigs of worlds a and b by k (the camera's easing; transitions may delay it,
 * story/transitions.ts `rig`). The point light rides with each world's hero grain.
 */
export class LightRigBlend {
  readonly state: RigState = {
    keyDir: new Vector3(0, 1, 0), keyCol: new Vector3(), sky: new Vector3(), ground: new Vector3(), rim: new Vector3(),
    pointPos: new Vector3(), pointCol: new Vector3(), pointRange: 1, specA: .3, specB: .3, shadow: 16,
    glowA: 0, glowB: 0, raysA: 1, raysB: 1, pixA: 1, pixB: 1, waterA: 0, waterB: 0, dof: 1,
  };
  private readonly ka = new Vector3();
  private readonly kb = new Vector3();
  private readonly pa = new Vector3();
  private readonly pb = new Vector3();

  update(a: number, b: number, k: number, heroes: readonly Vector3[]): RigState {
    const ra = rigOf(a), rb = rigOf(b), s = this.state;
    this.ka.set(...ra.key[0]).normalize(); this.kb.set(...rb.key[0]).normalize();
    mix(s.keyDir, this.ka, this.kb, k).normalize();
    mix(s.keyCol, ra.key[1], rb.key[1], k);
    mix(s.sky, ra.sky, rb.sky, k); mix(s.ground, ra.ground, rb.ground, k); mix(s.rim, ra.rim, rb.rim, k);
    this.pa.copy(heroes[a]!).add(new Vector3(...ra.point[0])); this.pb.copy(heroes[b]!).add(new Vector3(...rb.point[0]));
    mix(s.pointPos, this.pa, this.pb, k);
    mix(s.pointCol, ra.point[1], rb.point[1], k);
    s.pointRange = num(ra.point[2], rb.point[2], k);
    s.specA = ra.spec; s.specB = rb.spec;
    s.shadow = num(ra.shadow, rb.shadow, k);
    s.glowA = ra.glow ?? 0; s.glowB = rb.glow ?? 0; s.raysA = ra.rays ?? 1; s.raysB = rb.rays ?? 1;
    s.pixA = ra.pix ?? 1; s.pixB = rb.pix ?? 1; s.waterA = ra.water ?? 0; s.waterB = rb.water ?? 0;
    s.dof = num(ra.dof ?? 1, rb.dof ?? 1, k);
    return s;
  }
}
