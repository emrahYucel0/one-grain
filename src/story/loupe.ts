import type { Vec3 } from './types';

/**
 * The loupe (reference v27): the hero grain magnified, at granite, coast, quarry, wafer and display,
 * morphing between chapters as the story moves (render/loupe.ts draws it, ui/loupe.ts places it).
 * Each world has a look, so the morph has somewhere to go on the way in and out; only the worlds with
 * `show` bring the loupe up.
 */
export type LoupeShape =
  /** a natural grain: a quartz crystal, rounded by `round` */
  | 'grain'
  /** a broken lump of stone */
  | 'lump'
  /** a molten drop */
  | 'drop'
  /** a perfect crystal */
  | 'crystal'
  /** a polished disc with its notch */
  | 'disc'
  /** a pixel: a cell behind cover glass */
  | 'pixel';
export const LOUPE_SHAPES: readonly LoupeShape[] = ['grain', 'lump', 'drop', 'crystal', 'disc', 'pixel'];

/** What the surface shows: nothing, the crystal lattice, projected light, a circuit, three sub-pixels. */
export type LoupePattern = 'none' | 'lattice' | 'light' | 'circuit' | 'subpixels';
export const LOUPE_PATTERNS: readonly LoupePattern[] = ['none', 'lattice', 'light', 'circuit', 'subpixels'];

export interface LoupeLook {
  show?: boolean;
  shape: LoupeShape;
  /** 0 a sharp crystal … 1 fully rounded (shape 'grain') */
  round: number;
  /** wear: shallow dents of transport (the surface's large-scale relief) */
  wear: number;
  /** frost: the fine pitting that scatters light, 0..1 */
  frost: number;
  /** polish, 0 matte … 1 mirror-smooth */
  gloss: number;
  /** clear transmission: light refracted through the body, 0..1 */
  glass: number;
  /** cloudiness of what is transmitted: milky quartz scatters inside, 0 clear … 1 milky */
  milk: number;
  /** metallic reflection (silicon), 0..1 */
  metal: number;
  /** self-emission, 0.. */
  emission: number;
  /** mineral speckles (feldspar, mica, iron stains), 0..1 */
  speckle: number;
  /** a ceiling of light panels around it (the factory), which glossy surfaces reflect, 0..1 */
  panels?: number;
  /** turns to and fro instead of round (a face that must stay towards the viewer) */
  sway?: boolean;
  pattern: LoupePattern;
  /** body colour, emission colour, the light around it (linear, may exceed 1) */
  colour: Vec3;
  glow: Vec3;
  env: Vec3;
}

const L = (look: LoupeLook): LoupeLook => look;
const NONE: Vec3 = [0, 0, 0];

/** One per world, in WORLDS order (checked at startup by render/loupe.ts). */
export const LOUPE: readonly LoupeLook[] = [
  // magma: a sharp, clear crystal, lit by the melt
  L({ shape: 'grain', round: 0, wear: 0, frost: 0, gloss: .95, glass: .9, milk: .1, metal: 0, emission: .12, speckle: 0, pattern: 'none', colour: [.86, .9, .95], glow: [1, .42, .12], env: [1, .55, .3] }),
  // granite: translucent quartz, faintly smoky, its faces still sharp
  L({ show: true, shape: 'grain', round: .04, wear: 0, frost: .04, gloss: .95, glass: .95, milk: .12, metal: 0, emission: 0, speckle: 0, pattern: 'none', colour: [.9, .87, .83], glow: NONE, env: [.5, .55, .65] }),
  // river: worn, wet
  L({ shape: 'grain', round: .45, wear: .4, frost: .12, gloss: 1, glass: .5, milk: .45, metal: 0, emission: 0, speckle: .15, pattern: 'none', colour: [.86, .85, .8], glow: NONE, env: [.35, .75, .8] }),
  // coast: rounded by the waves, worn and frosted: a matte, satin surface, light glowing through its edges
  L({ show: true, shape: 'grain', round: .82, wear: .8, frost: .85, gloss: .25, glass: .1, milk: .9, metal: 0, emission: 0, speckle: .35, pattern: 'none', colour: [.9, .84, .74], glow: NONE, env: [.95, .62, .48] }),
  // desert: round, frosted, iron-stained
  L({ shape: 'grain', round: 1, wear: .6, frost: 1, gloss: .12, glass: .05, milk: 1, metal: 0, emission: 0, speckle: .6, pattern: 'none', colour: [.95, .7, .46], glow: NONE, env: [1, .7, .45] }),
  // again: quartzite
  L({ shape: 'grain', round: .6, wear: .5, frost: .55, gloss: .3, glass: .1, milk: .9, metal: 0, emission: 0, speckle: .3, pattern: 'none', colour: [.82, .75, .66], glow: NONE, env: [.8, .6, .45] }),
  // quarry: a broken lump of stone: fresh fracture faces, grains of quartz, feldspar and mica
  L({ show: true, shape: 'lump', round: 0, wear: 0, frost: .5, gloss: .2, glass: 0, milk: 0, metal: 0, emission: 0, speckle: 1, pattern: 'none', colour: [.7, .67, .63], glow: NONE, env: [.65, .68, .72] }),
  // furnace: molten
  L({ shape: 'drop', round: 1, wear: 0, frost: 0, gloss: .6, glass: 0, milk: 0, metal: 0, emission: 1, speckle: 0, pattern: 'none', colour: [1, .5, .15], glow: [1, .5, .16], env: [1, .5, .2] }),
  // purity: polysilicon
  L({ shape: 'lump', round: 0, wear: 0, frost: .25, gloss: .85, glass: 0, milk: 0, metal: .9, emission: 0, speckle: 0, panels: .6, pattern: 'none', colour: [.62, .65, .7], glow: NONE, env: [.7, .75, .85] }),
  // crystal: the perfect lattice
  L({ shape: 'crystal', round: 0, wear: 0, frost: 0, gloss: 1, glass: 0, milk: 0, metal: .95, emission: 0, speckle: 0, panels: .8, pattern: 'lattice', colour: [.7, .73, .8], glow: NONE, env: [.65, .72, .9] }),
  // wafer: a true mirror, the cleanroom's ceiling in it, its notch at the edge
  L({ show: true, shape: 'disc', round: 0, wear: 0, frost: 0, gloss: 1, glass: 0, milk: 0, metal: 1, emission: 0, speckle: 0, panels: 1, pattern: 'none', colour: [.62, .64, .68], glow: NONE, env: [.7, .75, .95] }),
  // light: a pattern of light
  L({ shape: 'disc', round: 0, wear: 0, frost: 0, gloss: .9, glass: 0, milk: 0, metal: .8, emission: .55, speckle: 0, panels: .6, pattern: 'light', colour: [.6, .55, .8], glow: [.72, .55, 1], env: [.6, .5, 1] }),
  // chip: circuits
  L({ shape: 'disc', round: 0, wear: 0, frost: 0, gloss: .8, glass: 0, milk: 0, metal: .7, emission: .45, speckle: 0, panels: .4, sway: true, pattern: 'circuit', colour: [.35, .38, .48], glow: [1, .78, .38], env: [.6, .6, .8] }),
  // display: one pixel: three fine sub-pixels in a black matrix, behind cover glass
  L({ show: true, shape: 'pixel', round: 0, wear: 0, frost: 0, gloss: .95, glass: 0, milk: 0, metal: 0, emission: 1, speckle: 0, panels: .3, sway: true, pattern: 'subpixels', colour: [.04, .04, .045], glow: [1, 1, 1], env: [.6, .6, .7] }),
  // now: sand again
  L({ shape: 'grain', round: 1, wear: .6, frost: 1, gloss: .12, glass: .05, milk: 1, metal: 0, emission: 0, speckle: .6, pattern: 'none', colour: [.9, .76, .58], glow: NONE, env: [.9, .72, .5] }),
];

/**
 * What the loupe must never cover, per world: the scene's main subject, as boxes in world space
 * (min, max) projected each frame. The wafer stack, one box per wafer (worlds/wafer.ts: disc k at
 * x + .25k, height 1.3k, radius 1.6); the display panel (worlds/display.ts).
 */
export const LOUPE_AVOID: Readonly<Record<string, readonly (readonly [Vec3, Vec3])[]>> = {
  wafer: Array.from({ length: 8 }, (_, k) => [[-1.65 + k * .25, k * 1.3 - .06, -1.65], [1.65 + k * .25, k * 1.3 + .06, 1.65]] as const),
  display: [[[-10, -6, -1.3], [10, 6, .1]]],
};

