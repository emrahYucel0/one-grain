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
  /** the budget never takes the pixel ratio below this (high: never under the screen's own pixels) */
  dprFloor: number;
  /** the render layers this tier draws */
  fx: LayerSet;
}

const ALL: LayerSet = { light: true, shadows: true, dof: true, bloom: true, grade: true };

// low = v10 on small screens (no shadows, no depth of field), mid = v10 on desktop (the parity
// baseline). The pixel-ratio caps are v10's: post costs per pixel. high is ours.
export const TIERS: Readonly<Record<TierName, Tier>> = {
  low: { name: 'low', n: 36000, dpr: 1.25, pixels: 1.5e6, dprFloor: 0, fx: { ...ALL, shadows: false, dof: false } },
  mid: { name: 'mid', n: 90000, dpr: 1.4, pixels: 2.2e6, dprFloor: 0, fx: ALL },
  high: { name: 'high', n: 160000, dpr: 1.75, pixels: 4.5e6, dprFloor: 1, fx: ALL },
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

/** The next tier up, or null at the top. */
export const upperTier = (t: Tier): Tier | null => {
  const i = ORDER.indexOf(t.name);
  return i < ORDER.length - 1 ? TIERS[ORDER[i + 1]!] : null;
};

/** The next tier down, or null at the bottom. */
export const lowerTier = (t: Tier): Tier | null => {
  const i = ORDER.indexOf(t.name);
  return i > 0 ? TIERS[ORDER[i - 1]!] : null;
};

/** The screen's DPR, capped by the tier and by its pixel budget for this window size (not below the tier's floor). */
export const pixelRatioFor = (t: Tier, width = innerWidth, height = innerHeight): number =>
  Math.min(devicePixelRatio || 1, t.dpr, Math.max(t.dprFloor, Math.sqrt(t.pixels / Math.max(1, width * height))));

/** A window's verdict: step down or back up, with the evidence. */
export interface Verdict { dir: 'down' | 'up'; reason: string; gpu: number | null; frame: number }

const median = (a: number[]): number => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]!; };

/**
 * Frame-cost watchdog. Judges 2 s windows of frame intervals and, where the GPU timer exists
 * (EXT_disjoint_timer_query_webgl2), of our own GPU time per frame.
 *   - Warm-up: nothing is judged for 8 s after the first rendered frame, nor for 3 s after a quality
 *     step or a tab switch; a window that overlaps grain generation, a shader compile or a texture
 *     upload (busy()) is thrown away.
 *   - Down, with the timer: our GPU time over budget in two windows in a row. Long frame intervals
 *     with our GPU time within budget are external (another app, a screen recorder): fewer grains
 *     would not help, so nothing happens (`external`).
 *   - Down, without the timer: the frame interval over budget in three windows in a row.
 *   - Up: resting on a chapter, comfortably under budget (GPU under 65 %, or without the timer the
 *     frame interval under 75 %) for 10 s in a row. The tier manager decides whether a step back is due.
 */
export class FrameMonitor {
  static readonly BUDGET_MS = 25;
  static readonly WINDOW_MS = 2000;
  static readonly WARMUP_MS = 8000;
  static readonly SETTLE_MS = 3000;
  static readonly RECOVER_MS = 10000;
  static readonly COMFORT_GPU = .65;
  static readonly COMFORT_FRAME = .75;
  /** whether our GPU time is measured (EXT_disjoint_timer_query_webgl2) */
  readonly gpu: boolean;
  /** the last complete window: median frame interval and GPU time (ms; gpu NaN without the timer) */
  frame = 0;
  gpuMs = NaN;
  /** the last window was slow for a reason outside our control */
  external = false;
  private intervals: number[] = [];
  private gpuSamples: number[] = [];
  private windowStart = -1;
  private last = -1;
  private quietUntil = Infinity;
  private dirty = false;
  private allResting = true;
  private bad = 0;
  private comfortSince = -1;

  constructor(gpu: boolean) {
    this.gpu = gpu;
    document.addEventListener('visibilitychange', () => this.reset(performance.now()));
  }

  /** The first rendered frame: judge nothing for the warm-up. */
  start(now: number): void { this.reset(now, FrameMonitor.WARMUP_MS); }

  /** Judge nothing for a while (after a quality step, a tab switch), and forget the streaks. */
  reset(now: number, ms = FrameMonitor.SETTLE_MS): void {
    this.intervals = []; this.gpuSamples = []; this.windowStart = -1; this.last = -1;
    this.bad = 0; this.comfortSince = -1; this.dirty = false; this.allResting = true;
    // the warm-up starts at the first frame; later pauses never shorten one already running
    if (ms === FrameMonitor.WARMUP_MS) this.quietUntil = now + ms;
    else if (this.quietUntil !== Infinity) this.quietUntil = Math.max(this.quietUntil, now + ms);
  }

  /** Whether the warm-up (or the settling after a step) is over. */
  warm(now: number): boolean { return now >= this.quietUntil; }

  /** Heavy work outside the frame's own cost (generation, compile, upload): the current window does not count. */
  busy(): void { this.dirty = true; }

  /** One of our frames' GPU time, as the timer resolves it (a few frames late). */
  gpuSample(ms: number): void { if (this.windowStart >= 0) this.gpuSamples.push(ms); }

  /** Feed one rendered frame; returns a verdict when a window settles one. */
  sample(now: number, resting: boolean): Verdict | null {
    const dt = this.last < 0 ? -1 : now - this.last;
    this.last = now;
    if (dt < 0 || document.hidden || now < this.quietUntil) return null;
    if (this.windowStart < 0) { this.windowStart = now; this.intervals = []; this.gpuSamples = []; this.dirty = false; this.allResting = true; }
    this.intervals.push(dt);
    this.allResting &&= resting;
    if (now - this.windowStart < FrameMonitor.WINDOW_MS) return null;
    const dirty = this.dirty, rested = this.allResting, start = this.windowStart;
    this.windowStart = -1;
    if (dirty || this.intervals.length < 5) { this.comfortSince = -1; return null; }
    const B = FrameMonitor.BUDGET_MS, gpuKnown = this.gpu && this.gpuSamples.length >= 5;
    this.frame = median(this.intervals);
    this.gpuMs = gpuKnown ? median(this.gpuSamples) : NaN;
    const slowFrame = this.frame > B;
    const slow = this.gpu ? gpuKnown && this.gpuMs > B : slowFrame;
    this.external = this.gpu && gpuKnown && slowFrame && !slow;
    const need = this.gpu ? 2 : 3;
    this.bad = slow ? this.bad + 1 : 0;
    const gpu = gpuKnown ? +this.gpuMs.toFixed(1) : null, frame = +this.frame.toFixed(1);
    if (this.bad >= need) {
      this.bad = 0; this.comfortSince = -1;
      const reason = this.gpu ? `GPU ${gpu} ms > ${B} ms in ${need} windows in a row` : `frame interval ${frame} ms > ${B} ms in ${need} windows in a row (no GPU timer)`;
      return { dir: 'down', reason, gpu, frame };
    }
    const comfy = this.gpu ? gpuKnown && this.gpuMs < B * FrameMonitor.COMFORT_GPU : this.frame < B * FrameMonitor.COMFORT_FRAME;
    if (!comfy || !rested) { this.comfortSince = -1; return null; }
    if (this.comfortSince < 0) this.comfortSince = start;
    if (now - this.comfortSince < FrameMonitor.RECOVER_MS) return null;
    this.comfortSince = -1;
    const reason = this.gpu ? `GPU ${gpu} ms < ${(B * FrameMonitor.COMFORT_GPU).toFixed(1)} ms for 10 s at rest` : `frame interval ${frame} ms < ${(B * FrameMonitor.COMFORT_FRAME).toFixed(1)} ms for 10 s at rest (no GPU timer)`;
    return { dir: 'up', reason, gpu, frame };
  }
}
