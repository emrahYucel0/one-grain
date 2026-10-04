/**
 * The sound's randomness (note choice, event timing, noise buffers). Math.random by default;
 * capture mode (src/capture/) seeds it, so an offline render is the same every time.
 */
export let rand: () => number = Math.random;

/** A seeded generator (mulberry32) for every random choice the sound makes from now on. */
export function seedRandom(seed: number): void {
  let s = seed >>> 0;
  rand = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
