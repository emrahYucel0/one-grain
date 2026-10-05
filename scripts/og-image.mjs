// The sharing image (npm run og-image): public/og-image.jpg, 1200×630, rendered in capture mode
// (?capture: the high tier, every effect, the virtual clock) at the final hold: the sand surface,
// the grain landed, the sentence. The brand and "Now" stay; the controls and the rail do not belong
// in a picture. Rendered at 2× and scaled down (Lanczos) for crisp grains.
import { existsSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { build, createServer } from 'vite';
import { launch } from './lib/browser.mjs';
import { startPreview } from './lib/servers.mjs';

const AT = +(process.argv[2] ?? 112.5); // seconds into the path: landed, silent, before the signature
const path = JSON.parse(await readFile('capture/path.json', 'utf8'));
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { SNAP_POINTS, TOTAL, transitionMidpoint } = await vite.ssrLoadModule('/src/timeline/segments.ts');
const { WORLDS } = await vite.ssrLoadModule('/src/story/worlds.ts');
await vite.close();
// the capture's timeline (scripts/capture.mjs): only the progress is needed here
const ease = (x) => (x < .5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
const segs = [];
WORLDS.forEach((w, i) => {
  const end = i === WORLDS.length - 1;
  segs.push({ d: i === 0 ? path.intro : end ? path.final : path.holds?.[w.slug] ?? path.hold, a: SNAP_POINTS[i], b: SNAP_POINTS[i] });
  if (end) return;
  const d = path.moves?.[w.slug] ?? (SNAP_POINTS[i + 1] - SNAP_POINTS[i]) * TOTAL * path.scroll, r = path.rests?.[w.slug];
  if (!r) segs.push({ d, a: SNAP_POINTS[i], b: SNAP_POINTS[i + 1] });
  else { const m = transitionMidpoint(i); segs.push({ d: d / 2, a: SNAP_POINTS[i], b: m }, { d: r, a: m, b: m }, { d: d / 2, a: m, b: SNAP_POINTS[i + 1] }); }
});
const vAt = (sec) => { let t = sec; for (const s of segs) { if (t <= s.d) return s.a === s.b ? s.a : s.a + (s.b - s.a) * ease(t / s.d); t -= s.d; } return 1; };

const ffmpeg = process.env.FFMPEG ?? (() => { try { const p = createRequire(import.meta.url)('ffmpeg-static'); if (p && existsSync(p)) return p; } catch { /* none */ } return 'ffmpeg'; })();
await build({ logLevel: 'error' });
const server = await startPreview(5212);
const browser = await launch();
try {
  const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 })).newPage();
  await page.goto(`${server.origin}/?capture`);
  await page.waitForFunction(() => window.__PACK && window.__capture, null, { timeout: 180000 });
  await page.addStyleTag({ content: '.controls,.timeline,.marker{display:none !important}' });
  const fps = path.fps, last = Math.round(AT * fps);
  for (let i = 0; i <= last; i++) await page.evaluate(([ms, v, d]) => window.__capture.step(ms, v, null, null, d), [i * 1000 / fps, vAt(i / fps), i >= last - 3]);
  await page.screenshot({ path: 'public/og-image.png' });
  await new Promise((ok, fail) => spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', 'public/og-image.png', '-vf', 'scale=1200:630:flags=lanczos', '-q:v', '3', 'public/og-image.jpg'], { stdio: 'inherit' }).on('close', (c) => (c ? fail(new Error(`ffmpeg ${c}`)) : ok())));
  await rm('public/og-image.png');
  console.log(`→ public/og-image.jpg (1200×630, ${AT} s into the path)`);
} finally { await browser.close(); await server.close(); }
