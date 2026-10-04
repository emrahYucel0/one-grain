import { Vector3, type Camera } from 'three';
import { ss } from '../core/ease';
import { holdTimeOverride } from '../debug/parity';

const proj = new Vector3();

/**
 * The ring that points at the grain on screen, and its "this grain" label at the very start. The
 * ring is clear during moves and for the first seconds of a chapter, then steps back to about a
 * fifth (v15); it fades with the grain's own light at the end.
 */
export class HeroMarker {
  private readonly el: HTMLElement;
  private readonly labelEl: HTMLElement;
  private holdAt = -1;
  private holdSince = -1;
  private opacity = '';
  private transform = '';
  private label = '';
  /** the canvas's box on screen, cached on resize (reading layout after the frame's style writes would
   * force it; and on mobile the canvas, sized to the largest viewport, is not the visible viewport) */
  private box = { left: 0, top: 0, width: innerWidth, height: innerHeight };

  constructor(el: HTMLElement, label: HTMLElement, canvas: HTMLElement) {
    this.el = el; this.labelEl = label;
    const measure = (): void => { const r = canvas.getBoundingClientRect(); this.box = { left: r.left, top: r.top, width: r.width, height: r.height }; };
    measure();
    addEventListener('resize', measure);
  }

  /** `hold`: the chapter resting on, or -1 while moving; `light`: the grain's light (1 until the final hold). */
  update(hero: Vector3, camera: Camera, heroVisible: boolean, v: number, hold: number, now: number, light = 1): void {
    proj.copy(hero).project(camera);
    const vis = proj.z < 1 && Math.abs(proj.x) < 1.1 && Math.abs(proj.y) < 1.1 && heroVisible;
    const b = this.box;
    const transform = `translate(${(b.left + (proj.x + 1) / 2 * b.width).toFixed(1)}px, ${(b.top + (1 - proj.y) / 2 * b.height).toFixed(1)}px)`;
    if (transform !== this.transform) { this.transform = transform; this.el.style.transform = transform; }
    if (hold < 0) this.holdAt = this.holdSince = -1;
    else if (hold !== this.holdAt) { this.holdAt = hold; this.holdSince = now; }
    const held = hold < 0 ? 0 : holdTimeOverride() ?? (now - this.holdSince) / 1000;
    const ring = 1 - ss(2.2, 3.4, held) * .78;
    const opacity = vis ? (.95 * ring * light * light).toFixed(2) : '0';
    if (opacity !== this.opacity) { this.opacity = opacity; this.el.style.opacity = opacity; }
    const label = v < .02 ? '1' : '0';
    if (label !== this.label) { this.label = label; this.labelEl.style.opacity = label; }
  }
}
