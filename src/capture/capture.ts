import { Engine } from '../audio/engine';
import { Sound, type SoundFrame } from '../audio/frame';
import { seedRandom } from '../audio/random';
import type { Pointer } from '../input/pointer';

declare global {
  interface Window {
    /** ?capture: driven by scripts/capture.mjs */
    __capture?: CaptureApi;
  }
}

export interface CaptureApi {
  /**
   * Render the frame at `nowMs` on the capture's clock, at story progress v; `holdSec`: seconds resting
   * on the current chapter (null while moving); `cursor`: the scripted pointer in normalised device
   * coordinates, or null when it is away.
   */
  step(nowMs: number, v: number, holdSec: number | null, cursor?: { x: number; y: number } | null): void;
  /** Render the sound for every stepped frame offline; resolves to a 16-bit stereo WAV, base64. */
  sound(fps: number, seed: number): Promise<string>;
}

const RATE = 48000;
/** audio after the last frame (the room's tail; the video's length decides what is kept) */
const TAIL_S = 4;
/** the realtime scheduler's period (audio/frame.ts): every third frame at 60 fps */
const SCHEDULE_EVERY_S = .05;
/** the scripted cursor steers the camera's pointer parallax at this share of a mouse's (a hand-held sway would read as a camera move) */
const PARALLAX = .5;

/**
 * Capture mode (?capture): the submission video, rendered offline one frame at a time by
 * scripts/capture.mjs. Each step sets the page's virtual clock (debug/parity.ts), the progress and
 * the seconds in the hold, renders one frame, and moves CSS transitions and Web Animations (the
 * clock's punch) to the same clock, so a frame shows the same whatever the render takes. The
 * sound's view of each frame is recorded; afterwards the whole score is scheduled frame by frame at
 * the same times, with a seeded random source, and rendered on an OfflineAudioContext.
 * Interaction hints are hidden (html.capture); instead a scripted, invisible cursor hovers where the
 * path says (the desert's dunes part, the chip's switches light).
 * Returns the recorder the frame listener feeds.
 */
export function exposeCapture(loop: { step(): void }, pointer: Pointer): (f: SoundFrame) => void {
  document.documentElement.classList.add('capture');
  const frames: SoundFrame[] = [];
  const born = new WeakMap<Animation, number>();
  // the video has its sound: the button shows it on (without starting the visitor's realtime sound)
  const button = document.getElementById('sound');
  if (button) { button.textContent = button.dataset.on ?? button.textContent; button.setAttribute('aria-pressed', 'true'); }
  window.__capture = {
    step(nowMs, v, holdSec, cursor = null) {
      window.__VNOW = nowMs; window.__V = v; window.__FT = holdSec;
      pointer.hovering = !!cursor;
      if (cursor) { pointer.nx = cursor.x; pointer.ny = cursor.y; pointer.x = cursor.x / 2 * PARALLAX; pointer.y = -cursor.y / 2 * PARALLAX; } else { pointer.x = 0; pointer.y = 0; }
      loop.step();
      for (const a of document.getAnimations()) {
        if (!born.has(a)) born.set(a, nowMs);
        a.pause();
        a.currentTime = nowMs - born.get(a)!;
      }
    },
    async sound(fps, seed) {
      seedRandom(seed);
      window.__FT = null; // the sound times its holds from the frame times below
      const ctx = new OfflineAudioContext(2, Math.ceil((frames.length / fps + TAIL_S) * RATE), RATE);
      const engine = Engine.offline(ctx), sound = Sound.driven(engine);
      const every = Math.max(1, Math.round(SCHEDULE_EVERY_S * fps));
      // The whole score is scheduled before rendering starts, frame by frame on the frame's exact time
      // (Engine.clock): nodes created while an OfflineAudioContext is suspended join its graph at a
      // moment that varies from run to run, so their starts would too.
      for (let i = 0; i < frames.length; i++) { engine.clock = i / fps; sound.frame(frames[i]!, i * 1000 / fps); if (i % every === 0) sound.schedule(); }
      return wavBase64(await ctx.startRendering());
    },
  };
  return (f) => frames.push({ ...f });
}

/** 16-bit PCM WAV, base64 (chunked: the string is tens of megabytes). */
function wavBase64(buf: AudioBuffer): string {
  const ch = buf.numberOfChannels, n = buf.length, bytes = new Uint8Array(44 + n * ch * 2), dv = new DataView(bytes.buffer);
  const str = (o: number, s: string): void => { for (let i = 0; i < s.length; i++) bytes[o + i] = s.charCodeAt(i); };
  str(0, 'RIFF'); dv.setUint32(4, 36 + n * ch * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true); dv.setUint32(24, buf.sampleRate, true);
  dv.setUint32(28, buf.sampleRate * ch * 2, true); dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true);
  str(36, 'data'); dv.setUint32(40, n * ch * 2, true);
  const data = Array.from({ length: ch }, (_, c) => buf.getChannelData(c));
  for (let i = 0, o = 44; i < n; i++) for (let c = 0; c < ch; c++, o += 2) dv.setInt16(o, Math.max(-1, Math.min(1, data[c]![i]!)) * 32767, true);
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
}
