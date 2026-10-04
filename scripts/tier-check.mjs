// Quality tiers and the adaptive downgrade (npm run check:tiers):
//  1. a forced downgrade (?debug&forceDrop: the budget counts as blown after every warm-up) is
//     queued while the story is mid-transition and nothing changes there;
//  2. resting on a chapter, it walks the ladder in order, one step per warm-up: depth of field off,
//     then shadows off, then fewer grains (the low tier's worlds, rebuilt and swapped in);
//  3. the low tier starts without shadows and depth of field (v10 on small screens);
//  4. the ?debug panel's toggles switch layers (the pass disappears from the GPU timings);
//  5. auto mode (core/quality.ts FrameMonitor), with simulated loads: no step during the 8 s warm-up
//     however slow the GPU; no step when only the frame interval is slow (a busy main thread: an
//     external slowdown, our GPU time fine); a step down under GPU load and back up once the load is
//     gone; after that up-and-down, no more steps up; without the GPU timer (?notimer) the frame
//     interval decides, over three windows;
//  and no console errors.
import { createServer } from 'vite';
import { launch, watchConsole } from './lib/browser.mjs';
import { startDev } from './lib/servers.mjs';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { transitionMidpoint, SNAP_POINTS } = await vite.ssrLoadModule('/src/timeline/segments.ts');
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

  // 5: auto mode
  const HOLD = SNAP_POINTS[1];
  const log = (pg) => pg.evaluate(() => window.__tiers.log.map((r) => ({ ...r })));
  const until = async (pg, pred, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const l = await log(pg); if (pred(l)) return { l, t: Date.now() - t0 }; await pg.waitForTimeout(250); } return { l: await log(pg), t: -1 }; };
  const auto = async (query = '') => {
    const pg = await open(query);
    await pg.evaluate((v) => { window.__V = v; window.__T = 10; }, HOLD);
    return { pg, packAt: await pg.evaluate(() => performance.now()) };
  };
  /** a busy main thread: every refresh spends `ms` before the frame (another app, a screen recorder) */
  const burn = (pg, ms) => pg.evaluate((d) => { window.__burn = d; const f = () => { const t = performance.now(); while (performance.now() - t < window.__burn); if (window.__burn) requestAnimationFrame(f); }; requestAnimationFrame(f); }, ms);
  {
    const { pg, packAt } = await auto();
    const gpu = await pg.evaluate(() => window.__tiers.monitor.gpu);
    if (!gpu) console.log('INFO  no GPU timer in this browser: the GPU-load cases below use ?notimer rules');
    await pg.evaluate(() => { window.__GPU_EXTRA = 40; });
    await pg.waitForTimeout(7000);
    const early = await log(pg);
    check('auto: no step during the warm-up, however slow the GPU', early.length === 0, `GPU +40 ms from the first frame; ${early.length} steps after 7 s`);
    const down = await until(pg, (l) => l.length >= 1, 15000);
    const first = down.l[0];
    check('auto: GPU over budget steps down once warm', first?.dir === 'down' && first.what === 'dof off' && first.at * 1000 - packAt >= 8000,
      first ? `${first.what} at ${((first.at * 1000 - packAt) / 1000).toFixed(1)} s after the worlds: ${first.reason}` : 'no step');
    await pg.evaluate(() => { window.__GPU_EXTRA = 0; });
    const up = await until(pg, (l) => l.length >= 2, 20000);
    check('auto: back up once the load is gone (≈10 s at rest)', up.l[1]?.dir === 'up' && up.l[1].what === 'dof on', up.l[1] ? `${up.l[1].what} after ${(up.t / 1000).toFixed(1)} s: ${up.l[1].reason}` : 'no step up');
    await pg.evaluate(() => { window.__GPU_EXTRA = 40; });
    const again = await until(pg, (l) => l.length >= 3, 15000);
    await pg.evaluate(() => { window.__GPU_EXTRA = 0; });
    await pg.waitForTimeout(16000);
    const settled = await log(pg), locked = await pg.evaluate(() => window.__tiers.upLocked);
    check('auto: after an up and a down, no more steps up (no oscillation)', again.l[2]?.dir === 'down' && settled.length === 3 && locked,
      settled.map((r) => `${r.dir} ${r.what}`).join(', ') + `; steps up ${locked ? 'off' : 'still on'} after 16 s without load`);
    await pg.context().close();
  }
  {
    const { pg } = await auto();
    const gpu = await pg.evaluate(() => window.__tiers.monitor.gpu);
    await burn(pg, 32);
    await pg.waitForTimeout(18000);
    const l = await log(pg), m = await pg.evaluate(() => ({ frame: window.__tiers.monitor.frame, gpu: window.__tiers.monitor.gpuMs, external: window.__tiers.monitor.external }));
    await burn(pg, 0);
    if (gpu) check('auto: slow frames with our GPU time fine (external) step nothing', l.length === 0 && m.external, `frame ${m.frame.toFixed(1)} ms, gpu ${m.gpu.toFixed(1)} ms, external ${m.external}, ${l.length} steps in 18 s`);
    else console.log('INFO  external-load case skipped: no GPU timer, so the frame interval decides (next case)');
    await pg.context().close();
  }
  {
    const { pg, packAt } = await auto('notimer');
    await burn(pg, 32);
    const down = await until(pg, (l) => l.length >= 1, 25000);
    await burn(pg, 0);
    const first = down.l[0], after = first ? first.at * 1000 - packAt : 0;
    check('?notimer: the frame interval steps down after three slow windows', first?.what === 'dof off' && /in 3 windows/.test(first.reason) && after >= 8000 + 3 * 2000,
      first ? `${first.what} at ${(after / 1000).toFixed(1)} s after the worlds: ${first.reason}` : 'no step');
    await pg.context().close();
  }

  const errors = logs.filter((x) => !x.harness);
  check('no console warnings or errors', errors.length === 0, errors.map((e) => e.text).join(' | ') || 'none');
} finally { await browser.close(); await dev.close(); }
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
process.exit(results.every(Boolean) ? 0 : 1);
