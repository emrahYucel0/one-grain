import type { Vec3 } from './types';

/**
 * The light rig of each world (values from reference/v10-lit.html; starting points, Phase 4b
 * tunes them). Colours are linear and may exceed 1 (HDR).
 */
export interface LightRig {
  /** key light: direction (towards the light, unnormalised) and colour */
  key: readonly [dir: Vec3, colour: Vec3];
  /** hemisphere fill: from above, from below */
  sky: Vec3;
  ground: Vec3;
  /** rim light colour (grazing angles) */
  rim: Vec3;
  /** one point light: offset from the hero grain, colour, range */
  point: readonly [offset: Vec3, colour: Vec3, range: number];
  /** how glossy the world's grains are, 0..1 */
  spec: number;
  /** half-size of the key light's shadow frustum, world units */
  shadow: number;
}

const NONE: LightRig['point'] = [[0, 0, 0], [0, 0, 0], 1];

export const LIGHTS: Readonly<Record<string, LightRig>> = {
  magma: { key: [[-.45, .85, .3], [.8, .86, 1.0]], sky: [.03, .04, .06], ground: [.22, .07, .02], rim: [.16, .2, .3], point: [[-.77, -5.9, -1.5], [1.7, .52, .12], 4.2], spec: .9, shadow: 14 },
  granite: { key: [[-.6, .42, .45], [1.45, 1.15, .9]], sky: [.07, .09, .12], ground: [.03, .025, .02], rim: [.12, .15, .22], point: NONE, spec: .25, shadow: 34 },
  river: { key: [[-.3, .8, .45], [.95, .98, 1.02]], sky: [.06, .09, .12], ground: [.03, .03, .025], rim: [.08, .1, .14], point: NONE, spec: .3, shadow: 18 },
  coast: { key: [[.45, .62, .5], [1.15, 1.02, .86]], sky: [.06, .09, .12], ground: [.04, .035, .03], rim: [.1, .12, .16], point: NONE, spec: .3, shadow: 18 },
  desert: { key: [[-.75, .32, .35], [1.6, 1.15, .75]], sky: [.07, .06, .05], ground: [.06, .04, .025], rim: [.18, .12, .08], point: NONE, spec: .12, shadow: 30 },
  again: { key: [[.7, .45, .55], [1.15, .95, .78]], sky: [.05, .045, .04], ground: [.03, .02, .015], rim: [.1, .08, .06], point: NONE, spec: .15, shadow: 24 },
  quarry: { key: [[-.2, .9, .35], [.85, .88, .92]], sky: [.09, .095, .1], ground: [.04, .04, .04], rim: [.06, .06, .07], point: NONE, spec: .15, shadow: 30 },
  furnace: { key: [[-.3, .9, .2], [.18, .2, .25]], sky: [.02, .02, .025], ground: [.05, .02, .008], rim: [.1, .06, .03], point: [[0, .6, -1], [4.5, 1.7, .45], 6.5], spec: .2, shadow: 18 },
  purity: { key: [[-.3, .9, .25], [1.05, 1.1, 1.18]], sky: [.05, .055, .065], ground: [.02, .02, .025], rim: [.2, .22, .26], point: NONE, spec: .8, shadow: 18 },
  crystal: { key: [[-.6, .72, .38], [1.05, 1.1, 1.2]], sky: [.02, .024, .032], ground: [.012, .01, .009], rim: [.3, .34, .4], point: [[0, -1.25, -1.63], [3.6, 1.5, .45], 3.2], spec: .92, shadow: 14 },
  wafer: { key: [[-.5, .75, .45], [1.15, 1.18, 1.25]], sky: [.04, .045, .055], ground: [.015, .015, .02], rim: [.3, .32, .36], point: NONE, spec: .95, shadow: 10 },
  light: { key: [[0, 1, .15], [.75, .62, 1.2]], sky: [.03, .025, .05], ground: [.01, .008, .02], rim: [.2, .15, .35], point: [[0, 2.5, 0], [1.2, .9, 2.2], 4], spec: .6, shadow: 8 },
  chip: { key: [[-.4, .85, .3], [.45, .5, .62]], sky: [.02, .025, .035], ground: [.01, .01, .012], rim: [.12, .14, .2], point: NONE, spec: .55, shadow: 16 },
  display: { key: [[.3, .6, .75], [.3, .32, .38]], sky: [.02, .02, .03], ground: [.01, .01, .01], rim: [.05, .05, .06], point: NONE, spec: .2, shadow: 16 },
  now: { key: [[0, 0, 1], [0, 0, 0]], sky: [0, 0, 0], ground: [0, 0, 0], rim: [0, 0, 0], point: NONE, spec: 0, shadow: 16 },
};
