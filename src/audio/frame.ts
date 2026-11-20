import { ss } from '../core/ease';
import { holdTimeOverride } from '../debug/parity';
import { ACTS, AMB, LEVELS, PULSE, SOUND_ACT } from '../story/sound';
import type { TransitionDef } from '../story/types';
import { WORLDS } from '../story/worlds';
import { AmbienceLayer } from './ambience';
import { Engine } from './engine';
import { Score } from './score';

const LAST = WORLDS.length - 1;
const slug = (i: number): string => WORLDS[i]!.slug;
const actOf = (i: number): number => SOUND_ACT[slug(i)]!;
const TICK_MS = 50;

/** Where the story is, for the sound (from the loop's frame). */
export interface SoundFrame {
  a: number; b: number;
  /** progress in the transition, and the camera's eased progress */
  t: number; eg: number;
  tr: TransitionDef;
  /** the chapter resting on, -1 while moving */
  hold: number;
}

/**
 * The sound (v23): the engine, the music and the ambience, mapped from the story every frame and
 * scheduled ahead by a timer. Created on the visitor's first request, never before.
 *
 * Quiet, never silence: through the "One day," cut the sound sinks to CUT_FLOOR (over t .02–.3, back
 * over .8–1) and one low note rings under the card; on the ending it settles to END_FLOOR with the
 * grain's light (3–6.2 s into the final hold) and the music goes on, softly. Only sound off ramps the
 * master to exactly 0. Starting again (ui/rewind.ts) has its own sound: rewind().
 */
const CUT_FLOOR = .32;
const END_FLOOR = .3;
export class Sound {
  on = false;
  readonly engine: Engine;
  private readonly score: Score;
  private readonly amb: AmbienceLayer;
  private timer = 0;
  private gate = 1;
  private lastGate = 0;
  private zeroed = true;
  private lastHold = -1;
  private holdAt = -1;
  private holdSince = -1;
  /** the cut's low note has rung (once per pass through the cut) */
  private tolled = false;
  /** audio time the rewind's sound ends (0: none) */
  private rewindUntil = 0;

  private constructor(engine: Engine) {
    this.engine = engine;
    this.score = new Score(engine);
    this.amb = new AmbienceLayer(engine);
  }

  /** null where Web Audio is missing. */
  static create(withTaps: boolean): Sound | null {
    const e = Engine.create(withTaps);
    return e ? new Sound(e) : null;
  }

  /**
   * Capture mode: the sound on an offline engine, driven from outside (frame() at the video's frame
   * times, schedule() every 50 ms of audio time) instead of by a timer.
   */
  static driven(engine: Engine): Sound {
    const s = new Sound(engine);
    s.on = true; s.lastGate = 0;
    return s;
  }

  setOn(on: boolean): void {
    const e = this.engine;
    this.on = on;
    if (on) {
      void e.ctx.resume();
      this.lastGate = 0;
      if (!this.timer) this.timer = window.setInterval(() => this.tick(), TICK_MS);
      return;
    }
    // off: to exactly 0 within .3 s; nothing more is scheduled
    const g = e.master.gain, now = e.now;
    g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(0, now + .3);
    this.zeroed = true;
    clearInterval(this.timer); this.timer = 0;
  }

  /** Every frame while sound is on. */
  frame(f: SoundFrame, now = performance.now()): void {
    if (!this.on) return;
    const t0 = performance.now(), e = this.engine, { a, b, t, eg, tr, hold } = f;
    if (hold < 0) this.holdAt = this.holdSince = -1;
    else if (hold !== this.holdAt) { this.holdAt = hold; this.holdSince = now; }
    const holdSec = hold < 0 ? 0 : holdTimeOverride() ?? (now - this.holdSince) / 1000;

    // harmony: one bank on chapter a, one on b, crossfaded with the camera; notes from the nearer chapter
    this.score.pads(a, b, eg);
    const cur = eg < .5 ? a : b;
    this.score.act = actOf(cur); this.score.chord = this.score.chordOf(cur);
    e.glide(this.score.padLP.frequency, ACTS[actOf(a)]!.padLP + (ACTS[actOf(b)]!.padLP - ACTS[actOf(a)]!.padLP) * eg, .6);
    // ambience: the world we are approaching from eg .35; the water rush where there is water
    this.amb.world(slug(eg < .35 ? a : b));
    const bedA = AMB[slug(a)]!.bed ?? 0, bedB = AMB[slug(b)]!.bed ?? 0;
    this.amb.bed(bedA + (bedB - bedA) * ss(.2, .8, eg));
    // the pad breathes: full when a chapter arrives or the story moves, settling lower while resting
    const rewinding = this.rewindUntil > e.now;
    e.glide(this.score.padG.gain, rewinding ? .3 : hold >= 0 ? .55 + .45 * (1 - ss(1, 7, holdSec)) : 1, rewinding ? .4 : .8);
    // the ambience steps aside while the story runs back (its worlds would flicker past)
    e.glide(e.ambience.gain, rewinding ? 0 : LEVELS.ambience, rewinding ? .25 : 1.2);
    this.score.pulse = hold >= 0 && PULSE.has(slug(hold));

    // silence: the cut and the end
    let gate = 1;
    if (tr.cam === 'cut' && !rewinding) {
      gate = 1 - (1 - CUT_FLOOR) * (t < .5 ? ss(.02, .3, t) : 1 - ss(.8, 1, t));
      // one low note under the "One day," card
      if (t > .3 && t < .7 && !this.tolled) { this.tolled = true; this.score.toll(b); }
    } else this.tolled = false;
    if (hold === LAST && !rewinding) gate = 1 - (1 - END_FLOOR) * ss(3, 6.2, holdSec); // it settles with the grain's light; the music goes on, softly
    this.gate = gate;
    const g = e.master.gain, at = e.now;
    if (gate < .02) {
      if (!this.zeroed) {
        // hold the level the automation has reached, then ramp to exactly 0 (cancelAndHoldAtTime where the
        // browser has it: it needs no read of the audio thread's value, which an offline render ahead of
        // time does not have)
        if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(at); else { g.cancelScheduledValues(at); g.setValueAtTime(g.value, at); }
        g.linearRampToValueAtTime(0, at + .5); this.zeroed = true;
      }
    } else {
      if (this.zeroed) { g.cancelScheduledValues(at); g.setValueAtTime(0, at); this.zeroed = false; }
      e.glide(g, LEVELS.master * gate, gate < this.lastGate ? .7 : .6);
    }
    this.lastGate = gate;

    // the motif, once per chapter arrival (never during silence)
    if (hold >= 0 && hold !== this.lastHold) { this.lastHold = hold; if (gate > .5 && !rewinding) this.score.motif(hold, actOf(hold)); }
    if (hold < 0) this.lastHold = -1;
    e.stats.frameMs += performance.now() - t0;
  }

  /**
   * Starting again (ui/rewind.ts): a tape running back for `dur` seconds — a rush of noise whose pitch
   * climbs with the run's speed and falls as it slows, a flutter on it, and the opening chord swelling in
   * backwards, landing as the camera reaches the grain.
   */
  rewind(dur: number): void {
    if (!this.on) return;
    const e = this.engine, ctx = e.ctx, t = e.now + .02, end = t + dur;
    this.rewindUntil = end;
    // the rush: band-passed noise, its band riding the run's speed
    const src = ctx.createBufferSource(); src.buffer = e.noiseBuf; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.6;
    const N = 48, curve = new Float32Array(N), lvl = new Float32Array(N);
    for (let k = 0; k < N; k++) {
      const x = k / (N - 1), speed = Math.sin(Math.PI * Math.min(1, x * 1.15)) ** 1.5;
      curve[k] = 260 + 2900 * speed;
      lvl[k] = .3 * Math.min(1, x / .12) * (x < .85 ? 1 : (1 - x) / .15) * (.35 + .65 * speed);
    }
    bp.frequency.setValueCurveAtTime(curve, t, dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.setValueCurveAtTime(lvl, t + .001, dur - .002);
    // the flutter: the tape's chatter, quicker as it runs
    const flut = ctx.createOscillator(); flut.frequency.setValueAtTime(9, t); flut.frequency.linearRampToValueAtTime(19, t + dur * .45); flut.frequency.linearRampToValueAtTime(7, end);
    const trem = e.gain(.7); flut.connect(e.gain(.3)).connect(trem.gain);
    src.connect(bp).connect(trem).connect(g).connect(e.music);
    src.start(t, 0); src.stop(end + .1); flut.start(t); flut.stop(end + .1);
    // the opening chord, backwards: it swells in from nothing and lands as the camera reaches the grain
    const sw = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(300, t); lp.frequency.exponentialRampToValueAtTime(1800, end);
    sw.gain.setValueAtTime(0, t); sw.gain.setValueAtTime(0, t + dur * .35); sw.gain.exponentialRampToValueAtTime(.002, t + dur * .4);
    sw.gain.exponentialRampToValueAtTime(.09, end); sw.gain.linearRampToValueAtTime(0, end + .25);
    sw.connect(lp).connect(e.music);
    for (const m of this.score.chordOf(0)) {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 440 * Math.pow(2, (m + 12 - 69) / 12);
      o.connect(sw); o.start(t); o.stop(end + .3);
    }
    e.count(9 + this.score.chordOf(0).length);
  }

  /** The look-ahead scheduler (every 50 ms while on; capture mode calls it itself). */
  schedule(): void { this.tick(); }

  private tick(): void {
    if (!this.on || this.gate < .02) return;
    const t0 = performance.now(), now = this.engine.now;
    this.amb.schedule(now);
    if (this.gate >= .3 && this.rewindUntil <= now) this.score.schedule(now);
    this.engine.stats.schedMs += performance.now() - t0;
  }
}
