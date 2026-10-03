import type { GpuCaps } from './env';

export type TierName = 'low' | 'mid' | 'high';

export interface Tier {
  name: TierName;
  /** grains per world */
  n: number;
  /** device-pixel-ratio cap */
  dpr: number;
}

// low = the reference on small screens, mid = the reference on desktop (parity baseline).
export const TIERS: Readonly<Record<TierName, Tier>> = {
  low: { name: 'low', n: 36000, dpr: 1.5 },
  mid: { name: 'mid', n: 90000, dpr: 1.75 },
  high: { name: 'high', n: 160000, dpr: 2 },
};

const ORDER: readonly TierName[] = ['low', 'mid', 'high'];
const WORLDS = 15, TEX_WIDTH = 1024;

const fits = (t: Tier, caps: GpuCaps): boolean => Math.ceil(t.n / TEX_WIDTH) * WORLDS <= caps.maxTextureSize;

/** Picks the starting tier from screen size and GPU capabilities (or a forced name). */
export function pickTier(caps: GpuCaps, forced: string | null): Tier {
  if (forced && forced in TIERS) return TIERS[forced as TierName];
  let name: TierName = 'mid';
  if (innerWidth < 760 || !caps.performant) name = 'low';
  else {
    const nav = navigator as Navigator & { deviceMemory?: number };
    const strong = (navigator.hardwareConcurrency || 0) >= 8 && (nav.deviceMemory === undefined || nav.deviceMemory >= 8) && caps.maxTextureSize >= 16384;
    if (strong) name = 'high';
  }
  let tier = TIERS[name];
  while (!fits(tier, caps) && tier.name !== 'low') tier = TIERS[ORDER[ORDER.indexOf(tier.name) - 1]!];
  return tier;
}

/** The next tier down, or null at the bottom. */
export const lowerTier = (t: Tier): Tier | null => {
  const i = ORDER.indexOf(t.name);
  return i > 0 ? TIERS[ORDER[i - 1]!] : null;
};

export const pixelRatioFor = (t: Tier): number => Math.min(devicePixelRatio || 1, t.dpr);
