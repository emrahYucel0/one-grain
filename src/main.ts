import './styles/main.css';
import { probeGpu } from './core/env';
import { Loop } from './core/loop';
import { pickTier, pixelRatioFor } from './core/quality';
import { createStage } from './core/renderer';
import { fit, onResize } from './core/resize';
import { exposePack, flags } from './debug/parity';
import { GrainCloud } from './render/grains';
import { HeroGrain } from './render/hero';
import { SimClient } from './sim/client';
import { HashRouter } from './timeline/hash';
import { bindChapterKeys } from './timeline/keys';
import { ScrollTimeline } from './timeline/scroll';

const root = document.documentElement;
const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

function boot(): void {
  const gpu = probeGpu();
  if (!gpu.webgl2) { root.classList.add('nogl'); return; }
  root.classList.add('gl');

  const tier = pickTier(gpu, flags.tier);
  const dpr = pixelRatioFor(tier);
  const stage = createStage($<HTMLCanvasElement>('scene'), dpr);
  const grains = new GrainCloud(), hero = new HeroGrain(dpr);
  stage.scene.add(grains.object, ...hero.objects);
  const resize = (): void => grains.setScale(fit(stage));
  resize();
  onResize(resize);

  const timeline = new ScrollTimeline($('track'));
  const hash = new HashRouter(timeline);
  bindChapterKeys(timeline);
  const loop = new Loop({ stage, grains, hero, timeline, hash });

  void new SimClient().build(tier.n).then((pack) => {
    exposePack(pack);
    loop.setPack(pack);
    hash.restore();
    loop.start();
  });
}

boot();
