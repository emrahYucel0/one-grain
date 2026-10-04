import { WORLDS } from '../story/worlds';
import { createContext, GENERATORS, type Carry, type Grains } from '../worlds';
import { materialOf } from '../worlds/materials';
import { toHalf } from './half';
import { PACK_VERSION, TEX_WIDTH, rowsFor, type GrainPack } from './pack';

/**
 * Builds every world's grains for one grain count. Pure: same n → same pack, bit for bit.
 *
 * Order is the reference's: one RNG stream, worlds in story order, and after each base world
 * a jittered sort along x so that neighbouring grain ids sit close together in every world
 * (that is what lets a transition sweep across the scene instead of shuffling it).
 */
export function buildPack(n: number, onWorld?: (done: number, total: number) => void): GrainPack {
  const ctx = createContext();
  const CH = WORLDS.length, rows = rowsFor(n);
  const pos = new Float32Array(TEX_WIDTH * rows * CH * 4), surface = new Uint16Array(TEX_WIDTH * rows * CH * 4);
  const heroes = new Float64Array(CH * 3);
  let prev: (Grains & Carry) | null = null;

  WORLDS.forEach((world, c) => {
    const gen = GENERATORS[world.slug];
    if (!gen) throw new Error(`no generator for world "${world.slug}"`);
    let cur: Grains & Carry;
    if (gen.kind === 'derived') {
      if (!prev) throw new Error(`"${world.slug}" derives from a previous world`);
      cur = gen.derive(ctx, prev, n);
    } else {
      cur = sortAlongX(gen.generate(ctx, n), n, ctx.rnd);
    }
    const base = c * rows * TEX_WIDTH * 4, P = cur.P, W = cur.W;
    for (let r = 0; r < n; r++) {
      const o = base + r * 4;
      pos[o] = P[r * 3]!; pos[o + 1] = P[r * 3 + 1]!; pos[o + 2] = P[r * 3 + 2]!; pos[o + 3] = W[r]!;
      // surface: the normal at the resting position (as v10, from the stored float32 values), the material
      const x = pos[o]!, y = pos[o + 1]!, z = pos[o + 2]!, w = pos[o + 3]!, nrm = gen.normal(ctx, x, y, z, w);
      surface[o] = toHalf(nrm[0]); surface[o + 1] = toHalf(nrm[1]); surface[o + 2] = toHalf(nrm[2]); surface[o + 3] = toHalf(materialOf(world.slug, y, w));
    }
    const h = gen.hero(ctx);
    heroes[c * 3] = h[0]; heroes[c * 3 + 1] = h[1]; heroes[c * 3 + 2] = h[2];
    prev = cur;
    onWorld?.(c + 1, CH);
  });

  return { version: PACK_VERSION, n, texWidth: TEX_WIDTH, rows, worlds: CH, heroes, layers: [{ name: 'pos', format: 'rgba32f', data: pos }, { name: 'surface', format: 'rgba16f', data: surface }] };
}

function sortAlongX(g: Grains<Float64Array>, n: number, rnd: () => number): Grains {
  const keys = new Float32Array(n), order = new Uint32Array(n);
  for (let i = 0; i < n; i++) { keys[i] = g.P[i * 3]! + (rnd() - .5) * 1.5; order[i] = i; }
  order.sort((a, b) => keys[a]! - keys[b]!);
  const P = new Float32Array(n * 3), W = new Float32Array(n);
  for (let r = 0; r < n; r++) {
    const j = order[r]!;
    P[r * 3] = g.P[j * 3]!; P[r * 3 + 1] = g.P[j * 3 + 1]!; P[r * 3 + 2] = g.P[j * 3 + 2]!; W[r] = g.W[j]!;
  }
  return { P, W };
}
