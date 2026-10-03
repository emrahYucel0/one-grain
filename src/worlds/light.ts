import { UP } from './normals';
import { fr } from './math';
import type { DerivedWorld } from './types';

// The bottom disc stays put and gets a printed pattern; grains from the other discs become
// light rays (behaviour 17) falling onto it, or saw dust around it.
export const light: DerivedWorld = {
  kind: 'derived',
  derive({ rnd, tone }, prev, N) {
    const P0 = prev.P, W0 = prev.W, disc = prev.disc;
    if (!disc) throw new Error('light needs the wafer disc map');
    const P = new Float32Array(N * 3), W = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const x = P0[i * 3]!, y = P0[i * 3 + 1]!, z = P0[i * 3 + 2]!, d = disc[i]!;
      if (d === 0) {
        P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z;
        const fx = fr((x + 100) / .2), fz = fr((z + 100) / .2);
        W[i] = fx < .12 || fz < .12 ? .06 : tone(.55 + .3 * Math.sin(x * 3 + z * 2), .05);
      } else if (d > 0 && rnd() < .16) {
        let cx: number, cz: number;
        do { cx = (Math.floor(rnd() * 16) - 8) * .2 + .1; cz = (Math.floor(rnd() * 16) - 8) * .2 + .1; } while (cx * cx + cz * cz > 2.3);
        P[i * 3] = cx + (rnd() - .5) * .04; P[i * 3 + 1] = .3 + rnd() * 2; P[i * 3 + 2] = cz + (rnd() - .5) * .04; W[i] = 17 + rnd() * .99;
      } else if (d > 0) {
        const r = 2.2 + rnd() * 2.5, a = rnd() * 6.2832;
        P[i * 3] = r * Math.cos(a); P[i * 3 + 1] = -.4 - rnd() * .5; P[i * 3 + 2] = r * Math.sin(a); W[i] = tone(.15, .1);
      } else {
        P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z; W[i] = W0[i]!;
      }
    }
    return { P, W };
  },
  normal: () => UP, // flat, upward-facing
  hero: () => [0, .03, 1.12],
};
