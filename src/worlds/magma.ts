import { UP, behaviourOf, nz3 } from './normals';
import { CRYSTALS, tipOf, type V3 } from './shapes';
import { GrainWriter, type BaseWorld } from './types';

// A magma chamber (behaviour 5) with quartz crystals growing in it.
export const magma: BaseWorld = {
  kind: 'base',
  generate({ rnd, tone, shapes }, N) {
    const g = new GrainWriter(N);
    for (let i = 0; i < N; i++) {
      if (rnd() < .62) {
        const t = rnd() * 6.2832, u = rnd() * 2 - 1, r = Math.cbrt(rnd()), s = Math.sqrt(1 - u * u);
        g.add(16 * r * s * Math.cos(t), -3 + 5 * r * u, -4 + 12 * r * s * Math.sin(t), 5 + rnd() * .99);
      } else {
        const c = CRYSTALS[(rnd() * CRYSTALS.length) | 0]!;
        const p = shapes.hexPrism(...c);
        g.add(p[0], p[1], p[2], tone(.85, .25));
      }
    }
    return g.done();
  },
  // crystal grains: the prism face (or the tip) they sit on; magma: up
  normal: (_ctx, x, y, z, w) => {
    if (behaviourOf(w) === 5) return UP;
    let best = 1e9, out = UP;
    for (const [c, axis, R0, L] of CRYSTALS) {
      const a = nz3(axis), d: V3 = [x - c[0], y - c[1], z - c[2]], h = d[0] * a[0] + d[1] * a[1] + d[2] * a[2];
      if (h < -.3 || h > L + R0 * 1.6) continue;
      const rad: V3 = [d[0] - a[0] * h, d[1] - a[1] * h, d[2] - a[2] * h], rl = Math.hypot(...rad), tipR = h > L ? R0 * (1 - (h - L) / (R0 * 1.4)) : R0;
      const err = Math.abs(rl - tipR * .93);
      if (err < best) { best = err; const rn = nz3(rad); out = h > L ? nz3([rn[0] * 1.4 + a[0] * .866, rn[1] * 1.4 + a[1] * .866, rn[2] * 1.4 + a[2] * .866]) : rn; }
    }
    return out;
  },
  hero: () => tipOf(...CRYSTALS[0]!),
};
