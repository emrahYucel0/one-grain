import { UP, behaviourOf, nz3 } from './normals';
import { GrainWriter, type BaseWorld } from './types';

// Czochralski growth: crucible, melt (13), and a turning single-crystal ingot (15).
export const crystal: BaseWorld = {
  kind: 'base',
  generate({ rnd, tone }, N) {
    const g = new GrainWriter(N);
    for (let i = 0; i < N; i++) {
      const u = rnd(), t = rnd() * 6.2832;
      if (u < .16) { // crucible
        const v = rnd() * 1.5708;
        g.add(4 * Math.cos(t) * Math.cos(v), -.6 - 4 * Math.sin(v), 4 * Math.sin(t) * Math.cos(v), tone(.65, .2));
      } else if (u < .26) { // melt
        const r = 3.8 * Math.sqrt(rnd());
        g.add(r * Math.cos(t), -.55, r * Math.sin(t), 13 + rnd() * .99);
      } else if (u < .44) { // surface lattice: rings with an offset on every other ring
        const ring = (rnd() * 75) | 0, k = (rnd() * 160) | 0, a = (k + (ring % 2) * .5) / 160 * 6.2832;
        g.add(1.6 * Math.cos(a), ring * .12, 1.6 * Math.sin(a), 15 + tone(.75, .1));
      } else if (u < .95) { // interior, snapped to a cubic lattice
        let x: number, z: number;
        do { x = Math.round((rnd() * 3.2 - 1.6) / .1) * .1; z = Math.round((rnd() * 3.2 - 1.6) / .1) * .1; } while (x * x + z * z > 2.4);
        const y = Math.round(rnd() * 9 / .1) * .1;
        g.add(x, y, z, 15 + tone(.6, .1));
      } else { // seed cone
        const s = rnd(), r = 1.6 * (1 - s) + .08;
        g.add(r * Math.cos(t), 9 + s * 2.4, r * Math.sin(t), 15 + tone(.8, .1));
      }
    }
    return g.done();
  },
  // crucible, cylinder, seed cone
  normal: (_ctx, x, y, z, w) => {
    if (behaviourOf(w) === 13) return UP;
    const r = Math.hypot(x, z) || 1;
    if (y < -.5) return nz3([x, y + .6, z]);
    if (y > 9) return nz3([x / r * 2.4, 1.6, z / r * 2.4]);
    return [x / r, 0, z / r];
  },
  hero: () => [0, 1, 1.63],
};
