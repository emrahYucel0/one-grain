import type { TransitionDef } from './types';

// TRANSITIONS[i] carries the story from WORLDS[i] to WORLDS[i + 1].
export const TRANSITIONS: readonly TransitionDef[] = [
  { g: 0, cam: 'crane', len: 1.2, k: 1.2, hero: [[0, 3, 0], [0, 3, 0]] },
  { g: 15, cam: 'crackdrop', len: 1.4, k: 1.2, hero: [[0, -1, 0], [0, 5, 0]] },
  { g: 2, cam: 'track', len: 1.0, k: 1.2, dir: [1, 0, 0], hero: [[4, 0, 0], [-4, 0, 0]] },
  { g: 17, cam: 'fly', len: 1.1, dir: [.93, 0, -.37], hero: [[2, 3, 0], [-3, 4, 0]] },
  { g: 4, cam: 'sink', len: 1.4, k: 6, span: .5, hero: [[0, -2, 0], [0, 6, 0]] },
  { g: 5, cam: 'cut', len: .7 },
  { g: 6, cam: 'pour', len: 1.0, hero: [[0, 6, 0], [0, 8, 0]] },
  { g: 7, cam: 'heat', len: .9, k: 1.5, hero: [[0, 5, 0], [0, 5, 0]] },
  { g: 8, cam: 'orbit', len: 1.3, axis: [0, 0], hero: [[0, 2, 0], [0, -2, 0]] },
  { g: 9, cam: 'slide', len: 1.0, dir: [0, -1, 0], spread: 9, span: .3 },
  { g: 16, cam: 'top', len: .9, dir: [1, 0, 0], spread: 4, span: .35 },
  { g: 11, cam: 'zoom', len: 1.4, span: .7 },
  { g: 12, cam: 'beam', len: .9, k: 1.2, hero: [[0, 6, 0], [0, -6, 0]] },
  { g: 13, cam: 'pullback', len: 1.6, span: .25 },
];
