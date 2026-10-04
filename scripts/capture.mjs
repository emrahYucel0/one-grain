// The submission video (npm run capture -- [WxH] [--path capture/path.json] [--seconds a-b]):
// a deterministic, offline, frame-by-frame render of the built site in capture mode (?capture,
// src/capture/). Every frame is stepped on the page's virtual clock at the high tier with every effect
// on (no downgrade, no pacing, film grain from the frame's time), read back from the compositor (HUD
// and words included) and piped to ffmpeg; the sound is rendered offline (OfflineAudioContext, seeded)
// for the same frames and muxed in. Output: capture/out/one-grain-<W>x<H>.mp4 (60 fps, H.264 + AAC)
// and the sound alone as .wav. --seconds a-b renders an excerpt (the frames before it are still
// stepped, unrecorded, so the page's own timers see them).
// ffmpeg: $FFMPEG, else the ffmpeg-static dev dependency, else ffmpeg on the PATH.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build, createServer } from 'vite';
import { launch } from './lib/browser.mjs';
import { startPreview } from './lib/servers.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const [W, H] = (args.find((a) => /^\d+x\d+$/.test(a)) ?? '1920x1080').split('x').map(Number);
const PATH = opt('--path', 'capture/path.json');
const range = opt('--seconds', null)?.split('-').map(Number) ?? null;
const OUT = 'capture/out';

const ffmpeg = (() => {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try { const p = createRequire(import.meta.url)('ffmpeg-static'); if (p && existsSync(p)) return p; } catch { /* not installed */ }
  return 'ffmpeg';
})();
const run = (argv, stdin = 'ignore') => {
  const p = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...argv], { stdio: [stdin, 'inherit', 'inherit'] });
  const done = new Promise((ok, fail) => {
    p.on('error', (e) => fail(new Error(`ffmpeg could not start (${e.message}): set FFMPEG, or approve ffmpeg-static's install script`)));
    p.on('close', (c) => (c ? fail(new Error(`ffmpeg exited with ${c}`)) : ok()));
  });
  return { p, done };
};

// the timeline: the story progress at every frame
const path = JSON.parse(await readFile(PATH, 'utf8'));
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { SNAP_POINTS, TOTAL } = await vite.ssrLoadModule('/src/timeline/segments.ts');
const { WORLDS } = await vite.ssrLoadModule('/src/story/worlds.ts');
await vite.close();
const ease = (x) => (x < .5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2); // the scroll snap's power2.inOut
const segs = []; // [seconds, from v, to v]
WORLDS.forEach((w, i) => {
  const end = i === WORLDS.length - 1;
  segs.push([i === 0 ? path.intro : end ? path.final : path.holds?.[w.slug] ?? path.hold, SNAP_POINTS[i], SNAP_POINTS[i]]);
  if (!end) segs.push([path.moves?.[w.slug] ?? (SNAP_POINTS[i + 1] - SNAP_POINTS[i]) * TOTAL * path.scroll, SNAP_POINTS[i], SNAP_POINTS[i + 1]]);
});
const fps = path.fps, total = segs.reduce((a, s) => a + s[0], 0), count = Math.round(total * fps);
const progressAt = (sec) => {
  let t = sec;
  for (const [d, a, b] of segs) { if (t <= d) return a === b ? a : a + (b - a) * ease(t / d); t -= d; }
  return 1;
};
const first = range ? Math.round(range[0] * fps) : 0, last = range ? Math.min(count, Math.round(range[1] * fps)) : count;
console.log(`${W}×${H} · ${total.toFixed(1)} s · ${count} frames at ${fps} fps${range ? ` · rendering frames ${first}–${last}` : ''} · ffmpeg: ${ffmpeg}`);

await mkdir(OUT, { recursive: true });
await build({ logLevel: 'error' });
const server = await startPreview(5199);
const browser = await launch({ args: [`--window-size=${W},${H}`] });
const name = `${OUT}/one-grain-${W}x${H}${range ? `-${range[0]}-${range[1]}s` : ''}`;
try {
  const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })).newPage();
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`page ${m.type()}: ${m.text()}`); });
  await page.goto(`${server.origin}/?capture`);
  await page.waitForFunction(() => window.__PACK && window.__capture, null, { timeout: 180000 });
  const env = await page.evaluate(() => ({ n: window.__PACK.n, buffer: `${document.getElementById('scene').width}×${document.getElementById('scene').height}` }));
  console.log(`high tier: ${env.n} grains · drawing buffer ${env.buffer}`);
  const cdp = await page.context().newCDPSession(page);
  const step = (i) => page.evaluate(([ms, v]) => window.__capture.step(ms, v, null), [i * 1000 / fps, progressAt(i / fps)]);
  await step(0);
  await page.waitForFunction(() => !document.documentElement.classList.contains('fonts-pending'), null, { timeout: 10000 });
  for (let i = 1; i < first; i++) await step(i);
  const enc = run(['-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', `${name}.video.mp4`], 'pipe');
  const t0 = Date.now();
  for (let i = first; i < last; i++) {
    if (i > 0) await step(i);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true });
    if (!enc.p.stdin.write(Buffer.from(data, 'base64'))) await new Promise((ok) => enc.p.stdin.once('drain', ok));
    if ((i - first) % 300 === 299) { const done = i - first + 1, per = (Date.now() - t0) / done; console.log(`  ${done}/${last - first} frames · ${per.toFixed(0)} ms per frame · ${((last - first - done) * per / 60000).toFixed(1)} min left`); }
  }
  enc.p.stdin.end(); await enc.done;
  console.log(`video: ${last - first} frames in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  // the sound for every frame stepped (from the story's start; an excerpt's offset is cut below)
  const t1 = Date.now();
  const wav = await page.evaluate(([f, seed]) => window.__capture.sound(f, seed), [fps, path.seed]);
  await writeFile(`${name}.wav`, Buffer.from(wav, 'base64'));
  console.log(`sound: ${((Date.now() - t1) / 1000).toFixed(0)} s`);
  await run(['-i', `${name}.video.mp4`, '-ss', String(first / fps), '-i', `${name}.wav`, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-shortest', '-movflags', '+faststart', `${name}.mp4`]).done;
  await rm(`${name}.video.mp4`);
  console.log(`→ ${name}.mp4 (the sound alone: ${name}.wav)`);
} finally { await browser.close(); await server.close(); }
