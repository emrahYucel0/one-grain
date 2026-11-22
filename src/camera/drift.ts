import { Vector3 } from 'three';
import { ss } from '../core/ease';
import type { WorldDef } from '../story/types';
import { meander } from '../worlds/shapes';

/**
 * Awwwards P9: the river carries the camera (story/types.ts drift). From the resting shot it comes down onto
 * the water and drifts downstream along the meander's line (worlds/shapes.ts), looking on down the bend.
 * `run` is how far through the hold (0 → 1, beyond 1 into the transition): the way downstream eases in from
 * still and leaves at a steady speed (2r² − r³, then straight on); the descent is done by a third of the way.
 * Writes the camera, the look and the focus point into pos, look and focus.
 */
/** How far the camera has come down onto the water (0 → 1 over the first part of the hold). */
export const driftDown = (run: number): number => ss(0, .38, Math.max(0, run));

export function drift(w: WorldDef, run: number, rest: Vector3, restLook: Vector3, pos: Vector3, look: Vector3, focus: Vector3): void {
  const d = w.drift!, r = Math.max(0, run);
  const along = r <= 1 ? r * r * (2 - r) : r;
  const x = rest.x + (d.to - rest.x) * along, ax = x + d.ahead, down = driftDown(r);
  pos.set(x, d.height, meander(x));
  look.set(ax, .1, meander(ax));
  focus.copy(look);
  pos.lerpVectors(rest, pos, down);
  look.lerpVectors(restLook, look, down);
}
