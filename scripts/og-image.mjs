// The sharing image (npm run og-image [preset] [output]): 1200×630 (Open Graph, and Twitter's large
// card, which takes the same 1.91:1 picture), rendered in capture mode (?capture: the high tier, every
// effect, the virtual clock) at 2× and scaled down (Lanczos) for crisp grains. Presets:
//   magma    (the default: the site's card) the magma hold, the glowing quartz crystals under the title
//   final    the final hold: the sand surface, the grain landed, the sentence (the card until Phase 6d;
//            it gives the ending away)
//   crystal  the crystal hold: the lone silicon monolith in the dark, under the same title
// The two title cards show the title and nothing else: no chapter text, clock, brand, controls or rail.
// Output: public/og-image.jpg unless given.
import { existsSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { build, createServer } from 'vite';
import { launch } from './lib/browser.mjs';
import { startPreview } from './lib/servers.mjs';

const TITLE_ONLY = '.story,.time,.hud .brand,.intro p:not(.intro-title){display:none !important}';
const PRESETS = {
  final: { at: 112.5, css: '' }, // landed, silent, before the signature
  magma: { at: 3, css: TITLE_ONLY }, // the opening hold, the title still up
  crystal: { at: 73, css: `${TITLE_ONLY}.intro{opacity:1 !important;visibility:visible !important;display:block !important}` },
};
const preset = PRESETS[process.argv[2] ?? 'magma'];
if (!preset) throw new Error(`og-image: unknown preset ${process.argv[2]} (${Object.keys(PRESETS).join(', ')})`);
const AT = preset.at, OUT = process.argv[3] ?? 'public/og-image.jpg';
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
  await page.addStyleTag({ content: `.controls,.timeline,.marker{display:none !important}${preset.css}` });
  const fps = path.fps, last = Math.round(AT * fps);
  for (let i = 0; i <= last; i++) await page.evaluate(([ms, v, d]) => window.__capture.step(ms, v, null, null, d), [i * 1000 / fps, vAt(i / fps), i >= last - 3]);
  const png = OUT.replace(/\.jpg$/, '.png');
  await page.screenshot({ path: png });
  await new Promise((ok, fail) => spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', png, '-vf', 'scale=1200:630:flags=lanczos', '-q:v', '3', OUT], { stdio: 'inherit' }).on('close', (c) => (c ? fail(new Error(`ffmpeg ${c}`)) : ok())));
  await rm(png);
  console.log(`→ ${OUT} (1200×630, ${AT} s into the path)`);
} finally { await browser.close(); await server.close(); }
