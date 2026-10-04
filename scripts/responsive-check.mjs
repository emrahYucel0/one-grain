// Responsive check (npm run check:responsive), on the dev server across the matrix's viewports:
//  1. the hero ring's centre is within 2 px of the hero grain as the camera projects it, at every
//     chapter hold (window.__heroRendered, projected after rendering through the matrices the frame was
//     drawn with, mapped through the canvas's own box on screen)
//  2. touch viewports: the sound button takes a touch anywhere in a 44×44 px box around its centre;
//     tablets: every rail button takes one in a 44 px wide box (elementFromPoint; their height is
//     reported); phones: the rail is an indicator only (a progress line with a mark per act change,
//     no buttons, hidden from screen readers, never taking a touch)
//  3. the drawing buffer stays within its tier's pixel budget (core/quality.ts), whatever the DPR,
//     except that high never goes below DPR 1 (and mid does), checked on a 4K screen at DPR 1
//  4. phones: a mobile browser bar coming in (height −100 px) rebuilds nothing: same drawing buffer,
//     same scroll position, same story progress (no ScrollTrigger refresh, no jump)
//     and turning the phone (width and height swapped) keeps the tier
//  5. device classes: the tier picked for an Apple Silicon Mac (Chromium and Safari), an iPad, a
//     4-core Mac, an Intel PC and an RTX PC, a phone either way up, a small tablet and a narrow
//     desktop window (core/quality.ts with a stubbed navigator and screen)
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';
import { launch, watchConsole } from './lib/browser.mjs';
import { startDev } from './lib/servers.mjs';
import { VIEWPORTS } from './lib/viewports.mjs';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { SNAP_POINTS } = await vite.ssrLoadModule('/src/timeline/segments.ts');
const { TIERS } = await vite.ssrLoadModule('/src/core/quality.ts');
const ACTS = readFileSync('index.html', 'utf8').match(/class="act-group" data-act=/g)?.length ?? 0;
await vite.close();
const dev = await startDev(5176);
const browser = await launch();
const logs = [], results = [];
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Mobile/15E148 Safari/604.1';
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
        const h = { ...window.__hero, ...window.__heroRendered }, c = document.getElementById('scene').getBoundingClientRect(), m = document.querySelector('.marker'), r = m.getBoundingClientRect();
        if (!h || !h.visible || h.z >= 1 || Math.abs(h.x) > 1.1 || Math.abs(h.y) > 1.1 || +getComputedStyle(m).opacity === 0) return null;
        return Math.hypot(r.left + r.width / 2 - (c.left + (h.x + 1) / 2 * c.width), r.top + r.height / 2 - (c.top + (1 - h.y) / 2 * c.height));
      });
      if (d !== null) { n++; if (d > worst) { worst = d; where = `hold ${i + 1}`; } }
    }
    check(`${vp.name}: ring on the grain at every hold`, worst <= 2, `${n} holds, at most ${worst.toFixed(2)} px${where ? ` (${where})` : ''}`);
    // 3: the pixel budget
    const buf = await page.evaluate(() => ({ w: document.getElementById('scene').width, h: document.getElementById('scene').height, n: window.__PACK.n }));
    const tierName = Object.values(TIERS).find((t) => t.n === buf.n)?.name ?? '?', floor = Math.min(vp.dpr, TIERS[tierName]?.dprFloor ?? 0);
    const budget = Math.max(TIERS[tierName]?.pixels ?? Infinity, vp.width * vp.height * floor * floor);
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
      await page.setViewportSize({ width: vp.height, height: vp.width }); await page.waitForTimeout(1500);
      const turned = await page.evaluate(() => window.__PACK.n);
      await page.setViewportSize({ width: vp.width, height: vp.height }); await page.waitForTimeout(800);
      check(`${vp.name}: turning the phone keeps the tier`, turned === buf.n, `${buf.n} grains → ${turned}`);
      check(`${vp.name}: a browser bar (height −100 px) rebuilds nothing and nothing jumps`, a.w === b.w && a.h === b.h && a.y === b.y && Math.abs(a.v - b.v) < 1e-4, `buffer ${a.w}×${a.h} → ${b.w}×${b.h}, scroll ${a.y} → ${b.y}, progress ${a.v.toFixed(6)} → ${b.v.toFixed(6)}`);
    }
    // 2: touch targets
    if (vp.touch) {
      const t = await page.evaluate(() => {
        const hits = (el, x, y) => { const e = document.elementFromPoint(x, y); return !!e && (e === el || el.contains(e)); };
        const s = document.getElementById('sound'), r = s.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const sound = [[-21, 0], [21, 0], [0, -21], [0, 21]].every(([dx, dy]) => hits(s, cx + dx, cy + dy));
        const rail = document.getElementById('timeline'), rr = rail.getBoundingClientRect();
        const buttons = [...rail.querySelectorAll('button')], shown = buttons.filter((b) => b.getClientRects().length > 0);
        const ticks = [...rail.querySelectorAll('.tick')].filter((k) => k.getClientRects().length > 0).length;
        const indicator = { line: rr.width <= 4 && rr.height > 100, top: rr.top, ticks, buttons: shown.length, hidden: rail.getAttribute('aria-hidden') === 'true', inert: getComputedStyle(rail).pointerEvents === 'none' };
        let wide = true, minH = Infinity;
        for (const b of shown) {
          const br = b.getBoundingClientRect(), tick = b.querySelector('i').getBoundingClientRect(), x = tick.left + tick.width / 2, y = br.top + br.height / 2;
          wide &&= hits(b, x - 21, y) && hits(b, x + 21, y);
          minH = Math.min(minH, br.height);
        }
        return { sound, wide, minH, indicator };
      });
      check(`${vp.name}: sound button takes a touch across 44×44 px`, t.sound, t.sound ? 'all four edges' : 'an edge misses');
      const ind = t.indicator;
      if (vp.mobile) check(`${vp.name}: rail is an indicator only (progress line, act marks, no buttons)`, ind.line && ind.top >= 96 && ind.ticks === ACTS - 1 && ind.buttons === 0 && ind.hidden && ind.inert,
        `line ${ind.line}, top ${ind.top.toFixed(0)} px, ${ind.ticks} act marks, ${ind.buttons} buttons shown, aria-hidden ${ind.hidden}, takes touches ${!ind.inert}`);
      else check(`${vp.name}: rail buttons take a touch across 44 px of width`, ind.buttons > 0 && !ind.hidden && t.wide, `${ind.buttons} buttons, height ${t.minH.toFixed(0)} px (44 px of height does not fit 15 chapters here)`);
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
      ['iPhone, landscape (screen 844×390)', IPHONE, 5, 6, 'Apple GPU', 'low', [844, 390]],
      ['iPhone, portrait (screen 390×844)', IPHONE, 5, 6, 'Apple GPU', 'low', [390, 844]],
      ['iPad mini, landscape (screen 1133×744)', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/17.0 Safari/605.1.15', 5, 8, 'Apple GPU', 'low', [1133, 744]],
      ['Windows, Intel UHD, 700 px window on a 1920×1080 screen', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 0, 12, 'ANGLE (Intel, Intel(R) UHD Graphics Direct3D11)', 'mid', [1920, 1080], 700],
    ];
    for (const [name, ua, touch, cores, renderer, want, scr = [1512, 982], win = 1512] of cases) {
      const got = await page.evaluate(async ([u, tp, c, r, [sw, sh], iw]) => {
        const def = (proto, k, v) => Object.defineProperty(proto, k, { configurable: true, get: () => v });
        def(Navigator.prototype, 'userAgent', u); def(Navigator.prototype, 'maxTouchPoints', tp); def(Navigator.prototype, 'hardwareConcurrency', c); def(Navigator.prototype, 'deviceMemory', 8);
        def(Screen.prototype, 'width', sw); def(Screen.prototype, 'height', sh); Object.defineProperty(window, 'innerWidth', { configurable: true, get: () => iw });
        const q = await import('/src/core/quality.ts');
        return q.pickTier({ webgl2: true, performant: true, maxTextureSize: 16384, renderer: r }, null).name;
      }, [ua, touch, cores, renderer, scr, win]);
      check(`device class: ${name} → ${want}`, got === want, got);
    }
    // the DPR floor: a 4K screen at DPR 1, and a 5K one at DPR 2
    for (const [w, h, dpr, tier, want] of [[3840, 2160, 1, 'high', 1], [3840, 2160, 1, 'mid', Math.sqrt(2.2e6 / (3840 * 2160))], [2560, 1440, 2, 'high', Math.sqrt(4.5e6 / (2560 * 1440))]]) {
      const got = await page.evaluate(async ([w, h, dpr, tier]) => {
        Object.defineProperty(window, 'devicePixelRatio', { configurable: true, get: () => dpr });
        const q = await import('/src/core/quality.ts');
        return q.pixelRatioFor(q.TIERS[tier], w, h);
      }, [w, h, dpr, tier]);
      check(`pixel ratio: ${tier} at ${w}×${h} @${dpr} → ${want.toFixed(3)}`, Math.abs(got - want) < 1e-6, `${got.toFixed(3)} (${Math.round(w * got)}×${Math.round(h * got)})`);
    }
    await page.context().close();
  }
  const errors = logs.filter((l) => !l.harness);
  check('no console warnings or errors', errors.length === 0, errors.map((e) => `${e.label}: ${e.text}`).join(' | ') || 'none');
} finally { await browser.close(); await dev.close(); }
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
process.exit(results.every(Boolean) ? 0 : 1);
