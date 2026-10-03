import { CRYSTALS, tipOf } from './shapes';
import { GrainWriter, type BaseWorld } from './types';

// A magma chamber (behaviour 5) with quartz crystals growing in it.
export const magma: BaseWorld = {
  kind: 'base',
  generate({ rnd, tone, shapes }, N) {
    const g = new GrainWriter(N);
    for (let i = 0; i < N; i++) {
      if (rnd() < .62) {
        const t = rnd() * 6.2832, u = rnd() * 2 - 1, r = Math.cbrt(rnd()), s = Math.sqrt(1 - u * u);
        g.add(16 * r * s * Math.cos(t), -3 + 5 * r * u, -4 + 12 * r * s * Math.sin(t), 5 + rnd() * .99);
      } else {
        const c = CRYSTALS[(rnd() * CRYSTALS.length) | 0]!;
        const p = shapes.hexPrism(...c);
        g.add(p[0], p[1], p[2], tone(.85, .25));
      }
    }
    return g.done();
  },
  hero: () => tipOf(...CRYSTALS[0]!),
};
