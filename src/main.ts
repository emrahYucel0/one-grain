import type { SoundFrame } from './audio/frame';
import { SoundToggle } from './audio/toggle';
import { env, probeGpu } from './core/env';
import { Loop } from './core/loop';
import { deviceKind, pickTier, pixelRatioFor, readDevice } from './core/quality';
import { GpuTimer } from './core/gpu-timer';
import { createStage } from './core/renderer';
import { StageColour } from './core/stage-colour';
import { isLayerName, RenderLayers } from './core/layers';
import { Projection, onResize } from './core/resize';
import { exposePack, exposeTier, flags, pullOverride } from './debug/parity';
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
import { ss } from './core/ease';
import { StoryA11y } from './ui/a11y';
import { TextBlock } from './ui/text-block';
import { ChapterView } from './ui/chapter';
import { ClockView, clockProgress } from './ui/clock';
import { fillLiveFacts, readCopy, type Copy } from './ui/copy';
import { Cursor } from './ui/cursor';
import { Gate } from './ui/gate';
import { Outro } from './ui/outro';
import { Rewind } from './ui/rewind';
import { revealWhenFontsReady } from './ui/fonts';
import { Loader } from './ui/loader';
import { guard } from './ui/guard';
import { LoupeView } from './ui/loupe';
import { HeroMarker } from './ui/marker';
import { MotionToggle } from './ui/motion';
import { TimelineNav } from './ui/nav';
import { TypeAxes } from './ui/type-axes';
import { Ending, Intro, Opening, cutOpacity } from './ui/overlays';

const root = document.documentElement;
const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
/** Where one act gives way to the next: the middle of the transition between them (progress 0..1). */
const actBoundaries = (copy: Copy): number[] =>
  copy.chapters.slice(1).flatMap((c, k) => (c.act !== copy.chapters[k]!.act ? [transitionMidpoint(k)] : []));
const LAST = WORLDS.length - 1;

function boot(): void {
  fillLiveFacts($('story'));
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
  const timeline = new ScrollTimeline($('scroll-length'), { snap: !flags.noSnap });
  onResize(() => { resize(); timeline.refresh(); });
  const hash = new HashRouter(timeline);
  bindChapterKeys(timeline);
  const pipeline = new Pipeline(stage.renderer, timer);
  if (!pipeline.hdr) guard.log('no half-float render targets', 'post runs on 8-bit targets');
  grains.attachShadow(pipeline.shadow);
  // Every program compiles in parallel off the main thread (KHR_parallel_shader_compile) while the worlds
  // are built, instead of inside the first frame, where a slow CPU would wait for every link in one long
  // task. The first frame waits for both; after the first pack a second pass finds them all cached.
  const compiled = grains.whileVisible(() => pipeline.compile(stage.scene, stage.overlay, stage.camera)).catch(() => {});
  const typeAxes = new TypeAxes($('chapter'), $('time'));
  const layers = new RenderLayers(tier.fx);
  for (const k of flags.off) if (isLayerName(k)) layers.override[k] = false;
  // the entry gate: a first visit at the start of the story; not for #slug links, nor the harnesses (unless ?gate)
  const gated = (!flags.parity || flags.gate) && !(location.hash.length > 1 && location.hash !== `#${WORLDS[0]!.slug}`);
  // phones and every gated first visit: the title alone on the first screen; the opening chapter's words come with the first scroll
  const opening = new Opening(gated || deviceKind(readDevice()).kind === 'phone');
  const textBlock = new TextBlock($('chapter'), stage.renderer.domElement, document.querySelector<HTMLElement>('.scrim-top'));
  const loupe = new LoupeView($('loupe'), $('loupeLine'), stage.renderer.domElement, [...document.querySelectorAll<HTMLElement>('.hud .brand, #time, .controls, #timeline')]);
  const loop = new Loop({ stage, grains, hero, timeline, hash, projection, typeAxes, stageColour: new StageColour(), pipeline, timer, layers, textBlock, opening, loupe });
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
  const gate = new Gate({
    enabled: gated, gate: $('gate'), veil: $('veil'), hint: $('introHint'), reduced: () => env.reduced,
    onChoice: (on) => sound.choose(on), preloadSound: () => sound.preload(),
  });
  // the ending's last word: start again (the veil closes and opens on the first world), share, credits
  const outro = new Outro({
    again: $<HTMLButtonElement>('again'), share: $<HTMLButtonElement>('share'), credits: $<HTMLButtonElement>('creditsOpen'),
    dialog: $<HTMLDialogElement>('credits'), status: $('status'),
    // the story runs back to its start, the camera pushes onto the grain and the opening's pull-back
    // follows (ui/rewind.ts); with motion off the veil closes and opens on the first world instead
    onAgain: () => {
      const back = (): void => { timeline.restart(); opening.reset(); };
      if (env.reduced) gate.rewind(() => { back(); });
      else rewind.start(timeline.state.v, performance.now(), () => { back(); gate.startPull(); });
    },
  });
  const rewind = new Rewind();
  loop.progressHook = (now) => rewind.value(now);
  // the cursor: a mouse only, and not in the video (the capture has its own scripted pointer)
  const cursor = new Cursor($('cursor'), !flags.capture);
  const a11y = new StoryA11y($('story'), $('status'), copy, {
    go,
    onSignatureFocus: (focused) => { ending.forced = focused; chapter.setSignatureFocus(focused); },
  });
  // ?capture: the frames are stepped by scripts/capture.mjs (src/capture/), and their sound recorded
  let record: ((f: SoundFrame) => void) | null = null;
  if (flags.capture) void import('./capture/capture').then((m) => { record = m.exposeCapture(loop, pointer); });
  const pointer = new Pointer();
  chapter.show(0); nav.setCurrent(0);

  loop.onFrame(({ L, now }) => {
    loop.finalTime = ending.update(L.hold === LAST, now);
    outro.update(loop.finalTime, ending.forced, gate.rewinding || rewind.active);
    loop.rewinding = rewind.active;
    loop.pull = pullOverride() ?? Math.max(gate.pull(now), rewind.pull(now));
  }, 'story');
  let depth = '';
  loop.onFrame(() => {
    pointer.smooth(); loop.parallax = { x: pointer.sx, y: pointer.sy };
    // the cursor's touch on the grains: it rises with the mouse's speed and fades once it rests; none on the
    // hands-on holds (they have their own), with motion off, or without a mouse
    const touch = loop.touch, want = pointer.hovering && !env.reduced && !loop.interaction.mode ? Math.min(1, pointer.speed / 16) : 0;
    touch.s += (want - touch.s) * (want > touch.s ? .3 : .035);
    if (touch.s < .003) touch.s = 0;
    touch.x = pointer.nx; touch.y = pointer.ny;
    // and the words a little nearer than the world: they drift against the camera's parallax
    const d = env.reduced ? '0,0' : `${pointer.sx.toFixed(3)},${pointer.sy.toFixed(3)}`;
    if (d !== depth) { depth = d; const [x, y] = d.split(','); root.style.setProperty('--px', x!); root.style.setProperty('--py', y!); }
  }, 'camera');
  loop.onFrame(({ v, L, t, eg, hero: heroPos, heroVisible, heroLight, now, dt, textOpacity }) => {
    const { a, b, tr, hold } = L;
    updateInteraction(loop.interaction, pointer, { hold, reduced: env.reduced, heroes: loop.heroes, camera: stage.camera, now });
    cursor.frame(dt, loop.interaction.mode, env.reduced);
    if (chapter.show(t < .5 ? a : b)) nav.setCurrent(chapter.current);
    nav.setProgress(v);
    marker.update(heroPos, stage.camera, heroVisible, v, hold, now, heroLight);
    const leaving = hold < 0 && t < .5;
    // the ending's sentence rises on the ending's own clock (seconds since resting there: pinned by ?parity, virtual under ?capture)
    const endingRise = chapter.current === LAST && !leaving ? (loop.finalTime < 0 ? 0 : ss(Ending.TITLE_S, Ending.TITLE_S + 1.8, loop.finalTime)) : 1;
    const op = rewind.active ? 0 : textOpacity * gate.update(v, now, marker.x, marker.y) * endingRise;
    chapter.setProgress(op, leaving, !env.reduced);
    typeAxes.showTitle(op > 0);
    clock.update(a, b, clockProgress(tr, t, eg), t, tr);
    const cutOp = (rewind.active ? 0 : cutOpacity(tr, t)).toFixed(3);
    if (cutOp !== cut.style.opacity) cut.style.opacity = cutOp;
    intro.update(v);
    // starting again passes every chapter on its way back: no announcements, no chapter motifs
    const rest = rewind.active ? -1 : hold;
    a11y.rest(rest);
    if (sound.on) sound.sound!.frame({ a, b, t, eg, tr, hold: rest });
    record?.({ a, b, t, eg, tr, hold });
  });

  const sim = new SimClient(guard.log);
  let firstFrame = true;
  loop.onFrame(() => { if (firstFrame) { firstFrame = false; loader.done(); if (layers.on('loupe')) pipeline.prepareLoupe(); } });
  if (flags.debug) void import('./debug/overlay').then((m) => m.debugOverlay({ tier, rule: picked.rule, gpu: gpu.renderer }, layers, () => stage.renderer.getPixelRatio(), timer));

  // the loading line: the worlds' generation fills 90 %, the first rendered frame the rest
  const loader = new Loader($('loaderFill'), flags.parity);
  loader.progress(.04);
  Promise.all([sim.build(tier.n, (p) => loader.progress(.04 + .86 * p)), compiled]).then(async ([pack]) => {
    loop.setPack(pack);
    await pipeline.compile(stage.scene, stage.overlay, stage.camera).catch(() => {}); // a safety net: all cached
    // the loupe's program: where it cannot compile in parallel (Firefox), now, while the loader shows, so it
    // never stalls the first screen; and under ?parity and capture before the harness is told the page is
    // ready. Elsewhere it compiles in parallel after the first frame (render/loupe.ts)
    if (layers.on('loupe') && (flags.parity || !pipeline.parallelCompile)) pipeline.prepareLoupe(true);
    exposePack(pack);
    if (guard.failed) return; // the guard gave up on this load and the article is the page
    intro.ready(gate.waiting);
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
