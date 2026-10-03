/**
 * The title and clock axes (--wdth, --wght in styles/main.css), driven by confinement. Written
 * when the rounded value changes, so what is shown depends only on where the story is.
 */
export class TypeAxes {
  private wdth = '';
  private wght = '';
  private readonly root: HTMLElement;
  constructor(root: HTMLElement = document.documentElement) { this.root = root; }
  set(wdth: number, wght: number): void {
    const wd = wdth.toFixed(1), wg = String(Math.round(wght));
    if (wd !== this.wdth) { this.wdth = wd; this.root.style.setProperty('--wdth', wd); }
    if (wg !== this.wght) { this.wght = wg; this.root.style.setProperty('--wght', wg); }
  }
}
