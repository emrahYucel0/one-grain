import { heightNormal } from './normals';
import { GrainWriter, type BaseWorld } from './types';

// A granite mountain; a few bright quartz grains among the rock.
export const granite: BaseWorld = {
  kind: 'base',
  generate({ rnd, shapes }, N) {
    const g = new GrainWriter(N);
    for (let i = 0; i < N; i++) {
      const r = 24 * Math.sqrt(rnd()), a = rnd() * 6.2832, x = r * Math.cos(a), z = r * Math.sin(a) * .85;
      const y = shapes.mountainH(x, z) - rnd() * .12;
      g.add(x, y, z, rnd() < .04 ? .98 : rnd() * .8);
    }
    return g.done();
  },
  normal: ({ shapes }, x, _y, z) => heightNormal(shapes.mountainH, x, z),
  hero: ({ shapes }) => [2, shapes.mountainH(2, 6) + .06, 6],
};
