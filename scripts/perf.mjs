// Performance survey (npm run perf): GPU time per render pass (EXT_disjoint_timer_query_webgl2,
// via ?perf) at every hold and transition midpoint, and while scrubbing through the whole story.
// Frame intervals are reported too, but they are quantised by the display refresh rate; the GPU
// times are what to compare. "GPU frame" is the median of whole frames as measured (raw); "refresh"
// is the median of the frames that also redraw the shadow map (every other frame), the expensive
// ones. Pass columns are smoothed per pass, so they do not add up to a frame: about 1 ms of work left
// over from the previous frame lands in whichever pass is timed first. Headed Chromium on the machine's default GPU, built site.
//   node scripts/perf.mjs [tier=mid] [width=1920] [height=909] [query=extra&url&flags]
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { startPreview } from './lib/servers.mjs';

const [tier = 'mid', width = '1920', height = '909', extra = ''] = process.argv.slice(2);
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { SEGMENTS, SNAP_POINTS, TOTAL, transitionMidpoint } = await vite.ssrLoadModule('/src/timeline/segments.ts');
const { TRANSITIONS } = await vite.ssrLoadModule('/src/story/transitions.ts');
const { WORLDS } = await vite.ssrLoadModule('/src/story/worlds.ts');
await vite.close();

const server = await startPreview(5191);
const browser = await chromium.launch({ channel: 'chromium', headless: false, args: [`--window-size=${+width + 16},${+height + 140}`] });
const DPR = +(process.env.DPR ?? 1); // DPR=2: emulate a 2× screen (the tier's pixel budget then decides the drawing buffer)
const page = await (await browser.newContext({ viewport: { width: +width, height: +height }, deviceScaleFactor: DPR })).newPage();
await page.goto(`${server.origin}/?parity&perf&tier=${tier}${extra ? '&' + extra : ''}`);
await page.waitForFunction(() => window.__PACK && window.__gpu, null, { timeout: 90000 });
const env = await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2'), e = gl.getExtension('WEBGL_debug_renderer_info');
  const c = document.getElementById('scene');
  return { gpu: e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?', n: window.__PACK.n, dpr: devicePixelRatio, timer: window.__gpu.gpu, buffer: `${c.width}×${c.height}` };
});
console.log(`tier ${tier} · ${width}×${height} @${env.dpr} · buffer ${env.buffer} · grains ${env.n} · ${env.gpu} · GPU timer ${env.timer ? 'on' : 'unavailable (CPU frame time only)'}${extra ? ' · ' + extra : ''}`);

/** ~150 frames at a fixed position: median frame interval, raw GPU frames, the pass times at the end. */
const sample = () => page.evaluate(() => new Promise((res) => {
  const ts = [];
  const f = (t) => { ts.push(t); if (ts.length < 150) requestAnimationFrame(f); else {
    const d = ts.slice(1).map((x, i) => x - ts[i]).sort((a, b) => a - b);
    const recent = window.__gpu.recent.slice(-120), med = (a) => { const s = a.sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
    res({ frame: d[d.length >> 1], gpu: window.__gpu, raw: med(recent.map((r) => r.total)), refresh: med(recent.filter((r) => 'shadow' in r.passes).map((r) => r.total)) }); } };
  requestAnimationFrame(f);
}));

const rows = [];
// every hold and transition midpoint, plus "become" (style 21: macro close-up, large grains) at five points
const become = SEGMENTS.filter((x) => x.type === 'tr' && TRANSITIONS[x.i].g === 21).flatMap((seg) => [.2, .4, .55, .7, .85].map((t) => [`become t=${t}`, (seg.start + seg.len * t) / TOTAL, seg.i]));
for (let i = 0; i < WORLDS.length; i++) {
  for (const [kind, v] of [['hold', SNAP_POINTS[i]], ...(i < WORLDS.length - 1 ? [['mid', transitionMidpoint(i)]] : []), ...become.filter((b) => b[2] === i).map((b) => [b[0], b[1]])]) {
    await page.evaluate((x) => { window.__V = x; window.__T = null; }, v);
    await page.waitForTimeout(400);
    const s = await sample();
    rows.push({ at: `${kind} ${WORLDS[i].slug}`, frame: s.frame, total: s.raw, refresh: s.refresh, passes: s.gpu.passes });
  }
}
const passNames = [...new Set(rows.flatMap((r) => Object.keys(r.passes)))];
const fmt = (x) => (x === undefined ? '—' : x.toFixed(2));
console.log(`\n| Position | Frame interval | GPU frame | refresh | ${passNames.join(' | ')} |`);
console.log(`|---|---|---|---|${passNames.map(() => '---').join('|')}|`);
for (const r of rows) console.log(`| ${r.at} | ${r.frame.toFixed(1)} ms | ${fmt(r.total)} ms | ${fmt(r.refresh)} ms | ${passNames.map((p) => fmt(r.passes[p])).join(' | ')} |`);
const sorted = (k) => rows.map((r) => r[k]).sort((a, b) => a - b);
const med = (k) => sorted(k)[rows.length >> 1], worst = (k) => sorted(k).at(-1);
console.log(`\nGPU frame: median ${med('total').toFixed(2)} ms, worst ${worst('total').toFixed(2)} ms · refresh frames: median ${med('refresh').toFixed(2)} ms, worst ${worst('refresh').toFixed(2)} ms · frame interval: median ${med('frame').toFixed(1)} ms, worst ${worst('frame').toFixed(1)} ms`);

// scrub: progress advances every frame through the whole story (lens, axes, stage colour change every frame)
const scrub = await page.evaluate(() => new Promise((res) => {
  const ts = [], gpu = [], refresh = []; let v = 0, last = null;
  const f = (t) => { ts.push(t); const r = window.__gpu.recent.at(-1); if (r && r !== last) { last = r; gpu.push(r.total); if ('shadow' in r.passes) refresh.push(r.total); } v += 1 / 900; window.__V = Math.min(v, 1); window.__T = null; if (v < 1) requestAnimationFrame(f); else {
    const d = ts.slice(1).map((x, i) => x - ts[i]).sort((a, b) => a - b), g = gpu.slice(30).sort((a, b) => a - b), h = refresh.slice(15).sort((a, b) => a - b);
    res({ frame: d[d.length >> 1], frameP95: d[Math.floor(d.length * .95)], gpu: g[g.length >> 1], gpuP95: g[Math.floor(g.length * .95)], refresh: h[h.length >> 1], refreshP95: h[Math.floor(h.length * .95)] }); } };
  requestAnimationFrame(f);
}));
console.log(`scrub through the story: GPU frame median ${scrub.gpu.toFixed(2)} ms (p95 ${scrub.gpuP95.toFixed(2)}), refresh frames median ${scrub.refresh.toFixed(2)} ms (p95 ${scrub.refreshP95.toFixed(2)}), frame interval median ${scrub.frame.toFixed(1)} ms (p95 ${scrub.frameP95.toFixed(1)})`);
await browser.close(); await server.close();
