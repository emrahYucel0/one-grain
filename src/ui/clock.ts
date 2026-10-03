import type { ClockUnit, TransitionDef } from '../story/types';
import { WORLDS } from '../story/worlds';
import { env } from '../core/env';
import { liveOverride } from '../debug/parity';
import { attr, type Copy } from './copy';

/**
 * The clock has one meaning: time elapsed on the grain's journey. Deep time in years
 * (log-interpolated, or a chapter's own label near its hold), production time as labels, on the
 * display a live count of milliseconds since the clock got there ("on your screen"), and "Now"
 * at the very end. Each unit has its own typography (CSS .u-<unit>); a change of unit replays a
 * "punch". The interlude card has no clock.
 */
/** The clock's progress through a move: on "become" (style 21) "Now" arrives at 74 % of the move (v15). */
const PUNCH_EASE = 'cubic-bezier(.2,.8,.2,1)';
const PUNCH: Keyframe[] = [{ transform: 'scale(1.35)', opacity: .2, offset: 0, easing: PUNCH_EASE }, { opacity: 1, offset: .6, easing: PUNCH_EASE }, { transform: 'scale(1)', opacity: 1, offset: 1 }];
const PUNCH_TIMING: KeyframeAnimationOptions = { duration: 700 };

export const clockProgress = (tr: TransitionDef, t: number, eg: number): number => (tr.g === 21 ? (t < .74 ? 0 : 1) : eg);

export class ClockView {
  private unit: ClockUnit = 'years';
  /** when the clock switched to the live count (-1: not live) */
  private liveSince = -1;
  private readonly el: HTMLElement;
  private readonly value: HTMLElement;
  private readonly label: HTMLElement;
  private readonly copy: Copy;

  constructor(el: HTMLElement, value: HTMLElement, label: HTMLElement, copy: Copy) {
    this.el = el; this.value = value; this.label = label; this.copy = copy;
  }

  /** Clock between worlds a and b: eg is the camera's eased progress, t the transition progress (0/1 = resting). */
  update(a: number, b: number, eg: number, t: number, tr: TransitionDef, now: number = performance.now()): void {
    const el = this.el;
    const hidden = tr.cam === 'cut' && t > .1 && t < .9;
    el.classList.toggle('hide', hidden);
    const A = WORLDS[a]!.clock, B = WORLDS[b]!.clock;
    const near = eg < .5 ? a : b, C = eg < .5 ? A : B;
    if (C.unit !== 'live') this.liveSince = -1;
    if (C.unit !== this.unit) {
      el.classList.replace(`u-${this.unit}`, `u-${C.unit}`);
      // the punch, replayed by the Web Animations API: restarting a CSS animation needs a forced layout
      if (!env.reduced) this.value.animate(PUNCH, PUNCH_TIMING);
      this.unit = C.unit;
    }
    const chapter = this.copy.chapters[near]!;
    let value: string, label: string;
    if (C.unit === 'years') {
      let v = C.value;
      if (A.unit === 'years' && B.unit === 'years') v = Math.pow(10, Math.log10(A.value + 1) + (Math.log10(B.value + 1) - Math.log10(A.value + 1)) * eg) - 1;
      // a chapter's own label holds near its end of the move (hysteresis: granite does not flicker
      // between "≈ hundreds of thousands" and "≈ 300,000" as soon as the scroll starts)
      const own = eg < .15 || eg > .85 ? chapter.clockLabel : '';
      el.classList.toggle('is-label', !!own);
      value = own ? attr(el, 'approx') + own : v < 1 ? '0' : attr(el, 'approx') + this.years(v);
      label = attr(el, 'years');
    } else if (C.unit === 'live') {
      el.classList.remove('is-label');
      if (this.liveSince < 0) this.liveSince = now;
      value = Math.round(liveOverride() ?? now - this.liveSince).toLocaleString('en-US') + attr(el, 'ms');
      label = attr(el, 'liveUnit');
    } else {
      el.classList.remove('is-label');
      [value, label] = C.unit === 'prod' ? [chapter.clockLabel, chapter.clockSub] : [attr(el, 'now'), ''];
    }
    if (this.value.textContent !== value) this.value.textContent = value;
    if (this.label.textContent !== label) this.label.textContent = label;
  }

  private years(y: number): string {
    if (y >= 1e6) return `${Math.round(y / 1e6)} ${attr(this.el, 'million')}`; // whole millions only
    const k = Math.pow(10, Math.floor(Math.log10(y))); // one significant figure, no false precision (v10)
    return (Math.round(y / k) * k).toLocaleString('en-US');
  }
}
