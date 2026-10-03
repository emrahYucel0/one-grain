import { GrainWriter, type BaseWorld } from './types';

// Dunes; wind streamers (behaviour 10) along the crests and hopping grains (behaviour 3).
export const desert: BaseWorld = {
  kind: 'base',
  generate({ rnd, shapes }, N) {
    const { duneS, desertH } = shapes;
    const g = new GrainWriter(N);
    for (let i = 0; i < N; i++) {
      let x = rnd() * 44 - 22, z = rnd() * 30 - 22;
      const u = rnd();
      if (u < .06) {
        for (let k = 0; k < 30 && Math.abs(duneS(x, z) - .78) > .03; k++) { x = rnd() * 44 - 22; z = rnd() * 30 - 22; }
        g.add(x, desertH(x, z), z, 10 + rnd() * .99);
      } else if (u < .1) {
        g.add(x, desertH(x, z), z, 3 + rnd() * .99);
      } else {
        const y = desertH(x, z) - rnd() * .08;
        g.add(x, y, z, rnd() * .99);
      }
    }
    return g.done();
  },
  // the grain rests on the highest crest near the origin
  hero: ({ shapes }) => {
    let bx = 0, by = -9;
    for (let x = -4; x <= 4; x += .05) { const y = shapes.desertH(x, 0); if (y > by) { by = y; bx = x; } }
    return [bx, by + .06, 0];
  },
};
