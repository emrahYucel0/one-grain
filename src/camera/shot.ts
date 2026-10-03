import { Vector3 } from 'three';
import { easeCubic, easeQuint, ss } from '../core/ease';
import type { TransitionDef, Vec3 } from '../story/types';
import { WORLDS } from '../story/worlds';

/** Where the camera is, what it looks at, and where the hero grain is, partway through a transition. */
export interface Shot {
  pos: Vector3;
  look: Vector3;
  hero: Vector3;
  /** eased progress (the camera's own curve: cut, slide, zoom or default) */
  eg: number;
  /** 0 at both ends, 1 midway */
  arc: number;
}

const v = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);
const off = (base: Vector3, a: Vec3): Vector3 => base.clone().add(v(a[0], a[1], a[2]));
const bez = (p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, t: number): Vector3 => {
  const u = 1 - t;
  return p0.clone().multiplyScalar(u * u * u).add(p1.clone().multiplyScalar(3 * u * u * t)).add(p2.clone().multiplyScalar(3 * u * t * t)).add(p3.clone().multiplyScalar(t * t * t));
};
const NO_HERO: readonly [Vec3, Vec3] = [[0, 0, 0], [0, 0, 0]];
/** shots that turn to look at the grain on the way */
const WATCH_HERO = new Set(['crackdrop', 'zoom', 'pour', 'pullback', 'beam', 'breakfall']);

/**
 * The shot director. Each world has a resting camera (cam/look offsets from its hero grain);
 * a transition flies between them on a cubic bezier whose inner handles depend on the style,
 * orbits around an axis, or cuts. While resting, the camera already leans towards the next move
 * (lean, from timeline/segments.ts) and the lean fades out as the move runs, so there is no seam.
 */
export function shot(tr: TransitionDef, a: number, b: number, t: number, heroes: readonly Vector3[], lean = 0, reduced = false): Shot {
  const hA = heroes[a]!, hB = heroes[b]!, wa = WORLDS[a]!, wb = WORLDS[b]!;
  const camA = off(hA, wa.cam), camB = off(hB, wb.cam), lookA = off(hA, wa.look), lookB = off(hB, wb.look);
  let eg = easeCubic(t);
  if (tr.cam === 'cut') eg = t < .5 ? 0 : 1; else if (tr.cam === 'slide') eg = ss(0, 1, t); else if (tr.cam === 'zoom') eg = easeQuint(t);
  const arc = Math.sin(Math.PI * eg), hc = tr.hero ?? NO_HERO;
  const hero = tr.cam === 'cut' ? (eg < .5 ? hA.clone() : hB.clone()) : bez(hA, off(hA, hc[0]), off(hB, hc[1]), hB, eg);
  const d = tr.dir ? v(tr.dir[0], tr.dir[1], tr.dir[2]) : v(1, 0, 0);
  let c1: Vector3, c2: Vector3, pos: Vector3;
  switch (tr.cam) {
    case 'crane': c1 = off(camA, [0, 6, 6]); c2 = off(camB, [0, 10, 8]); break;
    case 'crackdrop': c1 = camA.clone().lerp(hA, .82); c2 = off(hB, [1, 4, 2.5]); break;
    case 'track': c1 = camA.clone().addScaledVector(d, 4); c2 = camB.clone().addScaledVector(d, -4); break;
    case 'fly': c1 = off(hA, [-3, 2.5, 3]); c2 = off(hB, [-5, 6, 6]); break;
    case 'drift': c1 = off(camA, [2, 1, 3]); c2 = off(camB, [-4, 4, 8]); break;
    case 'breakfall': c1 = off(hA, [0, 6, 8]); c2 = off(hB, [0, 12, 7]); break;
    case 'rise': c1 = off(camA, [0, 9, 2]); c2 = off(camB, [0, 8, 4]); break;
    case 'sink': c1 = off(camA, [0, -1, -2]); c2 = off(camB, [0, -8, 0]); break;
    case 'pour': c1 = off(hA, [0, 8, 5]); c2 = off(hB, [0, 11, 6]); break;
    case 'heat': c1 = off(camA, [0, 7, 0]); c2 = off(camB, [0, 7, 2]); break;
    case 'top': c1 = off(camA, [0, 3, 0]); c2 = off(hB, [0, 6, .5]); break;
    case 'zoom': c1 = camA.clone().lerp(hA, .97); c2 = camB.clone().lerp(hB, .97); break;
    case 'beam': c1 = off(camA, [0, 5, 0]); c2 = off(camB, [0, -5, 0]); break;
    case 'pullback': c1 = off(hB, [0, 0, 1.2]); c2 = off(hB, [0, 0, 3]); break;
    default: c1 = camA.clone().lerp(camB, 1 / 3); c2 = camA.clone().lerp(camB, 2 / 3);
  }
  if (tr.cam === 'orbit') {
    const axis = tr.axis ?? [0, 0], ax = v(axis[0], 0, axis[1]);
    const ra = Math.hypot(camA.x - ax.x, camA.z - ax.z), rb = Math.hypot(camB.x - ax.x, camB.z - ax.z);
    const ta = Math.atan2(camA.z - ax.z, camA.x - ax.x); let tb = Math.atan2(camB.z - ax.z, camB.x - ax.x);
    while (tb < ta + Math.PI) tb += Math.PI * 2;
    const th = ta + (tb - ta) * eg, r = ra + (rb - ra) * eg;
    pos = v(ax.x + Math.cos(th) * r, camA.y + (camB.y - camA.y) * eg + arc * 3, ax.z + Math.sin(th) * r);
  } else if (tr.cam === 'cut') pos = eg < .5 ? camA : camB;
  else pos = bez(camA, c1, c2, camB, eg);
  const look = lookA.clone().lerp(lookB, eg);
  if (WATCH_HERO.has(tr.cam)) look.lerp(hero, arc * .9);
  if (tr.subject) { // a reframe beyond the reference: aim at what the move is about
    const { at, rise, over } = tr.subject;
    const subject = v(at[0], at[1] + rise * ss(over[0], over[1], t), at[2]);
    look.lerp(subject, ss(0, .2, t) * (1 - ss(.85, 1, t)));
  }
  if (tr.cam !== 'cut' && !reduced) {
    const toward = camB.clone().sub(camA);
    if (toward.lengthSq() > 1e-4) pos.addScaledVector(toward.normalize(), .6 * (1 - eg) * lean);
  }
  return { pos, look, hero, eg, arc };
}
