import { GrainWriter, type BaseWorld } from './types';

// A stepped open pit with a conveyor belt (behaviour 12) climbing out of it.
export const quarry: BaseWorld = {
  kind: 'base',
  generate({ rnd, tone }, N) {
    const L = 6, hx = (j: number) => 14 - 2 * j, hz = (j: number) => 10 - 1.6 * j;
    const g = new GrainWriter(N);
    for (let i = 0; i < N; i++) {
      const u = rnd();
      if (u < .07) { const s = rnd(); g.add(2 + 18 * s, -7.2 + 10.2 * s, 2 - 6 * s, 12 + s * .99); continue; } // moving belt
      if (u < .1) { // belt frame
        const s = rnd();
        const x = 2 + 18 * s + (rnd() - .5) * .2, y = -7.5 + 10.2 * s, z = 2 - 6 * s + (rnd() < .5 ? -.35 : .35);
        g.add(x, y, z, .92);
        continue;
      }
      const j = (rnd() * L) | 0, y = -1.2 * (j + 1);
      if (rnd() < .55) { // bench floors
        let x: number, z: number;
        do { x = (rnd() * 2 - 1) * hx(j); z = (rnd() * 2 - 1) * hz(j); } while (j < L - 1 && Math.abs(x) < hx(j + 1) && Math.abs(z) < hz(j + 1));
        g.add(x, y, z, tone(.35 + j * .1));
      } else { // bench walls
        const per = 4 * (hx(j) + hz(j)), s = rnd() * per, yy = -1.2 * j - rnd() * 1.2; let x: number, z: number;
        if (s < 2 * hx(j)) { x = -hx(j) + s; z = -hz(j); }
        else if (s < 2 * hx(j) + 2 * hz(j)) { x = hx(j); z = -hz(j) + (s - 2 * hx(j)); }
        else if (s < 4 * hx(j) + 2 * hz(j)) { x = hx(j) - (s - 2 * hx(j) - 2 * hz(j)); z = hz(j); }
        else { x = -hx(j); z = hz(j) - (s - 4 * hx(j) - 2 * hz(j)); }
        g.add(x, yy, z, tone(.2 + j * .08));
      }
    }
    return g.done();
  },
  hero: () => [0, -3.6, (8.4 + 6.8) / 2],
};
