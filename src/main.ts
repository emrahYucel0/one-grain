import './styles/main.css';
import { Vector3 } from 'three';
import { probeGpu } from './core/env';
import { pickTier, pixelRatioFor } from './core/quality';
import { createStage } from './core/renderer';
import { fit, onResize } from './core/resize';
import { exposePack, flags } from './debug/parity';
import { GrainCloud } from './render/grains';
import { HeroGrain } from './render/hero';
import { SimClient } from './sim/client';
import { WORLDS } from './story/worlds';

const root = document.documentElement;
const gpu = probeGpu();

if (!gpu.webgl2) {
  root.classList.add('nogl');
} else {
  root.classList.add('gl');
  const tier = pickTier(gpu, flags.tier);
  const dpr = pixelRatioFor(tier);
  const stage = createStage(document.getElementById('scene') as HTMLCanvasElement, dpr);
  const grains = new GrainCloud(), hero = new HeroGrain(dpr);
  stage.scene.add(grains.object, ...hero.objects);
  const resize = (): void => grains.setScale(fit(stage));
  resize();
  onResize(resize);

  // provisional: show the first world at rest
  void new SimClient().build(tier.n).then((pack) => {
    exposePack(pack);
    grains.setPack(pack);
    const h = new Vector3(pack.heroes[0], pack.heroes[1], pack.heroes[2]);
    const w = WORLDS[0]!;
    hero.moveTo(h);
    stage.camera.position.copy(h).add(new Vector3(...w.cam));
    stage.camera.lookAt(h.clone().add(new Vector3(...w.look)));
    const frame = (): void => {
      requestAnimationFrame(frame);
      grains.update({
        from: 0, to: 1, t: 0, time: performance.now() / 1000, motion: 1, style: 0, k: 1.2, span: .45, spread: 30, dir: [1, 0, 0], axis: undefined,
        heroA: h, heroB: h, loA: w.lo, hiA: w.hi, loB: w.lo, hiB: w.hi, grain: w.grain, fog: stage.stageColor, interact: 0, mouse: h, press: 0,
      });
      stage.renderer.render(stage.scene, stage.camera);
    };
    frame();
  });
}
