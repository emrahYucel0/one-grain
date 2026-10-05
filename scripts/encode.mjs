// Delivery encodes from the capture masters (npm run encode -- …):
//   (default)            the 1080p submission file for Vimeo/YouTube: the 2560×1440 master (or the
//                        1080p one when that is all there is) scaled to 1920×1080 (Lanczos), H.264
//                        High, two passes at the bitrate that lands on --target-mb (200), GOP of half a
//                        second, the master's AAC copied → capture/out/one-grain-1080p-submission.mp4
//   --teaser <file.json> a short cut: [{ "from": s, "to": s }, …] (master seconds), joined with
//                        --fade (0.6 s) crossfades of picture and sound, faded in and out, 1080p H.264
//                        (CRF 17) → capture/out/one-grain-teaser.mp4
// The masters stay as rendered (CRF 14). ffmpeg as in scripts/capture.mjs.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, rm, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = 'capture/out';
const ffmpeg = (() => {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try { const p = createRequire(import.meta.url)('ffmpeg-static'); if (p && existsSync(p)) return p; } catch { /* not installed */ }
  return 'ffmpeg';
})();
const run = (argv, capture = false) => new Promise((ok, fail) => {
  const p = spawn(ffmpeg, ['-hide_banner', ...(capture ? [] : ['-loglevel', 'error']), '-y', ...argv], { stdio: ['ignore', 'inherit', capture ? 'pipe' : 'inherit'] });
  let err = '';
  if (capture) p.stderr.on('data', (d) => { err += d; });
  p.on('error', (e) => fail(new Error(`ffmpeg could not start (${e.message})`)));
  p.on('close', (c) => (c && !capture ? fail(new Error(`ffmpeg exited with ${c}`)) : ok(err)));
});
/** seconds, from ffmpeg's own banner (ffmpeg-static ships no ffprobe) */
const duration = async (file) => { const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(await run(['-i', file], true)); return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : NaN; };
const master = opt('--source', [`${OUT}/one-grain-2560x1440.mp4`, `${OUT}/one-grain-1920x1080.mp4`].find((f) => existsSync(f)));
if (!master) throw new Error('no master in capture/out (npm run capture first)');
const scale = 'scale=1920:1080:flags=lanczos,format=yuv420p';
const h264 = ['-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-level', '4.2', '-g', '30', '-bf', '2', '-movflags', '+faststart'];
const t0 = Date.now();

const teaser = opt('--teaser', null);
if (!teaser) {
  const mb = +opt('--target-mb', 200), secs = await duration(master), audioKbps = 320;
  const kbps = Math.floor(mb * 8 * 1024 * 1024 / 1000 / secs - audioKbps - 100); // 100 kb/s for the container and the encoder's overshoot
  const out = `${OUT}/one-grain-1080p-submission.mp4`, log = `${OUT}/x264-2pass`;
  const rate = ['-b:v', `${kbps}k`, '-maxrate', `${Math.round(kbps * 1.6)}k`, '-bufsize', `${kbps * 3}k`];
  console.log(`${master} · ${secs.toFixed(2)} s → 1920×1080, ${kbps} kb/s video + ${audioKbps} kb/s audio, two passes`);
  await run(['-i', master, '-vf', scale, ...h264, ...rate, '-pass', '1', '-passlogfile', log, '-an', '-f', 'mp4', process.platform === 'win32' ? 'NUL' : '/dev/null']);
  await run(['-i', master, '-vf', scale, ...h264, ...rate, '-pass', '2', '-passlogfile', log, '-c:a', 'copy', out]);
  for (const f of ['-0.log', '-0.log.mbtree']) await rm(`${log}${f}`, { force: true });
  console.log(`→ ${out} · ${((await stat(out)).size / 1048576).toFixed(0)} MB · ${((Date.now() - t0) / 60000).toFixed(1)} min`);
} else {
  const clips = JSON.parse(await readFile(teaser, 'utf8')), fade = +opt('--fade', .6), out = `${OUT}/one-grain-teaser.mp4`;
  // each clip trimmed from the master; picture and sound crossfaded into the next
  const parts = [];
  clips.forEach((c, i) => parts.push(`[0:v]trim=${c.from}:${c.to},setpts=PTS-STARTPTS,${scale}[v${i}]`, `[0:a]atrim=${c.from}:${c.to},asetpts=PTS-STARTPTS[a${i}]`));
  let v = 'v0', a = 'a0', len = clips[0].to - clips[0].from;
  for (let i = 1; i < clips.length; i++) {
    parts.push(`[${v}][v${i}]xfade=transition=fade:duration=${fade}:offset=${(len - fade).toFixed(3)}[vx${i}]`, `[${a}][a${i}]acrossfade=d=${fade}[ax${i}]`);
    v = `vx${i}`; a = `ax${i}`; len += clips[i].to - clips[i].from - fade;
  }
  parts.push(`[${v}]fade=t=in:d=0.5,fade=t=out:st=${(len - .8).toFixed(3)}:d=0.8,format=yuv420p[vo]`, `[${a}]afade=t=in:d=0.5,afade=t=out:st=${(len - .8).toFixed(3)}:d=0.8[ao]`);
  console.log(`${clips.length} clips · ${len.toFixed(1)} s`);
  await run(['-i', master, '-filter_complex', parts.join(';'), '-map', '[vo]', '-map', '[ao]', ...h264, '-crf', '17', '-c:a', 'aac', '-b:a', '320k', out]);
  console.log(`→ ${out} · ${((await stat(out)).size / 1048576).toFixed(0)} MB`);
}
