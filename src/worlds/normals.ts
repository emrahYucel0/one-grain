import type { V3 } from './shapes';

// Surface normals, as v10 computes them (reference/v10-lit.html, surfaceNormal). Each world's
// generator has a normal(ctx, x, y, z, w) that uses these helpers on its resting positions.

export const UP: V3 = [0, 1, 0];
export const FRONT: V3 = [0, 0, 1];

/** Unit vector; a zero vector stays zero. */
export const nz3 = (v: V3): V3 => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

/** Normal of a height field y = f(x, z), by central differences. */
export const heightNormal = (f: (x: number, z: number) => number, x: number, z: number): V3 => {
  const e = .05;
  return nz3([-(f(x + e, z) - f(x - e, z)) / (2 * e), 1, -(f(x, z + e) - f(x, z - e)) / (2 * e)]);
};

/** The behaviour code in a grain's w. */
export const behaviourOf = (w: number): number => Math.floor(w + .001);
