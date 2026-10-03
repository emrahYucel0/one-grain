import type { ClockUnit, TransitionDef } from '../story/types';
import { WORLDS } from '../story/worlds';
import { attr, type Copy } from './copy';

/**
 * The clock has one meaning: time elapsed on the grain's journey. Deep time in years
 * (log-interpolated, or a chapter's own label while resting there), production time as
 * labels, and "Now" at the very end. Each unit has its own typography (CSS .u-<unit>);
 * a change of unit replays a "punch". The interlude card has no clock.
 */
export class ClockView {
  private unit: ClockUnit = 'years';
  private readonly el: HTMLElement;
  private readonly value: HTMLElement;
  private readonly label: HTMLElement;
  private readonly copy: Copy;

  constructor(el: HTMLElement, value: HTMLElement, label: HTMLElement, copy: Copy) {
    this.el = el; this.value = value; this.label = label; this.copy = copy;
  }

  /** Clock between worlds a and b: eg is the camera's eased progress, t the transition progress (0/1 = resting). */
  update(a: number, b: number, eg: number, t: number, tr: TransitionDef): void {
    const el = this.el;
    el.classList.toggle('hide', tr.cam === 'cut' && t > .2 && t < .8);
    const A = WORLDS[a]!.clock, B = WORLDS[b]!.clock;
    const near = eg < .5 ? a : b, C = eg < .5 ? A : B, resting = t === 0 || t === 1;
    if (C.unit !== this.unit) {
      el.className = `time u-${C.unit}`;
      void el.offsetWidth; // restart the punch animation
      el.classList.add('punch');
      this.unit = C.unit;
    }
    const chapter = this.copy.chapters[near]!;
    let value: string, label: string;
    if (C.unit === 'years') {
      let v = C.value;
      if (A.unit === 'years' && B.unit === 'years') v = Math.pow(10, Math.log10(A.value + 1) + (Math.log10(B.value + 1) - Math.log10(A.value + 1)) * eg) - 1;
      const own = resting ? chapter.clockLabel : '';
      el.classList.toggle('is-label', !!own);
      value = own ? attr(el, 'approx') + own : v < 1 ? '0' : attr(el, 'approx') + this.years(v);
      label = attr(el, 'years');
    } else {
      el.classList.remove('is-label');
      [value, label] = C.unit === 'prod' ? [chapter.clockLabel, chapter.clockSub] : [attr(el, 'now'), ''];
    }
    if (this.value.textContent !== value) this.value.textContent = value;
    if (this.label.textContent !== label) this.label.textContent = label;
  }

  private years(y: number): string {
    if (y >= 1e6) return `${Math.round(y / 1e6)} ${attr(this.el, 'million')}`; // whole millions only
    const k = Math.pow(10, Math.max(0, Math.floor(Math.log10(y)) - 1)); // two significant figures (v8)
    return (Math.round(y / k) * k).toLocaleString('en-US');
  }
}
