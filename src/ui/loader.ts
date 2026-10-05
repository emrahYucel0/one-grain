import { guard } from './guard';

/**
 * The loading moment (index.html .loader, styles/main.css): a thin line filled by the worker's
 * progress, then html.ready once the first frame is on screen, which fades the loader away.
 */
export class Loader {
  private readonly fill: HTMLElement;
  private readonly instant: boolean;
  private shown = -1;

  /** `instant`: no fade (the harnesses' ?parity captures must not catch the loader on its way out) */
  constructor(fill: HTMLElement, instant = false) { this.fill = fill; this.instant = instant; }

  /** 0..1; only ever moves forward. */
  progress(p: number): void {
    const v = Math.round(Math.min(1, Math.max(this.shown, p)) * 100) / 100;
    if (v === this.shown) return;
    this.shown = v;
    this.fill.style.setProperty('--load', String(v));
    guard.alive();
  }

  /** After the first rendered frame: the next refresh has it on screen, then the loader goes. */
  done(): void {
    this.progress(1);
    guard.ready();
    const root = document.documentElement;
    if (this.instant) { this.fill.closest<HTMLElement>('.loader')!.style.transition = 'none'; root.classList.add('ready'); return; }
    requestAnimationFrame(() => root.classList.add('ready'));
  }
}
