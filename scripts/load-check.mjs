// First load (npm run check:load), in dev (styles injected by the script) and on the production build:
//  1. the first paint, with the page's script held back 1.5 s: the article is visually hidden and
//     nothing but the stage, the brand and the loading line is painted;
//  2. every frame painted from navigation until the scene arrives (CDP screencast): before html.ready,
//     no light pixel outside the brand and the line;
//  3. the line only moves forward and is full when the scene arrives; no layout shift (CLS 0) up to
//     1.5 s after it;
//  4. reduced motion: the line fills without a transition and the loader is gone at once.
// Screenshots of the first paint, the loading state and the scene's arrival go to parity/load/.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { build } from 'vite';
import { launch, watchConsole } from './lib/browser.mjs';
import { startDev, startPreview } from './lib/servers.mjs';

const OUT = new URL('../parity/load/', import.meta.url);
await mkdir(OUT, { recursive: true });
await build({ logLevel: 'error' });
const browser = await launch();
const logs = [], results = [];
const check = (name, ok, detail) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (${detail})`); };

/** Light pixels (any channel above 110) outside the given boxes (CSS px, scaled to the image). */
const lightOutside = (img, boxes, scale) => {
  let n = 0;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    const i = (y * img.width + x) * 4;
    if (Math.max(img.data[i], img.data[i + 1], img.data[i + 2]) <= 110) continue;
    const cx = x / scale, cy = y / scale;
    if (!boxes.some((b) => cx >= b.left - 4 && cx <= b.right + 4 && cy >= b.top - 4 && cy <= b.bottom + 4)) n++;
  }
  return n;
};
/** The brand and the line, where the loader puts them. */
const loaderBoxes = (page) => page.evaluate(() => ['.loader .brand', '.loader-line'].map((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; }));
const watch = () => {
  // before any script of the page: when html.ready arrives, the loader's fill over time, layout shifts
  window.__load = { readyAt: 0, firstPaint: 0, fills: [], cls: 0 };
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === 'first-paint') window.__load.firstPaint = performance.timeOrigin + e.startTime; }).observe({ type: 'paint', buffered: true });
  new MutationObserver(() => { if (!window.__load.readyAt && document.documentElement.classList.contains('ready')) window.__load.readyAt = performance.timeOrigin + performance.now(); })
    .observe(document, { attributes: true, subtree: true, attributeFilter: ['class'] }); // <html> does not exist yet
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__load.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
  const poll = () => { const f = document.getElementById('loaderFill'); if (f) window.__load.fills.push(+(f.style.getPropertyValue('--load') || 0)); if (!window.__load.readyAt) requestAnimationFrame(poll); };
  requestAnimationFrame(poll);
};

try {
  for (const [mode, start, script] of [['dev', startDev, '**/src/main.ts'], ['prod', startPreview, '**/assets/*.js']]) {
    const srv = await start(mode === 'dev' ? 5181 : 5182);
    // 1: the first paint, script held back
    {
      const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
      await page.route(script, async (r) => { await new Promise((ok) => setTimeout(ok, 1500)); await r.continue(); });
      const nav = page.goto(srv.origin + '/').catch(() => {});
      await page.waitForTimeout(700);
      const shot = await page.screenshot({ path: fileURLToPath(new URL(`first-paint-${mode}.png`, OUT)) });
      const state = await page.evaluate(() => { const r = document.getElementById('story').getBoundingClientRect(), cs = getComputedStyle(document.getElementById('story')); return { w: r.width, h: r.height, clip: cs.clipPath, ready: document.documentElement.classList.contains('ready') }; });
      const boxes = await loaderBoxes(page), light = lightOutside(PNG.sync.read(shot), boxes, 1);
      check(`${mode}: first paint (script held back): the article is hidden`, state.w <= 1 && state.h <= 1 && !state.ready, `article box ${state.w}×${state.h}, clip ${state.clip}`);
      check(`${mode}: first paint: nothing but the stage, the brand and the line`, light === 0, `${light} light pixels elsewhere`);
      await nav; await page.context().close();
    }
    // 2–3: every painted frame until the scene arrives
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await ctx.addInitScript(watch);
      const page = await ctx.newPage();
      watchConsole(page, mode, logs);
      // half-size frames (kept encoded), judged afterwards against where the styled loader puts the brand and the line
      const cdp = await ctx.newCDPSession(page), frames = [];
      cdp.on('Page.screencastFrame', async (f) => {
        frames.push({ t: f.metadata.timestamp * 1000, data: f.data });
        await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
      });
      await cdp.send('Page.startScreencast', { format: 'png', maxWidth: 720, maxHeight: 450, everyNthFrame: 1 });
      await page.goto(srv.origin + '/');
      await page.waitForFunction(() => window.__load.readyAt > 0, null, { timeout: 120000 });
      await page.waitForTimeout(1500);
      await cdp.send('Page.stopScreencast');
      const load = await page.evaluate(() => ({ ...window.__load, fills: window.__load.fills }));
      // frames painted from the page's first paint until html.ready (100 ms to spare: the screencast's
      // timestamps can trail the page's clock); earlier frames are the blank tab before navigation
      const boxes = await loaderBoxes(page);
      const before = frames.filter((f) => f.t >= load.firstPaint - 5 && f.t < load.readyAt - 100);
      for (const f of before) { const img = PNG.sync.read(Buffer.from(f.data, 'base64')); f.light = lightOutside(img, boxes, img.width / 1440); }
      let worst = 0, worstAt = -1;
      before.forEach((f, i) => { if (f.light > worst) { worst = f.light; worstAt = i; } });
      if (worstAt >= 0 && worst > 5) await writeFile(new URL(`worst-${mode}.png`, OUT), Buffer.from(before[worstAt].data, 'base64'));
      check(`${mode}: every frame until the scene arrives shows only the stage, the brand and the line`, before.length > 0 && worst <= 5, `${before.length} frames before ready (half size), at most ${worst} light pixels elsewhere${worstAt >= 0 ? ` (frame ${worstAt})` : ''}`);
      const forward = load.fills.every((v, i) => i === 0 || v >= load.fills[i - 1]), last = load.fills.at(-1) ?? 0, mid = load.fills.filter((v) => v > .1 && v < .9).length;
      check(`${mode}: the line fills forward with the worker's progress, full on arrival`, forward && last === 1 && mid > 0, `${load.fills.length} samples, ${mid} between 10 and 90 %, last ${last}`);
      check(`${mode}: no layout shift until 1.5 s after the scene arrives`, load.cls < .001, `CLS ${load.cls.toFixed(4)}`);
      // screenshots: the loading state (half full) and the arrival
      const t0 = frames[0]?.t ?? 0, pick = (t) => frames.reduce((a, f) => (Math.abs(f.t - t) < Math.abs(a.t - t) ? f : a), frames[0]);
      const half = before.find((f, i) => i > 0 && f.t > t0 + (load.readyAt - t0) / 2) ?? before.at(-1);
      if (half) await writeFile(new URL(`loading-${mode}.png`, OUT), Buffer.from(half.data, 'base64'));
      for (const dt of [0, 200, 400, 600, 1000]) await writeFile(new URL(`arrival-${mode}-${dt}ms.png`, OUT), Buffer.from(pick(load.readyAt + dt).data, 'base64'));
      await ctx.close();
    }
    // 4: reduced motion (production)
    if (mode === 'prod') {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
      await ctx.addInitScript(watch);
      const page = await ctx.newPage();
      watchConsole(page, `${mode} reduced`, logs);
      await page.goto(srv.origin + '/');
      const during = await page.evaluate(() => getComputedStyle(document.getElementById('loaderFill')).transitionDuration);
      await page.waitForFunction(() => window.__load.readyAt > 0, null, { timeout: 120000 });
      const after = await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(getComputedStyle(document.getElementById('loader')).opacity))));
      check('reduced motion: the line fills without animation, the loader goes at once', during === '0s' && after === '0', `fill transition ${during}, loader opacity a frame after ready ${after}`);
      await ctx.close();
    }
    await srv.close();
  }
  const errors = logs.filter((x) => !x.harness);
  check('no console warnings or errors', errors.length === 0, errors.map((e) => `${e.label}: ${e.text}`).join(' | ') || 'none');
} finally { await browser.close(); }
console.log(`\n${results.filter(Boolean).length}/${results.length} passed; screenshots in parity/load/`);
process.exit(results.every(Boolean) ? 0 : 1);
