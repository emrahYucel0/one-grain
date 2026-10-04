// Responsive check (npm run check:responsive), on the dev server across the matrix's viewports:
//  1. the hero ring's centre is within 2 px of the hero grain as the camera projects it, at every
//     chapter hold (window.__hero mapped through the canvas's own box on screen)
//  2. touch viewports: the sound button takes a touch anywhere in a 44×44 px box around its centre,
//     and every rail button in a 44 px wide one (elementFromPoint); the rail buttons' height is
//     reported (15 chapters do not fit 44 px each on a phone)
//  3. the drawing buffer stays within its tier's pixel budget (core/quality.ts), whatever the DPR
//  4. phones: a mobile browser bar coming in (height −100 px) rebuilds nothing: same drawing buffer,
//     same scroll position, same story progress (no ScrollTrigger refresh, no jump)
//  5. device classes: the tier picked for an Apple Silicon Mac (Chromium and Safari), an iPad, a
//     4-core Mac, an Intel PC and an RTX PC (core/quality.ts with a stubbed navigator)
import { createServer } from 'vite';
import { launch, watchConsole } from './lib/browser.mjs';
import { startDev } from './lib/servers.mjs';
import { VIEWPORTS } from './lib/viewports.mjs';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { SNAP_POINTS } = await vite.ssrLoadModule('/src/timeline/segments.ts');
const { TIERS } = await vite.ssrLoadModule('/src/core/quality.ts');
await vite.close();
const dev = await startDev(5176);
const browser = await launch();
const logs = [], results = [];
const check = (name, ok, detail) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (${detail})`); };
try {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dpr, hasTouch: vp.touch, isMobile: vp.mobile });
    const page = await ctx.newPage();
    watchConsole(page, vp.name, logs);
    await page.goto(`${dev.origin}/?parity`);
    await page.waitForFunction(() => window.__PACK, null, { timeout: 120000 });
    // 1: the ring at every hold
    let worst = 0, where = '', n = 0;
    for (let i = 0; i < SNAP_POINTS.length; i++) {
      await page.evaluate((v) => { window.__V = v; window.__T = 10; window.__FT = 0; }, SNAP_POINTS[i]);
      await page.waitForTimeout(700);
      const d = await page.evaluate(() => {
        const h = window.__hero, c = document.getElementById('scene').getBoundingClientRect(), m = document.querySelector('.marker'), r = m.getBoundingClientRect();
        if (!h || !h.visible || h.z >= 1 || Math.abs(h.x) > 1.1 || Math.abs(h.y) > 1.1 || +getComputedStyle(m).opacity === 0) return null;
        return Math.hypot(r.left + r.width / 2 - (c.left + (h.x + 1) / 2 * c.width), r.top + r.height / 2 - (c.top + (1 - h.y) / 2 * c.height));
      });
      if (d !== null) { n++; if (d > worst) { worst = d; where = `hold ${i + 1}`; } }
    }
    check(`${vp.name}: ring on the grain at every hold`, worst <= 2, `${n} holds, at most ${worst.toFixed(2)} px${where ? ` (${where})` : ''}`);
    // 3: the pixel budget
    const buf = await page.evaluate(() => ({ w: document.getElementById('scene').width, h: document.getElementById('scene').height, n: window.__PACK.n }));
    const tierName = Object.values(TIERS).find((t) => t.n === buf.n)?.name ?? '?', budget = TIERS[tierName]?.pixels ?? Infinity;
    check(`${vp.name}: drawing buffer within the ${tierName} tier's pixel budget`, buf.w * buf.h <= budget * 1.01, `${buf.w}×${buf.h} = ${(buf.w * buf.h / 1e6).toFixed(2)} MP, budget ${(budget / 1e6).toFixed(1)} MP, DPR ${vp.dpr}`);
    // 4: a mobile browser bar
    if (vp.mobile) {
      // a chapter jump (exact, no snap inertia), then let the 1.6 s scrub settle; Chromium's emulation resizes
      // vh with the window (real iOS and Android Chrome keep vh at the large viewport), so this tests that
      // ScrollTrigger keeps its scroll mapping: the same scroll gives the same progress
      await page.evaluate(() => { window.__V = null; window.__FT = null; location.hash = 'furnace'; });
      await page.waitForTimeout(5000);
      const read = () => page.evaluate(() => ({ w: document.getElementById('scene').width, h: document.getElementById('scene').height, y: scrollY, v: window.__progress }));
      const a = await read();
      await page.setViewportSize({ width: vp.width, height: vp.height - 100 }); await page.waitForTimeout(1200);
      const b = await read();
      await page.setViewportSize({ width: vp.width, height: vp.height }); await page.waitForTimeout(800);
      check(`${vp.name}: a browser bar (height −100 px) rebuilds nothing and nothing jumps`, a.w === b.w && a.h === b.h && a.y === b.y && Math.abs(a.v - b.v) < 1e-4, `buffer ${a.w}×${a.h} → ${b.w}×${b.h}, scroll ${a.y} → ${b.y}, progress ${a.v.toFixed(6)} → ${b.v.toFixed(6)}`);
    }
    // 2: touch targets
    if (vp.touch) {
      const t = await page.evaluate(() => {
        const hits = (el, x, y) => { const e = document.elementFromPoint(x, y); return !!e && (e === el || el.contains(e)); };
        const s = document.getElementById('sound'), r = s.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const sound = [[-21, 0], [21, 0], [0, -21], [0, 21]].every(([dx, dy]) => hits(s, cx + dx, cy + dy));
        const rail = document.getElementById('timeline'), collapsed = rail.getBoundingClientRect().width < 10;
        const buttons = [...rail.querySelectorAll('button')];
        let wide = true, minH = Infinity;
        if (!collapsed) for (const b of buttons) {
          const br = b.getBoundingClientRect(), tick = b.querySelector('i').getBoundingClientRect(), x = tick.left + tick.width / 2, y = br.top + br.height / 2;
          wide &&= hits(b, x - 21, y) && hits(b, x + 21, y);
          minH = Math.min(minH, br.height);
        }
        return { sound, collapsed, wide, minH };
      });
      check(`${vp.name}: sound button takes a touch across 44×44 px`, t.sound, t.sound ? 'all four edges' : 'an edge misses');
      if (!t.collapsed) check(`${vp.name}: rail buttons take a touch across 44 px of width`, t.wide, `button height ${t.minH.toFixed(0)} px (44 px of height does not fit 15 chapters here)`);
      else console.log(`INFO  ${vp.name}: rail collapsed to the progress line (short screen)`);
    }
    await ctx.close();
  }
  // 5: device classes
  {
    const page = await (await browser.newContext({ viewport: { width: 1512, height: 982 } })).newPage();
    await page.goto(`${dev.origin}/reference/README-v23.md`); // any same-origin page will do
    const cases = [
      ['Mac, Apple M2 (Chromium), 8 cores', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0, 8, 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)', 'high'],
      ['Mac, Apple GPU (Safari), 10 cores', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/17.0 Safari/605.1.15', 0, 10, 'Apple GPU', 'high'],
      ['iPad (Mac user agent, touch), Apple GPU', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/17.0 Safari/605.1.15', 5, 8, 'Apple GPU', 'mid'],
      ['Mac, Apple GPU, 4 cores', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0, 4, 'Apple GPU', 'mid'],
      ['Windows, Intel UHD, 12 cores', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 0, 12, 'ANGLE (Intel, Intel(R) UHD Graphics Direct3D11)', 'mid'],
      ['Windows, RTX 4070, 16 cores', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 0, 16, 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11)', 'high'],
    ];
    for (const [name, ua, touch, cores, renderer, want] of cases) {
      const got = await page.evaluate(async ([u, tp, c, r]) => {
        const def = (k, v) => Object.defineProperty(Navigator.prototype, k, { configurable: true, get: () => v });
        def('userAgent', u); def('maxTouchPoints', tp); def('hardwareConcurrency', c); def('deviceMemory', 8);
        const q = await import('/src/core/quality.ts');
        return q.pickTier({ webgl2: true, performant: true, maxTextureSize: 16384, renderer: r }, null).name;
      }, [ua, touch, cores, renderer]);
      check(`device class: ${name} → ${want}`, got === want, got);
    }
    await page.context().close();
  }
  const errors = logs.filter((l) => !l.harness);
  check('no console warnings or errors', errors.length === 0, errors.map((e) => `${e.label}: ${e.text}`).join(' | ') || 'none');
} finally { await browser.close(); await dev.close(); }
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
process.exit(results.every(Boolean) ? 0 : 1);
