// Sound (npm run check:audio): headless Chromium with autoplay allowed, the dev server, ?parity.
//  1. nothing is created before the visitor asks (AudioContext constructions counted from page start)
//  2. the sound button takes a real click at 900×560 and 1440×700 (nothing on top of it)
//  3. silence: output exactly 0 in the middle of the "One day," cut and after the final landing;
//     non-zero again after scrolling back from either
//  4. per-world levels: ambience above the music in magma, river, coast, desert and furnace (RMS over
//     15 s: the ambience is random events and slow swells); output peaks below −6 dBFS at every hold
//  5. toggling off reaches exactly 0 within 0.5 s; a hidden tab suspends the context, a visible one resumes it
//  6. a returning visitor who chose sound gets it on the first gesture (also when that gesture is the button)
//  7. a scroll through the whole story, both ways, with sound on: no console warnings or errors; the
//     main-thread cost of the sound (per-frame mapping and event scheduling) and the audio nodes it creates
// Levels come from analysers the sound adds under ?parity: after the limiter, and on the music and
// ambience buses (as they enter the mix).
import { createServer } from 'vite';
import { launch, watchConsole } from './lib/browser.mjs';
import { startDev } from './lib/servers.mjs';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { SNAP_POINTS, transitionMidpoint } = await vite.ssrLoadModule('/src/timeline/segments.ts');
const { WORLDS } = await vite.ssrLoadModule('/src/story/worlds.ts');
const { TRANSITIONS } = await vite.ssrLoadModule('/src/story/transitions.ts');
await vite.close();
const ix = (s) => WORLDS.findIndex((w) => w.slug === s);
const CUT = TRANSITIONS.findIndex((t) => t.cam === 'cut'), LAST = WORLDS.length - 1;

const dev = await startDev(5178);
const browser = await launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const logs = [], results = [];
const check = (name, ok, detail) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (${detail})`); };
const db = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);
const fdb = (x) => (Number.isFinite(x) ? `${x.toFixed(1)} dB` : '−∞');

/** a page that counts AudioContext constructions from the start */
async function open(viewport, init) {
  const ctx = await browser.newContext({ viewport });
  if (init) await ctx.addInitScript(init);
  await ctx.addInitScript(() => {
    window.__acCount = 0;
    const AC = window.AudioContext;
    window.AudioContext = class extends AC { constructor(...a) { super(...a); window.__acCount++; } };
  });
  const page = await ctx.newPage();
  watchConsole(page, `${viewport.width}×${viewport.height}`, logs);
  await page.goto(`${dev.origin}/?parity&tier=mid`);
  await page.waitForFunction(() => window.__PACK, null, { timeout: 90000 });
  return page;
}

/** RMS and peak per tap over `ms`, measured in the page */
const levels = (page, ms) => page.evaluate((dur) => new Promise((done) => {
  const taps = window.__audio.engine.taps, buf = new Float32Array(2048), acc = {};
  for (const k of Object.keys(taps)) acc[k] = { sum: 0, n: 0, peak: 0 };
  const t0 = performance.now();
  const id = setInterval(() => {
    for (const [k, a] of Object.entries(taps)) {
      a.getFloatTimeDomainData(buf);
      const s = acc[k];
      for (let i = 0; i < buf.length; i++) { const v = buf[i]; s.sum += v * v; s.n++; if (Math.abs(v) > s.peak) s.peak = Math.abs(v); }
    }
    if (performance.now() - t0 >= dur) { clearInterval(id); done(Object.fromEntries(Object.entries(acc).map(([k, s]) => [k, { rms: Math.sqrt(s.sum / s.n), peak: s.peak }]))); }
  }, 40);
}), ms);
const go = (page, v, ft = null) => page.evaluate(([x, f]) => { window.__V = x; window.__T = null; window.__FT = f; }, [v, ft]);

try {
  // --- 1 and 2: nothing before the click; the click lands at short and wide viewports
  for (const vp of [{ width: 900, height: 560 }, { width: 1440, height: 700 }]) {
    const page = await open(vp);
    await page.waitForTimeout(1500);
    const before = await page.evaluate(() => ({ count: window.__acCount, text: document.getElementById('sound').textContent }));
    let clicked = true;
    await page.locator('#sound').click({ timeout: 4000 }).catch(() => { clicked = false; });
    const after = await page.evaluate(() => ({ count: window.__acCount, pressed: document.getElementById('sound').getAttribute('aria-pressed'), text: document.getElementById('sound').textContent }));
    if (vp.width === 900) check('nothing created before the visitor asks; the button reads "Listen"', before.count === 0 && before.text === 'Listen', `${before.count} contexts, "${before.text}"`);
    check(`sound button takes a real click at ${vp.width}×${vp.height}`, clicked && after.pressed === 'true' && after.text === 'Sound on' && after.count === 1, clicked ? `aria-pressed ${after.pressed}, "${after.text}"` : 'another element receives the click');
    await page.context().close();
  }

  // --- 3, 4, 5, 7 on one page
  const page = await open({ width: 1440, height: 900 });
  await page.locator('#sound').click();
  await page.waitForTimeout(800);

  // 4: per-world levels and peaks
  const loud = new Set(['magma', 'river', 'coast', 'desert', 'furnace']);
  const rows = [];
  let maxPeak = 0;
  for (const w of WORLDS) {
    const i = ix(w.slug);
    if (i === LAST) continue; // the final hold withdraws into silence (checked below)
    await go(page, SNAP_POINTS[i]);
    await page.waitForTimeout(1200);
    // the ambience is random events (Poisson) and slow swells: the worlds held to "ambience above the music" get 15 s windows
    const L = await levels(page, loud.has(w.slug) ? 15000 : 5000);
    maxPeak = Math.max(maxPeak, L.out.peak);
    rows.push(`${w.slug.padEnd(8)} music ${fdb(db(L.music.rms))}, ambience ${fdb(db(L.ambience.rms))}, output peak ${fdb(db(L.out.peak))}`);
    if (loud.has(w.slug)) check(`${w.slug}: ambience above the music`, L.ambience.rms > L.music.rms, `ambience ${fdb(db(L.ambience.rms))} vs music ${fdb(db(L.music.rms))}`);
  }
  check('output peaks below −6 dBFS at every hold', db(maxPeak) < -6, `highest ${fdb(db(maxPeak))}`);
  console.log(rows.map((r) => `      ${r}`).join('\n'));

  // 3: silence in the cut and after the landing, sound again after scrolling back
  await go(page, transitionMidpoint(CUT)); await page.waitForTimeout(1200);
  const cut = await levels(page, 800);
  check('the middle of the "One day," cut is silent (output exactly 0)', cut.out.peak === 0, `peak ${cut.out.peak}`);
  await go(page, SNAP_POINTS[CUT]); await page.waitForTimeout(1500);
  const back1 = await levels(page, 1500);
  check('scrolling back from the cut brings the sound back', back1.out.peak > 0, `peak ${fdb(db(back1.out.peak))}`);
  await go(page, 1, 7); await page.waitForTimeout(1200);
  const end = await levels(page, 800);
  check('after the final landing the output is exactly 0', end.out.peak === 0, `peak ${end.out.peak}`);
  await go(page, SNAP_POINTS[LAST - 1]); await page.waitForTimeout(1500);
  const back2 = await levels(page, 1500);
  check('scrolling back from the end brings the sound back', back2.out.peak > 0, `peak ${fdb(db(back2.out.peak))}`);

  // 7: the whole story, both ways, sound on: console, main-thread cost, nodes
  const stats0 = await page.evaluate(() => ({ ...window.__audio.engine.stats, t: performance.now() }));
  await page.evaluate(() => new Promise((done) => {
    let v = 0, dir = 1;
    const f = () => { v += dir / 900; if (v >= 1) { v = 1; dir = -1; } window.__V = Math.max(0, v); window.__FT = null; if (dir < 0 && v <= 0) done(); else requestAnimationFrame(f); };
    requestAnimationFrame(f);
  }));
  const stats1 = await page.evaluate(() => ({ ...window.__audio.engine.stats, t: performance.now() }));
  const sec = (stats1.t - stats0.t) / 1000, mapMs = stats1.frameMs - stats0.frameMs, schedMs = stats1.schedMs - stats0.schedMs, nodes = stats1.nodes - stats0.nodes;
  console.log(`INFO  scroll-through both ways with sound on (${sec.toFixed(1)} s): per-frame mapping ${(mapMs / sec).toFixed(2)} ms/s, event scheduling ${(schedMs / sec).toFixed(2)} ms/s, ${Math.round(nodes / sec)} audio nodes created per second`);

  // 5: off within .5 s; hidden suspends, visible resumes
  await go(page, SNAP_POINTS[ix('river')]); await page.waitForTimeout(1500);
  await page.locator('#sound').click();
  await page.waitForTimeout(500);
  const off = await levels(page, 400);
  check('toggling off reaches exactly 0 within 0.5 s', off.out.peak === 0, `peak ${off.out.peak}, button "${await page.locator('#sound').textContent()}"`);
  await page.locator('#sound').click(); await page.waitForTimeout(600);
  const other = await page.context().newPage();
  await other.bringToFront(); await page.waitForTimeout(600);
  let hidden = await page.evaluate(() => ({ vis: document.visibilityState, state: window.__audio.engine.ctx.state }));
  let how = 'another tab in front';
  if (hidden.vis !== 'hidden') { // headless may keep every tab visible: dispatch the change as the browser would
    how = 'visibilitychange dispatched';
    hidden = await page.evaluate(async () => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange')); await new Promise((r) => setTimeout(r, 300));
      return { vis: document.visibilityState, state: window.__audio.engine.ctx.state };
    });
  }
  await page.bringToFront();
  const shown = await page.evaluate(async () => {
    delete document.hidden; delete document.visibilityState;
    document.dispatchEvent(new Event('visibilitychange')); await new Promise((r) => setTimeout(r, 300));
    return window.__audio.engine.ctx.state;
  });
  check('a hidden tab suspends the audio, a visible one resumes it', hidden.state === 'suspended' && shown === 'running', `${how}: ${hidden.state}, visible again: ${shown}`);
  await page.context().close();

  // --- 6: the remembered choice
  for (const first of ['elsewhere', 'the button']) {
    const p = await open({ width: 1440, height: 900 }, () => { try { localStorage.setItem('og-sound', 'on'); } catch { /* */ } });
    await p.waitForTimeout(800);
    const pre = await p.evaluate(() => window.__acCount);
    if (first === 'elsewhere') await p.mouse.click(400, 450); else await p.locator('#sound').click();
    await p.waitForTimeout(500);
    const s = await p.evaluate(() => ({ count: window.__acCount, pressed: document.getElementById('sound').getAttribute('aria-pressed') }));
    check(`remembered choice: on at the first gesture (${first})`, pre === 0 && s.count === 1 && s.pressed === 'true', `${pre} contexts before, ${s.count} after, aria-pressed ${s.pressed}`);
    await p.context().close();
  }

  const errors = logs.filter((l) => !l.harness);
  check('no console warnings or errors (sound on, the whole story both ways)', errors.length === 0, errors.map((e) => `${e.label}: ${e.text}`).join(' | ') || 'none');
} finally { await browser.close(); await dev.close(); }
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
process.exit(results.every(Boolean) ? 0 : 1);
