import { ss } from './math';
import { GrainWriter, type BaseWorld } from './types';

// The grains become a screen: a 16:9 grid showing a desert under a dark sky.
export const you: BaseWorld = {
  kind: 'base',
  generate({ rnd, tone }, N) {
    const cols = Math.round(Math.sqrt(N * 16 / 9)), rows = Math.floor(N / cols), s = 20 / cols;
    const g = new GrainWriter(N);
    for (let i = 0; i < N; i++) {
      const k = i < cols * rows ? i : (rnd() * cols * rows) | 0, cx = k % cols, cy = (k / cols) | 0, x = -10 + cx * s, y = -rows * s / 2 + cy * s;
      const dune = -1 + Math.sin(x * .4) * .8 + Math.sin(x * 1.1 + 1) * .3;
      g.add(x, y, 0, y > dune ? tone(.1 + Math.max(0, y) * .015, .02) : tone(.5 + .4 * ss(-6, dune, y) * (.6 + .4 * Math.sin(x * .9 - y)), .05));
    }
    return g.done();
  },
  hero: () => [0, 0, .02],
};
