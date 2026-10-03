// Quality tiers (npm run check:tiers): a forced drop (?debug&forceDrop) is queued while the
// story is mid-transition, nothing changes until the visitor rests on a chapter, and then the
// worlds are rebuilt with fewer grains and swapped in. Also: the debug overlay reports it, and no
// console errors.
import { createServer } from 'vite';
import { launch, watchConsole } from './lib/browser.mjs';
import { startDev } from './lib/servers.mjs';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { transitionMidpoint } = await vite.ssrLoadModule('/src/timeline/segments.ts');
const { TIERS } = await vite.ssrLoadModule('/src/core/quality.ts');
await vite.close();

const dev = await startDev(5179);
const browser = await launch();
const logs = [];
const results = [];
const check = (name, ok, detail) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (${detail})`); };
try {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  watchConsole(page, 'port', logs);
  await page.goto(`${dev.origin}/?parity&debug&forceDrop&tier=mid`);
  await page.waitForFunction(() => window.__PACK, null, { timeout: 90000 });
  const state = () => page.evaluate(() => ({ n: window.__PACK.n, overlay: document.querySelector('pre')?.textContent.split('\n')[0] ?? '' }));
  const start = await state();
  check('starts on the forced tier', start.n === TIERS.mid.n, `${start.n} grains`);

  // park mid-transition through the warm-up and well beyond
  await page.evaluate((v) => { window.__V = v; window.__T = 10; }, transitionMidpoint(2));
  await page.waitForTimeout(6500);
  const parked = await state();
  check('drop queued while mid-transition, nothing swapped', parked.n === TIERS.mid.n && /queued/.test(parked.overlay), `${parked.n} grains, "${parked.overlay}"`);

  // rest on a chapter: rebuilt and swapped there
  await page.evaluate(() => { window.__V = 0; });
  await page.waitForFunction((n) => window.__PACK.n === n, TIERS.low.n, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(900); // the swap sits mid-dip (250 ms); the overlay refreshes every 500 ms
  const rested = await state();
  check('swapped once resting on a chapter', rested.n === TIERS.low.n && !/queued/.test(rested.overlay), `${rested.n} grains, "${rested.overlay}"`);
  const errors = logs.filter((l) => !l.harness);
  check('no console warnings or errors', errors.length === 0, errors.map((e) => e.text).join(' | ') || 'none');
} finally { await browser.close(); await dev.close(); }
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
process.exit(results.every(Boolean) ? 0 : 1);
