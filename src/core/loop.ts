import { SHADOW_EVERY } from '../render/shadow';
import { Vector3 } from 'three';
import { frameShot } from '../camera/rig';
import { SAFE, keepInSafeArea } from '../camera/safe-area';
import { CONFINEMENT, towards } from '../camera/confinement';
import { ss } from './ease';
import { LightRigBlend, type RigState } from './light-rig';
import { shot } from '../camera/shot';
import { flags, overdrawView, progressOverride, reportGpu, reportHero, reportHeroRendered, reportProgress, reportRender, restPathAllowed, timeOverride, transitionOverride } from '../debug/parity';
import type { GrainCloud } from '../render/grains';
import type { Pipeline } from '../render/pipeline';
import type { GpuTimer } from './gpu-timer';
import type { RenderLayers } from './layers';
import type { HeroGrain } from '../render/hero';
import type { FrameUniforms } from '../render/types';
import type { GrainPack } from '../sim/pack';
import { WORLDS } from '../story/worlds';
import type { HashRouter } from '../timeline/hash';
import type { ScrollTimeline } from '../timeline/scroll';
import { locate, locateAt, type Located } from '../timeline/segments';
import { FixedClock } from './clock';
import { env } from './env';
import { chapterOpacity, type Opening } from '../ui/overlays';
import type { TextBlock } from '../ui/text-block';
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
  pipeline: Pipeline;
  timer: GpuTimer;
  /** what to draw: the tier's layers and ?debug / ?off overrides (core/layers.ts) */
  layers: RenderLayers;
  /** the chapter's text block and the HUD's scrim on screen: where the hero grain must not sit */
  textBlock: TextBlock;
  /** phones: the opening chapter's words wait for the first scroll (ui/overlays.ts) */
  opening: Opening;
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
  /** the hero grain's light: 1, fading to 0 in the final hold (v15) */
  heroLight: number;
  now: number;
  dt: number;
  /** the chapter text's opacity as the transition sets it, times the opening's gate on phones */
  textOpacity: number;
}

/**
 * The render loop: reads the scroll position, asks the shot director for the camera,
 * feeds the grain layer and lets listeners update everything else.
 */
export class Loop {
  heroes: Vector3[] = [];
  private readonly clock = new FixedClock();
  private readonly rig = new LightRigBlend();
  /** this frame's light rig (render/ draws with it) */
  rigState: RigState = this.rig.state;
  private readonly listeners: Record<FramePhase, FrameListener[]> = { story: [], camera: [], scene: [] };
  private readonly mouse = new Vector3(0, -99, 0);
  private readonly d: LoopDeps;
  private running = false;
  /** set by the interaction listener, applied in the same frame */
  readonly interaction = { mode: 0, at: new Vector3(0, -99, 0), press: 0 };
  private canvasOpacity = '';
  private readonly heroNdc = new Vector3();
  /** seconds since the final chapter was reached, -1 elsewhere (set by the ending, in the 'story' phase) */
  finalTime = -1;
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
    // a frame on every refresh the browser offers: it shows them at the display's own pace
    const tick = (now: number): void => {
      requestAnimationFrame(tick);
      this.frame();
      reportRender(now);
    };
    requestAnimationFrame(tick);
  }

  /** Capture mode: one frame now, outside the rAF loop (src/capture/); `draw` false skips only the GPU work. */
  step(draw = true): void { this.frame(draw); }

  private frame(draw = true): void {
    const { stage, grains, hero, timeline, hash, projection, typeAxes, stageColour, pipeline, timer, layers } = this.d;
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
    const textOpacity = chapterOpacity(tr, t) * this.d.opening.factor(v, t < .5 ? a : b);
    const info: FrameInfo = { v, L, t, eg: S.eg, hero: S.hero, heroVisible, heroLight: 1, now: performance.now(), dt, textOpacity };
    for (const fn of this.listeners.story) fn(info);
    // the final hold (v15): the grain hovers, loses its light (3–5.6 s), then lands among the others
    // (5–6.4 s, a soft ease); under reduced motion it simply becomes matte in place
    let landed = 0;
    if (L.hold === WORLDS.length - 1 && this.finalTime >= 0) {
      info.heroLight = 1 - ss(3, 5.6, this.finalTime);
      landed = reduced ? (info.heroLight < .05 ? 1 : 0) : ss(5, 6.4, this.finalTime);
      S.hero.z -= .6 * (1 - (1 - landed) ** 3);
    }

    // stage colour per act; confinement, eased like the camera: lens (and uScale), type axes, jitter
    stageColour.update(a, b, S.eg);
    projection.setLens(towards(ca.fov, cb.fov, S.eg));
    // light rigs, eased like the camera unless the transition delays them
    this.rigState = this.rig.update(a, b, tr.rig ? ss(tr.rig[0], tr.rig[1], t) : S.eg, this.heroes);
    typeAxes.set(towards(ca.wdth, cb.wdth, S.eg), towards(ca.wght, cb.wght, S.eg));

    hero.moveTo(S.hero);
    hero.visible = heroVisible;
    for (const fn of this.listeners.camera) fn(info);
    frameShot(stage.camera, S, reduced ? null : this.parallax, towards(wa.wideAnchor, wb.wideAnchor, S.eg));
    // narrow screens: turn just enough to keep the hero grain on screen and clear of the words
    const tb = this.d.textBlock;
    if (!flags.noSafe) keepInSafeArea(stage.camera, S.hero, { x: SAFE.x, bottom: -SAFE.y, top: tb.top, text: tb.box, textWeight: textOpacity });
    const hp = this.heroNdc.copy(S.hero).project(stage.camera);
    reportHero(hp.x, hp.y, hp.z, heroVisible);
    const grain = towards(wa.grain, wb.grain, S.eg);
    hero.setLight(info.heroLight, grain * projection.scale / Math.max(.1, stage.camera.position.distanceTo(S.hero)));
    for (const fn of this.listeners.scene) fn(info);
    // reduced motion: worlds swap behind a quick fade instead of morphing
    const fade = reduced ? 1 - Math.sin(Math.PI * L.t) : 1;
    const opacity = fade === 1 ? '1' : fade.toFixed(3);
    if (opacity !== this.canvasOpacity) { this.canvasOpacity = opacity; stage.renderer.domElement.style.opacity = opacity; }

    // the key light's shadow map, framed around what the camera looks at
    const light = layers.on('light'), shadows = light && layers.on('shadows');
    pipeline.shadow.fit(S.look, this.rigState.keyDir, this.rigState.shadow);
    const ix = this.interaction;
    const u: FrameUniforms = {
      rest: !restPathAllowed() ? 0 : t <= 0 ? 1 : t >= 1 ? 2 : 0,
      from: a, to: b, t, time, motion: reduced ? 0 : 1,
      style: tr.g, k: tr.k ?? 1, span: tr.span ?? .45, spread: tr.spread ?? 30, dir: tr.dir ?? [1, 0, 0],
      heroA: this.heroes[a]!, heroB: this.heroes[b]!,
      loA: wa.lo, hiA: wa.hi, loB: wb.lo, hiB: wb.hi, grain, jitter: towards(ca.jitter, cb.jitter, S.eg),
      fog: stageColour.fog, fogLinear: stageColour.fogLinear, rig: this.rigState, camera: stage.camera, light, shadows, lightVP: pipeline.shadow.viewProjection, shadowPx: pipeline.shadow.pxPerUnit, land: landed, landPos: S.hero, interact: ix.mode, mouse: ix.mode ? ix.at : this.mouse, press: ix.press,
    };
    const overdraw = overdrawView();
    grains.setOverdrawView(overdraw);
    grains.update(u);
    hash.update(L.hold);
    const cam = stage.camera;
    const shadowEvery = L.hold >= 0 ? flags.shadowEvery ?? SHADOW_EVERY.rest : SHADOW_EVERY.moving;
    if (!draw) { pipeline.skip(shadows && !overdraw, shadowEvery); timer.tick(); return; }
    pipeline.render({
      grains: stage.scene, overlay: stage.overlay, camera: cam, shadows: shadows && !overdraw, shadowEvery, clear: stageColour.fogLinear, direct: overdraw,
      post: { bloom: layers.on('bloom'), dof: layers.on('dof'), grade: layers.on('grade'), near: cam.near, far: cam.far, focus: cam.position.distanceTo(S.hero), dofScale: this.rigState.dof, time, grainMoves: !reduced },
    });
    reportHeroRendered(S.hero, cam);
    timer.tick();
    reportGpu(timer);
  }
}
