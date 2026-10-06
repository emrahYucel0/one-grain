// First load (npm run check:load), in dev (styles injected by the script) and on the production build:
//  1. the first paint, with the page's script held back 1.5 s: the article is visually hidden and
//     nothing but the first screen is painted: the stage, the brand, the intro's title and its line,
//     and the loading line under them (index.html); the title is painted;
//  2. every frame painted from navigation until the scene arrives (CDP screencast): before html.ready,
//     no light pixel outside the first screen;
//  3. the line only moves forward and is full when the scene arrives; no layout shift (CLS 0) up to
//     1.5 s after it;
//  4. reduced motion: the line fills without a transition and the loader is gone at once;
//  5. under mobile throttling (Lighthouse's mobile: 4x CPU, slow 4G, a phone viewport) the first
//     contentful paint comes at once with the intro's title, styled by the HTML alone (index.html);
//     the largest contentful paint: on a desktop window the title block at the first paint, after the
//     scene and the chapter text have arrived (on a phone, reported);
//  6. WebKit: the same first paint (the brand painted, the article hidden), the scene arriving, and
//     no console warnings or errors;
//  7. the startup guard (index.html), production, Chromium and WebKit, each failure forced: a script
//     that does not load, startup throwing, no WebGL2, a texture limit too small even for low, the
//     worker and the main-thread build both failing, loading stalled: each reveals the article and
//     the note, with the reason in the ?debug report. Degraded but running: the worker alone failing
//     (built on the main thread), no half-float render targets (8-bit post).
// Screenshots of the first paint, the loading state, the scene's arrival and each fallback go to
// parity/load/.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { webkit } from 'playwright';
import { PNG } from 'pngjs';
import { build } from 'vite';
import { launch, watchConsole } from './lib/browser.mjs';
import { startDev, startPreview } from './lib/servers.mjs';

const OUT = new URL('../parity/load/', import.meta.url);
await mkdir(OUT, { recursive: true });
await build({ logLevel: 'error' });
const browser = await launch();
const logs = [], results = [];
const check = (name, ok, detail) => { if (ok !== null) results.push(ok); console.log(`${ok === null ? 'INFO' : ok ? 'PASS' : 'FAIL'}  ${name}  (${detail})`); };

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
/** Light pixels inside a box (CSS px, scaled to the image): the brand painted. */
const lightInside = (img, b, scale) => {
  let n = 0;
  for (let y = Math.max(0, Math.floor(b.top * scale)); y < Math.min(img.height, b.bottom * scale); y++) for (let x = Math.max(0, Math.floor(b.left * scale)); x < Math.min(img.width, b.right * scale); x++) {
    const i = (y * img.width + x) * 4;
    if (Math.max(img.data[i], img.data[i + 1], img.data[i + 2]) > 110) n++;
  }
  return n;
};
/** The first screen: the brand, the intro's title and its line, the loading line. */
const loaderBoxes = (page) => page.evaluate(() => ['.loader .brand', '.intro-head', '.intro .loader-line'].map((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; }));
/** Forced startup failures (section 7): init scripts run before the page; routes are production chunk names. */
const GUARD_CASES = [
  { id: 'script', name: 'a script does not load (three.js)', routes: [['**/assets/three-*.js', 'abort']], expect: 'fallback', reason: /script did not load/ },
  { id: 'throw', name: 'startup throws (creating the renderer)', expect: 'fallback', reason: /FALLBACK/,
    init: () => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, a) { if (this.id === 'scene') throw new Error('forced startup failure'); return g.call(this, t, a); }; } },
  { id: 'nogl', name: 'no WebGL2', expect: 'fallback', reason: /no WebGL2/,
    init: () => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, a) { return t === 'webgl2' ? null : g.call(this, t, a); }; } },
  { id: 'limits', name: 'a texture limit too small even for low', expect: 'fallback', reason: /texture limit/,
    init: () => { const p = WebGL2RenderingContext.prototype, g = p.getParameter; p.getParameter = function (k) { return k === 0x0D33 ? 512 : g.call(this, k); }; } },
  { id: 'build', name: 'the worker and the main-thread build both fail to load', routes: [['**/assets/sim.worker-*.js', 'abort'], ['**/assets/build-*.js', 'abort']], expect: 'fallback', reason: /FALLBACK/ },
  { id: 'stall', name: 'loading stalls (the worker never answers)', routes: [['**/assets/sim.worker-*.js', 'hang']], expect: 'fallback', reason: /no progress for 8 s/ },
  { id: 'worker', name: 'the worker alone fails to load', routes: [['**/assets/sim.worker-*.js', 'abort']], expect: 'scene', reason: /worker|building here/ },
  { id: 'halffloat', name: 'no half-float render targets', expect: 'scene', reason: /half-float/,
    init: () => {
      const p = WebGL2RenderingContext.prototype, ge = p.getExtension, gs = p.getSupportedExtensions, hide = /^EXT_color_buffer_(half_)?float$/;
      p.getExtension = function (n) { return hide.test(n) ? null : ge.call(this, n); };
      p.getSupportedExtensions = function () { return (gs.call(this) ?? []).filter((n) => !hide.test(n)); };
    } },
];
/** Every largest-contentful-paint candidate, from before any script of the page. */
const watchLcp = () => new PerformanceObserver((l) => { for (const e of l.getEntries()) (window.__lcp ??= []).push({ el: e.element?.className || e.element?.tagName, t: e.startTime, size: e.size }); }).observe({ type: 'largest-contentful-paint', buffered: true });
/** The last candidate once the scene and the chapter text are on screen (2 s after html.ready). */
async function finalLcp(page, raw = false) {
  await page.waitForFunction(() => document.documentElement.classList.contains('ready'), null, { timeout: 120000 });
  await page.waitForTimeout(2000);
  const { lcp, fcp } = await page.evaluate(() => ({ lcp: window.__lcp ?? [], fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? -1 }));
  const last = lcp.at(-1) ?? { el: 'none', t: -1, size: 0 };
  const text = `${last.el} at ${Math.round(last.t)} ms (${Math.round(last.size)} px²), first paint ${Math.round(fcp)} ms; candidates ${lcp.map((c) => `${c.el} ${Math.round(c.t)} ms ${Math.round(c.size)} px²`).join(', ')}`;
  return raw ? { ...last, fcp, text } : text;
}
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

/** One forced failure: the fallback with its reason, or (degraded cases) the scene still arriving. */
async function guardCase(b, engine, srv, c) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  if (c.init) await ctx.addInitScript(c.init);
  const page = await ctx.newPage();
  for (const [pattern, how] of c.routes ?? []) await page.route(pattern, (r) => (how === 'abort' ? r.abort() : undefined)); // 'hang': never answered
  await page.goto(`${srv.origin}/?debug`).catch(() => {});
  const want = c.expect === 'fallback' ? 'failed' : 'ready';
  const ok = await page.waitForFunction((k) => document.documentElement.classList.contains(k), want, { timeout: 20000 }).then(() => true, () => false);
  if (ok && want === 'ready') await page.waitForTimeout(800);
  const st = await page.evaluate(() => {
    const cs = (sel) => getComputedStyle(document.querySelector(sel)), story = document.getElementById('story').getBoundingClientRect();
    return { cls: document.documentElement.className, note: cs('.fallback-note').display, story: story.width > 200 && story.height > 400, canvas: cs('#scene').display, loader: cs('#loader').display, report: document.querySelector('.og-errors')?.textContent ?? '' };
  }).catch((e) => ({ err: e.message, report: '' }));
  const shot = await page.screenshot({ path: fileURLToPath(new URL(`guard-${engine}-${c.id}.png`, OUT)) }).catch(() => null);
  const line = st.report.split('\n').find((l) => (c.expect === 'fallback' ? /FALLBACK/ : c.reason).test(l))?.replace(/^\s*[\d.]+ s\s+/, '') ?? '';
  if (c.expect === 'fallback') {
    check(`guard (${engine}): ${c.name} → the article and the note`, ok && st.note === 'block' && st.story && st.canvas === 'none' && st.loader === 'none' && c.reason.test(st.report),
      ok ? `${line || 'no reason shown'}; note ${st.note}, article shown ${st.story}, canvas ${st.canvas}` : `no fallback within 20 s (${st.cls ?? st.err})`);
  } else {
    const img = shot ? PNG.sync.read(shot) : null, lit = img ? lightOutside(img, [], img.width / 390) : 0;
    check(`guard (${engine}): ${c.name} → the scene still arrives`, ok && st.note === 'none' && lit > 500 && c.reason.test(st.report),
      ok ? `${line || 'not reported'}; ${lit} light pixels drawn` : `no scene within 20 s (${st.cls ?? st.err})`);
  }
  await ctx.close();
}

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
      const boxes = await loaderBoxes(page), img = PNG.sync.read(shot), light = lightOutside(img, boxes, 1), title = lightInside(img, boxes[1], 1);
      check(`${mode}: first paint (script held back): the article is hidden`, state.w <= 1 && state.h <= 1 && !state.ready, `article box ${state.w}×${state.h}, clip ${state.clip}`);
      check(`${mode}: first paint: nothing but the first screen (stage, brand, title and its line, loading line)`, light === 0, `${light} light pixels elsewhere`);
      check(`${mode}: first paint (script held back): the intro's title is painted`, title > 400, `${title} light pixels in the title block`);
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
      check(`${mode}: every frame until the scene arrives shows only the first screen`, before.length > 0 && worst <= 5, `${before.length} frames before ready (half size), at most ${worst} light pixels elsewhere${worstAt >= 0 ? ` (frame ${worstAt})` : ''}`);
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
    // 5: mobile throttling
    {
      const ctx = await browser.newContext({ viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8 * .9, uploadThroughput: 750e3 / 8 * .9 });
      await ctx.addInitScript(watchLcp);
      await page.goto(srv.origin + '/', { waitUntil: 'commit' });
      await page.waitForFunction(() => performance.getEntriesByName('first-contentful-paint').length > 0, null, { timeout: 60000 });
      const r = await page.evaluate(() => {
        const b = document.querySelector('.intro-title'), cs = getComputedStyle(b), box = b.getBoundingClientRect();
        return { fcp: performance.getEntriesByName('first-contentful-paint')[0].startTime, vis: cs.visibility, op: cs.opacity, w: box.width, text: b.textContent, ready: document.documentElement.classList.contains('ready') };
      });
      await page.screenshot({ path: fileURLToPath(new URL(`throttled-fcp-${mode}.png`, OUT)) });
      check(`${mode}: mobile throttling (4x CPU, slow 4G): the first contentful paint comes at once, with the intro's title`, r.fcp < 4000 && r.vis === 'visible' && +r.op === 1 && r.w > 100 && !r.ready,
        `FCP ${(r.fcp / 1000).toFixed(2)} s, "${r.text}" ${r.vis}, opacity ${r.op}, ${r.w.toFixed(0)} px wide, scene not yet there`);
      const phone = await finalLcp(page);
      check(`${mode}: the largest contentful paint at 412×823 (Lighthouse's phone), after the scene arrives`, null, phone);
      await ctx.close();
    }
    // 5b: the largest contentful paint on a desktop window: the title block, at the first paint
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await ctx.addInitScript(watchLcp);
      const page = await ctx.newPage();
      await page.goto(srv.origin + '/');
      const r = await finalLcp(page, true);
      check(`${mode}: largest contentful paint at 1440×900: the intro's title block, at the first paint`, r.el === 'intro-head' && Math.abs(r.t - r.fcp) < 50, r.text);
      await ctx.close();
    }
    // 6: WebKit
    {
      const wk = await webkit.launch();
      try {
        const page = await (await wk.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
        watchConsole(page, `${mode} webkit`, logs);
        await page.route(script, async (r) => { await new Promise((ok) => setTimeout(ok, 1500)); await r.continue(); });
        const nav = page.goto(srv.origin + '/').catch(() => {});
        await page.waitForTimeout(700);
        const shot = await page.screenshot({ path: fileURLToPath(new URL(`first-paint-${mode}-webkit.png`, OUT)) });
        const hidden = await page.evaluate(() => document.getElementById('story').getBoundingClientRect().width <= 1);
        const boxes = await loaderBoxes(page), img = PNG.sync.read(shot), scale = img.width / 1440;
        const title = lightInside(img, boxes[1], scale), light = lightOutside(img, boxes, scale);
        check(`${mode}: WebKit first paint: the title painted, nothing outside the first screen, the article hidden`, title > 400 && light === 0 && hidden, `${title} light pixels in the title block, ${light} elsewhere, article hidden ${hidden}`);
        await nav;
        const arrived = await page.waitForFunction(() => document.documentElement.classList.contains('ready'), null, { timeout: 120000 }).then(() => true, () => false);
        await page.waitForTimeout(1000);
        check(`${mode}: WebKit: the scene arrives`, arrived, arrived ? 'html.ready' : 'not within 120 s');
        await page.context().close();
      } finally { await wk.close(); }
    }
    // 7: the startup guard's failure paths (production)
    if (mode === 'prod') {
      for (const [engine, open] of [['chromium', () => launch()], ['webkit', () => webkit.launch()]]) {
        const b = await open();
        try {
          for (const c of GUARD_CASES) await guardCase(b, engine, srv, c);
        } finally { await b.close(); }
      }
    }
    await srv.close();
  }
  const errors = logs.filter((x) => !x.harness);
  check('no console warnings or errors', errors.length === 0, errors.map((e) => `${e.label}: ${e.text}`).join(' | ') || 'none');
} finally { await browser.close(); }
console.log(`\n${results.filter(Boolean).length}/${results.length} passed; screenshots in parity/load/`);
process.exit(results.every(Boolean) ? 0 : 1);
