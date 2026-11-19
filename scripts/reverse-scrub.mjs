// Reverse scrub (npm run check:reverse): for the transitions added from blockout v6, a position
// reached by scrolling backwards must look exactly like the same position reached forwards.
//
// Real scrolling (scroll events through Lenis and the speed limit, timeline/scroll.ts), so the page
// can rest mid-transition, shader time frozen. Each position is approached from the hold before
// the transition (forwards) and from the hold after it (backwards), in small steps, one per frame.
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { createServer } from 'vite';
import { launch } from './lib/browser.mjs';
import { startDev } from './lib/servers.mjs';

const STYLES = new Set([17, 18, 19, 20, 21]);  // drift, break, separate, grow
const TS = [.2, .45, .75];
const SETTLE_MS = 1200;                     // CSS transitions, once the story has caught up with the scroll
const MAX_PCT = .05;                        // capture noise is ~0.02 %

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { SEGMENTS, TOTAL } = await vite.ssrLoadModule('/src/timeline/segments.ts');
const { TRANSITIONS } = await vite.ssrLoadModule('/src/story/transitions.ts');
const { WORLDS } = await vite.ssrLoadModule('/src/story/worlds.ts');
await vite.close();

const dev = await startDev(5186);
const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${dev.origin}/?parity&nosnap&tier=mid`);
await page.waitForFunction(() => window.__PACK, null, { timeout: 90000 });
// frozen shader time; the live clock and the time spent in a hold pinned (they count real time)
await page.evaluate(() => { window.__T = 10; window.__LIVE = 0; window.__FT = 0; });

const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
const px = (v) => Math.round(v * max);
/** The story follows the scroll under a speed limit (timeline/scroll.ts): wait until it has caught up. */
const settle = async () => {
  await page.waitForFunction(() => {
    const w = window, v = w.__progress;
    if (v !== w.__settleV) { w.__settleV = v; w.__settleAt = performance.now(); return false; }
    return performance.now() - w.__settleAt > 600;
  }, null, { polling: 100, timeout: 60000 });
  await page.waitForTimeout(SETTLE_MS);
};
/** Scroll to `from` at once, then glide to `to` in ~40 px steps (one per frame), then settle. */
const approach = async (from, to) => {
  await page.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), from);
  await settle();
  await page.evaluate((target) => new Promise((done) => {
    const step = () => {
      const d = target - scrollY;
      if (Math.abs(d) <= 40) { scrollTo({ top: target, behavior: 'instant' }); done(); return; }
      scrollBy({ top: Math.sign(d) * 40, behavior: 'instant' });
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }), to);
  await settle();
  return { shot: PNG.sync.read(await page.screenshot()), v: await page.evaluate(() => window.__progress), y: await page.evaluate(() => scrollY) };
};

let failed = 0, n = 0;
for (const seg of SEGMENTS.filter((s) => s.type === 'tr' && STYLES.has(TRANSITIONS[s.i].g))) {
  const before = px((seg.start - .3) / TOTAL), after = px((seg.start + seg.len + .3) / TOTAL);
  for (const t of TS) {
    const target = px((seg.start + seg.len * t) / TOTAL);
    const fwd = await approach(before, target), back = await approach(after, target);
    const diff = pixelmatch(fwd.shot.data, back.shot.data, null, fwd.shot.width, fwd.shot.height, { threshold: .1 });
    const pct = diff / (fwd.shot.width * fwd.shot.height) * 100;
    const ok = pct <= MAX_PCT && fwd.v === back.v && fwd.y === back.y;
    n++; if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${WORLDS[seg.i].slug} → ${WORLDS[seg.i + 1].slug} t=${t}: ${pct.toFixed(3)} % differ, progress ${fwd.v.toFixed(6)} / ${back.v.toFixed(6)}`);
  }
}
await browser.close(); await dev.close();
console.log(`\n${n - failed}/${n} reverse = forward`);
process.exit(failed ? 1 : 0);
