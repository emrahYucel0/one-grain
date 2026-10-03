// Seams (npm run check:seams): no transition may leave a trace on a resting chapter.
//
// For every chapter i with both neighbours, render
//   (a)  the previous transition at t = 1
//   (b)  the next transition at t = 0
// They show the same resting world and must be identical, pixel for pixel. The hold "lean"
// (the camera easing towards the next move while resting) is camera-only by design, so (a) and
// (b) are compared with the lean pinned to 0, and (b) is compared again with the lean the hold
// has at its snap point against the hold screenshot itself. Also checked: (b) against the hold
// as actually scrolled into (its first instant, lean ≈ 0).
//
// Exact comparison: any differing byte counts. Diff masks of failures go to the OS temp folder.
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { createServer } from 'vite';
import { launch } from './lib/browser.mjs';
import { startDev } from './lib/servers.mjs';

const SETTLE_MS = 1600; // clock font-size .5 s, punch .7 s
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { SEGMENTS, SNAP_POINTS, TOTAL, locate } = await vite.ssrLoadModule('/src/timeline/segments.ts');
const { WORLDS } = await vite.ssrLoadModule('/src/story/worlds.ts');
await vite.close();

const out = join(tmpdir(), 'one-grain-seams');
await mkdir(out, { recursive: true });
const dev = await startDev(5185);
const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${dev.origin}/?parity&tier=mid`);
await page.waitForFunction(() => window.__PACK, null, { timeout: 90000 });

const render = async (v, at) => {
  await page.evaluate(([x, a]) => { window.__T = 10; window.__V = x; window.__AT = a; }, [v, at]);
  await page.waitForTimeout(SETTLE_MS);
  return PNG.sync.read(await page.screenshot());
};
/** Number of pixels whose RGBA differs at all; writes a red mask when there are any. */
const compare = async (A, B, name) => {
  const mask = new PNG({ width: A.width, height: A.height });
  let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let i = 0; i < A.data.length; i += 4) {
    if (A.data[i] !== B.data[i] || A.data[i + 1] !== B.data[i + 1] || A.data[i + 2] !== B.data[i + 2] || A.data[i + 3] !== B.data[i + 3]) {
      n++; mask.data[i] = 255; mask.data[i + 3] = 255;
      const p = i / 4, x = p % A.width, y = (p / A.width) | 0;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
  }
  if (n) await writeFile(join(out, `${name}.png`), PNG.sync.write(mask));
  return { n, pct: n / (A.width * A.height) * 100, box: n ? `x ${x0}–${x1}, y ${y0}–${y1}` : '' };
};

let failed = 0;
for (let i = 1; i < WORLDS.length - 1; i++) {
  const hold = SEGMENTS.find((s) => s.type === 'hold' && s.i === i);
  const snap = SNAP_POINTS[i], holdStart = (hold.start + 1e-7) / TOTAL;
  const a = await render(snap, { tr: i - 1, t: 1, lean: 1 });
  const b0 = await render(snap, { tr: i, t: 0, lean: 0 });
  const h0 = await render(holdStart, null);
  const bH = await render(snap, { tr: i, t: 0, lean: locate(snap).lean });
  const hs = await render(snap, null);
  const slug = WORLDS[i].slug;
  const rows = [
    ['end of previous = start of next', await compare(a, b0, `${String(i).padStart(2, '0')}-${slug}-a-vs-b`)],
    ['start of next = hold as scrolled into', await compare(b0, h0, `${String(i).padStart(2, '0')}-${slug}-b-vs-hold-start`)],
    ['start of next = hold screenshot (same lean)', await compare(bH, hs, `${String(i).padStart(2, '0')}-${slug}-b-vs-hold`)],
  ];
  for (const [what, r] of rows) {
    const ok = r.n === 0; if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${slug.padEnd(8)} ${what.padEnd(44)} ${r.pct.toFixed(3)} %${r.n ? `  (${r.n} px, ${r.box})` : ''}`);
  }
}
await browser.close(); await dev.close();
console.log(failed ? `\n${failed} seam comparisons differ; masks in ${out}` : '\nall seams identical');
process.exit(failed ? 1 : 0);
