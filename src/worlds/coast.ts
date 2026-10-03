import { UP, behaviourOf, heightNormal } from './normals';
import { GrainWriter, type BaseWorld } from './types';

// Sea (behaviour 2), the wet sand under it, and the dry beach.
export const coast: BaseWorld = {
  kind: 'base',
  generate({ rnd, shapes }, N) {
    const g = new GrainWriter(N);
    for (let i = 0; i < N; i++) {
      const u = rnd(), x = rnd() * 22 - 11;
      if (u < .25) { const z = .15 + rnd() * 7.8; g.add(x, 0, z, 2 + rnd() * .99); }
      else if (u < .4) { const z = rnd() * 8; g.add(x, shapes.beachH(x, z), z, rnd() * .6); }
      else { const z = -rnd() * 8; const y = shapes.beachH(x, z) - rnd() * .04; g.add(x, y, z, .2 + rnd() * .79); }
    }
    return g.done();
  },
  normal: ({ shapes }, x, _y, z, w) => (behaviourOf(w) === 2 ? UP : heightNormal(shapes.beachH, x, z)),
  hero: ({ shapes }) => [0, shapes.beachH(0, -.6) + .06, -.6],
};
