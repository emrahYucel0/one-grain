import { Plane, Raycaster, Vector2, Vector3, type Camera } from 'three';
import { INTERACTIVE } from '../story/worlds';
import { WORLDS } from '../story/worlds';
import type { Pointer } from './pointer';

/** Which hold is hands-on, and how (1 brush the dunes, 2 light the switches). */
const MODES = new Map<number, number>(
  Object.entries(INTERACTIVE).map(([slug, mode]) => [WORLDS.findIndex((w) => w.slug === slug), mode]),
);

const ray = new Raycaster(), plane = new Plane(), up = new Vector3(0, 1, 0), ndc = new Vector2();

export interface InteractionState { mode: number; at: Vector3; press: number }

/**
 * Hands-on holds: while resting on the desert or the chip, the pointer (hover, or a tap on
 * touch screens) is projected onto the ground plane at the hero grain's height.
 */
export function updateInteraction(out: InteractionState, p: Pointer, opts: {
  hold: number; reduced: boolean; heroes: readonly Vector3[]; camera: Camera; now: number;
}): void {
  const tapping = p.tapping(opts.now);
  const mode = !opts.reduced && (p.hovering || tapping) ? MODES.get(opts.hold) ?? 0 : 0;
  p.press += ((tapping ? 1 : 0) - p.press) * .1;
  out.mode = mode; out.press = p.press;
  if (!mode) return;
  plane.set(up, -opts.heroes[opts.hold]!.y);
  ray.setFromCamera(ndc.set(p.nx, p.ny), opts.camera);
  ray.ray.intersectPlane(plane, out.at);
}
