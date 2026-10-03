// Frame cost (npm run perf:frame): what each frame costs on the main thread and on the GPU, and how
// steady the cadence is. Headed Chromium on the built site, mid tier, 1920×909.
//   - per hold (progress pinned, as npm run perf) and during a real scroll-through (wheel input
//     through ScrollTrigger, snapping on), each measured twice: once untraced for the cadence and
//     the GPU (tracing slows the page), once with a Chrome trace of the renderer's main thread, split
//     per frame (BeginMainThreadFrame) into script, style, layout and paint/commit;
//   - layouts forced from script (a Layout inside a script event);
//   - the raw GPU frame (window.__gpu.recent) and the interval between rendered frames (window.__renderT:
//     the pacer may skip refreshes, so rAF timestamps alone would not show the cadence), bucketed
//     in refresh intervals (on a 144 Hz panel 1 = 6.9 ms, 2 = 13.9 ms, 3 = 20.8 ms); the refresh
//     interval is measured first on a blank page;
//   - for frames whose main-thread work exceeds 13.9 ms, the longest events and their source.
//   node scripts/frame-cost.mjs [query=extra&url&flags] [slug,slug|all]
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { startPreview } from './lib/servers.mjs';

const [extra = '', which = 'all'] = process.argv.slice(2);
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { SNAP_POINTS } = await vite.ssrLoadModule('/src/timeline/segments.ts');
const { WORLDS } = await vite.ssrLoadModule('/src/story/worlds.ts');
await vite.close();

const W = 1920, H = 909, BUDGET = 13.9;
const server = await startPreview(5193);
const browser = await chromium.launch({ channel: 'chromium', headless: false, args: [`--window-size=${W + 16},${H + 140}`] });
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
// the display's refresh interval: rAF on a page that draws nothing
const blank = await ctx.newPage();
await blank.goto(`${server.origin}/reference/README-v15.md`);
const refresh = await blank.evaluate(() => new Promise((res) => { const t = []; const f = (x) => { t.push(x); if (t.length < 240) requestAnimationFrame(f); else { const d = t.slice(1).map((v, i) => v - t[i]).sort((a, b) => a - b); res(d[d.length >> 1]); } }; requestAnimationFrame(f); }));
await blank.close();
const page = await ctx.newPage();
await page.bringToFront();
await page.goto(`${server.origin}/?parity&perf&tier=mid${extra ? '&' + extra : ''}`);
await page.waitForFunction(() => window.__PACK && window.__gpu, null, { timeout: 90000 });
await page.waitForTimeout(1500);

const CATEGORIES = ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'toplevel', 'v8.execute'];
const SCRIPT = new Set(['FunctionCall', 'FireAnimationFrame', 'TimerFire', 'EventDispatch', 'EvaluateScript', 'v8.callFunction', 'RunMicrotasks']);
const STYLE = new Set(['UpdateLayoutTree', 'RecalculateStyles', 'ScheduleStyleRecalculation']);
const LAYOUT = new Set(['Layout']);
const PAINT = new Set(['Paint', 'PrePaint', 'Layerize', 'UpdateLayer', 'Commit', 'PaintImage', 'RasterTask', 'CompositeLayers']);

/** Untraced: rAF intervals and raw GPU frames over `ms` (or while `during` runs). */
async function cadenceRun(ms, during) {
  // rAF timestamps and each newly resolved GPU frame, collected in the page (no polling from outside)
  await page.evaluate(() => {
    window.__renderT = []; window.__renderLock = [];
    const own = window.__rafT = { raf: [], gpu: [] }; let last = null;
    const f = (t) => { if (window.__rafT !== own) return; own.raf.push(t); const r = window.__gpu.recent.at(-1); if (r && r !== last) { last = r; own.gpu.push(r.total); } requestAnimationFrame(f); };
    requestAnimationFrame(f);
  });
  const t0 = Date.now();
  await during?.();
  await page.waitForTimeout(Math.max(0, ms - (Date.now() - t0)));
  return page.evaluate(() => { const r = window.__rafT; window.__rafT = null; return { raf: window.__renderT.slice(), gpu: r.gpu, locked: window.__renderLock.filter((l) => l > 0).length / Math.max(1, window.__renderLock.length), lock: Math.max(0, ...window.__renderLock) }; });
}

/** Traced: per-frame main-thread costs over `ms` (or while `during` runs). */
async function traceRun(ms, during) {
  await browser.startTracing(page, { categories: CATEGORIES });
  const t0 = Date.now();
  await during?.();
  await page.waitForTimeout(Math.max(0, ms - (Date.now() - t0)));
  return frames(JSON.parse((await browser.stopTracing()).toString()).traceEvents);
}

async function measure(ms, during, reset) {
  const c = await cadenceRun(ms, during);
  await reset?.();
  return { ...c, ...(await traceRun(ms, during)) };
}

/** Per-frame main-thread cost from trace events. */
function frames(events) {
  const main = events.find((e) => e.name === 'thread_name' && e.args?.name === 'CrRendererMain');
  const ev = events.filter((e) => e.pid === main?.pid && e.tid === main?.tid && e.ph === 'X' && e.dur !== undefined);
  const begins = events.filter((e) => e.pid === main?.pid && e.tid === main?.tid && e.name === 'BeginMainThreadFrame').map((e) => e.ts).sort((a, b) => a - b);
  const tasks = ev.filter((e) => e.name === 'RunTask' || e.name === 'ThreadControllerImpl::RunTask');
  const out = [];
  for (let k = 0; k + 1 < begins.length; k++) {
    const a = begins[k], b = begins[k + 1], within = (e) => e.ts >= a && e.ts < b;
    const sum = (set) => ev.filter((e) => within(e) && set.has(e.name)).reduce((s, e) => s + e.dur, 0) / 1000;
    const busy = union(tasks.filter(within)) / 1000;
    const scriptEv = ev.filter((e) => within(e) && SCRIPT.has(e.name));
    const forced = ev.filter((e) => within(e) && LAYOUT.has(e.name) && scriptEv.some((s) => e.ts >= s.ts && e.ts + e.dur <= s.ts + s.dur)).length;
    const style = sum(STYLE), layout = sum(LAYOUT), paint = sum(PAINT);
    out.push({ busy, style, layout, paint, script: Math.max(0, busy - style - layout - paint - 0), forced, top: busy > BUDGET ? topEvents(ev.filter(within)) : null });
  }
  return { cost: out };
}

/** Total time covered by possibly nested or duplicated task events (RunTask and its ThreadController twin). */
function union(list) {
  const iv = list.map((e) => [e.ts, e.ts + e.dur]).sort((a, b) => a[0] - b[0]);
  let total = 0, end = -Infinity;
  for (const [a, b] of iv) { if (b <= end) continue; total += b - Math.max(a, end); end = b; }
  return total;
}

function topEvents(list) {
  return list.filter((e) => e.name !== 'RunTask' && e.name !== 'ThreadControllerImpl::RunTask').sort((x, y) => y.dur - x.dur).slice(0, 4).map((e) => {
    const d = e.args?.data ?? e.args?.beginData ?? {};
    const b = e.args?.beginData;
    const objs = e.name === 'Layout' && b ? ` (${b.dirtyObjects}/${b.totalObjects} objects${b.partialLayout ? ', partial' : ''})` : '';
    const src = d.url ? ` ${String(d.url).split('/').pop()}:${d.lineNumber ?? ''}${d.functionName ? ' ' + d.functionName : ''}` : d.functionName ? ` ${d.functionName}` : '';
    return `${e.name}${objs}${src} ${(e.dur / 1000).toFixed(1)}`;
  });
}

const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : NaN; };
const med = (a) => q(a, .5);
const std = (a) => { const m = a.reduce((s, x) => s + x, 0) / a.length; return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length); };
function cadence(raf) {
  const d = raf.slice(1).map((x, i) => x - raf[i]).filter((x) => x > 0 && x < 1000);
  const buckets = {};
  for (const x of d) { const n = Math.max(1, Math.round(x / refresh)); buckets[n] = (buckets[n] ?? 0) + 1; }
  const share = Object.entries(buckets).sort((a, b) => +a[0] - +b[0]).map(([n, c]) => `${n}×${Math.round(100 * c / d.length)}%`).join(' ');
  return { d, share, median: med(d), p95: q(d, .95), sd: std(d) };
}
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '—'), f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '—');

const rows = [], worst = [];
const report = (at, m) => {
  const c = cadence(m.raf), cost = m.cost;
  rows.push(`| ${at} | ${f1(c.median)} ms (sd ${f1(c.sd)}, p95 ${f1(c.p95)}) | ${c.share}${m.locked ? ` (locked ${Math.round(m.locked * 100)} % of frames, to ${m.lock})` : ''} | ${f2(med(cost.map((x) => x.busy)))} / ${f2(q(cost.map((x) => x.busy), .95))} / ${f2(Math.max(...cost.map((x) => x.busy)))} | ${f2(med(cost.map((x) => x.script)))} | ${f2(med(cost.map((x) => x.style)))} | ${f2(med(cost.map((x) => x.layout)))} | ${f2(med(cost.map((x) => x.paint)))} | ${cost.reduce((s, x) => s + x.forced, 0)} | ${f2(med(m.gpu))} / ${f2(q(m.gpu, .95))} / ${f2(Math.max(...m.gpu))} |`);
  for (const x of cost) if (x.top) worst.push(`${at}: ${x.busy.toFixed(1)} ms main thread — ${x.top.join(' · ')}`);
};

const slugs = which === 'all' ? WORLDS.map((w) => w.slug) : which.split(',');
for (const slug of slugs) {
  const i = WORLDS.findIndex((w) => w.slug === slug);
  await page.evaluate((x) => { window.__V = x; window.__T = null; }, SNAP_POINTS[i]);
  await page.waitForTimeout(1500);
  report(`hold ${slug}`, await measure(2500));
}
// a real scroll-through: wheel input from the top, ScrollTrigger scrub and snap as a visitor gets them
const toTop = async () => { await page.evaluate(() => { window.__V = null; window.scrollTo(0, 0); }); await page.waitForTimeout(3000); await page.mouse.move(W / 2, H / 2); };
await toTop();
report('scroll-through (wheel)', await measure(0, async () => {
  for (let k = 0; k < 400; k++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(40); }
  await page.waitForTimeout(2500);
}, toTop));

console.log(`frame cost · mid · ${W}×${H}${extra ? ' · ' + extra : ''} · refresh ≈ ${refresh.toFixed(2)} ms (${(1000 / refresh).toFixed(0)} Hz)\n`);
console.log('| Position | Frame interval | Cadence (refreshes per frame) | Main thread median / p95 / max | script | style | layout | paint | forced layouts | GPU frame median / p95 / max |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) console.log(r);
console.log(`\nframes with more than ${BUDGET} ms of main-thread work: ${worst.length}`);
for (const w of worst.slice(0, 25)) console.log(`  ${w}`);
await browser.close(); await server.close();
