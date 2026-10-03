// Performance survey (npm run perf): GPU time per render pass (EXT_disjoint_timer_query_webgl2,
// via ?perf) at every hold and transition midpoint, and while scrubbing through the whole story.
// Frame intervals are reported too, but they are quantised by the display refresh rate; the GPU
// times are what to compare. Headed Chromium on the machine's default GPU, built site.
//   node scripts/perf.mjs [tier=mid] [width=1920] [height=909] [query=extra&url&flags]
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { startPreview } from './lib/servers.mjs';

const [tier = 'mid', width = '1920', height = '909', extra = ''] = process.argv.slice(2);
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { SNAP_POINTS, transitionMidpoint } = await vite.ssrLoadModule('/src/timeline/segments.ts');
const { WORLDS } = await vite.ssrLoadModule('/src/story/worlds.ts');
await vite.close();

const server = await startPreview(5191);
const browser = await chromium.launch({ channel: 'chromium', headless: false, args: [`--window-size=${+width + 16},${+height + 140}`] });
const page = await (await browser.newContext({ viewport: { width: +width, height: +height } })).newPage();
await page.goto(`${server.origin}/?parity&perf&tier=${tier}${extra ? '&' + extra : ''}`);
await page.waitForFunction(() => window.__PACK && window.__gpu, null, { timeout: 90000 });
const env = await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2'), e = gl.getExtension('WEBGL_debug_renderer_info');
  return { gpu: e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?', n: window.__PACK.n, dpr: devicePixelRatio, timer: window.__gpu.gpu };
});
console.log(`tier ${tier} · ${width}×${height} · grains ${env.n} · ${env.gpu} · GPU timer ${env.timer ? 'on' : 'unavailable (CPU frame time only)'}${extra ? ' · ' + extra : ''}`);

/** ~150 frames at a fixed position: median frame interval and the GPU pass times at the end. */
const sample = () => page.evaluate(() => new Promise((res) => {
  const ts = [];
  const f = (t) => { ts.push(t); if (ts.length < 150) requestAnimationFrame(f); else {
    const d = ts.slice(1).map((x, i) => x - ts[i]).sort((a, b) => a - b);
    res({ frame: d[d.length >> 1], gpu: window.__gpu }); } };
  requestAnimationFrame(f);
}));

const rows = [];
for (let i = 0; i < WORLDS.length; i++) {
  for (const [kind, v] of [['hold', SNAP_POINTS[i]], ...(i < WORLDS.length - 1 ? [['mid', transitionMidpoint(i)]] : [])]) {
    await page.evaluate((x) => { window.__V = x; window.__T = null; }, v);
    await page.waitForTimeout(400);
    const s = await sample();
    rows.push({ at: `${kind} ${WORLDS[i].slug}`, frame: s.frame, total: s.gpu.total, passes: s.gpu.passes });
  }
}
const passNames = [...new Set(rows.flatMap((r) => Object.keys(r.passes)))];
const fmt = (x) => (x === undefined ? '—' : x.toFixed(2));
console.log(`\n| Position | Frame interval | GPU total | ${passNames.join(' | ')} |`);
console.log(`|---|---|---|${passNames.map(() => '---').join('|')}|`);
for (const r of rows) console.log(`| ${r.at} | ${r.frame.toFixed(1)} ms | ${fmt(r.total)} ms | ${passNames.map((p) => fmt(r.passes[p])).join(' | ')} |`);
const sorted = (k) => rows.map((r) => r[k]).sort((a, b) => a - b);
const med = (k) => sorted(k)[rows.length >> 1], worst = (k) => sorted(k).at(-1);
console.log(`\nGPU total: median ${med('total').toFixed(2)} ms, worst ${worst('total').toFixed(2)} ms · frame interval: median ${med('frame').toFixed(1)} ms, worst ${worst('frame').toFixed(1)} ms`);

// scrub: progress advances every frame through the whole story (lens, axes, stage colour change every frame)
const scrub = await page.evaluate(() => new Promise((res) => {
  const ts = [], gpu = []; let v = 0;
  const f = (t) => { ts.push(t); gpu.push(window.__gpu.total); v += 1 / 900; window.__V = Math.min(v, 1); window.__T = null; if (v < 1) requestAnimationFrame(f); else {
    const d = ts.slice(1).map((x, i) => x - ts[i]).sort((a, b) => a - b), g = gpu.slice(30).sort((a, b) => a - b);
    res({ frame: d[d.length >> 1], frameP95: d[Math.floor(d.length * .95)], gpu: g[g.length >> 1], gpuWorst: g.at(-1) }); } };
  requestAnimationFrame(f);
}));
console.log(`scrub through the story: GPU total median ${scrub.gpu.toFixed(2)} ms (worst ${scrub.gpuWorst.toFixed(2)}), frame interval median ${scrub.frame.toFixed(1)} ms (p95 ${scrub.frameP95.toFixed(1)})`);
await browser.close(); await server.close();
