import './styles/main.css';
import { mixBed } from './audio/mix';
import { SoundToggle } from './audio/toggle';
import { env, probeGpu } from './core/env';
import { Loop } from './core/loop';
import { pickTier, pixelRatioFor } from './core/quality';
import { TierManager } from './core/tiers';
import { createStage } from './core/renderer';
import { fit, onResize } from './core/resize';
import { debugOverlay } from './debug/overlay';
import { exposePack, flags } from './debug/parity';
import { updateInteraction } from './input/interact';
import { Pointer } from './input/pointer';
import { GrainCloud } from './render/grains';
import { HeroGrain } from './render/hero';
import { SimClient } from './sim/client';
import { WORLDS } from './story/worlds';
import { HashRouter } from './timeline/hash';
import { bindChapterKeys } from './timeline/keys';
import { ScrollTimeline } from './timeline/scroll';
import { StoryA11y } from './ui/a11y';
import { ChapterView } from './ui/chapter';
import { ClockView } from './ui/clock';
import { readCopy } from './ui/copy';
import { HeroMarker } from './ui/marker';
import { TimelineNav } from './ui/nav';
import { Ending, Intro, chapterOpacity, cutOpacity } from './ui/overlays';

const root = document.documentElement;
const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
const LAST = WORLDS.length - 1;

function boot(): void {
  const gpu = probeGpu();
  if (!gpu.webgl2) { root.classList.add('nogl'); return; }
  const copy = readCopy($('story'));
  root.classList.add('gl');

  // stage
  const tier = pickTier(gpu, flags.tier);
  const dpr = pixelRatioFor(tier);
  const stage = createStage($<HTMLCanvasElement>('scene'), dpr);
  const grains = new GrainCloud(), hero = new HeroGrain(dpr);
  stage.scene.add(grains.object, ...hero.objects);
  const resize = (): void => grains.setScale(fit(stage));
  resize();
  onResize(resize);

  // story position
  const timeline = new ScrollTimeline($('track'));
  const hash = new HashRouter(timeline);
  bindChapterKeys(timeline);
  const loop = new Loop({ stage, grains, hero, timeline, hash });
  const go = (i: number): void => timeline.goTo(i);

  // words and instruments
  const chapter = new ChapterView($('chapter'), $('act'), copy, env.touchOnly);
  const nav = new TimelineNav($('timeline'), copy, go);
  const clock = new ClockView($('time'), $('clock'), $('clockUnit'), copy);
  const intro = new Intro($('intro'), $('introHint'));
  const ending = new Ending($('chapter'));
  const marker = new HeroMarker($('marker'), $('markerLabel'));
  const cut = $('cut');
  const sound = new SoundToggle($<HTMLButtonElement>('sound'));
  const a11y = new StoryA11y($('story'), $('status'), copy, {
    go,
    onSignatureFocus: (focused) => { ending.forced = focused; chapter.setSignatureFocus(focused); },
  });
  const pointer = new Pointer();
  chapter.show(0); nav.setCurrent(0);

  loop.onFrame(() => { pointer.smooth(); loop.parallax = { x: pointer.sx, y: pointer.sy }; }, 'camera');
  loop.onFrame(({ v, L, t, eg, hero: heroPos, heroVisible, now }) => {
    const { a, b, tr, hold } = L;
    updateInteraction(loop.interaction, pointer, { hold, reduced: env.reduced, heroes: loop.heroes, camera: stage.camera, now });
    if (chapter.show(t < .5 ? a : b)) nav.setCurrent(chapter.current);
    chapter.setOpacity(chapterOpacity(tr, t));
    clock.update(a, b, eg, t, tr);
    cut.style.opacity = cutOpacity(tr, t).toFixed(3);
    intro.update(v);
    ending.update(hold === LAST, now);
    marker.update(heroPos, stage.camera, heroVisible, v);
    a11y.rest(hold);
    mixBed(sound.bed, a, b, t, tr);
  });

  // quality: step down (queued, applied only while resting) if frames stay over budget
  const sim = new SimClient();
  const tiers = new TierManager(tier, {
    auto: !flags.tier, forceDrop: flags.forceDrop,
    build: (n) => sim.build(n),
    swap: (pack, pixelRatio) => {
      stage.renderer.setPixelRatio(pixelRatio);
      hero.setPixelRatio(pixelRatio);
      resize();
      exposePack(pack);
      loop.setPack(pack);
    },
  });
  loop.onFrame(({ L, now }) => { tiers.frame(now, L.hold); loop.fade = tiers.fade; });
  if (flags.debug) debugOverlay(tiers, () => stage.renderer.getPixelRatio());

  sim.build(tier.n).then((pack) => {
    exposePack(pack);
    loop.setPack(pack);
    intro.ready();
    hash.restore();
    tiers.monitor.reset(performance.now());
    loop.start();
  }, fallBack);
}

/** Without a working experience, the article is the page. */
function fallBack(err: unknown): void {
  root.classList.remove('gl');
  root.classList.add('nogl');
  throw err;
}

try { boot(); } catch (err) { fallBack(err); }
