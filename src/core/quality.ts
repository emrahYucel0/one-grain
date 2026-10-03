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

/** Discrete desktop/laptop GPUs and Apple's larger chips. Integrated graphics stay on mid. */
const DISCRETE_GPU = /nvidia|geforce|quadro|rtx|radeon(\(tm\))? (rx|pro)|apple m\d+ (pro|max|ultra)/i;

const fits = (t: Tier, caps: GpuCaps): boolean => Math.ceil(t.n / TEX_WIDTH) * WORLDS <= caps.maxTextureSize;

/** Picks the starting tier from screen size and GPU capabilities (or a forced name). */
export function pickTier(caps: GpuCaps, forced: string | null): Tier {
  if (forced && forced in TIERS) return TIERS[forced as TierName];
  let name: TierName = 'mid';
  if (innerWidth < 760 || !caps.performant) name = 'low';
  else {
    const nav = navigator as Navigator & { deviceMemory?: number };
    const strong = DISCRETE_GPU.test(caps.renderer) && (navigator.hardwareConcurrency || 0) >= 8 &&
      (nav.deviceMemory === undefined || nav.deviceMemory >= 8) && caps.maxTextureSize >= 16384;
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

/**
 * Frame-time watchdog. 60 fps is the target; the budget is the point below which fewer grains
 * are a better deal than a stuttering story. Uses the median of 2 s windows (robust to vsync
 * quantisation and one-off hitches) and only complains after two bad windows in a row.
 */
export class FrameMonitor {
  static readonly BUDGET_MS = 25;
  static readonly WINDOW_MS = 2000;
  static readonly WARMUP_MS = 3000;
  private samples: number[] = [];
  private windowStart = -1;
  private bad = 0;
  private last = -1;
  private quietUntil = 0;
  /** median of the last complete window, for the debug overlay */
  median = 0;

  constructor() {
    document.addEventListener('visibilitychange', () => this.reset(performance.now()));
  }

  /** Ignore the next few seconds (after a build or a swap, when frames are not representative). */
  reset(now: number): void {
    this.samples = []; this.windowStart = -1; this.bad = 0; this.last = -1; this.quietUntil = now + FrameMonitor.WARMUP_MS;
  }

  /** Feed one frame; returns true when the budget has been blown long enough. */
  sample(now: number): boolean {
    const dt = this.last < 0 ? -1 : now - this.last;
    this.last = now;
    if (dt < 0 || document.hidden || now < this.quietUntil) return false;
    if (this.windowStart < 0) this.windowStart = now;
    this.samples.push(dt);
    if (now - this.windowStart < FrameMonitor.WINDOW_MS) return false;
    const sorted = this.samples.sort((a, b) => a - b);
    this.median = sorted[sorted.length >> 1]!;
    this.samples = []; this.windowStart = now;
    this.bad = this.median > FrameMonitor.BUDGET_MS ? this.bad + 1 : 0;
    return this.bad >= 2;
  }
}
