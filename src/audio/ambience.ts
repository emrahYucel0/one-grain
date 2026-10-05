import { AMB, type Ambience } from '../story/sound';
import type { Engine } from './engine';
import { rand } from './random';

type Kind = 'thump' | 'crack' | 'bubble' | 'tick' | 'gust' | 'wave' | 'metal' | 'brook';
const KINDS: readonly Kind[] = ['thump', 'crack', 'bubble', 'tick', 'gust', 'wave', 'metal', 'brook'];
const AHEAD = .3;

/**
 * The ambience (v23), in front of the music: per-world events (far thumps, cracks, ticks, gusts,
 * waves, distant metal rings, the river's babbling bubbles) and one continuous sound, a soft
 * modulated water rush, only where there is water. Events are scheduled inside a look-ahead
 * window as a Poisson process per kind; after a stall, missed events are skipped, never bunched.
 */
export class AmbienceLayer {
  private w: Ambience | null = null;
  private slug = '';
  private readonly next = new Map<Kind, number>();
  private readonly bedG: GainNode;
  private readonly bedLfoG: GainNode;
  private readonly e: Engine;

  constructor(e: Engine) {
    this.e = e;
    const ctx = e.ctx;
    const src = ctx.createBufferSource(); src.buffer = e.noiseBuf; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 750; bp.Q.value = .6;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    this.bedG = e.gain(0); src.connect(bp).connect(lp).connect(this.bedG).connect(e.ambience); src.start();
    const lfo = ctx.createOscillator(); lfo.frequency.value = .17; this.bedLfoG = e.gain(0); lfo.connect(this.bedLfoG).connect(this.bedG.gain); lfo.start();
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = .43; const lfo2G = e.gain(160); lfo2.connect(lfo2G).connect(bp.frequency); lfo2.start();
  }

  /** The world whose ambience plays; arriving somewhere, its first sounds come now, not seconds later. */
  world(slug: string): void {
    if (slug === this.slug) return;
    this.slug = slug; this.w = AMB[slug]!;
    for (const k of KINDS) this.next.set(k, 0);
    this.next.set('wave', this.w.wave > 0 ? this.e.now + .05 : 0); // the coast's first wave at once
  }

  /** The water rush, 0..1. */
  bed(level: number): void { this.e.glide(this.bedG.gain, level * .06, .5); this.e.glide(this.bedLfoG.gain, level * .018, .5); }

  /** Called by the scheduler: every event due inside the look-ahead window. */
  schedule(now: number): void {
    const w = this.w;
    if (!w) return;
    // g: the world's gain on every event (the random draws stay in the same order whatever it is)
    const R = rand, ahead = now + AHEAD, g = 10 ** ((w.gain ?? 0) / 20);
    for (const t of this.due('thump', w.thump, now, ahead)) this.thump(t, .04 * g);
    for (const t of this.due('crack', w.crack, now, ahead)) this.burst(t, w.crackF[0] + R() * (w.crackF[1] - w.crackF[0]), 12, .015 + R() * .04, (.3 + R() * .3) * g, (R() - .5) * 1.4);
    const bf = w.bubF ?? [3000, 6000];
    for (const t of this.due('bubble', w.bubble, now, ahead)) this.burst(t, bf[0] + R() * (bf[1] - bf[0]), 18, .02 + R() * .05, (.34 + R() * .3) * g, (R() - .5) * 1.6);
    for (const t of this.due('tick', w.tick, now, ahead)) this.burst(t, w.tickF * (.8 + R() * .4), 6, .008, (.28 + R() * .16) * g, (R() - .5) * 1.4);
    for (const t of this.due('gust', w.gust, now, ahead)) this.swell(t, (w.gustF ?? 5000) * (.85 + R() * .3), 1.2, 1.8 + R() * 2, 2.5 + R() * 3, .09 * g, (R() - .5) * 1.4, 'bandpass');
    for (const t of this.due('wave', w.wave, now, ahead)) this.swell(t, 900 + R() * 400, .6, 2.6 + R(), 3.6 + R() * 1.5, .07 * g, (R() - .5) * .8, 'lowpass');
    for (const t of this.due('metal', w.metal, now, ahead)) this.metal(t, .05 * g);
    for (const t of this.due('brook', w.brook ?? 0, now, ahead)) this.bubble(t, (.012 + R() * .022) * g, (R() - .5) * 1.5);
  }

  /** Every event time of one kind inside the window (at most six per call). */
  private due(k: Kind, rate: number, now: number, ahead: number): number[] {
    const out: number[] = [];
    if (rate <= 0) { this.next.set(k, 0); return out; }
    let n = this.next.get(k) ?? 0;
    if (!n) n = now + rand() / rate;
    else if (n < now - .5) n = now + rand() * .1; // after a stall: skip what was missed
    while (n < ahead && out.length < 6) { out.push(Math.max(n, now + .005)); n += -Math.log(1 - rand()) / rate; }
    this.next.set(k, n);
    return out;
  }

  /** A short band of noise. */
  private burst(t: number, f: number, q: number, len: number, level: number, pan: number): void {
    const e = this.e, ctx = e.ctx, src = ctx.createBufferSource(); src.buffer = e.noiseBuf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level, t + .002); g.gain.exponentialRampToValueAtTime(.0001, t + len);
    src.connect(bp).connect(g); e.pan(g, pan).connect(e.ambience); src.start(t, rand() * 3.5, len + .05);
    e.count(4);
  }

  /** A slow swelling breath of noise. */
  private swell(t: number, f: number, q: number, up: number, down: number, level: number, pan: number, type: BiquadFilterType): void {
    const e = this.e, ctx = e.ctx, src = ctx.createBufferSource(); src.buffer = e.noiseBuf; src.loop = true;
    const flt = ctx.createBiquadFilter(); flt.type = type; flt.frequency.value = f; flt.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level, t + up); g.gain.linearRampToValueAtTime(0, t + up + down);
    let out: AudioNode = g;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.setValueAtTime(pan, t); p.pan.linearRampToValueAtTime(-pan * .6, t + up + down); g.connect(p); out = p; }
    src.connect(flt).connect(g); out.connect(e.ambience); src.start(t, rand() * 3); src.stop(t + up + down + .1);
    e.count(4);
  }

  /** One bubble on the water's surface: a tiny sine whose pitch rises as it closes. */
  private bubble(t: number, level: number, pan: number): void {
    const e = this.e, ctx = e.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    const f0 = 380 * Math.pow(2, rand() * 2.6), dur = .018 + rand() * .045;
    o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * (1.4 + rand() * .5), t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level, t + .002); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); e.pan(g, pan).connect(e.ambience); o.start(t); o.stop(t + dur + .02);
    e.count(3);
  }

  /** A low far thump. */
  private thump(t: number, level: number): void {
    const e = this.e, ctx = e.ctx, o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.type = 'sine'; o.frequency.setValueAtTime(58 + rand() * 14, t); o.frequency.exponentialRampToValueAtTime(34, t + 1.6);
    lp.type = 'lowpass'; lp.frequency.value = 160;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level, t + .35); g.gain.exponentialRampToValueAtTime(.0001, t + 2.4);
    o.connect(lp).connect(g).connect(e.ambience); o.start(t); o.stop(t + 2.5);
    e.count(3);
  }

  /** A distant metal ring (into the room only). */
  private metal(t: number, level: number): void {
    const e = this.e, ctx = e.ctx, base = 300 + rand() * 300;
    [1, 2.76, 5.4, 8.93].forEach((r, k) => {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = base * r;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level / (k + 1), t + .005); g.gain.exponentialRampToValueAtTime(.0001, t + 2.5 - k * .4);
      o.connect(g).connect(e.ambRoom); o.start(t); o.stop(t + 2.6);
    });
    e.count(8);
  }
}
