import { behaviourOf } from './normals';

/**
 * What each grain is made of: the 'surface' layer's material id (stored in w). A first,
 * deterministic classification from the world and the grain's behaviour; Phase 4b tunes the
 * materials per world. Shading in 4a does not read it yet.
 */
export const MATERIAL = {
  mineral: 0, // rock, sand, sandstone, dust
  water: 1,
  molten: 2,  // magma, melt, sparks
  quartz: 3,  // grown quartz crystals
  silicon: 4, // ingot, wafers, the chip's substrate and switches
  metal: 5,   // wires, vias, the clock tree
  glass: 6,
  light: 7,   // light rays, pixels, the final screen
} as const;

export type MaterialId = (typeof MATERIAL)[keyof typeof MATERIAL];

export function materialOf(slug: string, y: number, w: number): MaterialId {
  const f = behaviourOf(w);
  if (f === 1 || f === 2) return MATERIAL.water;
  if (f === 5 || f === 7 || f === 13) return MATERIAL.molten;
  if (f === 17 || f === 9) return MATERIAL.light;
  if (f === 18 || f === 19) return MATERIAL.metal;
  switch (slug) {
    case 'magma': return MATERIAL.quartz;           // everything that is not magma: the crystals
    case 'crystal': return f === 15 ? MATERIAL.silicon : MATERIAL.mineral; // ingot vs crucible
    case 'wafer': case 'light': return y < -.3 ? MATERIAL.mineral : MATERIAL.silicon; // saw dust lies below the discs (y ≤ −.4)
    case 'chip': return w > .85 && w < .95 ? MATERIAL.metal : MATERIAL.silicon; // vias (.9)
    case 'display': return MATERIAL.glass;
    case 'now': return MATERIAL.light;
    default: return MATERIAL.mineral;
  }
}
