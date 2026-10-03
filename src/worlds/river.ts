import { UP, behaviourOf, heightNormal } from './normals';
import { meander } from './shapes';
import { GrainWriter, type BaseWorld } from './types';

// Water grains (behaviour 1) flowing along a meander, banks on either side.
export const river: BaseWorld = {
  kind: 'base',
  generate({ rnd, shapes }, N) {
    const g = new GrainWriter(N);
    for (let i = 0; i < N; i++) {
      if (rnd() < .3) {
        const x = rnd() * 26 - 13, y = -.25 + rnd() * .85, z = (rnd() - .5) * 3.2;
        g.add(x, y, z, 1 + rnd() * .99);
      } else {
        const x = rnd() * 26 - 13, z = rnd() * 16 - 8;
        const y = shapes.riverH(x, z) - rnd() * .05;
        g.add(x, y, z, rnd() * .99);
      }
    }
    return g.done();
  },
  normal: ({ shapes }, x, _y, z, w) => (behaviourOf(w) === 1 ? UP : heightNormal(shapes.riverH, x, z)),
  hero: ({ shapes }) => [-1, shapes.riverH(-1, meander(-1)) + .06, meander(-1)],
};
