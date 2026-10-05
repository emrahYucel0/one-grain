// Delivery encodes from the capture masters (npm run encode -- …):
//   (default)            the 1080p submission file for Vimeo/YouTube: the 2560×1440 master (or the
//                        1080p one when that is all there is) scaled to 1920×1080 (Lanczos), H.264
//                        High, two passes at the bitrate that lands on --target-mb (200), GOP of half a
//                        second, the master's AAC copied → capture/out/one-grain-1080p-submission.mp4
//   --teaser <file.json> a short cut (capture/teaser.json): clips of master seconds in order, each
//                        meeting the one before with a hard cut or a crossfade of fadeFrames; the sound
//                        follows the picture with soundFadeMs fades at every cut; the last silentEnd
//                        seconds are silent; 1080p H.264, two passes at --kbps (13 000, the submission
//                        file's rate) → capture/out/one-grain-teaser.mp4
//   … --storyboard       first, a sheet of every clip's in, middle and out frames →
//                        capture/out/teaser-storyboard.jpg (--storyboard-only: just the sheet)
// The masters stay as rendered (CRF 14). ffmpeg as in scripts/capture.mjs.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, stat } from 'node:fs/promises';
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
  const spec = JSON.parse(await readFile(teaser, 'utf8')), clips = spec.clips, fps = 60;
  const fade = (spec.fadeFrames ?? 8) / fps, sf = (spec.soundFadeMs ?? 150) / 1000, silent = spec.silentEnd ?? 1;
  const out = `${OUT}/one-grain-teaser.mp4`;
  if (args.includes('--storyboard') || args.includes('--storyboard-only')) await storyboard(clips, `${OUT}/teaser-storyboard.jpg`);
  if (args.includes('--storyboard-only')) process.exit(0);
  // each clip trimmed from the master; its sound faded at the edges that are hard cuts
  const parts = [];
  clips.forEach((c, i) => {
    const len = c.to - c.from, next = clips[i + 1];
    const fadeIn = i === 0 || c.join !== 'fade', fadeOut = next && next.join !== 'fade';
    const af = [fadeIn && `afade=t=in:d=${sf}`, fadeOut && `afade=t=out:st=${(len - sf).toFixed(3)}:d=${sf}`].filter(Boolean).join(',');
    parts.push(`[0:v]trim=start=${c.from}:end=${c.to},setpts=PTS-STARTPTS,settb=AVTB,${scale}[v${i}]`, `[0:a]atrim=start=${c.from}:end=${c.to},asetpts=PTS-STARTPTS${af ? ',' + af : ''}[a${i}]`);
  });
  // joined in order: a crossfade where the act changes, a hard cut elsewhere
  let v = 'v0', a = 'a0', len = clips[0].to - clips[0].from;
  for (let i = 1; i < clips.length; i++) {
    const d = clips[i].to - clips[i].from;
    if (clips[i].join === 'fade') {
      parts.push(`[${v}][v${i}]xfade=transition=fade:duration=${fade.toFixed(4)}:offset=${(len - fade).toFixed(4)}[vj${i}]`, `[${a}][a${i}]acrossfade=d=${fade.toFixed(4)}[aj${i}]`);
      len += d - fade;
    } else {
      parts.push(`[${v}][${a}][v${i}][a${i}]concat=n=2:v=1:a=1[vj${i}][aj${i}]`);
      len += d;
    }
    v = `vj${i}`; a = `aj${i}`;
  }
  // the end: the sound fades into silence for the last second
  parts.push(`[${v}]format=yuv420p[vo]`, `[${a}]afade=t=out:st=${(len - silent - sf).toFixed(3)}:d=${sf},volume=volume=0:enable='gte(t,${(len - silent).toFixed(3)})'[ao]`);
  console.log(`${clips.length} clips · ${len.toFixed(2)} s`);
  // the submission file's quality: two passes at its video bitrate (--kbps, 13 000)
  const kbps = +opt('--kbps', 13000), log = `${OUT}/x264-teaser`, rate = ['-b:v', `${kbps}k`, '-maxrate', `${Math.round(kbps * 1.6)}k`, '-bufsize', `${kbps * 3}k`];
  const graph = ['-i', master, '-filter_complex', parts.join(';'), '-map', '[vo]', '-map', '[ao]'];
  await run([...graph, ...h264, ...rate, '-pass', '1', '-passlogfile', log, '-c:a', 'aac', '-f', 'mp4', process.platform === 'win32' ? 'NUL' : '/dev/null']);
  await run([...graph, ...h264, ...rate, '-pass', '2', '-passlogfile', log, '-c:a', 'aac', '-b:a', '320k', out]);
  for (const f of ['-0.log', '-0.log.mbtree']) await rm(`${log}${f}`, { force: true });
  console.log(`→ ${out} · ${((await stat(out)).size / 1048576).toFixed(0)} MB`);
}

/** A sheet of each clip's in, middle and out frames, with its label and times (rendered with Playwright). */
async function storyboard(list, file) {
  const { chromium } = await import('playwright');
  const tmp = `${OUT}/storyboard-frames`;
  await mkdir(tmp, { recursive: true });
  const rows = [];
  for (const [i, c] of list.entries()) {
    const times = [c.from, (c.from + c.to) / 2, c.to - 1 / 60];
    const imgs = [];
    for (const [k, t] of times.entries()) {
      const f = `${tmp}/${i}-${k}.jpg`;
      await run(['-ss', t.toFixed(3), '-i', master, '-frames:v', '1', '-vf', 'scale=480:-1', '-q:v', '3', f]);
      imgs.push(`data:image/jpeg;base64,${(await readFile(f)).toString('base64')}`);
    }
    rows.push({ i, c, times, imgs });
  }
  const html = rows.map(({ i, c, times, imgs }) => `<div class="r"><div class="t"><b>${i + 1}.</b> ${c.label}<br><span>${c.from.toFixed(2)}–${c.to.toFixed(2)} s · ${(c.to - c.from).toFixed(2)} s${i ? ` · ${c.join === 'fade' ? 'crossfade in' : 'cut in'}` : ''}</span></div>${imgs.map((src, k) => `<figure><img src="${src}"><figcaption>${['in', 'middle', 'out'][k]} ${times[k].toFixed(2)} s</figcaption></figure>`).join('')}</div>`).join('');
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1800, height: 400 } });
  await p.setContent(`<style>body{margin:0;padding:12px;background:#141414;color:#eee;font:14px system-ui}.r{display:flex;gap:8px;align-items:center;margin-bottom:8px}.t{width:330px}.t span{color:#aaa}figure{margin:0}img{display:block;width:480px}figcaption{color:#aaa;font-size:12px}</style><h1 style="font:600 18px system-ui;margin:0 0 12px">Teaser storyboard · ${list.length} clips</h1>${html}`);
  await p.screenshot({ path: file, type: 'jpeg', quality: 85, fullPage: true });
  await b.close();
  await rm(tmp, { recursive: true, force: true });
  console.log(`→ ${file}`);
}
