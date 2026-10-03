import { createNoise, type Noise2 } from './noise';
import { createRng, SEED, type Rng } from './rng';
import { createShapes, type Shapes } from './shapes';

/** Everything a generator may draw on. One context per build: its stream is consumed in story order. */
export interface GenContext {
  rnd: Rng;
  sn: Noise2;
  /** a palette position with a little random jitter (consumes one draw) */
  tone: (t: number, j?: number) => number;
  shapes: Shapes;
}

export function createContext(seed: number = SEED): GenContext {
  const rnd = createRng(seed);
  const sn = createNoise(rnd);
  const tone = (t: number, j = .08): number => Math.min(.99, Math.max(0, t + (rnd() - .5) * j));
  return { rnd, sn, tone, shapes: createShapes(rnd, sn) };
}
