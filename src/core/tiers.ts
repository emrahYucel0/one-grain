import type { GrainPack } from '../sim/pack';
import type { LayerName, RenderLayers } from './layers';
import { FrameMonitor, lowerTier, upperTier, type Tier, type Verdict } from './quality';

export interface TierHooks {
  /** watch frame costs and step on our own (off when a tier is forced) */
  auto: boolean;
  /** debug: behave as if the budget stayed blown once each warm-up is over (walks the whole ladder) */
  forceDrop: boolean;
  build(n: number): Promise<GrainPack>;
  /** apply the next tier's grain pack and pixel ratio together (called mid-dip, while resting) */
  swap(pack: GrainPack, tier: Tier): void;
}

/** One step: an effect off (or back on), or the next tier's grain count and pixel ratio. */
type Step = ({ kind: 'fx'; layer: 'dof' | 'shadows' } | { kind: 'tier'; tier: Tier }) & { up: boolean };

/** A step as taken, for the ?debug overlay. */
export interface StepRecord { at: number; dir: 'down' | 'up'; what: string; reason: string; gpu: number | null; frame: number }

const DIP_MS = 250;
const describe = (s: Step): string => (s.kind === 'fx' ? `${s.layer} ${s.up ? 'on' : 'off'}` : `${s.tier.name} (${s.tier.n.toLocaleString('en-US')} grains)`);

/**
 * Steps quality down when our frames stay over budget, one step at a time: depth of field off, then
 * shadows off, then fewer grains (the next tier); and back up, one step at a time and in reverse,
 * once frames have had headroom at rest for a while (core/quality.ts FrameMonitor decides both).
 * After a step up that is followed by a step down, it stops stepping up for the session.
 * Never mid-transition: a step is queued, the new worlds (if any) are built in the worker only while
 * the visitor rests on a chapter, and the step is applied behind a short canvas dip, again only
 * while resting. Each step restarts the monitor's settling time, so the next one needs fresh evidence.
 */
export class TierManager {
  tier: Tier;
  /** canvas opacity multiplier (1 except during a swap) */
  fade = 1;
  readonly monitor: FrameMonitor;
  /** every step taken, oldest first */
  readonly log: StepRecord[] = [];
  /** a step up was followed by a step down: no more steps up this session */
  upLocked = false;
  private wentUp = false;
  /** the steps taken down and not yet undone, newest last */
  private readonly taken: Step[] = [];
  private readonly droppedFx = new Set<LayerName>();
  private queued: { step: Step; verdict: Verdict } | null = null;
  private building = false;
  private ready: GrainPack | null = null;
  private dipStart = -1;
  private applied = false;
  private programs = -1;
  private readonly hooks: TierHooks;
  private readonly layers: RenderLayers;

  constructor(tier: Tier, layers: RenderLayers, hooks: TierHooks, gpuTimer: boolean) {
    this.tier = tier; this.layers = layers; this.hooks = hooks;
    this.monitor = new FrameMonitor(gpuTimer);
  }

  /** The pending step, for the debug overlay. */
  get next(): string | null { return this.queued ? describe(this.queued.step) : null; }

  private stepDown(): Step | null {
    if (this.layers.on('dof')) return { kind: 'fx', layer: 'dof', up: false };
    if (this.layers.on('shadows')) return { kind: 'fx', layer: 'shadows', up: false };
    const tier = lowerTier(this.tier);
    return tier ? { kind: 'tier', tier, up: false } : null;
  }

  /** Undo the last step down, if any and if stepping up is still allowed. */
  private stepUp(): Step | null {
    const last = this.taken[this.taken.length - 1];
    if (this.upLocked || !last) return null;
    return last.kind === 'fx' ? { kind: 'fx', layer: last.layer, up: true } : { kind: 'tier', tier: upperTier(this.tier)!, up: true };
  }

  /** Once per rendered frame. `programs`: the renderer's compiled programs (a change means a compile). */
  frame(now: number, hold: number, programs: number): void {
    const resting = hold >= 0;
    if (this.programs >= 0 && programs !== this.programs) this.monitor.busy();
    this.programs = programs;
    if (this.building) this.monitor.busy();
    const verdict = this.monitor.sample(now, resting);
    if (!this.queued) {
      const v = this.hooks.forceDrop && this.monitor.warm(now) ? { dir: 'down' as const, reason: 'forced (?forceDrop)', gpu: null, frame: this.monitor.frame }
        : this.hooks.auto ? verdict : null;
      const step = v ? (v.dir === 'down' ? this.stepDown() : this.stepUp()) : null;
      if (v && step) this.queued = { step, verdict: v };
    }
    const q = this.queued;
    if (!q) return;
    const { step } = q;

    if (step.kind === 'tier' && !this.ready) {
      if (!this.building && resting) {
        this.building = true;
        void this.hooks.build(step.tier.n).then((pack) => { this.building = false; if (this.queued === q) this.ready = pack; });
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
      if (step.kind === 'fx') {
        if (step.up) { this.layers.restore(step.layer); this.droppedFx.delete(step.layer); } else { this.layers.drop(step.layer); this.droppedFx.add(step.layer); }
      } else { this.hooks.swap(this.ready!, step.tier); this.layers.setTier(step.tier.fx, this.droppedFx); }
      this.applied = true;
    }
    this.fade = Math.min(1, Math.abs(1 - 2 * Math.min(k, 1)));
    if (k >= 1) {
      if (step.kind === 'tier') this.tier = step.tier;
      if (step.up) { this.taken.pop(); this.wentUp = true; } else { this.taken.push(step); if (this.wentUp) this.upLocked = true; }
      const v = q.verdict;
      this.log.push({ at: +(now / 1000).toFixed(1), dir: step.up ? 'up' : 'down', what: describe(step), reason: v.reason, gpu: v.gpu, frame: v.frame });
      this.queued = null; this.ready = null; this.dipStart = -1; this.fade = 1;
      this.monitor.reset(now);
    }
  }
}
