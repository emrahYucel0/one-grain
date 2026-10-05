import { DataTexture, FloatType, HalfFloatType, NearestFilter, RGBAFormat } from 'three';
import type { GrainPack, LayerName } from '../sim/pack';

/** One float texture per pack layer (32- or 16-bit), sampled with texelFetch (no filtering, no mips). */
export function layerTextures(pack: GrainPack): Map<LayerName, DataTexture> {
  const out = new Map<LayerName, DataTexture>();
  for (const layer of pack.layers) {
    const tex = new DataTexture(layer.data, pack.texWidth, pack.rows * pack.worlds, RGBAFormat, layer.format === 'rgba16f' ? HalfFloatType : FloatType);
    tex.minFilter = tex.magFilter = NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    out.set(layer.name, tex);
  }
  return out;
}

/** Shader defines describing the pack: texture width and one HAS_LAYER_<NAME> per layer. */
/** The layers every pack carries (sim/build.ts), so the grain programs can be compiled before the first pack exists. */
export const PACK_LAYERS: readonly LayerName[] = ['pos', 'surface'];

/** The grain shaders' defines for a layout (the same for every pack: compiled once). */
export const layoutDefines = (texWidth: number, layers: readonly LayerName[]): Record<string, string | number> =>
  Object.fromEntries([['TEX_WIDTH', texWidth], ...layers.map((n) => [`HAS_LAYER_${n.toUpperCase()}`, ''])]);

export function layerDefines(pack: GrainPack): Record<string, string | number> {
  const defines: Record<string, string | number> = { TEX_WIDTH: pack.texWidth };
  for (const layer of pack.layers) defines[`HAS_LAYER_${layer.name.toUpperCase()}`] = '';
  return defines;
}

/** Sampler uniform name for a layer. */
export const layerUniform = (name: LayerName): string => `uLayer_${name}`;
