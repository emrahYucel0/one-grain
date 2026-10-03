/** xorshift32, as in the reference. One stream feeds every world, in story order. */
export type Rng = () => number;

export const SEED = 4242;

export function createRng(seed: number = SEED): Rng {
  let s = seed;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}
