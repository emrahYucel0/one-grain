import type { Rng } from './rng';

/** 2D simplex noise, permutation drawn from the shared stream (the reference's first 255 draws). */
export type Noise2 = (x: number, y: number) => number;

const GR: readonly (readonly [number, number])[] = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
const F2 = .5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;

export function createNoise(rnd: Rng): Noise2 {
  const perm = new Uint8Array(512);
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [p[i], p[j]] = [p[j]!, p[i]!]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]!;

  return (xin, yin) => {
    const s = (xin + yin) * F2, i = Math.floor(xin + s), j = Math.floor(yin + s), t = (i + j) * G2;
    const x0 = xin - (i - t), y0 = yin - (j - t), i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2, ii = i & 255, jj = j & 255;
    let n = 0, q: number, g: readonly [number, number];
    q = .5 - x0 * x0 - y0 * y0; if (q > 0) { q *= q; g = GR[perm[ii + perm[jj]!]! & 7]!; n += q * q * (g[0] * x0 + g[1] * y0); }
    q = .5 - x1 * x1 - y1 * y1; if (q > 0) { q *= q; g = GR[perm[ii + i1 + perm[jj + j1]!]! & 7]!; n += q * q * (g[0] * x1 + g[1] * y1); }
    q = .5 - x2 * x2 - y2 * y2; if (q > 0) { q *= q; g = GR[perm[ii + 1 + perm[jj + 1]!]! & 7]!; n += q * q * (g[0] * x2 + g[1] * y2); }
    return 70 * n;
  };
}
