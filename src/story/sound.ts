// The sound of each chapter (values from reference/v23-sound.html). Data only: audio/ plays it.
// A quiet, melancholic accompaniment: it accompanies, never leads. Music sits beneath the ambience.

/**
 * One chord per chapter (MIDI notes, already voiced for its register): Nature in D minor, low and
 * warm; Industry cooler and a little higher; Now high and glassy; the end returns to the opening
 * chord, an octave higher.
 */
export const CHORDS: Readonly<Record<string, readonly number[]>> = {
  magma: [38, 45, 53, 57, 64],   // Dm9 — D A F A E
  granite: [34, 46, 50, 53, 57], // B♭maj7
  river: [41, 48, 53, 55, 57],   // Fadd9
  coast: [36, 43, 50, 55, 62],   // Csus2
  desert: [43, 50, 53, 57, 58],  // Gm9
  again: [38, 45, 50, 53, 64],   // Dm(add9) — home again, before the cycle breaks
  quarry: [45, 52, 55, 60, 64],  // Am7
  furnace: [41, 48, 52, 57, 59], // Fmaj7♯11
  purity: [48, 55, 59, 64, 67],  // Cmaj7
  crystal: [52, 55, 59, 62, 67], // Em7
  wafer: [45, 52, 59, 60, 64],   // Am(add9)
  light: [48, 55, 59, 62, 64],   // Cmaj9
  chip: [53, 60, 64, 67, 69],    // Fmaj7, high
  display: [57, 64, 67, 71, 72], // Am9, high
  now: [50, 57, 62, 65, 69],     // Dm(add9) — the opening chord, an octave higher
};

/** The sound's three acts (not quite the story's acts: chip is already "Now" here). */
export interface ActSound {
  /** FM ratio and index of the notes (timbre), their lowpass */
  ratio: number; index: number; lp: number;
  /** seconds between notes, [min, max] */
  gap: readonly [number, number];
  /** pad brightness (lowpass) */
  padLP: number;
  /** the notes' register, MIDI [low, high] */
  reg: readonly [number, number];
}

export const ACTS: readonly ActSound[] = [
  { ratio: 1, index: 1.1, lp: 2000, gap: [2.6, 5.2], padLP: 650, reg: [50, 69] },   // 0 Nature: electric piano
  { ratio: 2, index: 1.4, lp: 3200, gap: [2.0, 4.2], padLP: 950, reg: [57, 76] },   // 1 Industry
  { ratio: 3.5, index: 1.7, lp: 5200, gap: [2.8, 5.6], padLP: 1500, reg: [64, 84] }, // 2 Now: celesta
];

/** Each chapter's act in the sound. */
export const SOUND_ACT: Readonly<Record<string, 0 | 1 | 2>> = {
  magma: 0, granite: 0, river: 0, coast: 0, desert: 0, again: 0,
  quarry: 1, furnace: 1, purity: 1, crystal: 1, wafer: 1, light: 1,
  chip: 2, display: 2, now: 2,
};

/** Chapters with the soft repeated note (production time passing, like a distant clock). */
export const PULSE: ReadonlySet<string> = new Set(['quarry', 'furnace', 'purity', 'crystal', 'wafer']);

/**
 * Ambience per world: events per second (slow swells: per second too, so .1 ≈ one every ten), their
 * frequency bands, and the water. It tells where we are and sits in front of the music.
 *   thump  a low far thump           crack  a short band of noise (crackF: its band, Hz)
 *   gust   a slow breath of noise    wave   a slow low swell (the sea)
 *   bubble a short high noise burst  metal  a distant metal ring
 *   tick   a tiny dry click (tickF)  brook  bubbles on running water: tiny rising sine tones
 *   bed    the water rush, 0..1 (the only continuous sound, only where there is water)
 */
export interface Ambience {
  thump: number; crack: number; crackF: readonly [number, number];
  gust: number; gustF?: number; wave: number;
  bubble: number; bubF?: readonly [number, number];
  metal: number; tick: number; tickF: number;
  brook?: number; bed?: number;
}

export const AMB: Readonly<Record<string, Ambience>> = {
  magma: { thump: .22, crack: 1.1, crackF: [1800, 4000], gust: 0, wave: 0, bubble: 0, metal: 0, tick: 0, tickF: 7000 },
  granite: { thump: 0, crack: .35, crackF: [2200, 4500], gust: .06, gustF: 4500, wave: 0, bubble: 0, metal: 0, tick: 0, tickF: 7000 },
  river: { thump: 0, crack: 0, crackF: [2500, 4500], gust: 0, wave: 0, bubble: 0, bubF: [2400, 5200], metal: 0, tick: 0, tickF: 7000, brook: 75, bed: .55 },
  coast: { thump: 0, crack: 0, crackF: [2500, 4500], gust: .03, gustF: 5000, wave: .24, bubble: 3, bubF: [3000, 6500], metal: 0, tick: 0, tickF: 7000, brook: 8, bed: .16 },
  desert: { thump: 0, crack: 0, crackF: [3000, 6000], gust: .14, gustF: 6200, wave: 0, bubble: 0, metal: 0, tick: 3, tickF: 6500 },
  again: { thump: .06, crack: .12, crackF: [2000, 4000], gust: .05, gustF: 4000, wave: 0, bubble: 0, metal: 0, tick: 0, tickF: 7000 },
  quarry: { thump: .05, crack: .15, crackF: [2000, 4000], gust: .05, gustF: 3500, wave: 0, bubble: 0, metal: .1, tick: 0, tickF: 7000 },
  furnace: { thump: .16, crack: 2.6, crackF: [2500, 6000], gust: 0, wave: 0, bubble: 0, metal: .04, tick: 0, tickF: 7000 },
  purity: { thump: 0, crack: 0, crackF: [3000, 6000], gust: .1, gustF: 8200, wave: 0, bubble: 0, metal: 0, tick: .5, tickF: 8500 },
  crystal: { thump: 0, crack: 0, crackF: [3000, 6000], gust: .09, gustF: 9000, wave: 0, bubble: 0, metal: 0, tick: .25, tickF: 9500 },
  wafer: { thump: 0, crack: 0, crackF: [3000, 6000], gust: .08, gustF: 8500, wave: 0, bubble: 0, metal: 0, tick: 1.2, tickF: 8000 },
  light: { thump: 0, crack: 0, crackF: [3000, 6000], gust: .08, gustF: 7500, wave: 0, bubble: 0, metal: 0, tick: .6, tickF: 9000 },
  chip: { thump: 0, crack: 0, crackF: [3000, 6000], gust: 0, wave: 0, bubble: 0, metal: 0, tick: 4, tickF: 7500 },
  display: { thump: 0, crack: 0, crackF: [3000, 6000], gust: 0, wave: 0, bubble: 0, metal: 0, tick: 2.5, tickF: 6500 },
  now: { thump: 0, crack: 0, crackF: [3000, 6000], gust: .1, gustF: 5500, wave: 0, bubble: 0, metal: 0, tick: 1, tickF: 6000 },
};

/** Levels (v23): master, the music bus beneath, the ambience bus in front. */
export const LEVELS = { master: .7, music: .42, ambience: 2.2 } as const;
