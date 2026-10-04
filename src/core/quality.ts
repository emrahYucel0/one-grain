import type { GpuCaps } from './env';
import type { LayerSet } from './layers';

export type TierName = 'low' | 'mid' | 'high';

export interface Tier {
  name: TierName;
  /** grains per world */
  n: number;
  /** device-pixel-ratio cap */
  dpr: number;
  /** drawing-buffer budget in pixels, whatever the screen's DPR (4K and Retina must not multiply the cost) */
  pixels: number;
  /** the render layers this tier draws */
  fx: LayerSet;
}

const ALL: LayerSet = { light: true, shadows: true, dof: true, bloom: true, grade: true };

// low = v10 on small screens (no shadows, no depth of field), mid = v10 on desktop (the parity
// baseline). The pixel-ratio caps are v10's: post costs per pixel. high is ours.
export const TIERS: Readonly<Record<TierName, Tier>> = {
  low: { name: 'low', n: 36000, dpr: 1.25, pixels: 1.5e6, fx: { ...ALL, shadows: false, dof: false } },
  mid: { name: 'mid', n: 90000, dpr: 1.4, pixels: 2.2e6, fx: ALL },
  high: { name: 'high', n: 160000, dpr: 1.75, pixels: 4.5e6, fx: ALL },
};

const ORDER: readonly TierName[] = ['low', 'mid', 'high'];
const WORLDS = 15, TEX_WIDTH = 1024;

/** Discrete desktop/laptop GPUs and Apple's larger chips. Integrated graphics stay on mid. */
const DISCRETE_GPU = /nvidia|geforce|quadro|rtx|radeon(\(tm\))? (rx|pro)|apple m\d+ (pro|max|ultra)/i;
/** Apple Silicon: WebGL names it "Apple M…" (Chromium) or "Apple GPU" (Safari). */
const APPLE_SILICON = /apple (m\d|gpu)/i;
/** A Mac, not an iPad (iPadOS reports a Mac user agent but has touch points). */
const isMac = (): boolean => /Macintosh|Mac OS X/.test(navigator.userAgent) && (navigator.maxTouchPoints || 0) <= 1;

/** Phones and small tablets start on low: by the screen's shorter side, so a device gets the same tier either way up. */
const SMALL_SCREEN_PX = 760;
const shortSide = (): number => Math.min(screen.width, screen.height) || Math.min(innerWidth, innerHeight);

const fits = (t: Tier, caps: GpuCaps): boolean => Math.ceil(t.n / TEX_WIDTH) * WORLDS <= caps.maxTextureSize;

/**
 * Picks the starting tier from the device's screen and GPU capabilities (or a forced name). Picked once
 * per visit: turning a phone or resizing the window never changes it (only the frame-time watchdog does).
 */
export function pickTier(caps: GpuCaps, forced: string | null): Tier {
  if (forced && forced in TIERS) return TIERS[forced as TierName];
  let name: TierName = 'mid';
  if (shortSide() < SMALL_SCREEN_PX || !caps.performant) name = 'low';
  else {
    const nav = navigator as Navigator & { deviceMemory?: number };
    const cores = navigator.hardwareConcurrency || 0;
    const discrete = DISCRETE_GPU.test(caps.renderer) && cores >= 8 && (nav.deviceMemory === undefined || nav.deviceMemory >= 8);
    const appleSilicon = APPLE_SILICON.test(caps.renderer) && isMac() && cores >= 8; // MacBook 14/16 and up
    const strong = (discrete || appleSilicon) && caps.maxTextureSize >= 16384;
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

/** The screen's DPR, capped by the tier and by its pixel budget for this window size. */
export const pixelRatioFor = (t: Tier, width = innerWidth, height = innerHeight): number =>
  Math.min(devicePixelRatio || 1, t.dpr, Math.sqrt(t.pixels / Math.max(1, width * height)));

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

  /** Past the warm-up after a (re)build or a step down. */
  warm(now: number): boolean { return now >= this.quietUntil; }

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
