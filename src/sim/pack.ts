// The contract between simulation and rendering. Plain data: no three, no DOM.
//
// Every layer is one RGBA texture (32- or 16-bit float), texWidth wide and rows × worlds tall:
// world c's grains occupy rows [c·rows, (c+1)·rows), grain id → texel (id % texWidth, id / texWidth).
// New layers bump PACK_VERSION; render/ binds layers by name, so adding one never touches
// existing ones.
//
// v1: pos. v2: + surface (Phase 4a).

export const PACK_VERSION = 2;
export const TEX_WIDTH = 1024;

export type LayerName = 'pos' | 'surface';

/**
 * 'pos' (rgba32f): xyz = position, w = behaviour code (integer part) + palette tone (fraction).
 * 'surface' (rgba16f, half-float bits): xyz = surface normal at the resting position, w = material
 * id (worlds/materials.ts). Normals are renormalised in the shader, so half precision is ample.
 */
export type GrainLayer =
  | { name: LayerName; format: 'rgba32f'; data: Float32Array }
  | { name: LayerName; format: 'rgba16f'; data: Uint16Array };

export interface GrainPack {
  version: typeof PACK_VERSION;
  /** grains per world */
  n: number;
  texWidth: number;
  /** texture rows per world */
  rows: number;
  worlds: number;
  /** hero grain position per world, xyz (double precision: the camera is built around it) */
  heroes: Float64Array;
  layers: GrainLayer[];
}

export const rowsFor = (n: number): number => Math.ceil(n / TEX_WIDTH);

export function isGrainPack(x: unknown): x is GrainPack {
  const p = x as Partial<GrainPack> | null;
  return !!p && p.version === PACK_VERSION && Array.isArray(p.layers) && p.heroes instanceof Float64Array;
}

/** Every ArrayBuffer in a pack, for zero-copy postMessage. */
export const transferables = (p: GrainPack): ArrayBuffer[] =>
  [p.heroes.buffer as ArrayBuffer, ...p.layers.map((l) => l.data.buffer as ArrayBuffer)];
