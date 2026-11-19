import { MathUtils } from 'three';
import type { Vec3, WorldDef } from '../story/types';
import { WORLDS } from '../story/worlds';

// What a world's confinement (story/worlds.ts) means on screen. All of it is linear in the
// confinement value, so interpolating these per-world values with the camera's easing (core/loop.ts)
// is the same as interpolating the confinement itself.

/** Vertical field of view, degrees: 48° natural, 30° fully confined (telephoto). */
export const lensFor = (c: number): number => 48 - 18 * c;
/** Portrait screens get this much more field of view. */
export const PORTRAIT_EXTRA_DEG = 9;
/** Wider screens than this crop top and bottom instead of showing more of the sides (and the worlds' edges). */
export const MAX_ASPECT = 2;
/**
 * Title and clock axes. They used to follow confinement (wide and light while time is slow, condensed and
 * heavy as it compresses, v15), but two outside reviews read the narrowing through industry as a font
 * failing to load, even once it was animated in view (Awwwards P3): since Awwwards P4 one width and
 * weight for every chapter; confinement is carried by the lens and the framing alone.
 */
export const typeAxesFor = (): { wdth: number; wght: number } => ({ wdth: 115, wght: 400 });
/** How restless resting matter is (world units of drift). */
export const jitterFor = (c: number): number => (1 - c) * .022;

export interface Confinement { fov: number; wdth: number; wght: number; jitter: number; cam: Vec3 }

/**
 * Per world: the derived values, and the resting camera offset that keeps the blockout
 * composition under the new lens (the blockout shots were framed for a 40° lens) before
 * applying the framing factor.
 */
export const CONFINEMENT: readonly Confinement[] = WORLDS.map((w: WorldDef) => {
  const fov = lensFor(w.conf), { wdth, wght } = typeAxesFor();
  const k = (Math.tan(MathUtils.degToRad(20)) / Math.tan(MathUtils.degToRad(fov / 2))) * w.frame;
  const cam = w.look.map((l, i) => l + (w.cam[i]! - l) * k) as unknown as Vec3;
  return { fov, wdth, wght, jitter: jitterFor(w.conf), cam };
});

/** a + (b − a)·eg, landing exactly on b at eg = 1 (rest states must be exact). */
export const towards = (a: number, b: number, eg: number): number => (eg >= 1 ? b : a + (b - a) * eg);
