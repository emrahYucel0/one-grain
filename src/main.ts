import type { SoundFrame } from './audio/frame';
import { SoundToggle } from './audio/toggle';
import { env, probeGpu } from './core/env';
import { Loop } from './core/loop';
import { pickTier, pixelRatioFor, readDevice } from './core/quality';
import { GpuTimer } from './core/gpu-timer';
import { createStage } from './core/renderer';
import { StageColour } from './core/stage-colour';
import { isLayerName, RenderLayers } from './core/layers';
import { Projection, onResize } from './core/resize';
import { exposePack, exposeTier, flags } from './debug/parity';
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
import { guard } from './ui/guard';
import { HeroMarker } from './ui/marker';
import { MotionToggle } from './ui/motion';
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
  guard.log('gpu', `WebGL2 ${gpu.webgl2 ? 'yes' : 'no'}${gpu.performant ? '' : ' (not performant)'} · ${gpu.renderer || 'renderer hidden'} · max texture ${gpu.maxTextureSize}`);
  if (!gpu.webgl2) { root.classList.add('nogl'); guard.fail('no WebGL2'); return; }
  const copy = readCopy($('story'));
  root.classList.add('gl');
  revealWhenFontsReady();

  // stage: the tier is picked once, from the device and its GPU, and never changes (core/quality.ts)
  const picked = pickTier(readDevice(), gpu, flags.tier);
  if (!picked) { root.classList.add('nogl'); guard.fail(`the GPU's texture limit (${gpu.maxTextureSize}) cannot hold the grains`); return; }
  const tier = flags.grains ? { ...picked.tier, n: flags.grains } : picked.tier;
  const dpr = pixelRatioFor(tier);
  guard.log('tier', `${tier.name} (${picked.rule}) · ${tier.n} grains · pixel ratio ${dpr.toFixed(2)}`);
  exposeTier(tier, picked.rule);
  const stage = createStage($<HTMLCanvasElement>('scene'), dpr);
  if (guard.shown) {
    const gl = stage.renderer.getContext();
    guard.log('extensions', ['EXT_color_buffer_float', 'EXT_color_buffer_half_float', 'OES_texture_float_linear', 'KHR_parallel_shader_compile', 'EXT_disjoint_timer_query_webgl2']
      .map((x) => `${x.replace(/^(EXT|OES|KHR)_/, '')} ${gl.getSupportedExtensions()?.includes(x) ? 'yes' : 'no'}`).join(' · '));
  }
  const grains = new GrainCloud(), hero = new HeroGrain(dpr);
  stage.scene.add(grains.object);
  if (flags.pointCap) grains.setPointMax(flags.pointCap);
  grains.setShadowSubset(flags.shadowStride, flags.shadowGrow);
  stage.overlay.add(...hero.objects);
  // GPU timing is a development tool only (?perf, ?debug): a normal visit measures nothing
  const timer = new GpuTimer(stage.renderer.getContext() as WebGL2RenderingContext, flags.perf || flags.debug);
  const projection = new Projection(stage, (s) => grains.setScale(s));
  // the pixel ratio follows the window: the tier's DPR cap and its pixel budget (core/quality.ts)
  const resize = (): void => {
    const pr = pixelRatioFor(tier);
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
  // Every program compiles in parallel off the main thread (KHR_parallel_shader_compile) while the worlds
  // are built, instead of inside the first frame, where a slow CPU would wait for every link in one long
  // task. The first frame waits for both; after the first pack a second pass finds them all cached.
  const compiled = grains.whileVisible(() => pipeline.compile(stage.scene, stage.overlay, stage.camera)).catch(() => {});
  const typeAxes = new TypeAxes($('chapter'), $('time'));
  const layers = new RenderLayers(tier.fx);
  for (const k of flags.off) if (isLayerName(k)) layers.override[k] = false;
  const loop = new Loop({ stage, grains, hero, timeline, hash, projection, typeAxes, stageColour: new StageColour(), pipeline, timer, layers });
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
  new MotionToggle($<HTMLButtonElement>('motion'));
  const a11y = new StoryA11y($('story'), $('status'), copy, {
    go,
    onSignatureFocus: (focused) => { ending.forced = focused; chapter.setSignatureFocus(focused); },
  });
  // ?capture: the frames are stepped by scripts/capture.mjs (src/capture/), and their sound recorded
  let record: ((f: SoundFrame) => void) | null = null;
  if (flags.capture) void import('./capture/capture').then((m) => { record = m.exposeCapture(loop, pointer); });
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

  const sim = new SimClient(guard.log);
  let firstFrame = true;
  loop.onFrame(() => { if (firstFrame) { firstFrame = false; loader.done(); } });
  if (flags.debug) void import('./debug/overlay').then((m) => m.debugOverlay({ tier, rule: picked.rule, gpu: gpu.renderer }, layers, () => stage.renderer.getPixelRatio(), timer));

  // the loading line: the worlds' generation fills 90 %, the first rendered frame the rest
  const loader = new Loader($('loaderFill'), flags.parity);
  loader.progress(.04);
  Promise.all([sim.build(tier.n, (p) => loader.progress(.04 + .86 * p)), compiled]).then(async ([pack]) => {
    exposePack(pack);
    loop.setPack(pack);
    await pipeline.compile(stage.scene, stage.overlay, stage.camera).catch(() => {}); // a safety net: all cached
    if (guard.failed) return; // the guard gave up on this load and the article is the page
    intro.ready();
    hash.restore();
    if (!flags.capture) loop.start();
  }, fallBack);
}

/** Without a working experience, the article is the page. */
function fallBack(err: unknown): void {
  root.classList.remove('gl');
  root.classList.add('nogl');
  guard.fail(err instanceof Error ? err.message : String(err));
  throw err;
}

// The stylesheet does not block the first paint (index.html carries the critical styles: the stage and
// the loader); the experience starts once it applies.
guard.log('bundle running');
guard.alive();
import('./styles/main.css').then(() => { try { boot(); } catch (err) { fallBack(err); } }, fallBack);
