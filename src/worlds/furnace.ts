import { GrainWriter, type BaseWorld } from './types';

// An arc furnace: back wall, front lip, convecting melt (13), sparks (7), three electrodes.
export const furnace: BaseWorld = {
  kind: 'base',
  generate({ rnd, tone }, N) {
    const E = [0, 2.094, 4.189].map((a) => [Math.cos(a) * 2.8, Math.sin(a) * 2.8] as const);
    const g = new GrainWriter(N);
    for (let i = 0; i < N; i++) {
      const u = rnd();
      if (u < .3) {
        const t = Math.PI + rnd() * Math.PI;
        const y = -3 + rnd() * 7;
        g.add(7 * Math.cos(t), y, 7 * Math.sin(t), tone(rnd() * .7, 0));
      } else if (u < .38) {
        const t = rnd() * Math.PI;
        const y = -3 + rnd() * 1.3;
        g.add(7 * Math.cos(t), y, 7 * Math.sin(t), tone(.5, .3));
      } else if (u < .72) {
        const r = 6.6 * Math.sqrt(rnd()), t = rnd() * 6.2832;
        const y = -2 + rnd() * .05;
        g.add(r * Math.cos(t), y, r * Math.sin(t), 13 + rnd() * .99);
      } else if (u < .8) {
        const r = 5.5 * Math.sqrt(rnd()), t = rnd() * 6.2832;
        g.add(r * Math.cos(t), -1.9, r * Math.sin(t), 7 + rnd() * .99);
      } else {
        const e = E[(rnd() * 3) | 0]!, t = rnd() * 6.2832;
        const y = -1.4 + rnd() * 9.4;
        g.add(e[0] + .8 * Math.cos(t), y, e[1] + .8 * Math.sin(t), tone(.15, .2));
      }
    }
    return g.done();
  },
  hero: () => [0, -1.95, 1],
};
