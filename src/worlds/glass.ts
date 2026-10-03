import { GrainWriter, type BaseWorld } from './types';

// A pane of glass in front of a screen's sub-pixel grid (behaviour 9).
export const glass: BaseWorld = {
  kind: 'base',
  generate({ rnd, tone }, N) {
    const g = new GrainWriter(N);
    for (let i = 0; i < N; i++) {
      if (rnd() < .55) {
        const x = rnd() * 20 - 10, y = rnd() * 12 - 6;
        g.add(x, y, 0, tone(.3 + rnd() * .4, 0));
      } else {
        const ix = (rnd() * 66) | 0, iy = (rnd() * 40) | 0;
        const x = -9.9 + ix * .3 + (rnd() - .5) * .08, y = -5.9 + iy * .3 + (rnd() - .5) * .14;
        g.add(x, y, -1.2, 9 + (ix % 3) / 3 + .1);
      }
    }
    return g.done();
  },
  hero: () => [0, 0, .03],
};
