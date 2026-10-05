// The submission video (npm run capture -- [WxH] [--path capture/path.json] [--seconds a-b]):
// a deterministic, offline, frame-by-frame render of the built site in capture mode (?capture,
// src/capture/). Every frame is stepped on the page's virtual clock at the high tier with every effect
// on (no downgrade, no pacing, film grain from the frame's time), read back from the compositor (HUD
// and words included) and piped to ffmpeg; the sound is rendered offline (OfflineAudioContext, seeded)
// for the same frames and muxed in. Output: capture/out/one-grain-<W>x<H>.mp4 (60 fps, H.264 + AAC)
// and the sound alone as .wav. --seconds a-b renders an excerpt (the frames before it are still
// stepped, unrecorded, so the page's own timers see them). --sound-only steps the path in a small
// window without recording frames, renders the sound and puts it into every finished
// capture/out/one-grain-<W>x<H>.mp4 (the picture is copied, not re-encoded): for a new seed.
// The picture is rendered in chunks of --chunk frames (1500), each in a fresh browser that first
// steps the earlier frames in a small window, then joined without re-encoding.
// --list prints the path's timeline and exits.
// ffmpeg: $FFMPEG, else the ffmpeg-static dev dependency, else ffmpeg on the PATH.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build, createServer } from 'vite';
import { launch } from './lib/browser.mjs';
import { startPreview } from './lib/servers.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const soundOnly = args.includes('--sound-only');
const [W, H] = soundOnly ? [640, 360] : (args.find((a) => /^\d+x\d+$/.test(a)) ?? '1920x1080').split('x').map(Number);
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
const { SNAP_POINTS, TOTAL, transitionMidpoint } = await vite.ssrLoadModule('/src/timeline/segments.ts');
const { WORLDS } = await vite.ssrLoadModule('/src/story/worlds.ts');
await vite.close();
const ease = (x) => (x < .5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2); // the scroll snap's power2.inOut
// segments: rest on a chapter (hold), move between progress values (eased), or rest mid-transition
const segs = [];
WORLDS.forEach((w, i) => {
  const end = i === WORLDS.length - 1;
  segs.push({ d: i === 0 ? path.intro : end ? path.final : path.holds?.[w.slug] ?? path.hold, a: SNAP_POINTS[i], b: SNAP_POINTS[i], hold: w.slug });
  if (end) return;
  const d = path.moves?.[w.slug] ?? (SNAP_POINTS[i + 1] - SNAP_POINTS[i]) * TOTAL * path.scroll, rest = path.rests?.[w.slug];
  if (!rest) { segs.push({ d, a: SNAP_POINTS[i], b: SNAP_POINTS[i + 1] }); return; }
  const mid = transitionMidpoint(i); // e.g. the "One day," card, fully shown around the cut's middle
  segs.push({ d: d / 2, a: SNAP_POINTS[i], b: mid }, { d: rest, a: mid, b: mid }, { d: d / 2, a: mid, b: SNAP_POINTS[i + 1] });
});
const fps = path.fps, total = segs.reduce((a, s) => a + s.d, 0), count = Math.round(total * fps);
/** Catmull-Rom through [t, x, y] keys; null before the first and after the last */
const cursorAt = (keys, t) => {
  if (!keys?.length || t < keys[0][0] || t > keys.at(-1)[0]) return null;
  let k = 0; while (k < keys.length - 2 && t > keys[k + 1][0]) k++;
  const p0 = keys[Math.max(0, k - 1)], p1 = keys[k], p2 = keys[Math.min(keys.length - 1, k + 1)], p3 = keys[Math.min(keys.length - 1, k + 2)];
  const u = p2[0] > p1[0] ? (t - p1[0]) / (p2[0] - p1[0]) : 0, cr = (a, b, c, d) => .5 * (2 * b + (c - a) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (3 * b - a - 3 * c + d) * u * u * u);
  return { x: cr(p0[1], p1[1], p2[1], p3[1]), y: cr(p0[2], p1[2], p2[2], p3[2]) };
};
/** progress and the scripted cursor at a time (seconds) */
const stateAt = (sec) => {
  let t = sec;
  for (const s of segs) {
    if (t <= s.d) {
      const cursor = s.hold ? cursorAt(path.cursor?.[s.hold], t) : null;
      if (cursor) cursor.press = (path.press?.[s.hold] ?? []).some(([a, b]) => t >= a && t <= b);
      return { v: s.a === s.b ? s.a : s.a + (s.b - s.a) * ease(t / s.d), cursor };
    }
    t -= s.d;
  }
  return { v: 1, cursor: null };
};
if (args.includes('--list')) { // the timeline, to pick excerpts or teaser moments
  let t = 0;
  for (const g of segs) { console.log(`${t.toFixed(2).padStart(7)}–${(t + g.d).toFixed(2).padStart(7)} s  ${g.hold ? `hold ${g.hold}` : g.a === g.b ? 'rest mid-transition' : 'move'}`); t += g.d; }
  process.exit(0);
}
const first = range ? Math.round(range[0] * fps) : 0, last = range ? Math.min(count, Math.round(range[1] * fps)) : count;
console.log(`${W}×${H} · ${total.toFixed(1)} s · ${count} frames at ${fps} fps${range ? ` · rendering frames ${first}–${last}` : ''} · ffmpeg: ${ffmpeg}`);

await mkdir(OUT, { recursive: true });
await build({ logLevel: 'error' });
const server = await startPreview(5199);
const name = soundOnly ? `${OUT}/one-grain` : `${OUT}/one-grain-${W}x${H}${range ? `-${range[0]}-${range[1]}s` : ''}`;
const CHUNK = +opt('--chunk', 1500); // frames per browser session: long sessions wear Chromium out (a crash, a hung readback)

/**
 * One browser session: step frames 0..from-1 without drawing (the page's timers, trackers and
 * smoothing see every frame; the last three are drawn, so the shadow map is what a continuous run
 * has: the same pixels, checked), then step and read back from..to-1 into `part` (an H.264 file of
 * its own). With `sound`, step to the end without drawing and render the sound for every frame.
 * Throws with the frame number when the page crashes, the browser closes or a frame takes over a
 * minute.
 */
async function session(from, to, part, sound) {
  const browser = await launch({ args: [`--window-size=${W},${H}`] });
  let lost = null;
  browser.on('disconnected', () => { lost ??= 'the browser closed'; });
  try {
    const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })).newPage();
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`page ${m.type()}: ${m.text()}`); });
    page.on('crash', () => { lost = 'the page crashed'; });
    await page.goto(`${server.origin}/?capture`);
    await page.waitForFunction(() => window.__PACK && window.__capture, null, { timeout: 180000 });
    const within = (pr, what) => Promise.race([pr, new Promise((_, fail) => setTimeout(() => fail(new Error(lost ?? `${what} took over 60 s`)), 60000))]);
    const step = (i, draw = true) => { const st = stateAt(i / fps); return within(page.evaluate(([ms, v, c, d]) => window.__capture.step(ms, v, null, c, d), [i * 1000 / fps, st.v, st.cursor, draw]), `frame ${i}`)
      .catch((e) => { throw new Error(`frame ${i} (${(i / fps).toFixed(2)} s): ${lost ?? e.message}`); }); };
    await step(0);
    await page.waitForFunction(() => !document.documentElement.classList.contains('fonts-pending'), null, { timeout: 10000 });
    for (let i = 1; i < from; i++) await step(i, i >= from - 3);
    if (part) {
      const cdp = await page.context().newCDPSession(page);
      const enc = run(['-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', part], 'pipe');
      const t0 = Date.now();
      for (let i = from; i < to; i++) {
        if (i > 0) await step(i);
        const { data } = await within(cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true }), `reading frame ${i}`);
        if (!enc.p.stdin.write(Buffer.from(data, 'base64'))) await new Promise((ok) => enc.p.stdin.once('drain', ok));
      }
      enc.p.stdin.end(); await enc.done;
      console.log(`  frames ${from}–${to}: ${((Date.now() - t0) / (to - from)).toFixed(0)} ms per frame`);
    }
    if (!sound) return null;
    for (let i = Math.max(to, 1); i < count; i++) await step(i, false);
    return Buffer.from(await page.evaluate(([f, seed]) => window.__capture.sound(f, seed), [fps, path.seed]), 'base64');
  } finally { await browser.close().catch(() => {}); }
}
const attempt = async (...a) => { try { return await session(...a); } catch (e) { console.log(`  retrying: ${e.message}`); return session(...a); } };

try {
  const t0 = Date.now();
  // the sound: every frame stepped once, in the small window
  const wav = await attempt(0, 0, null, true);
  await writeFile(`${name}.wav`, wav);
  console.log(`sound: ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  if (soundOnly) {
    for (const f of (await readdir(OUT)).filter((x) => /^one-grain-\d+x\d+\.mp4$/.test(x))) {
      await run(['-i', `${OUT}/${f}`, '-i', `${name}.wav`, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-shortest', '-movflags', '+faststart', `${OUT}/new-${f}`]).done;
      await rename(`${OUT}/new-${f}`, `${OUT}/${f}`);
      await writeFile(`${OUT}/${f.replace(/\.mp4$/, '.wav')}`, wav);
      console.log(`→ new sound in ${OUT}/${f}`);
    }
  } else {
    // the picture, chunk by chunk, each in a fresh browser; then joined without re-encoding
    const parts = [];
    for (let from = first; from < last; from += CHUNK) {
      const part = `${name}.part${parts.length}.mp4`;
      await attempt(from, Math.min(last, from + CHUNK), part, false);
      parts.push(part);
      const done = Math.min(last, from + CHUNK) - first, per = (Date.now() - t0) / done;
      console.log(`  ${done}/${last - first} frames · ${((last - first - done) * per / 60000).toFixed(1)} min left`);
    }
    await writeFile(`${name}.parts.txt`, parts.map((f) => `file '${f.split('/').pop()}'`).join('\n'));
    await run(['-f', 'concat', '-safe', '0', '-i', `${name}.parts.txt`, '-c', 'copy', `${name}.video.mp4`]).done;
    console.log(`video: ${last - first} frames in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
    await run(['-i', `${name}.video.mp4`, '-ss', String(first / fps), '-i', `${name}.wav`, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-shortest', '-movflags', '+faststart', `${name}.mp4`]).done;
    for (const f of [...parts, `${name}.parts.txt`, `${name}.video.mp4`]) await rm(f, { force: true });
    console.log(`→ ${name}.mp4 (the sound alone: ${name}.wav)`);
  }
} finally { await server.close(); }
