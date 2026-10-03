import { fr } from './math';
import { nz3 } from './normals';
import type { DerivedWorld } from './types';

// The display, seen as what it is made of (v15). Every sub-pixel of the display is a cluster of
// grains; here the cluster spreads over (slightly past) the area its sub-pixel lit, on a sand
// surface 1.36 times the screen's size. Sub-pixel colours become mineral families inside one sand
// palette (22 red → feldspar tint, 23 green → olive, 24 blue → cool quartz); the glass becomes
// plain sand: mostly quartz tones on faint wind ripples, a few dark minerals, a few bright clear
// grains. RNG order per grain is the reference's.
export const now: DerivedWorld = {
  kind: 'derived',
  derive({ rnd, tone }, prev, N) {
    const P0 = prev.P, W0 = prev.W, S = 1.36;
    const P = new Float32Array(N * 3), W = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const x = P0[i * 3]!, y = P0[i * 3 + 1]!, f = Math.floor(W0[i]! + .001);
      let fx: number, fy: number;
      if (f === 9) {
        const cx = -9.9 + Math.round((x + 9.9) / .3) * .3, cy = -5.9 + Math.round((y + 5.9) / .3) * .3, g = (): number => (rnd() + rnd() + rnd() - 1.5) * .26;
        fx = (cx + (rnd() - .5) * .3 + g()) * S; fy = (cy + (rnd() - .5) * .3 + g()) * S;
      } else { fx = x * S + (rnd() - .5) * .05; fy = y * S + (rnd() - .5) * .05; }
      P[i * 3] = fx; P[i * 3 + 1] = fy; P[i * 3 + 2] = rnd() * .06;
      const fam = f === 9 ? Math.min(2, Math.floor(fr(W0[i]!) * 3)) : -1;
      const u = rnd(), ripple = .5 + .5 * Math.sin(fx * 2.1 + Math.sin(fy * .6) * 1.6);
      W[i] = fam >= 0 ? 22 + fam + Math.min(.99, Math.max(0, .35 + .45 * ripple + (rnd() - .5) * .3))
        : u < .05 ? .03 + rnd() * .05 : u < .09 ? .97 : tone(.42 + .32 * ripple, .22);
    }
    return { P, W };
  },
  // grains lying on a surface: upward (towards the viewer), each tilted a little by a hash of its place
  normal: (_ctx, x, y) => {
    const h1 = fr(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) - .5, h2 = fr(Math.sin(x * 39.346 + y * 11.135) * 24634.634) - .5;
    return nz3([h1 * .7, h2 * .7, 1]);
  },
  hero: () => [0, 0, .62], // hovering just above the sand
};
