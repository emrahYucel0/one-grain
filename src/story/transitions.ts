import type { TransitionDef } from './types';

// TRANSITIONS[i] carries the story from WORLDS[i] to WORLDS[i + 1]. One verb per transition.
export const TRANSITIONS: readonly TransitionDef[] = [
  // rise: magma → granite
  { g: 0, cam: 'crane', len: 1.2, k: 1.2, hero: [[0, 3, 0], [0, 3, 0]] },
  // crack: granite → river
  { g: 15, cam: 'crackdrop', len: 1.4, k: 1.2, hero: [[0, -1, 0], [0, 5, 0]] },
  // carry: river → coast
  { g: 2, cam: 'track', len: 1.0, k: 1.2, dir: [1, 0, 0], hero: [[4, 0, 0], [-4, 0, 0]] },
  // drift: coast → desert, water hands the grain to the wind
  { g: 17, cam: 'drift', len: 1.8, dir: [.93, 0, -.37], hero: [[1, .5, 1], [-3, 3, 0]] },
  // bury: desert → again
  { g: 4, cam: 'sink', len: 1.4, k: 6, span: .5, hero: [[0, -2, 0], [0, 6, 0]] },
  // cut: again → quarry, the interlude ("One day,")
  { g: 5, cam: 'cut', len: .7 },
  // break: quarry → furnace, the rock cracks, falls and feeds the furnace
  { g: 18, cam: 'breakfall', len: 1.6, hero: [[0, 3, 1], [0, 7, 0]] },
  // separate: furnace → purity, heat, vapour, separation, deposition
  { g: 19, cam: 'rise', len: 1.4, hero: [[0, 7, 0], [0, 6, 0]] },
  // grow: purity → crystal, rods melt, a seed touches, order spreads
  // (Phase 2 reframe, beyond v6: keep the melt pool centred, then follow the crystal up out of it;
  //  the subject climbs with the growth front in shaders/transitions.glsl, half the visible height)
  { g: 20, cam: 'orbit', len: 1.7, axis: [0, 0], hero: [[0, -2.5, 0], [0, -1.5, 0]], subject: { at: [0, -.55, 0], rise: 5.7, over: [.45, 1] } },
  // slice: crystal → wafer
  { g: 9, cam: 'slide', len: 1.0, dir: [0, -1, 0], spread: 9, span: .3 },
  // expose: wafer → light
  { g: 16, cam: 'top', len: .9, dir: [1, 0, 0], spread: 4, span: .35 },
  // enter: light → chip
  { g: 11, cam: 'zoom', len: 1.4, span: .7 },
  // emit: chip → display
  { g: 12, cam: 'beam', len: .9, k: 1.2, hero: [[0, 6, 0], [0, -6, 0]] },
  // reveal: display → now
  { g: 13, cam: 'pullback', len: 1.6, span: .25 },
];
