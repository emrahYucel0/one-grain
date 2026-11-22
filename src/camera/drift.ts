import { Vector3 } from 'three';
import { ss } from '../core/ease';
import type { WorldDef } from '../story/types';
import { meander } from '../worlds/shapes';

/** How far the camera has come down to its line (0 → 1 over the first part of the hold). */
export const driftDown = (run: number): number => ss(DEAD, .38, run);

/** the first sliver of the hold is the resting shot itself (where a jump lands, timeline/segments.ts SNAP_POINTS) */
const DEAD = .04;

type Route = readonly (readonly [number, number])[];
const lengths = new WeakMap<Route, number[]>();
/** the route's corners as distances along it */
const along = (route: Route): number[] => {
  let acc = lengths.get(route);
  if (!acc) {
    acc = [0];
    for (let i = 1; i < route.length; i++) acc.push(acc[i - 1]! + Math.hypot(route[i]![0] - route[i - 1]![0], route[i]![1] - route[i - 1]![1]));
    lengths.set(route, acc);
  }
  return acc;
};
/** x/z at distance s along the route (straight on past either end) */
const at = (route: Route, acc: number[], s: number, out: [number, number]): void => {
  let i = 1; while (i < route.length - 1 && acc[i]! < s) i++;
  const a = route[i - 1]!, b = route[i]!, f = (s - acc[i - 1]!) / (acc[i]! - acc[i - 1]!);
  out[0] = a[0] + (b[0] - a[0]) * f; out[1] = a[1] + (b[1] - a[1]) * f;
};
const q: [number, number] = [0, 0];
/** at distance s, the corners rounded: the route averaged over ±round (a turn, not a kink) */
const smooth = (route: Route, round: number, s: number, out: [number, number]): void => {
  const acc = along(route), n = 8; let x = 0, z = 0;
  for (let k = 0; k <= n; k++) { at(route, acc, s + round * (2 * k / n - 1), q); x += q[0]; z += q[1]; }
  out[0] = x / (n + 1); out[1] = z / (n + 1);
};
const p: [number, number] = [0, 0], l: [number, number] = [0, 0];

/**
 * Awwwards P9: the world carries the camera (story/types.ts drift). From the resting shot it comes down to its
 * line and travels along it, looking on ahead: the river's meander (worlds/shapes.ts), downstream round the
 * bends, or a route of streets (the chip's clock tree, worlds/chip.ts), turning at its corners; looking
 * ahead along the line, the camera turns its head into a bend before it gets there.
 * `run` is how far through the hold (0 → 1, beyond 1 into the transition): the way eases in from still and
 * leaves at a steady speed (2r² − r³, then straight on); the descent is done by a third of the way.
 * Writes the camera, the look and the focus point into pos, look and focus.
 */
export function drift(w: WorldDef, run: number, rest: Vector3, restLook: Vector3, pos: Vector3, look: Vector3, focus: Vector3): void {
  const d = w.drift!, r = Math.max(0, (run - DEAD) / (1 - DEAD)), u = r <= 1 ? r * r * (2 - r) : r, down = driftDown(run);
  if (d.line === 'meander') {
    const x = rest.x + (d.to - rest.x) * u, ax = x + Math.sign(d.to - rest.x) * d.ahead;
    pos.set(x, d.height, meander(x));
    look.set(ax, d.lookY, meander(ax));
  } else {
    const acc = along(d.path), s = acc[acc.length - 1]! * u;
    smooth(d.path, d.round, s, p); smooth(d.path, d.round, s + d.ahead, l);
    pos.set(p[0], d.height, p[1]);
    look.set(l[0], d.lookY, l[1]);
  }
  focus.copy(look);
  pos.lerpVectors(rest, pos, down);
  look.lerpVectors(restLook, look, down);
}
