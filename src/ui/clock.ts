import type { ClockUnit } from '../story/types';
import { WORLDS } from '../story/worlds';
import { attr, fill } from './copy';

/**
 * The clock is the idea: deep time, production days, a clock tick, a frame, now.
 * Each unit has its own typography (CSS .u-<unit>); changing unit replays a "punch".
 */
export class ClockView {
  private unit: ClockUnit = 'years';
  private readonly el: HTMLElement;
  private readonly value: HTMLElement;
  private readonly label: HTMLElement;

  constructor(el: HTMLElement, value: HTMLElement, label: HTMLElement) {
    this.el = el; this.value = value; this.label = label;
  }

  /** Clock between worlds a and b at eased progress eg. Years interpolate on a log scale. */
  update(a: number, b: number, eg: number): void {
    const [va, ua] = WORLDS[a]!.clock, [vb, ub] = WORLDS[b]!.clock;
    let v: number, u: ClockUnit;
    if (ua === ub) { u = ua; v = ua === 'years' ? Math.pow(10, Math.log10(va + 1) + (Math.log10(vb + 1) - Math.log10(va + 1)) * eg) - 1 : va + (vb - va) * eg; }
    else [v, u] = eg < .5 ? [va, ua] : [vb, ub];
    if (u !== this.unit) {
      this.el.className = `time u-${u}`;
      void this.el.offsetWidth; // restart the punch animation
      this.el.classList.add('punch');
      this.unit = u;
    }
    const el = this.el;
    const [value, label] =
      u === 'years' ? [(v < 1 ? '' : attr(el, 'yearsApprox')) + this.years(v), attr(el, 'years')]
      : u === 'days' ? [fill(attr(el, 'days'), { n: Math.max(1, Math.round(v)) }), attr(el, 'daysUnit')]
      : u === 'ns' ? [fill(attr(el, 'ns'), { n: v.toFixed(2) }), attr(el, 'nsUnit')]
      : u === 'ms' ? [fill(attr(el, 'ms'), { n: v.toFixed(1) }), attr(el, 'msUnit')]
      : [attr(el, 'now'), ''];
    if (this.value.textContent !== value) this.value.textContent = value;
    if (this.label.textContent !== label) this.label.textContent = label;
  }

  private years(y: number): string {
    if (y < 1) return '0';
    if (y >= 1e6) { const m = y / 1e6; return `${m < 100 ? m.toFixed(1) : Math.round(m)} ${attr(this.el, 'million')}`; }
    const k = Math.pow(10, Math.max(0, Math.floor(Math.log10(y)) - 1));
    return (Math.round(y / k) * k).toLocaleString('en-US');
  }
}
