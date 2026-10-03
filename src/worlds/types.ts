import type { GenContext } from './context';
import type { V3 } from './shapes';

/**
 * Behaviour codes live in the integer part of a grain's w; the fraction is its palette tone.
 * 0 still · 1 river · 2 sea · 3 hop · 4 fall · 5 magma · 7 spark · 8 switch · 9 sub-pixel
 * 10 wind streamer · 11 pressure · 12 conveyor · 13 convection · 14 deposition
 * 15 turning crystal · 17 light ray · 18 wire pulse · 19 clock tree
 */

/** Positions (xyz per grain) and behaviour.tone per grain. */
export interface Grains<T extends Float32Array | Float64Array = Float32Array> {
  P: T;
  W: T;
}

/** Collects exactly N grains, in double precision (as the reference's JS arrays). */
export class GrainWriter {
  readonly P: Float64Array;
  readonly W: Float64Array;
  private n = 0;
  readonly N: number;
  constructor(N: number) { this.N = N; this.P = new Float64Array(N * 3); this.W = new Float64Array(N); }
  add(x: number, y: number, z: number, w: number): void {
    const i = this.n++;
    this.P[i * 3] = x; this.P[i * 3 + 1] = y; this.P[i * 3 + 2] = z; this.W[i] = w;
  }
  done(): Grains<Float64Array> {
    if (this.n !== this.N) throw new Error(`generator wrote ${this.n} of ${this.N} grains`);
    return { P: this.P, W: this.W };
  }
}

/** Extra state a derived world hands to the next one (wafer → light: which disc each grain is in). */
export interface Carry { disc?: Int8Array }

/** A world built from scratch. Generation order inside generate() is part of the spec. */
export interface BaseWorld {
  kind: 'base';
  generate(ctx: GenContext, N: number): Grains<Float64Array>;
  hero(ctx: GenContext): V3;
}

/** A world made by moving the previous world's grains (same grain order). */
export interface DerivedWorld {
  kind: 'derived';
  derive(ctx: GenContext, prev: Grains & Carry, N: number): Grains & Carry;
  hero(ctx: GenContext): V3;
}

export type WorldGenerator = BaseWorld | DerivedWorld;
