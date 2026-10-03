import { GrainWriter, type BaseWorld } from './types';

// A grid of distillation columns; deposition grains (behaviour 14) settling on them.
export const purity: BaseWorld = {
  kind: 'base',
  generate({ rnd, tone }, N) {
    const g = new GrainWriter(N);
    for (let i = 0; i < N; i++) {
      const gx = (rnd() * 5) | 0, gz = (rnd() * 4) | 0, cx = (gx - 2) * 2.4, cz = (gz - 1.5) * 2.4;
      const u = rnd(), leg = rnd() < .5 ? -1.2 : 1.2, t = rnd() * 6.2832;
      let x: number, y: number, z: number;
      if (u < .85) { x = cx + leg + .35 * Math.cos(t); y = -3 + rnd() * 8; z = cz + .35 * Math.sin(t); }
      else { const b = rnd() * 2.4 - 1.2; x = cx + b; y = 5 + .35 * Math.cos(t); z = cz + .35 * Math.sin(t); }
      g.add(x, y, z, rnd() < .16 ? 14 + rnd() * .99 : tone(.35 + .5 * rnd(), 0));
    }
    return g.done();
  },
  hero: () => [-1.2 + .36, 2.5, 2.4 * 1.5],
};
