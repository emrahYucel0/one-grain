/**
 * The skies, only while the grain is at the surface (values from reference/v27-skies.html): a soft
 * morning over the river, a sunset over the coast, a sunny desert with slowly drifting clouds, and a
 * sky that darkens as the grain is buried (again). Every other world keeps its dark stage.
 * Colours are sRGB hex; positions are on screen (0..1, y up).
 */
export interface Sky {
  /** how much of the sky shows over the stage colour, 0..1 */
  amount: number;
  /** the horizon's height on screen; below it the ground band, so no sky shows between the grains */
  horizon: number;
  ground: string;
  zenith: string;
  /** the sky's colour at the horizon (distant grains fog into it) */
  low: string;
  sun: readonly [x: number, y: number];
  sunColour: string;
  sunIntensity: number;
  sunSize: number;
  /** cloud cover, 0..1 */
  clouds: number;
  cloudColour: string;
}

// river: the sun moved from v27's [.78, .86] (behind the top-right controls) left and down, onto the far bank
export const SKIES: Readonly<Record<string, Sky>> = {
  river: { amount: 1, horizon: .5, ground: '#16211f', zenith: '#2f4d66', low: '#a7bac3', sun: [.47, .82], sunColour: '#fff0d4', sunIntensity: .45, sunSize: .07, clouds: .35, cloudColour: '#dfe5e8' },
  coast: { amount: 1, horizon: .42, ground: '#2b1f22', zenith: '#2a2646', low: '#ee9a5c', sun: [.8, .5], sunColour: '#ffcf8a', sunIntensity: 1.1, sunSize: .05, clouds: .32, cloudColour: '#f0a284' },
  desert: { amount: 1, horizon: .58, ground: '#3a2616', zenith: '#3b76ab', low: '#e4cfae', sun: [.2, .9], sunColour: '#fff3da', sunIntensity: .85, sunSize: .07, clouds: .5, cloudColour: '#ffffff' },
  again: { amount: .5, horizon: .5, ground: '#141016', zenith: '#111827', low: '#3a3247', sun: [.5, .3], sunColour: '#000000', sunIntensity: 0, sunSize: .1, clouds: .12, cloudColour: '#4a4258' },
};

/** The worlds without a sky: nothing over the stage colour. */
export const NO_SKY: Sky = { amount: 0, horizon: .5, ground: '#000000', zenith: '#000000', low: '#000000', sun: [.5, .5], sunColour: '#000000', sunIntensity: 0, sunSize: .1, clouds: 0, cloudColour: '#000000' };
