import type { Copy } from './copy';

/** How long the figure takes to count up to its value (s). */
const COUNT_S = .75;
/** Room kept clear on the right for the chapter rail (px), and the figure's largest size (px). */
const RAIL = 170;
const MAX_PX = 270;
/** the size the figure is measured at */
const PROBE = 100;

const easeOutExpo = (t: number): number => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/**
 * Act II as a montage (Awwwards P7): on each industry chapter we rest on, its one figure fills the screen
 * (index.html data-figure: "2,000 °C", "99.9999999 %"). It cuts in the moment the story rests there and counts
 * up to its value; it cuts out the moment the story moves on. No fades: the act is told in hard cuts.
 */
export class FigureView {
  private readonly el: HTMLElement;
  private readonly value: HTMLElement;
  private readonly unit: HTMLElement;
  private readonly label: HTMLElement;
  private readonly copy: Copy;
  private at = -1;
  private since = 0;
  private on = false;
  private shown = '';
  private target = { int: 0, dec: 0, digits: 0, grouped: false };

  constructor(el: HTMLElement, copy: Copy) {
    this.el = el; this.copy = copy;
    this.value = el.querySelector('.figure-v')!;
    this.unit = el.querySelector('.figure-u')!;
    this.label = el.querySelector('.figure-l')!;
  }

  /** Every frame: `hold` the chapter rested on (-1 moving), `hidden` while something else owns the screen. */
  update(hold: number, now: number, reduced: boolean, hidden: boolean): void {
    const f = hold >= 0 && !hidden ? this.copy.chapters[hold]!.figure : null;
    if (!f) {
      if (this.on) { this.on = false; this.el.classList.remove('on'); }
      this.at = -1;
      return;
    }
    if (hold !== this.at) {
      this.at = hold; this.since = now;
      const [int = '', dec = ''] = f.value.split('.');
      this.target = { int: +int.replace(/,/g, ''), dec: dec ? +`0.${dec}` : 0, digits: dec.length, grouped: int.includes(',') };
      this.unit.textContent = f.unit; this.label.textContent = f.label;
      // as large as fits between the left margin and the rail: measured once, at its full value, at a probe size
      this.value.textContent = f.value; this.shown = '';
      const line = this.value.parentElement!;
      this.el.style.setProperty('--figure-size', `${PROBE}px`);
      const room = innerWidth - this.el.offsetLeft - RAIL, w = line.scrollWidth;
      this.el.style.setProperty('--figure-size', `${Math.min(MAX_PX, PROBE * room / Math.max(1, w)).toFixed(0)}px`);
    }
    if (!this.on) { this.on = true; this.el.classList.add('on'); }
    const k = reduced ? 1 : easeOutExpo(Math.min(1, (now - this.since) / 1000 / COUNT_S));
    const t = this.target, n = (t.int + t.dec) * k;
    let s = t.digits ? n.toFixed(t.digits) : String(Math.round(n));
    if (t.grouped) { const [i, d] = s.split('.'); s = i!.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (d ? `.${d}` : ''); }
    if (s !== this.shown) { this.shown = s; this.value.textContent = s; }
  }
}
