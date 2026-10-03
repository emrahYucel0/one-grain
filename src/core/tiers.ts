import type { GrainPack } from '../sim/pack';
import { FrameMonitor, lowerTier, pixelRatioFor, type Tier } from './quality';

export interface TierHooks {
  /** watch frame times and step down on our own (off when a tier is forced) */
  auto: boolean;
  /** debug: behave as if the budget were blown once warm-up is over */
  forceDrop: boolean;
  build(n: number): Promise<GrainPack>;
  /** apply a new pixel ratio and grain pack together (called mid-dip, while resting) */
  swap(pack: GrainPack, pixelRatio: number): void;
}

const DIP_MS = 250;

/**
 * Steps the quality tier down when frames stay over budget. Never mid-transition: a drop is
 * queued, the new worlds are built (in the worker) only while the visitor rests on a chapter,
 * and they are swapped in, together with the new pixel ratio, behind a short canvas dip, again
 * only while resting.
 */
export class TierManager {
  tier: Tier;
  /** canvas opacity multiplier (1 except during a swap) */
  fade = 1;
  readonly monitor = new FrameMonitor();
  private queued: Tier | null = null;
  private building = false;
  private ready: GrainPack | null = null;
  private dipStart = -1;
  private swapped = false;
  private forcedDone = false;
  private readonly createdAt = performance.now();
  private readonly hooks: TierHooks;

  constructor(tier: Tier, hooks: TierHooks) {
    this.tier = tier; this.hooks = hooks;
    this.monitor.reset(performance.now());
  }

  /** The tier that will be shown after a pending swap (for the debug overlay). */
  get next(): Tier | null { return this.queued; }

  frame(now: number, hold: number): void {
    const over = this.monitor.sample(now) && this.hooks.auto;
    const forced = this.hooks.forceDrop && !this.forcedDone && now - this.createdAt > FrameMonitor.WARMUP_MS;
    if ((over || forced) && !this.queued) {
      this.queued = lowerTier(this.tier);
      this.forcedDone ||= forced;
    }
    if (!this.queued) return;
    const resting = hold >= 0;

    if (!this.ready && !this.building && resting) {
      this.building = true;
      const target = this.queued;
      void this.hooks.build(target.n).then((pack) => { this.building = false; if (this.queued === target) this.ready = pack; });
    }
    if (!this.ready) return;

    if (this.dipStart < 0) {
      if (resting) { this.dipStart = now; this.swapped = false; }
      return;
    }
    const k = (now - this.dipStart) / DIP_MS;
    if (!this.swapped && !resting) { this.dipStart = -1; this.fade = 1; return; } // scrolled away: wait for the next hold
    if (!this.swapped && k >= .5) {
      this.hooks.swap(this.ready, pixelRatioFor(this.queued));
      this.swapped = true;
    }
    this.fade = Math.min(1, Math.abs(1 - 2 * Math.min(k, 1)));
    if (k >= 1) {
      this.tier = this.queued; this.queued = null; this.ready = null; this.dipStart = -1; this.fade = 1;
      this.monitor.reset(now);
    }
  }
}
