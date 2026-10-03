import type { GrainPack } from '../sim/pack';
import type { RenderLayers } from './layers';
import { FrameMonitor, lowerTier, pixelRatioFor, type Tier } from './quality';

export interface TierHooks {
  /** watch frame times and step down on our own (off when a tier is forced) */
  auto: boolean;
  /** debug: behave as if the budget stayed blown once each warm-up is over (walks the whole ladder) */
  forceDrop: boolean;
  build(n: number): Promise<GrainPack>;
  /** apply a new pixel ratio and grain pack together (called mid-dip, while resting) */
  swap(pack: GrainPack, pixelRatio: number): void;
}

/** One step down: an effect off, or the next tier's grain count and pixel ratio. */
type Step = { kind: 'fx'; layer: 'dof' | 'shadows' } | { kind: 'tier'; tier: Tier };

const DIP_MS = 250;

/**
 * Steps quality down when frames stay over budget, one step at a time: depth of field off, then
 * shadows off, then fewer grains (the next tier). Never mid-transition: a step is queued, the new
 * worlds (if any) are built in the worker only while the visitor rests on a chapter, and the step
 * is applied behind a short canvas dip, again only while resting. Each step restarts the frame
 * monitor's warm-up, so the next one needs fresh evidence.
 */
export class TierManager {
  tier: Tier;
  /** canvas opacity multiplier (1 except during a swap) */
  fade = 1;
  readonly monitor = new FrameMonitor();
  private queued: Step | null = null;
  private building = false;
  private ready: GrainPack | null = null;
  private dipStart = -1;
  private applied = false;
  private readonly hooks: TierHooks;
  private readonly layers: RenderLayers;

  constructor(tier: Tier, layers: RenderLayers, hooks: TierHooks) {
    this.tier = tier; this.layers = layers; this.hooks = hooks;
    this.monitor.reset(performance.now());
  }

  /** The pending step, for the debug overlay. */
  get next(): string | null {
    const q = this.queued;
    return !q ? null : q.kind === 'fx' ? `${q.layer} off` : `${q.tier.name} (${q.tier.n.toLocaleString('en-US')} grains)`;
  }

  private nextStep(): Step | null {
    if (this.layers.on('dof')) return { kind: 'fx', layer: 'dof' };
    if (this.layers.on('shadows')) return { kind: 'fx', layer: 'shadows' };
    const tier = lowerTier(this.tier);
    return tier ? { kind: 'tier', tier } : null;
  }

  frame(now: number, hold: number): void {
    const over = this.monitor.sample(now) && this.hooks.auto;
    const forced = this.hooks.forceDrop && this.monitor.warm(now);
    if ((over || forced) && !this.queued) this.queued = this.nextStep();
    const step = this.queued;
    if (!step) return;
    const resting = hold >= 0;

    if (step.kind === 'tier' && !this.ready) {
      if (!this.building && resting) {
        this.building = true;
        void this.hooks.build(step.tier.n).then((pack) => { this.building = false; if (this.queued === step) this.ready = pack; });
      }
      return;
    }

    if (this.dipStart < 0) {
      if (resting) { this.dipStart = now; this.applied = false; }
      return;
    }
    const k = (now - this.dipStart) / DIP_MS;
    if (!this.applied && !resting) { this.dipStart = -1; this.fade = 1; return; } // scrolled away: wait for the next hold
    if (!this.applied && k >= .5) {
      if (step.kind === 'fx') this.layers.drop(step.layer);
      else { this.hooks.swap(this.ready!, pixelRatioFor(step.tier)); this.layers.limit(step.tier.fx); }
      this.applied = true;
    }
    this.fade = Math.min(1, Math.abs(1 - 2 * Math.min(k, 1)));
    if (k >= 1) {
      if (step.kind === 'tier') this.tier = step.tier;
      this.queued = null; this.ready = null; this.dipStart = -1; this.fade = 1;
      this.monitor.reset(now);
    }
  }
}
