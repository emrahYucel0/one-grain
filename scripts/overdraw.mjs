// Overdraw survey (npm run overdraw, after a build): at every hold, how many grains cover each
// pixel. The grain shader's debug view (window.__overdraw) adds 1/32 per covering grain with no
// depth test, so a screenshot's red channel counts grains per pixel (saturating at 32).
//   node scripts/overdraw.mjs [tier=mid] [width=1920] [height=909] [extra-query]
import { PNG } from 'pngjs';
import { createServer } from 'vite';
import { launch } from './lib/browser.mjs';
import { startPreview } from './lib/servers.mjs';

const [tier = 'mid', width = '1920', height = '909', extra = ''] = process.argv.slice(2);
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { SNAP_POINTS } = await vite.ssrLoadModule('/src/timeline/segments.ts');
const { WORLDS } = await vite.ssrLoadModule('/src/story/worlds.ts');
await vite.close();
const server = await startPreview(5175);
const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: +width, height: +height }, deviceScaleFactor: 1 })).newPage();
await page.goto(`${server.origin}/?parity&tier=${tier}${extra ? '&' + extra : ''}`);
await page.waitForFunction(() => window.__PACK, null, { timeout: 90000 });
// hide the page's text and chrome so only the canvas is counted
await page.addStyleTag({ content: '.hud,.intro,.story,.timeline,.cut,.marker,.scrim{display:none!important}' });
console.log(`overdraw · tier ${tier} · ${width}×${height}${extra ? ' · ' + extra : ''}\n`);
console.log('| Hold | Covered | Mean grains per covered pixel | p95 | Max (32 = saturated) | Fragments / pixel |');
console.log('|---|---|---|---|---|---|');
const all = [];
for (let i = 0; i < WORLDS.length; i++) {
  await page.evaluate((v) => { window.__V = v; window.__T = 10; window.__overdraw = true; }, SNAP_POINTS[i]);
  await page.waitForTimeout(500);
  const png = PNG.sync.read(await page.locator('#scene').screenshot());
  const counts = [];
  let frags = 0;
  for (let k = 0; k < png.data.length; k += 4) {
    const n = Math.round(png.data[k] / (255 / 32)); // the clear colour is black in this view
    if (n > 0) counts.push(n);
    frags += n;
  }
  counts.sort((a, b) => a - b);
  const px = png.width * png.height, mean = counts.reduce((a, b) => a + b, 0) / Math.max(1, counts.length);
  all.push(frags / px);
  console.log(`| ${WORLDS[i].slug} | ${(counts.length / px * 100).toFixed(0)} % | ${mean.toFixed(2)} | ${counts[Math.floor(counts.length * .95)] ?? 0} | ${counts.at(-1) ?? 0} | ${(frags / px).toFixed(2)} |`);
}
console.log(`\nmean fragments per pixel over all holds: ${(all.reduce((a, b) => a + b, 0) / all.length).toFixed(2)}`);
await browser.close(); await server.close();
