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
 * Silence: the "One day," cut (the gate closes over t .02–.2 and reopens over .84–1) and the end (it
 * follows the grain's light, 3–6.2 s into the final hold). A closed gate ramps the master to exactly
 * 0; scrolling back reopens it.
 */
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
    e.glide(this.score.padG.gain, hold >= 0 ? .55 + .45 * (1 - ss(1, 7, holdSec)) : 1, .8);
    this.score.pulse = hold >= 0 && PULSE.has(slug(hold));

    // silence: the cut and the end
    let gate = 1;
    if (tr.cam === 'cut') gate = t < .5 ? 1 - ss(.02, .2, t) : ss(.84, 1, t);
    if (hold === LAST) gate = 1 - ss(3, 6.2, holdSec); // it withdraws with the grain's light; silence when it lands
    this.gate = gate;
    const g = e.master.gain, at = e.now;
    if (gate < .02) {
      if (!this.zeroed) { g.cancelScheduledValues(at); g.setValueAtTime(g.value, at); g.linearRampToValueAtTime(0, at + .5); this.zeroed = true; }
    } else {
      if (this.zeroed) { g.cancelScheduledValues(at); g.setValueAtTime(0, at); this.zeroed = false; }
      e.glide(g, LEVELS.master * gate, gate < this.lastGate ? .3 : .6);
    }
    this.lastGate = gate;

    // the motif, once per chapter arrival (never during silence)
    if (hold >= 0 && hold !== this.lastHold) { this.lastHold = hold; if (gate > .5) this.score.motif(hold, actOf(hold)); }
    if (hold < 0) this.lastHold = -1;
    e.stats.frameMs += performance.now() - t0;
  }

  /** The look-ahead scheduler (every 50 ms while on). */
  private tick(): void {
    if (!this.on || this.gate < .02) return;
    const t0 = performance.now(), now = this.engine.now;
    this.amb.schedule(now);
    if (this.gate >= .3) this.score.schedule(now);
    this.engine.stats.schedMs += performance.now() - t0;
  }
}
