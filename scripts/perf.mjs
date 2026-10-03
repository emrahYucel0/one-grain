// Frame-time survey (npm run perf, after a build): median and 95th-percentile frame time at
// every hold and transition midpoint, headed Chromium on the machine's default GPU.
//   node scripts/perf.mjs [tier=mid] [width=1440] [height=900]
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { startPreview } from './lib/servers.mjs';

const [tier = 'mid', width = '1440', height = '900'] = process.argv.slice(2);
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { SNAP_POINTS, transitionMidpoint } = await vite.ssrLoadModule('/src/timeline/segments.ts');
const { WORLDS } = await vite.ssrLoadModule('/src/story/worlds.ts');
await vite.close();

const server = await startPreview(5191);
const browser = await chromium.launch({ channel: 'chromium', headless: false, args: [`--window-size=${+width + 16},${+height + 140}`] });
const page = await (await browser.newContext({ viewport: { width: +width, height: +height } })).newPage();
await page.goto(`${server.origin}/?parity&tier=${tier}`);
await page.waitForFunction(() => window.__PACK, null, { timeout: 90000 });
const gpu = await page.evaluate(() => { const gl = document.createElement('canvas').getContext('webgl2'); const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; });
console.log(`tier ${tier} · ${width}×${height} · grains ${await page.evaluate(() => window.__PACK.n)} · ${gpu}`);

const measure = () => page.evaluate(() => new Promise((res) => {
  const ts = []; const f = (t) => { ts.push(t); if (ts.length < 150) requestAnimationFrame(f); else {
    const d = ts.slice(1).map((x, i) => x - ts[i]).sort((a, b) => a - b);
    res([d[d.length >> 1], d[Math.floor(d.length * .95)]]); } };
  requestAnimationFrame(f);
}));
const rows = [];
for (let i = 0; i < WORLDS.length; i++) {
  for (const [kind, v] of [['hold', SNAP_POINTS[i]], ...(i < WORLDS.length - 1 ? [['mid', transitionMidpoint(i)]] : [])]) {
    await page.evaluate((x) => { window.__V = x; window.__T = null; }, v);
    await page.waitForTimeout(400);
    const [med, p95] = await measure();
    rows.push({ at: `${kind} ${WORLDS[i].slug}`, med, p95 });
  }
}
for (const r of rows) console.log(`${r.at.padEnd(14)} median ${r.med.toFixed(1).padStart(5)} ms  p95 ${r.p95.toFixed(1).padStart(5)} ms`);
const meds = rows.map((r) => r.med).sort((a, b) => a - b);
console.log(`overall: median of medians ${meds[meds.length >> 1].toFixed(1)} ms (${(1000 / meds[meds.length >> 1]).toFixed(0)} fps), worst ${meds[meds.length - 1].toFixed(1)} ms`);
await browser.close(); await server.close();
