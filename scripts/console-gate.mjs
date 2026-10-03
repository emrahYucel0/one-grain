// Gate: zero console warnings or errors, in dev and in the production build.
//
//   npm run check:console     (builds first)
//
// Drives the page the way a visitor would: real scrolling through every hold and transition
// midpoint, chapter links, the sound toggle, a resize. Runs in Chromium (real GPU) and Firefox.
import { firefox } from 'playwright';
import { createServer } from 'vite';
import { launch } from './lib/browser.mjs';
import { startDev, startPreview } from './lib/servers.mjs';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { SNAP_POINTS, transitionMidpoint } = await vite.ssrLoadModule('/src/timeline/segments.ts');
const { WORLDS } = await vite.ssrLoadModule('/src/story/worlds.ts');
await vite.close();
const stops = [];
SNAP_POINTS.forEach((v, i) => { stops.push(v); if (i < SNAP_POINTS.length - 1) stops.push(transitionMidpoint(i)); });

const engines = [['chromium', () => launch()], ['firefox', () => firefox.launch()]];
const targets = [['dev', () => startDev(5193)], ['build', () => startPreview(5192)]];
const report = [];

for (const [targetName, start] of targets) {
  const server = await start();
  for (const [engineName, open] of engines) {
    const browser = await open();
    const messages = [];
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
    page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') messages.push(`${m.type()}: ${m.text()}`); });
    page.on('pageerror', (e) => messages.push(`pageerror: ${e.message}`));
    await page.goto(server.origin + '/');
    await page.waitForFunction(() => document.documentElement.classList.contains('nogl') || document.getElementById('introHint').textContent.includes('Scroll'), null, { timeout: 90000 });
    const mode = await page.evaluate(() => (document.documentElement.classList.contains('gl') ? 'webgl2' : 'fallback'));

    if (mode === 'webgl2') {
      for (const v of stops) {
        await page.evaluate((x) => scrollTo({ top: (document.documentElement.scrollHeight - innerHeight) * x, behavior: 'auto' }), v);
        await page.waitForTimeout(700);
      }
      await page.locator('#sound').click(); await page.waitForTimeout(800); await page.locator('#sound').click();
      await page.setViewportSize({ width: 700, height: 900 }); await page.waitForTimeout(500);
      for (const slug of [WORLDS[4].slug, WORLDS[12].slug, WORLDS[14].slug]) {
        await page.goto(`${server.origin}/#${slug}`); await page.waitForTimeout(2500);
      }
      await page.mouse.move(600, 500); await page.waitForTimeout(500);
    }
    await browser.close();
    report.push({ target: targetName, engine: engineName, mode, messages });
    console.log(`${messages.length ? 'FAIL' : 'PASS'}  ${targetName.padEnd(5)} ${engineName.padEnd(8)} (${mode})${messages.map((m) => `\n        ${m.slice(0, 300)}`).join('')}`);
  }
  await server.close();
}
process.exit(report.some((r) => r.messages.length) ? 1 : 0);
