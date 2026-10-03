import type { Noise2 } from './noise';
import type { Rng } from './rng';
import { fr, ss } from './math';

export type V3 = [number, number, number];
/** centre, axis, radius, length */
export type CrystalDef = readonly [c: V3, axis: V3, R: number, L: number];

export const CRYSTALS: readonly CrystalDef[] = [
  [[0, -1, 2], [.15, 1, .1], .9, 4], [[-1.6, -1.2, 1], [-.5, 1, .2], .6, 3.2], [[1.5, -1.3, .5], [.6, 1, -.1], .55, 2.8],
  [[-.4, -1.4, -.8], [-.1, 1, -.5], .7, 3.6], [[.7, -1.1, 3.2], [.3, .8, .7], .4, 2], [[-2.6, -1.4, -1.5], [-.7, 1, -.2], .45, 2.4],
  [[2.6, -1.5, -.8], [.8, .9, -.3], .5, 2.6],
];

const norm = (v: V3): V3 => { const l = Math.hypot(...v); return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export const tipOf = (c: V3, axis: V3, R: number, L: number): V3 => {
  const a = norm(axis);
  return [c[0] + a[0] * (L + R * 1.4), c[1] + a[1] * (L + R * 1.4), c[2] + a[2] * (L + R * 1.4)];
};

export const meander = (x: number): number => 2.2 * Math.sin(x * .22);

export interface Shapes {
  /** a random point on a hexagonal quartz prism with a pointed tip */
  hexPrism: (c: V3, axis: V3, R: number, L: number) => V3;
  mountainH: (x: number, z: number) => number;
  riverH: (x: number, z: number) => number;
  beachH: (x: number, z: number) => number;
  duneS: (x: number, z: number) => number;
  desertH: (x: number, z: number) => number;
}

export function createShapes(rnd: Rng, sn: Noise2): Shapes {
  const hexPrism = (c: V3, axis: V3, R: number, L: number): V3 => {
    const a = norm(axis), u = norm(cross(a, Math.abs(a[2]) < .9 ? [0, 0, 1] : [1, 0, 0])), v = cross(a, u);
    const tipL = R * 1.4, theta = rnd() * 6.2832, k = Math.floor(theta / 1.0472), phi = theta - k * 1.0472 - .5236;
    let r = R * .866 / Math.cos(phi), h: number;
    if (rnd() < L / (L + tipL * .5)) h = rnd() * L; else { const s = 1 - Math.sqrt(rnd()); r *= (1 - s); h = L + s * tipL; }
    const ct = Math.cos(theta), st = Math.sin(theta);
    return [c[0] + a[0] * h + (u[0] * ct + v[0] * st) * r, c[1] + a[1] * h + (u[1] * ct + v[1] * st) * r, c[2] + a[2] * h + (u[2] * ct + v[2] * st) * r];
  };
  const mountainH = (x: number, z: number): number => {
    const r2 = x * x + z * z * 1.2;
    const h = 11 * Math.exp(-r2 / 70) * (.8 + .35 * sn(x * .15, z * .15)) + Math.abs(sn(x * .4, z * .4)) * 1.2 * Math.exp(-r2 / 150);
    return Math.max(0, h) + sn(x * .6, z * .6) * .08;
  };
  const riverH = (x: number, z: number): number => { const dz = Math.abs(z - meander(x)); return dz < 1.8 ? -.35 * (1 - ss(0, 1.8, dz)) : 2.2 * ss(1.8, 5.5, dz) + .25 * sn(x * .3, z * .3); };
  const beachH = (x: number, z: number): number => z < 0 ? -z * .12 + .1 * sn(x * .4, z * .4) : -z * .15;
  const duneS = (x: number, z: number): number => { const n = sn(x * .08, z * .08) + sn(x * .21 + 3.1, z * .21 + 3.1) * .45; return fr((x * .38 + z * .92 + n * 2.4) * .2); };
  const desertH = (x: number, z: number): number => { const s = duneS(x, z); return ss(0, .78, s) * (1 - ss(.78, 1, s)) * 1.7 + sn(x * .33 + 7, z * .33) * .2; };
  return { hexPrism, mountainH, riverH, beachH, duneS, desertH };
}
