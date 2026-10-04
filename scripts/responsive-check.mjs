// Responsive check (npm run check:responsive), on the dev server across the matrix's viewports:
//  1. the hero ring's centre is within 2 px of the hero grain as the camera projects it, at every
//     chapter hold (window.__hero mapped through the canvas's own box on screen)
//  2. touch viewports: the sound button takes a touch anywhere in a 44×44 px box around its centre,
//     and every rail button in a 44 px wide one (elementFromPoint); the rail buttons' height is
//     reported (15 chapters do not fit 44 px each on a phone)
import { createServer } from 'vite';
import { launch, watchConsole } from './lib/browser.mjs';
import { startDev } from './lib/servers.mjs';
import { VIEWPORTS } from './lib/viewports.mjs';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { SNAP_POINTS } = await vite.ssrLoadModule('/src/timeline/segments.ts');
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
  const errors = logs.filter((l) => !l.harness);
  check('no console warnings or errors', errors.length === 0, errors.map((e) => `${e.label}: ${e.text}`).join(' | ') || 'none');
} finally { await browser.close(); await dev.close(); }
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
process.exit(results.every(Boolean) ? 0 : 1);
