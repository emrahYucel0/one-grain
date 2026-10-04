import { ACTS, CHORDS } from '../story/sound';
import { WORLDS } from '../story/worlds';
import type { Engine } from './engine';
import { rand } from './random';

const midi = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
const chordOf = (i: number): readonly number[] => CHORDS[WORLDS[i]!.slug]!;

/** The chord's tones in [lo, hi] across octaves, ascending. */
const chordTones = (chord: readonly number[], lo: number, hi: number): number[] => {
  const out: number[] = [];
  for (const m of chord) for (let o = -24; o <= 36; o += 12) { const x = m + o; if (x >= lo && x <= hi && !out.includes(x)) out.push(x); }
  return out.sort((a, b) => a - b);
};

interface Bank { ch: number; g: GainNode; voices: { o1: OscillatorNode; o2: OscillatorNode }[] }

/**
 * The music (v23): soft breathing chords and a few sparse notes in a long room.
 *   pads   two banks of five voices (a soft triangle and a quieter detuned saw), one bank on the
 *          chapter behind, one on the chapter ahead, crossfaded with the camera's easing
 *   notes  sparse FM "electric piano / celesta" notes from the current chord, timbre and register
 *          per act
 *   motif  three falling notes from the chord when a chapter is reached
 *   pulse  a soft repeated note in the production chapters, like a distant clock
 */
export class Score {
  /** the act and chord the notes come from (set per frame) */
  act = 0;
  chord: readonly number[] = chordOf(0);
  /** the production pulse plays (set per frame) */
  pulse = false;
  readonly padLP: BiquadFilterNode;
  readonly padG: GainNode;
  private readonly banks: Bank[] = [];
  private nextNote = 0;
  private nextPulse = 0;
  private readonly e: Engine;

  constructor(e: Engine) {
    this.e = e;
    const ctx = e.ctx;
    this.padLP = ctx.createBiquadFilter(); this.padLP.type = 'lowpass'; this.padLP.frequency.value = 650; this.padLP.Q.value = .3;
    this.padG = e.gain(0); this.padLP.connect(this.padG).connect(e.music);
    const lfo = ctx.createOscillator(); lfo.frequency.value = .05; const lfoG = e.gain(90); lfo.connect(lfoG).connect(this.padLP.frequency); lfo.start();
    for (let k = 0; k < 2; k++) {
      const bank: Bank = { ch: -1, g: e.gain(0), voices: [] };
      bank.g.connect(this.padLP);
      for (let v = 0; v < 5; v++) {
        const o1 = ctx.createOscillator(); o1.type = 'triangle';
        const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.detune.value = v % 2 ? 5 : -5;
        o1.connect(e.gain(.5)).connect(bank.g); o2.connect(e.gain(.09)).connect(bank.g); o1.start(); o2.start();
        bank.voices.push({ o1, o2 });
      }
      this.banks.push(bank);
    }
  }

  /** Keep one bank on chapter a and the other on b; crossfade by eg. */
  pads(a: number, b: number, eg: number): void {
    const now = this.e.now;
    let ba = this.banks.find((k) => k.ch === a), bb = this.banks.find((k) => k.ch === b);
    if (!ba && !bb) { ba = this.banks[0]!; bb = this.banks[1]!; this.setBank(ba, a, now); this.setBank(bb, b, now); }
    else if (!ba) { ba = this.banks.find((k) => k !== bb)!; this.setBank(ba, a, now); }
    else if (!bb) { bb = this.banks.find((k) => k !== ba)!; this.setBank(bb, b, now); }
    this.e.glide(ba.g.gain, (1 - eg) * .055, .25); this.e.glide(bb!.g.gain, eg * .055, .25);
  }

  /** Called by the scheduler: a note when one is due, and the pulse. */
  schedule(now: number): void {
    const S = ACTS[this.act]!;
    if (this.nextNote < now) {
      const tones = chordTones(this.chord, S.reg[0], S.reg[1]), pick = tones[Math.floor(Math.pow(rand(), .7) * tones.length)]!;
      this.note(pick, .25 + rand() * .3, this.act);
      if (rand() < .18) { const lower = tones.filter((x) => x < pick - 2); if (lower.length) this.note(lower[lower.length - 1]!, .18 + rand() * .15, this.act, now + .06); }
      this.nextNote = now + S.gap[0] + rand() * (S.gap[1] - S.gap[0]);
    }
    if (this.act === 1 && this.pulse && this.nextPulse < now) {
      const tones = chordTones(this.chord, 69, 79);
      this.note(tones[tones.length - 1]!, .1, 1);
      this.nextPulse = now + .95 + rand() * .12;
    }
  }

  /** The grain's motif: three falling notes from chapter i's chord; the next note waits for it. */
  motif(i: number, act: number): void {
    const S = ACTS[act]!, tones = chordTones(chordOf(i), S.reg[0] + 5, S.reg[1]), top = tones.length - 1, now = this.e.now + .05;
    [top, top - 1, top - 3].forEach((k, j) => { if (tones[k] !== undefined) this.note(tones[Math.max(0, k)]!, .32 - j * .04, act, now + j * .42); });
    this.nextNote = this.e.now + 3.2;
  }

  chordOf(i: number): readonly number[] { return chordOf(i); }

  private setBank(bank: Bank, ch: number, now: number): void {
    bank.ch = ch;
    chordOf(ch).forEach((m, v) => { const f = midi(m); bank.voices[v]!.o1.frequency.setValueAtTime(f, now); bank.voices[v]!.o2.frequency.setValueAtTime(f, now); });
  }

  /** A soft electric-piano / celesta note: FM with a quickly mellowing brightness and a long, gentle decay. */
  private note(m: number, vel: number, act: number, when?: number): void {
    const e = this.e, ctx = e.ctx, t = when ?? ctx.currentTime + .02, f = midi(m), S = ACTS[act]!;
    const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), env = ctx.createGain(), lp = ctx.createBiquadFilter();
    car.frequency.value = f; mod.frequency.value = f * S.ratio;
    mg.gain.setValueAtTime(f * S.index * vel, t); mg.gain.exponentialRampToValueAtTime(f * .05, t + 1.2);
    const len = 3.5 + (84 - m) * .05;
    env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(vel * .1, t + .008); env.gain.exponentialRampToValueAtTime(vel * .035, t + .5); env.gain.exponentialRampToValueAtTime(.0001, t + len);
    lp.type = 'lowpass'; lp.frequency.value = S.lp;
    mod.connect(mg).connect(car.frequency); car.connect(env).connect(lp);
    e.pan(lp, (rand() - .5) * .6).connect(e.music);
    car.start(t); mod.start(t); car.stop(t + len + .1); mod.stop(t + len + .1);
    e.count(5);
  }
}
