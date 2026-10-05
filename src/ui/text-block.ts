import { SAFE, type NdcBox } from '../camera/safe-area';

/** Around the text, so the grain (and its ring) keeps clear of the letters. */
const PAD_PX = 24;

/**
 * The chapter's text block and the top of the safe area (below the HUD's scrim), in the canvas's
 * normalised device coordinates, for the camera's safe area (camera/safe-area.ts). Measured when the
 * text or the window changes (a ResizeObserver, a resize), never inside a frame.
 */
export class TextBlock {
  box: NdcBox | null = null;
  top: number = SAFE.y;
  private readonly chapter: HTMLElement;
  private readonly canvas: HTMLElement;
  private readonly hudScrim: HTMLElement | null;

  constructor(chapter: HTMLElement, canvas: HTMLElement, hudScrim: HTMLElement | null) {
    this.chapter = chapter; this.canvas = canvas; this.hudScrim = hudScrim;
    const ro = new ResizeObserver(() => this.measure());
    ro.observe(chapter);
    for (const el of chapter.children) ro.observe(el);
    addEventListener('resize', () => this.measure());
    this.measure();
  }

  private measure(): void {
    const c = this.canvas.getBoundingClientRect();
    if (!c.width || !c.height) return;
    const nx = (px: number): number => (px - c.left) / c.width * 2 - 1, ny = (py: number): number => 1 - (py - c.top) / c.height * 2;
    let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity;
    for (const el of this.chapter.children) {
      const box = el.getBoundingClientRect();
      if (!box.width || !box.height) continue;
      l = Math.min(l, box.left); r = Math.max(r, box.right); t = Math.min(t, box.top); b = Math.max(b, box.bottom);
    }
    this.box = l < r ? { left: nx(l - PAD_PX), right: nx(r + PAD_PX), top: ny(t - PAD_PX), bottom: ny(b + PAD_PX) } : null;
    const hud = this.hudScrim?.getBoundingClientRect();
    this.top = hud && hud.height ? Math.min(SAFE.y, ny(hud.bottom)) : SAFE.y;
  }
}
