import type { DerivedWorld } from './types';

// Same grains, same crystal, now in slices. Records which disc each grain ended up in (−1 = saw dust).
export const wafer: DerivedWorld = {
  kind: 'derived',
  derive({ rnd, tone }, prev, N) {
    const P0 = prev.P, W0 = prev.W;
    const P = new Float32Array(N * 3), W = new Float32Array(N), disc = new Int8Array(N);
    for (let i = 0; i < N; i++) {
      const x = P0[i * 3]!, y = P0[i * 3 + 1]!, z = P0[i * 3 + 2]!, f = Math.floor(W0[i]!);
      if (f === 15 && y >= 0 && y < 9) {
        const k = Math.min(7, Math.floor(y / 1.125)), th = Math.atan2(z, x), r = 1.6 * Math.sqrt(rnd());
        P[i * 3] = r * Math.cos(th) + k * .25; P[i * 3 + 1] = k * 1.3 + (rnd() - .5) * .03; P[i * 3 + 2] = r * Math.sin(th);
        W[i] = tone(.55 + .4 * (r / 1.6), .05); disc[i] = k;
      } else {
        const r = 2.2 + rnd() * 2.5, a = rnd() * 6.2832;
        P[i * 3] = r * Math.cos(a); P[i * 3 + 1] = -.4 - rnd() * .5; P[i * 3 + 2] = r * Math.sin(a);
        W[i] = tone(.15, .1); disc[i] = -1;
      }
    }
    return { P, W, disc };
  },
  hero: () => [0, .03, 1.12],
};
