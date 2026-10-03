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
export function layerDefines(pack: GrainPack): Record<string, string | number> {
  const defines: Record<string, string | number> = { TEX_WIDTH: pack.texWidth };
  for (const layer of pack.layers) defines[`HAS_LAYER_${layer.name.toUpperCase()}`] = '';
  return defines;
}

/** Sampler uniform name for a layer. */
export const layerUniform = (name: LayerName): string => `uLayer_${name}`;
