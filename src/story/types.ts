// Shapes of the story data. The data files hold numbers only; copy lives in index.html.

export type Vec3 = readonly [number, number, number];
export type ActId = 'nature' | 'industry' | 'now';
export type ClockUnit = 'years' | 'prod' | 'live' | 'now';

/**
 * The clock has one meaning: time elapsed on the grain's journey.
 * years: a number, log-interpolated between chapters; a chapter may also carry a label in
 *   index.html (data-clock), shown instead while resting there.
 * prod: production time; the label always comes from index.html.
 * now: the final chapter only.
 */
export type WorldClock = { unit: 'years'; value: number } | { unit: 'prod' } | { unit: 'live' } | { unit: 'now' };

export interface WorldDef {
  slug: string;
  act: ActId;
  /** scroll length of the resting segment, in screen heights */
  hold: number;
  /** what the clock reads in this world (labels live in index.html) */
  clock: WorldClock;
  /** palette ramp for grains that use the world palette */
  lo: string;
  hi: string;
  /** grain size, world units */
  grain: number;
  /** camera position and look-at target, as offsets from the hero grain (blockout composition) */
  cam: Vec3;
  look: Vec3;
  /**
   * CONFINEMENT, 0 natural and unbounded … 1 fully controlled. Nature fills the frame; industry
   * concentrates matter until the crystal stands alone; computation opens the space again; the
   * end fills your screen. Drives the lens, camera distance, resting restlessness and the type
   * axes (camera/confinement.ts). Not colour.
   */
  conf: number;
  /** framing against the blockout shot, applied after the lens change (> 1: the subject owns less of the frame) */
  frame: number;
  /** the last chapter: ending sequence, own nav label, own audio act */
  final?: boolean;
}

/**
 * Grain transition styles (uStyle in the shader):
 * 0 rise · 2 flow · 4 bury · 5 cut · 9 slice · 11 dive · 12 beam · 13 raster · 15 crack
 * 16 expose · 17 drift · 18 break · 19 separate · 20 grow
 * (numbers are kept stable; styles no transition used any more were removed and live in git history)
 */
export type GrainStyle = 0 | 2 | 4 | 5 | 9 | 11 | 12 | 13 | 15 | 16 | 17 | 18 | 19 | 20 | 21;

/** Camera moves (camera/shot.ts). */
export type CamStyle =
  | 'crane' | 'crackdrop' | 'track' | 'drift' | 'sink' | 'cut' | 'breakfall' | 'rise'
  | 'orbit' | 'slide' | 'top' | 'zoom' | 'beam' | 'pullback' | 'macro';

export interface TransitionDef {
  g: GrainStyle;
  cam: CamStyle;
  /** scroll length, in screen heights */
  len: number;
  k?: number;
  span?: number;
  spread?: number;
  dir?: Vec3;
  /** orbit centre (x, z), for the camera */
  axis?: readonly [number, number];
  /** bezier handles for the hero grain, offsets from hero A and hero B */
  hero?: readonly [Vec3, Vec3];
  /**
   * Not in the reference: during the move the camera turns to look at a subject that starts at
   * `at` and climbs by `rise` over the part `over` of the move (smoothstep). The turn eases in
   * and out at both ends of the move, so both holds frame exactly as before.
   */
  subject?: { at: Vec3; rise: number; over: readonly [number, number] };
  /** the light rigs blend over this part of the move (smoothstep) instead of with the camera */
  rig?: readonly [number, number];
}
