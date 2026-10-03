import { FRONT, UP, behaviourOf } from './normals';
import { band } from './math';
import { GrainWriter, type BaseWorld } from './types';

// A cut-away block of banded sandstone (behaviour 11) with a thin layer of fresh sand on top (behaviour 4).
export const again: BaseWorld = {
  kind: 'base',
  generate({ rnd, tone }, N) {
    const g = new GrainWriter(N);
    for (let i = 0; i < N; i++) {
      const u = rnd() * 700; let x: number, y: number, z: number;
      if (u < 280) { x = rnd() * 28 - 14; y = rnd() * 10 - 7; z = 3; }
      else if (u < 504) { x = rnd() * 28 - 14; y = 3; z = rnd() * 8 - 5; }
      else if (u < 664) { x = rnd() < .5 ? -14 : 14; y = rnd() * 10 - 7; z = rnd() * 8 - 5; }
      else {
        const px = rnd() * 28 - 14, py = 3.2 + rnd() * .3, pz = 3 - rnd() * .3;
        g.add(px, py, pz, 4 + rnd() * .5);
        continue;
      }
      g.add(x, y, z, 11 + tone(band(x, y)));
    }
    return g.done();
  },
  // the cut-away block: front face, top, sides
  normal: (_ctx, x, y, z, w) => {
    if (behaviourOf(w) === 4) return UP;
    if (Math.abs(z - 3) < .01) return FRONT;
    if (Math.abs(y - 3) < .01) return UP;
    if (Math.abs(x) > 13.99) return [Math.sign(x), 0, 0];
    return UP;
  },
  hero: () => [0, -2, 3.08],
};
