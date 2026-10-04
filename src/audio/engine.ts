import { LEVELS } from '../story/sound';
import { rand } from './random';

/**
 * The sound's plumbing (v23): one AudioContext, created on the visitor's first request, never
 * before. Buses:
 *   music (.42) ─┬─ dry (.75) ──────────────────┐
 *                └─ room ── wet (.55) ──────────┤
 *   ambience (2.2) ── duck ─┬─ dry              ├─ master (.7) ── limiter (−10 dB, safety only) ── out
 *                           └─ ambRoom (.35) ── room
 * The room is a long, soft, dark generated tail; noiseBuf is four seconds of white noise for the
 * ambience. Nothing is loaded: everything is synthesised.
 */
export class Engine {
  /** the visitor's AudioContext, or capture mode's OfflineAudioContext (src/capture/) */
  readonly ctx: AudioContext | OfflineAudioContext;
  readonly master: GainNode;
  readonly music: GainNode;
  readonly ambience: GainNode;
  readonly ambRoom: GainNode;
  readonly noiseBuf: AudioBuffer;
  /** audio nodes created by events, and main-thread time spent mapping and scheduling (for the audio check) */
  readonly stats = { nodes: 0, frameMs: 0, schedMs: 0 };
  /** with ?parity: taps for the audio check (output after the limiter, the music and ambience buses) */
  readonly taps: { out: AnalyserNode; music: AnalyserNode; ambience: AnalyserNode } | null;

  private constructor(ctx: AudioContext | OfflineAudioContext, withTaps: boolean) {
    this.ctx = ctx;
    const G = (v: number): GainNode => { const g = ctx.createGain(); g.gain.value = v; return g; };
    this.master = G(0);
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -10; lim.knee.value = 6; lim.ratio.value = 10; lim.attack.value = .004; lim.release.value = .3;
    this.master.connect(lim).connect(ctx.destination);
    const room = ctx.createConvolver(); room.buffer = makeRoom(ctx, 6);
    const wet = G(.55), dry = G(.75);
    room.connect(wet).connect(this.master);
    dry.connect(this.master);
    this.music = G(LEVELS.music); this.music.connect(dry); this.music.connect(room);
    this.ambience = G(LEVELS.ambience);
    const duck = G(1);
    this.ambience.connect(duck); duck.connect(dry);
    this.ambRoom = G(.35); duck.connect(this.ambRoom).connect(room);
    this.noiseBuf = noise(ctx, 4);
    if (withTaps) {
      const tap = (from: AudioNode): AnalyserNode => { const a = ctx.createAnalyser(); a.fftSize = 2048; from.connect(a); return a; };
      this.taps = { out: tap(lim), music: tap(this.music), ambience: tap(duck) };
    } else this.taps = null;
  }

  /** null where Web Audio is missing. */
  static create(withTaps = false): Engine | null {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    return AC ? new Engine(new AC(), withTaps) : null;
  }

  /** Capture mode: the same plumbing on an OfflineAudioContext. */
  static offline(ctx: OfflineAudioContext): Engine { return new Engine(ctx, false); }

  /**
   * Capture mode sets the clock itself (the frame's exact time): an OfflineAudioContext's currentTime,
   * read on the main thread while suspended, can trail the suspension point by a varying amount.
   */
  clock: number | null = null;

  get now(): number { return this.clock ?? this.ctx.currentTime; }

  /** Count audio nodes created for an event. */
  count(n: number): void { this.stats.nodes += n; }

  /** A gain node with a starting value. */
  gain(v: number): GainNode { const g = this.ctx.createGain(); g.gain.value = v; return g; }

  /** Glide towards v (time constant tc, seconds). */
  glide(param: AudioParam, v: number, tc = .2): void { param.setTargetAtTime(v, this.now, tc); }

  /** A stereo panner after `node` where the browser has one; returns what to connect onwards. */
  pan(node: AudioNode, value: number): AudioNode {
    if (!this.ctx.createStereoPanner) return node;
    const p = this.ctx.createStereoPanner(); p.pan.value = value; node.connect(p); return p;
  }
}

/** A long, soft, dark room: low-passed noise with a slow fall. */
function makeRoom(ctx: BaseAudioContext, sec: number): AudioBuffer {
  const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
  const k = Math.exp(-2 * Math.PI * 4200 / ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c); let lp = 0;
    for (let i = 0; i < n; i++) { const t = i / n; lp = lp * k + (rand() * 2 - 1) * (1 - k); d[i] = lp * Math.pow(1 - t, 2.4) * (t < .01 ? t / .01 : 1); }
  }
  return b;
}

function noise(ctx: BaseAudioContext, sec: number): AudioBuffer {
  const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = rand() * 2 - 1;
  return b;
}
