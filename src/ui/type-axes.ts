/**
 * The title and clock axes (--wdth, --wght in styles/main.css), driven by confinement. They are
 * written on the chapter and clock elements, not on :root, so a change restyles those two and
 * nothing else; quantised (width in 1 % steps, weight in steps of 10), so a move between worlds
 * goes through a few dozen font instances rather than a new one every frame; and the title's only
 * while it can be seen (chapter opacity above 0). What is shown depends only on where the story is.
 */
export class TypeAxes {
  private wdth = '';
  private wght = '';
  private readonly title: Axes;
  private readonly clock: Axes;
  constructor(title: HTMLElement, clock: HTMLElement) { this.title = new Axes(title); this.clock = new Axes(clock); }
  /** This frame's axes; the clock takes them at once. */
  set(wdth: number, wght: number): void {
    this.wdth = String(Math.round(wdth)); this.wght = String(Math.round(wght / 10) * 10);
    this.clock.write(this.wdth, this.wght);
  }
  /** The title takes them while it is visible (called once its opacity is known). */
  showTitle(visible: boolean): void { if (visible) this.title.write(this.wdth, this.wght); }
}

class Axes {
  private wdth = '';
  private wght = '';
  private readonly el: HTMLElement;
  constructor(el: HTMLElement) { this.el = el; }
  write(wdth: string, wght: string): void {
    if (wdth !== this.wdth) { this.wdth = wdth; this.el.style.setProperty('--wdth', wdth); }
    if (wght !== this.wght) { this.wght = wght; this.el.style.setProperty('--wght', wght); }
  }
}
