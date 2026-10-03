import type { GenContext } from './context';
import { fr } from './math';
import type { V3 } from './shapes';
import { GrainWriter, type BaseWorld } from './types';

// The first fully ordered world: substrate lattice, transistor rows, memory blocks,
// two metal layers and a clock tree.

interface Seg { x: number; z: number; nx: number; nz: number; horiz: boolean; acc: number; L: number }
interface Route { segs: Seg[]; total: number; ph: number }
interface Macro { x0: number; x1: number; z0: number; z1: number }

const q = (v: number, s: number): number => Math.round(v / s) * s;
const cl = (v: number): number => Math.max(-10.8, Math.min(10.8, v));
const MACROS: readonly Macro[] = [{ x0: -9.6, x1: -5.4, z0: -9.4, z1: -4.6 }, { x0: 4.8, x1: 9.6, z0: 4.6, z1: 9.4 }, { x0: -9.4, x1: -4.6, z0: 4.4, z1: 8.8 }];
const inMacro = (x: number, z: number): boolean => MACROS.some((m) => x > m.x0 - .3 && x < m.x1 + .3 && z > m.z0 - .3 && z < m.z1 + .3);

/** Wire routes (consumes draws, so it runs right before the grains, as in the reference). */
function layout({ rnd }: GenContext): { routes: Route[]; H: [number, number, number, number][] } {
  const routes: Route[] = [];
  for (let r = 0; r < 180; r++) {
    let x = q(rnd() * 20 - 10, .6), z = q(rnd() * 20 - 10, .6), horiz = rnd() < .5; const segs: Seg[] = []; let acc = 0;
    for (let k = 0, n = 2 + ((rnd() * 3) | 0); k < n; k++) {
      const len = (1 + ((rnd() * 6) | 0)) * .6 * (rnd() < .5 ? -1 : 1), nx = horiz ? cl(x + len) : x, nz = horiz ? z : cl(z + len);
      const L = Math.abs(nx - x) + Math.abs(nz - z); if (L > 0) { segs.push({ x, z, nx, nz, horiz, acc, L }); acc += L; }
      x = nx; z = nz; horiz = !horiz;
    }
    if (segs.length) routes.push({ segs, total: acc, ph: rnd() });
  }
  // clock distribution: an H-tree
  const H: [number, number, number, number][] = [];
  const h = (cx: number, cz: number, size: number, depth: number): void => {
    if (!depth) return; const hs = size / 2;
    H.push([cx - hs, cz, cx + hs, cz]); H.push([cx - hs, cz - hs, cx - hs, cz + hs]); H.push([cx + hs, cz - hs, cx + hs, cz + hs]);
    ([[-hs, -hs], [-hs, hs], [hs, -hs], [hs, hs]] as const).forEach(([dx, dz]) => h(cx + dx, cz + dz, hs, depth - 1));
  };
  h(0, 0, 10, 4);
  return { routes, H };
}

export const chip: BaseWorld = {
  kind: 'base',
  generate(ctx, N) {
    const { rnd } = ctx;
    const { routes, H } = layout(ctx);
    const g = new GrainWriter(N);
    for (let i = 0; i < N; i++) {
      const u = rnd();
      if (u < .16) { // substrate lattice
        const x = -10.98 + ((rnd() * 122) | 0) * .18, z = -10.98 + ((rnd() * 122) | 0) * .18;
        g.add(x, 0, z, .04);
      } else if (u < .28) { // memory arrays
        const m = MACROS[(rnd() * MACROS.length) | 0]!, cx = Math.floor((m.x1 - m.x0) / .14), cz = Math.floor((m.z1 - m.z0) / .14);
        const x = m.x0 + ((rnd() * cx) | 0) * .14, z = m.z0 + ((rnd() * cz) | 0) * .14;
        g.add(x, .12, z, 8 + rnd() * .99);
      } else if (u < .58) { // transistor rows: fins along x, gates across them
        let x: number, k: number, zc: number;
        do { k = ((rnd() * 17) | 0) - 8; zc = k * 1.25; x = rnd() * 21.6 - 10.8; } while (inMacro(x, zc));
        if (rnd() < .4) { const z = zc - .35 + ((rnd() * 6) | 0) * .14; g.add(q(x, .06), .05, z, .45); }
        else {
          const gx = q(x + 11, .24) - 11, hsh = fr(Math.sin(gx * 91.7 + k * 13.1) * 4375.5);
          const z = zc - .42 + q(rnd() * .84, .06);
          g.add(gx, .13, z, 8 + Math.min(.99, hsh));
        }
      } else if (u < .9) { // two metal layers: horizontal wires on one, vertical on the other, vias where they turn
        const r = routes[(rnd() * routes.length) | 0]!, sg = r.segs[(rnd() * r.segs.length) | 0]!;
        if (rnd() < .06) { const y = .38 + rnd() * .24; g.add(sg.x, y, sg.z, .9); }
        else {
          const s = q(rnd() * sg.L, .05), f = sg.L ? s / sg.L : 0;
          g.add(sg.x + (sg.nx - sg.x) * f, sg.horiz ? .38 : .62, sg.z + (sg.nz - sg.z) * f, 18 + fr(r.ph + (sg.acc + s) / 8) * .99);
        }
      } else { // clock tree
        const hseg = H[(rnd() * H.length) | 0]!, s = q(rnd(), .02), x = hseg[0] + (hseg[2] - hseg[0]) * s, z = hseg[1] + (hseg[3] - hseg[1]) * s;
        g.add(x, .9, z, 19 + Math.min(.99, Math.hypot(x, z) / 14));
      }
    }
    return g.done();
  },
  hero: (): V3 => [q(.5 + 11, .24) - 11, .15, .1],
};
