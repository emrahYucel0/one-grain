import './styles/main.css';
import type { SoundFrame } from './audio/frame';
import { SoundToggle } from './audio/toggle';
import { env, probeGpu } from './core/env';
import { Loop } from './core/loop';
import { pickTier, pixelRatioFor } from './core/quality';
import { TierManager } from './core/tiers';
import { GpuTimer } from './core/gpu-timer';
import { createStage } from './core/renderer';
import { StageColour } from './core/stage-colour';
import { isLayerName, RenderLayers } from './core/layers';
import { Pacer } from './core/pacing';
import { Projection, onResize } from './core/resize';
import { debugOverlay } from './debug/overlay';
import { exposePack, exposeTiers, flags, gpuExtra } from './debug/parity';
import { updateInteraction } from './input/interact';
import { Pointer } from './input/pointer';
import { GrainCloud } from './render/grains';
import { HeroGrain } from './render/hero';
import { Pipeline } from './render/pipeline';
import { SimClient } from './sim/client';
import { WORLDS } from './story/worlds';
import { HashRouter } from './timeline/hash';
import { bindChapterKeys } from './timeline/keys';
import { ScrollTimeline } from './timeline/scroll';
import { transitionMidpoint } from './timeline/segments';
import { StoryA11y } from './ui/a11y';
import { ChapterView } from './ui/chapter';
import { ClockView, clockProgress } from './ui/clock';
import { readCopy, type Copy } from './ui/copy';
import { revealWhenFontsReady } from './ui/fonts';
import { Loader } from './ui/loader';
import { HeroMarker } from './ui/marker';
import { TimelineNav } from './ui/nav';
import { TypeAxes } from './ui/type-axes';
import { Ending, Intro, chapterOpacity, cutOpacity } from './ui/overlays';

const root = document.documentElement;
const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
/** Where one act gives way to the next: the middle of the transition between them (progress 0..1). */
const actBoundaries = (copy: Copy): number[] =>
  copy.chapters.slice(1).flatMap((c, k) => (c.act !== copy.chapters[k]!.act ? [transitionMidpoint(k)] : []));
const LAST = WORLDS.length - 1;

function boot(): void {
  const gpu = probeGpu();
  if (!gpu.webgl2) { root.classList.add('nogl'); return; }
  const copy = readCopy($('story'));
  root.classList.add('gl');
  revealWhenFontsReady();

  // stage
  const picked = pickTier(gpu, flags.tier);
  const tier = flags.grains ? { ...picked, n: flags.grains } : picked;
  const dpr = pixelRatioFor(tier);
  const stage = createStage($<HTMLCanvasElement>('scene'), dpr);
  const grains = new GrainCloud(), hero = new HeroGrain(dpr);
  stage.scene.add(grains.object);
  if (flags.pointCap) grains.setPointMax(flags.pointCap);
  grains.setShadowSubset(flags.shadowStride, flags.shadowGrow);
  stage.overlay.add(...hero.objects);
  const timer = new GpuTimer(stage.renderer.getContext() as WebGL2RenderingContext, !flags.noTimer);
  const projection = new Projection(stage, (s) => grains.setScale(s));
  // the pixel ratio follows the window: the tier's DPR cap and its pixel budget (core/quality.ts)
  let activeTier = tier;
  const resize = (): void => {
    const pr = pixelRatioFor(activeTier);
    if (pr !== stage.renderer.getPixelRatio()) { stage.renderer.setPixelRatio(pr); hero.setPixelRatio(pr); }
    projection.fit();
  };
  resize();

  // story position
  const timeline = new ScrollTimeline($('track'), { snap: !flags.noSnap });
  onResize(() => { resize(); timeline.refresh(); });
  const hash = new HashRouter(timeline);
  bindChapterKeys(timeline);
  const pipeline = new Pipeline(stage.renderer, timer);
  grains.attachShadow(pipeline.shadow);
  const typeAxes = new TypeAxes($('chapter'), $('time'));
  const layers = new RenderLayers(tier.fx);
  for (const k of flags.off) if (isLayerName(k)) layers.override[k] = false;
  const pacer = new Pacer(flags.pacing);
  void pacer.measureRefresh(); // while the worlds build, nothing heavy draws (in every mode: ?debug shows it)
  const loop = new Loop({ stage, grains, hero, timeline, hash, projection, typeAxes, stageColour: new StageColour(), pipeline, timer, layers, pacer });
  const go = (i: number): void => timeline.goTo(i);

  // words and instruments
  const chapter = new ChapterView($('chapter'), copy, env.touchOnly);
  const nav = new TimelineNav($('timeline'), copy, go, actBoundaries(copy));
  const clock = new ClockView($('time'), $('clock'), $('clockUnit'), copy);
  const intro = new Intro($('intro'), $('introHint'));
  const ending = new Ending($('chapter'));
  const marker = new HeroMarker($('marker'), $('markerLabel'), stage.renderer.domElement);
  const cut = $('cut');
  const sound = new SoundToggle($<HTMLButtonElement>('sound'));
  const a11y = new StoryA11y($('story'), $('status'), copy, {
    go,
    onSignatureFocus: (focused) => { ending.forced = focused; chapter.setSignatureFocus(focused); },
  });
  // ?capture: the frames are stepped by scripts/capture.mjs (src/capture/), and their sound recorded
  let record: ((f: SoundFrame) => void) | null = null;
  if (flags.capture) void import('./capture/capture').then((m) => { record = m.exposeCapture(loop); });
  const pointer = new Pointer();
  chapter.show(0); nav.setCurrent(0);

  loop.onFrame(({ L, now }) => { loop.finalTime = ending.update(L.hold === LAST, now); }, 'story');
  loop.onFrame(() => { pointer.smooth(); loop.parallax = { x: pointer.sx, y: pointer.sy }; }, 'camera');
  loop.onFrame(({ v, L, t, eg, hero: heroPos, heroVisible, heroLight, now }) => {
    const { a, b, tr, hold } = L;
    updateInteraction(loop.interaction, pointer, { hold, reduced: env.reduced, heroes: loop.heroes, camera: stage.camera, now });
    if (chapter.show(t < .5 ? a : b)) nav.setCurrent(chapter.current);
    nav.setProgress(v);
    const op = chapterOpacity(tr, t);
    chapter.setOpacity(op);
    typeAxes.showTitle(op > 0);
    clock.update(a, b, clockProgress(tr, t, eg), t, tr);
    const cutOp = cutOpacity(tr, t).toFixed(3);
    if (cutOp !== cut.style.opacity) cut.style.opacity = cutOp;
    intro.update(v);
    marker.update(heroPos, stage.camera, heroVisible, v, hold, now, heroLight);
    a11y.rest(hold);
    if (sound.on) sound.sound!.frame({ a, b, t, eg, tr, hold });
    record?.({ a, b, t, eg, tr, hold });
  });

  // quality: step down if our frames stay over budget, back up once they have headroom (queued, applied only while resting)
  const sim = new SimClient();
  const tiers = new TierManager(tier, layers, {
    auto: !flags.tier, forceDrop: flags.forceDrop,
    build: (n) => sim.build(n),
    swap: (pack, next) => {
      pacer.reset(performance.now());
      activeTier = next;
      resize();
      exposePack(pack);
      loop.setPack(pack);
    },
  }, timer.gpu);
  timer.onFrame = (ms) => tiers.monitor.gpuSample(ms + gpuExtra());
  exposeTiers(tiers);
  let firstFrame = true;
  loop.onFrame(({ L, now }) => {
    if (firstFrame) { firstFrame = false; tiers.monitor.start(now); loader.done(); }
    tiers.frame(now, L.hold, stage.renderer.info.programs?.length ?? 0);
    loop.fade = tiers.fade;
  });
  if (flags.debug) debugOverlay(tiers, layers, () => stage.renderer.getPixelRatio(), timer, pacer);

  // the loading line: the worlds' generation fills 90 %, the first rendered frame the rest
  const loader = new Loader($('loaderFill'), flags.parity);
  loader.progress(.04);
  sim.build(tier.n, (p) => loader.progress(.04 + .86 * p)).then((pack) => {
    exposePack(pack);
    loop.setPack(pack);
    intro.ready();
    hash.restore();
    if (!flags.capture) loop.start();
  }, fallBack);
}

/** Without a working experience, the article is the page. */
function fallBack(err: unknown): void {
  root.classList.remove('gl');
  root.classList.add('nogl');
  throw err;
}

try { boot(); } catch (err) { fallBack(err); }
