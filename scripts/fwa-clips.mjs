// FWA extra visuals (node scripts/fwa-clips.mjs [id…]): silent MP4 loops from capture mode at the high
// tier with every effect on and no words or HUD (scripts/capture.mjs --clean --no-sound), rendered at 2×
// and scaled down (Lanczos) to the size, H.264 at 60 fps, then looped: the clip's last FADE seconds
// dissolve into its first, and the first FADE seconds are dropped, so the end meets the start.
// Transitions run between a short hold at each end (ping-pong would play the rock and the crystal
// backwards), and are paced so the change itself fills the loop: the still stretches go quickly and the
// action (the crack and the fall, the melt, the crystal's rise) gets about 3 s, in a copy of the capture
// path with a "pace" for that move (scripts/capture.mjs).
// H.264 in 4:2:0 (what every player decodes) needs even sizes, and its cropping works in steps of two
// pixels, so an odd side cannot be had in 4:2:0. Two files per clip with an odd side: the exact size in
// 4:4:4 (High 4:4:4: Chrome plays it, Safari and many hardware decoders do not), and a "compat" one in
// 4:2:0, one pixel larger on the odd side. The 2× masters stay in capture/out/fwa/raw/ (a rerun
// re-encodes from them). A frame strip of each clip (8 frames across the loop) goes next to it.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const CLIPS = [
  // the quarry → furnace transition, 0.5 s of hold either side: the pit (t 0–.22) quickly, the crack and the
  // fall (.22–.72) over 3 s, the glow coming up (.72–1) over 1.3 s
  { id: 'fwa-extra-01-628x353', w: 628, h: 353, move: 'quarry', pace: [[.45, .22], [3, .72], [1.3, 1], [.35, 'end']], fade: .4 },
  // purity → crystal: the rods melting into the pool (t .05–.5) over 2.2 s, the crystal's rise (.5–.95) over 3 s
  { id: 'fwa-extra-02-628x353', w: 628, h: 353, move: 'purity', pace: [[.3, .05], [2.2, .5], [3, .95], [.4, 1], [.25, 'end']], fade: .4 },
  // the chip hold (90.35–95.85 s), the scripted cursor lighting the switches
  { id: 'fwa-extra-03-877x548', w: 877, h: 548, from: 90.35, to: 95.85, fade: .5 },
];
const OUT = 'capture/out/fwa';
const ffmpeg = process.env.FFMPEG ?? (() => { try { const p = createRequire(import.meta.url)('ffmpeg-static'); if (p && existsSync(p)) return p; } catch { /* none */ } return 'ffmpeg'; })();
const sh = (cmd, argv) => new Promise((ok, fail) => spawn(cmd, argv, { stdio: 'inherit' }).on('close', (c) => (c ? fail(new Error(`${cmd} exited with ${c}`)) : ok())));
const ff = (argv) => sh(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...argv]);
const probe = (file) => new Promise((ok) => {
  const p = spawn(ffmpeg, ['-hide_banner', '-i', file], { stdio: ['ignore', 'ignore', 'pipe'] });
  let err = ''; p.stderr.on('data', (d) => { err += d; }); p.on('close', () => ok(err));
});

const only = process.argv.slice(2);
for (const c of CLIPS.filter((x) => !only.length || only.some((o) => x.id.includes(o)))) {
  const raw = `fwa/raw/${c.id}`;
  if (!existsSync(`capture/out/${raw}.mp4`)) {
    let window = ['--seconds', `${c.from}-${c.to}`];
    if (c.move) { // a copy of the capture path with this move paced
      const path = JSON.parse(await readFile('capture/path.json', 'utf8'));
      path.pace = { ...path.pace, [c.move]: c.pace };
      await writeFile(`${OUT}/raw/path-${c.id}.json`, JSON.stringify(path, null, 1));
      window = ['--path', `${OUT}/raw/path-${c.id}.json`, '--move', c.move, '--around', '.5'];
    }
    await sh(process.execPath, ['scripts/capture.mjs', `${c.w}x${c.h}`, ...window, '--clean', '--scale', '2', '--no-sound', '--name', raw]);
  }
  const d = +((await probe(`capture/out/${raw}.mp4`)).match(/Duration: (\d+):(\d+):([\d.]+)/) ?? []).slice(1).reduce((a, x) => a * 60 + +x, 0);
  const W = c.w + (c.w % 2), H = c.h + (c.h % 2);
  const variants = [[`${OUT}/${c.id}.mp4`, c.w, c.h, 'yuv444p', 'high444']];
  if (W !== c.w || H !== c.h) variants.push([`${OUT}/${c.id}-compat-${W}x${H}.mp4`, W, H, 'yuv420p', 'high']);
  for (const [out, w, h, pix, profile] of variants) {
    const graph = [
      `[0:v]scale=${w}:${h}:flags=lanczos,setsar=1,fps=60,split[a][b]`,
      `[a]trim=start=${c.fade},setpts=PTS-STARTPTS[body]`,
      `[b]trim=end=${c.fade},setpts=PTS-STARTPTS[head]`,
      `[body][head]xfade=transition=fade:duration=${c.fade}:offset=${(d - 2 * c.fade).toFixed(3)}[v]`,
    ].join(';');
    await ff(['-i', `capture/out/${raw}.mp4`, '-filter_complex', graph, '-map', '[v]', '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '14',
      '-profile:v', profile, '-pix_fmt', pix, '-r', '60', '-movflags', '+faststart', out]);
    const info = await probe(out), size = (await stat(out)).size;
    const dims = info.match(/Video: h264.*?, (\d{3,4})x(\d{3,4})/), dur = info.match(/Duration: ([\d:.]+)/)?.[1], fps = info.match(/([\d.]+) fps/)?.[1];
    console.log(`→ ${out}: ${dims ? `${dims[1]}×${dims[2]}` : '?'} · ${pix} · ${dur} · ${fps} fps · ${(size / 1048576).toFixed(2)} MB · ${/Audio:/.test(info) ? 'has audio' : 'no audio'}`);
  }
  // the strip: 8 frames across the loop, side by side
  const step = (d - c.fade) / 8;
  await ff(['-i', `${OUT}/${c.id}.mp4`, '-vf', `fps=1/${step.toFixed(4)},scale=${Math.round(c.w / 2)}:-2,tile=8x1:padding=4:color=black`, '-frames:v', '1', '-q:v', '3', `${OUT}/strip-${c.id}.jpg`]);
}
