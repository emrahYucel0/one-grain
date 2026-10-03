// float → IEEE 754 half (binary16) bits, round to nearest even, via float32 first (the values
// the reference keeps). Our own so the result is the same in every engine and worker.

const f32 = new Float32Array(1);
const u32 = new Uint32Array(f32.buffer);

export function toHalf(x: number): number {
  f32[0] = x;
  const b = u32[0]!;
  const sign = (b >>> 16) & 0x8000, exp = (b >>> 23) & 0xff;
  let mant = b & 0x7fffff;
  if (exp === 0xff) return sign | 0x7c00 | (mant ? 0x200 : 0); // inf, NaN
  const e = exp - 127 + 15;
  if (e >= 0x1f) return sign | 0x7c00; // too large: inf
  if (e <= 0) { // subnormal half, or zero
    if (e < -10) return sign;
    mant |= 0x800000;
    const shift = 14 - e, rem = mant & ((1 << shift) - 1), halfway = 1 << (shift - 1);
    let h = mant >>> shift;
    if (rem > halfway || (rem === halfway && (h & 1))) h++;
    return sign | h;
  }
  let h = (e << 10) | (mant >>> 13);
  const rem = mant & 0x1fff;
  if (rem > 0x1000 || (rem === 0x1000 && (h & 1))) h++; // a carry into the exponent is the right rounding
  return sign | h;
}
