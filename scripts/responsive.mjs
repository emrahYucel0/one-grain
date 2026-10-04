// Responsive matrix (npm run responsive [before|after]): the built site in headed Chromium on this
// machine's GPU, at every chapter hold and at display → now t = .3 / .7, across phones, tablets
// and desktops. One contact sheet per viewport → docs/responsive/<label>/<viewport>.jpg; the single
// shots go to the OS temp folder. The tier is picked as on a real visit (no ?tier).
// Also measured at every hold: the hero ring's centre against the hero grain as the camera projects
// it (through the canvas's own box on screen), in CSS px.
import { mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { startPreview } from './lib/servers.mjs';
import { VIEWPORTS } from './lib/viewports.mjs';


const label = process.argv[2] ?? 'before', only = process.argv[3];
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { SEGMENTS, SNAP_POINTS, TOTAL } = await vite.ssrLoadModule('/src/timeline/segments.ts');
const { WORLDS } = await vite.ssrLoadModule('/src/story/worlds.ts');
const { TRANSITIONS } = await vite.ssrLoadModule('/src/story/transitions.ts');
await vite.close();
const become = SEGMENTS.find((s) => s.type === 'tr' && TRANSITIONS[s.i].g === 21);
const POSITIONS = [
  ...WORLDS.map((w, i) => ({ id: `${String(i + 1).padStart(2, '0')}-${w.slug}`, v: SNAP_POINTS[i], hold: true, final: i === WORLDS.length - 1 })),
  ...[.3, .7].map((t) => ({ id: `become-t${t * 100}`, v: (become.start + become.len * t) / TOTAL, hold: false })),
];

const OUT = fileURLToPath(new URL(`../docs/responsive/${label}/`, import.meta.url));
const SHOTS = join(tmpdir(), 'one-grain-responsive', label);
await mkdir(OUT, { recursive: true });
const server = await startPreview(5196);
const browser = await chromium.launch({ channel: 'chromium', headless: false, args: ['--window-size=1400,1000'] });
const rings = [];
try {
  for (const vp of VIEWPORTS.filter((x) => !only || x.name.includes(only))) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dpr, hasTouch: vp.touch, isMobile: vp.mobile });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
    await page.goto(`${server.origin}/?parity`);
    await page.waitForFunction(() => window.__PACK, null, { timeout: 120000 });
    const info = await page.evaluate(() => ({ n: window.__PACK.n, buffer: [document.getElementById('scene').width, document.getElementById('scene').height] }));
    await mkdir(join(SHOTS, vp.name), { recursive: true });
    const shots = [];
    let worst = 0;
    for (const p of POSITIONS) {
      await page.evaluate(([v, ft]) => { window.__V = v; window.__T = 10; window.__FT = ft; }, [p.v, p.final ? 15 : null]);
      await page.waitForTimeout(1400);
      const file = join(SHOTS, vp.name, `${p.id}.jpg`);
      await page.screenshot({ path: file, type: 'jpeg', quality: 80 });
      shots.push({ id: p.id, file });
      if (p.hold) {
        const r = await page.evaluate(() => {
          const h = { ...window.__hero, ...window.__heroRendered }, c = document.getElementById('scene').getBoundingClientRect(), m = document.querySelector('.marker'), mr = m.getBoundingClientRect();
          const op = +getComputedStyle(m).opacity;
          if (!h || !h.visible || h.z >= 1 || Math.abs(h.x) > 1.1 || Math.abs(h.y) > 1.1 || op === 0) return null;
          const hx = c.left + (h.x + 1) / 2 * c.width, hy = c.top + (1 - h.y) / 2 * c.height;
          return { dx: mr.left + mr.width / 2 - hx, dy: mr.top + mr.height / 2 - hy };
        });
        if (r) { const d = Math.hypot(r.dx, r.dy); worst = Math.max(worst, d); rings.push({ vp: vp.name, at: p.id, d }); }
      }
    }
    await sheet(ctx, vp, info, shots);
    console.log(`${vp.name.padEnd(26)} tier grains ${info.n}, drawing buffer ${info.buffer.join('×')}, ring offset at most ${worst.toFixed(2)} px${errors.length ? `, console: ${errors.slice(0, 3).join(' | ')}` : ''}`);
    await ctx.close();
  }
} finally { await browser.close(); await server.close(); }
const bad = rings.filter((r) => r.d > 2);
console.log(`\nring centre within 2 px of the projected grain: ${rings.length - bad.length}/${rings.length} holds${bad.length ? `; off: ${bad.slice(0, 12).map((r) => `${r.vp} ${r.at} ${r.d.toFixed(1)} px`).join(', ')}` : ''}`);

/** One contact sheet: every position as a thumbnail, labelled, composed in the page and captured. */
async function sheet(ctx, vp, info, shots) {
  const imgs = await Promise.all(shots.map(async (s) => ({ id: s.id, src: `data:image/jpeg;base64,${(await readFile(s.file)).toString('base64')}` })));
  const cols = vp.width / vp.height > 1.2 ? 4 : 6, w = 1800;
  const page = await (await ctx.browser().newContext({ viewport: { width: w, height: 800 }, deviceScaleFactor: 1 })).newPage();
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:16px;background:#111;color:#ddd;font:13px system-ui}h1{font-size:16px;margin:0 0 10px}
    .g{display:grid;grid-template-columns:repeat(${cols},1fr);gap:10px}figure{margin:0}img{width:100%;display:block;border:1px solid #333}figcaption{padding:3px 0}</style>
    <h1>${vp.name} · ${vp.width}×${vp.height} @${vp.dpr}${vp.touch ? ' · touch' : ''} · ${info.n.toLocaleString('en-US')} grains · buffer ${info.buffer.join('×')} · ${label}</h1>
    <div class="g">${imgs.map((i) => `<figure><img src="${i.src}"><figcaption>${i.id}</figcaption></figure>`).join('')}</div>`);
  await page.waitForLoadState('load');
  await page.screenshot({ path: join(OUT, `${vp.name}.jpg`), type: 'jpeg', quality: 72, fullPage: true });
  await page.context().close();
}
