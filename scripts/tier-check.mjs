// Quality tiers and the adaptive downgrade (npm run check:tiers):
//  1. a forced downgrade (?debug&forceDrop: the budget counts as blown after every warm-up) is
//     queued while the story is mid-transition and nothing changes there;
//  2. resting on a chapter, it walks the ladder in order, one step per warm-up: depth of field off,
//     then shadows off, then fewer grains (the low tier's worlds, rebuilt and swapped in);
//  3. the low tier starts without shadows and depth of field (v10 on small screens);
//  4. the ?debug panel's toggles switch layers (the pass disappears from the GPU timings);
//  and no console errors.
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
const open = async (query) => {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  watchConsole(page, 'port', logs);
  await page.goto(`${dev.origin}/?parity&debug&${query}`);
  await page.waitForFunction(() => window.__PACK, null, { timeout: 90000 });
  return page;
};
/** grains, the overlay's first line, and which layers the debug panel shows as on */
const state = (page) => page.evaluate(() => ({
  n: window.__PACK.n,
  overlay: document.querySelector('pre')?.textContent.split('\n')[0] ?? '',
  on: Object.fromEntries([...document.querySelectorAll('[role=group] button[aria-pressed]')].map((b) => [b.textContent, b.getAttribute('aria-pressed') === 'true'])),
}));
try {
  // 1–2: the ladder
  const page = await open('forceDrop&tier=mid');
  const start = await state(page);
  check('starts on the forced tier with every layer', start.n === TIERS.mid.n && Object.values(start.on).every(Boolean), `${start.n} grains, ${JSON.stringify(start.on)}`);

  await page.evaluate((v) => { window.__V = v; window.__T = 10; }, transitionMidpoint(2));
  await page.waitForTimeout(10500); // past the 8 s warm-up
  const parked = await state(page);
  check('first step queued while mid-transition, nothing applied', parked.n === TIERS.mid.n && parked.on['Depth of field'] && /dof off \(queued\)/.test(parked.overlay), `${parked.n} grains, "${parked.overlay}"`);

  // rest on a chapter and watch the steps arrive
  await page.evaluate(() => { window.__V = 0; });
  const t0 = Date.now(), seen = {};
  while (Date.now() - t0 < 30000 && !seen.grains) {
    const s = await state(page), t = Date.now() - t0;
    if (!s.on['Depth of field'] && seen.dof === undefined) seen.dof = t;
    if (!s.on.Shadows && seen.shadows === undefined) seen.shadows = t;
    if (s.n === TIERS.low.n && seen.grains === undefined) seen.grains = t;
    await page.waitForTimeout(200);
  }
  const order = seen.dof !== undefined && seen.shadows > seen.dof && seen.grains > seen.shadows;
  check('resting: depth of field, then shadows, then grains', order, `dof off at ${seen.dof} ms, shadows off at ${seen.shadows} ms, ${TIERS.low.n} grains at ${seen.grains} ms`);
  await page.waitForTimeout(900);
  const rested = await state(page);
  check('bottom of the ladder: nothing more queued', rested.n === TIERS.low.n && !/queued/.test(rested.overlay), `"${rested.overlay}"`);
  await page.context().close();

  // 3: the low tier's layers
  const low = await open('tier=low');
  const l = await state(low);
  check('low tier: no shadows, no depth of field, the rest on', l.n === TIERS.low.n && !l.on.Shadows && !l.on['Depth of field'] && l.on.Light && l.on.Bloom && l.on.Grade, JSON.stringify(l.on));
  await low.context().close();

  // 4: the panel's toggles
  const p = await open('tier=mid');
  await p.evaluate(() => { window.__V = 0; window.__T = 10; });
  await p.waitForTimeout(1500);
  const before = await p.evaluate(() => Object.keys(window.__gpu.recent.at(-1)?.passes ?? {}));
  await p.getByRole('button', { name: 'Bloom' }).click();
  await p.waitForTimeout(1500);
  const after = await p.evaluate(() => ({ passes: Object.keys(window.__gpu.recent.at(-1)?.passes ?? {}), pressed: document.querySelector('[role=group] button[aria-pressed]:nth-child(4)').getAttribute('aria-pressed') }));
  const gpu = before.length > 0;
  check('debug panel: the Bloom toggle switches the bloom pass off', after.pressed === 'false' && (!gpu || (before.includes('bloom') && !after.passes.includes('bloom'))),
    gpu ? `passes before: ${before.join(', ')}; after: ${after.passes.join(', ')}` : 'GPU timer unavailable: toggle state only');
  await p.context().close();

  const errors = logs.filter((x) => !x.harness);
  check('no console warnings or errors', errors.length === 0, errors.map((e) => e.text).join(' | ') || 'none');
} finally { await browser.close(); await dev.close(); }
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
process.exit(results.every(Boolean) ? 0 : 1);
