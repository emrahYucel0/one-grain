// Scratch: port vs reference at (transition i, t) pairs. Usage: node scripts/_shot.mjs OUTDIR 3:0.2 3:0.45 ...
import { readFile } from 'node:fs/promises';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { createServer } from 'vite';
import { launch } from './lib/browser.mjs';
import { referenceFile, routeReference } from './lib/reference.mjs';
import { startDev } from './lib/servers.mjs';

const [out, ...specs] = process.argv.slice(2);
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { WORLDS } = await vite.ssrLoadModule('/src/story/worlds.ts');
const { TRANSITIONS } = await vite.ssrLoadModule('/src/story/transitions.ts');
await vite.close();
const holds = WORLDS.map((w) => w.hold);
const refLens = [...(await readFile(referenceFile(), 'utf8')).matchAll(/\{ g: \d+,\s*cam: '\w+',\s*len: ([\d.]+)/g)].map((m) => +m[1]);
const portLens = TRANSITIONS.map((t) => t.len);
const at = (lens, i, t) => { let s = 0; for (let k = 0; k < i; k++) s += holds[k] + lens[k]; const T = holds.reduce((a, b) => a + b) + lens.reduce((a, b) => a + b); return (s + holds[i] + lens[i] * t) / T; };

const dev = await startDev(5187);
const b = await launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const port = await ctx.newPage(), ref = await ctx.newPage();
for (const p of [port, ref]) {
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall/.test(m.text())) console.log(`[${p === port ? 'port' : 'ref'} ${m.type()}]`, m.text().slice(0, 600)); });
  p.on('pageerror', (e) => console.log('[pageerror]', e.message));
}
await port.goto(`${dev.origin}/?parity&tier=mid`);
await routeReference(ref, `${dev.origin}/__r.html`);
await ref.goto(`${dev.origin}/__r.html`);
await port.waitForFunction(() => window.__PACK, null, { timeout: 90000 });
await ref.waitForFunction(() => window.__DATA, null, { timeout: 90000 });
for (const spec of specs) {
  const [i, t] = spec.split(':').map(Number);
  const shots = [];
  for (const [p, lens] of [[port, portLens], [ref, refLens]]) {
    await p.bringToFront();
    await p.evaluate((v) => { window.__V = v; window.__T = 10; }, at(lens, i, t));
    await p.waitForTimeout(900);
    console.log("   ", p === port ? "port" : "ref ", "--stage", await p.evaluate(() => document.documentElement.style.getPropertyValue("--stage")), "scrim", await p.evaluate(() => getComputedStyle(document.querySelector(".scrim")).backgroundImage));
    const buf = await p.screenshot();
    await p.screenshot({ path: `${out}/${p === port ? 'port' : 'ref'}-${i}-${t}.jpg`, type: 'jpeg', quality: 80 });
    shots.push(PNG.sync.read(buf));
  }
  const [A, B] = shots;
  const n = pixelmatch(A.data, B.data, null, A.width, A.height, { threshold: .1 });
  let strict = 0; const cells = {}; for (let k = 0; k < A.data.length; k += 4) if (A.data[k] !== B.data[k] || A.data[k + 1] !== B.data[k + 1] || A.data[k + 2] !== B.data[k + 2]) { strict++; const p = k / 4, key = Math.floor((p % A.width) / 180) + "," + Math.floor(p / A.width / 150); cells[key] = (cells[key] || 0) + 1; }
  console.log("   cells(x/180,y/150):", JSON.stringify(Object.entries(cells).sort((a, b) => b[1] - a[1]).slice(0, 6)));
  { let mx = 0, sample = ""; for (let k = 0; k < A.data.length; k += 4) { const d = Math.max(Math.abs(A.data[k] - B.data[k]), Math.abs(A.data[k + 1] - B.data[k + 1]), Math.abs(A.data[k + 2] - B.data[k + 2])); if (d > mx) { mx = d; } if (!sample && d) sample = "port " + [A.data[k], A.data[k + 1], A.data[k + 2]] + " ref " + [B.data[k], B.data[k + 1], B.data[k + 2]] + " at " + ((k / 4) % A.width) + "," + Math.floor(k / 4 / A.width); } console.log("   max channel delta", mx, "first:", sample); }
  console.log(`${WORLDS[i].slug} → ${WORLDS[i + 1].slug} t=${t}: ${(n / (A.width * A.height) * 100).toFixed(3)} % differ (perceptual), ${(strict / (A.width * A.height) * 100).toFixed(3)} % strict`);
}
await b.close(); await dev.close();
