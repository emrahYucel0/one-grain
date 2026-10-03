import { Vector3 } from 'three';
import { frameShot } from '../camera/rig';
import { CONFINEMENT, towards } from '../camera/confinement';
import { shot } from '../camera/shot';
import { progressOverride, reportProgress, timeOverride, transitionOverride } from '../debug/parity';
import type { GrainCloud } from '../render/grains';
import type { HeroGrain } from '../render/hero';
import type { FrameUniforms } from '../render/types';
import type { GrainPack } from '../sim/pack';
import { WORLDS } from '../story/worlds';
import type { HashRouter } from '../timeline/hash';
import type { ScrollTimeline } from '../timeline/scroll';
import { locate, locateAt, type Located } from '../timeline/segments';
import { FixedClock } from './clock';
import { env } from './env';
import type { TypeAxes } from '../ui/type-axes';
import type { Stage } from './renderer';
import type { Projection } from './resize';
import type { StageColour } from './stage-colour';

export interface LoopDeps {
  stage: Stage;
  grains: GrainCloud;
  hero: HeroGrain;
  timeline: ScrollTimeline;
  hash: HashRouter;
  projection: Projection;
  typeAxes: TypeAxes;
  stageColour: StageColour;
}

/** Per-frame hook for the parts that react to where the story is (UI, input, audio, quality). */
export type FrameListener = (f: FrameInfo) => void;
/**
 * 'story' runs first, once the shot is known and before anything is drawn (the ending's reveal);
 * 'camera' before the camera is placed (pointer smoothing); 'scene' after it, before drawing.
 */
export type FramePhase = 'story' | 'camera' | 'scene';

export interface FrameInfo {
  /** story progress, 0..1 */
  v: number;
  L: Located;
  /** progress inside the transition as rendered (snapped to 0/1 under reduced motion) */
  t: number;
  eg: number;
  hero: Vector3;
  heroVisible: boolean;
  now: number;
  dt: number;
}

/**
 * The render loop: reads the scroll position, asks the shot director for the camera,
 * feeds the grain layer and lets listeners update everything else.
 */
export class Loop {
  heroes: Vector3[] = [];
  private readonly clock = new FixedClock();
  private readonly listeners: Record<FramePhase, FrameListener[]> = { story: [], camera: [], scene: [] };
  private readonly mouse = new Vector3(0, -99, 0);
  private readonly d: LoopDeps;
  private running = false;
  /** set by the interaction listener, applied in the same frame */
  readonly interaction = { mode: 0, at: new Vector3(0, -99, 0), press: 0 };
  /** the final reveal, 0..1 (set by the ending, in the 'story' phase) */
  reveal = 0;
  /** extra canvas opacity factor (quality swaps) */
  fade = 1;
  /** smoothed pointer, for camera parallax (set by input) */
  parallax: { x: number; y: number } = { x: 0, y: 0 };

  constructor(deps: LoopDeps) { this.d = deps; }

  setPack(pack: GrainPack): void {
    this.d.grains.setPack(pack);
    this.heroes = WORLDS.map((_, i) => new Vector3(pack.heroes[i * 3], pack.heroes[i * 3 + 1], pack.heroes[i * 3 + 2]));
  }

  onFrame(fn: FrameListener, phase: FramePhase = 'scene'): void { this.listeners[phase].push(fn); }

  start(): void {
    if (this.running) return;
    this.running = true;
    const tick = (): void => { requestAnimationFrame(tick); this.frame(); };
    requestAnimationFrame(tick);
  }

  private frame(): void {
    const { stage, grains, hero, timeline, hash, projection, typeAxes, stageColour } = this.d;
    const reduced = env.reduced;
    const v = progressOverride() ?? timeline.state.v;
    reportProgress(v);
    const dt = this.clock.tick(reduced);
    const time = timeOverride() ?? this.clock.time;
    const at = transitionOverride();
    const L = at ? locateAt(at.tr, at.t, at.lean) : locate(v), { a, b, tr } = L;
    const t = reduced ? (L.t < .5 ? 0 : 1) : L.t;
    const S = shot(tr, a, b, t, this.heroes, L.lean, reduced);
    const wa = WORLDS[a]!, wb = WORLDS[b]!, ca = CONFINEMENT[a]!, cb = CONFINEMENT[b]!;
    const heroVisible = !(tr.cam === 'cut' && t > .2 && t < .8);
    const info: FrameInfo = { v, L, t, eg: S.eg, hero: S.hero, heroVisible, now: performance.now(), dt };
    for (const fn of this.listeners.story) fn(info);

    // stage colour per act; confinement, eased like the camera: lens (and uScale), type axes, jitter
    stageColour.update(a, b, S.eg, this.reveal);
    projection.setLens(towards(ca.fov, cb.fov, S.eg));
    typeAxes.set(towards(ca.wdth, cb.wdth, S.eg), towards(ca.wght, cb.wght, S.eg));

    hero.moveTo(S.hero);
    hero.visible = heroVisible;
    for (const fn of this.listeners.camera) fn(info);
    frameShot(stage.camera, S, reduced ? null : this.parallax);
    for (const fn of this.listeners.scene) fn(info);
    // reduced motion: worlds swap behind a quick fade instead of morphing; times any listener fade
    const fade = (reduced ? 1 - Math.sin(Math.PI * L.t) : 1) * this.fade;
    stage.renderer.domElement.style.opacity = fade === 1 ? '1' : fade.toFixed(3);

    const ix = this.interaction;
    const u: FrameUniforms = {
      from: a, to: b, t, time, motion: reduced ? 0 : 1,
      style: tr.g, k: tr.k ?? 1, span: tr.span ?? .45, spread: tr.spread ?? 30, dir: tr.dir ?? [1, 0, 0],
      heroA: this.heroes[a]!, heroB: this.heroes[b]!,
      loA: wa.lo, hiA: wa.hi, loB: wb.lo, hiB: wb.hi, grain: towards(wa.grain, wb.grain, S.eg), jitter: towards(ca.jitter, cb.jitter, S.eg),
      fog: stageColour.fog, last: WORLDS.length - 1, reveal: this.reveal, interact: ix.mode, mouse: ix.mode ? ix.at : this.mouse, press: ix.press,
    };
    grains.update(u);
    hash.update(L.hold);
    stage.renderer.render(stage.scene, stage.camera);
  }
}
