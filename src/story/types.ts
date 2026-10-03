// Shapes of the story data. The data files hold numbers only; copy lives in index.html.

export type Vec3 = readonly [number, number, number];
export type ActId = 'nature' | 'industry' | 'now';
export type ClockUnit = 'years' | 'days' | 'ns' | 'ms' | 'now';

export interface WorldDef {
  slug: string;
  act: ActId;
  /** scroll length of the resting segment, in screen heights */
  hold: number;
  /** what the clock reads in this world */
  clock: readonly [value: number, unit: ClockUnit];
  /** palette ramp for grains that use the world palette */
  lo: string;
  hi: string;
  /** grain size, world units */
  grain: number;
  /** camera position and look-at target, as offsets from the hero grain */
  cam: Vec3;
  look: Vec3;
  /** the last chapter: ending sequence, own nav label, own audio act */
  final?: boolean;
}

/**
 * Grain transition styles (uStyle in the shader):
 * 0 rise · 1 fall · 2 flow · 3 wind · 4 bury · 5 cut · 6 pour · 7 heat · 8 spiral
 * 9 slice · 11 dive · 12 beam · 13 raster · 15 crack · 16 expose
 */
export type GrainStyle = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 11 | 12 | 13 | 15 | 16;

export type CamStyle =
  | 'crane' | 'crackdrop' | 'track' | 'fly' | 'sink' | 'cut' | 'pour'
  | 'heat' | 'orbit' | 'slide' | 'top' | 'zoom' | 'beam' | 'pullback';

export interface TransitionDef {
  g: GrainStyle;
  cam: CamStyle;
  /** scroll length, in screen heights */
  len: number;
  k?: number;
  span?: number;
  spread?: number;
  dir?: Vec3;
  /** orbit centre (x, z) */
  axis?: readonly [number, number];
  /** bezier handles for the hero grain, offsets from hero A and hero B */
  hero?: readonly [Vec3, Vec3];
}
