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
  private readonly label: HTMLElement;
  private holdAt = -1;
  private holdSince = -1;
  private opacity = '';

  constructor(el: HTMLElement, label: HTMLElement) { this.el = el; this.label = label; }

  /** `hold`: the chapter resting on, or -1 while moving; `light`: the grain's light (1 until the final hold). */
  update(hero: Vector3, camera: Camera, heroVisible: boolean, v: number, hold: number, now: number, light = 1): void {
    proj.copy(hero).project(camera);
    const vis = proj.z < 1 && Math.abs(proj.x) < 1.1 && Math.abs(proj.y) < 1.1 && heroVisible;
    this.el.style.transform = `translate(${((proj.x + 1) / 2 * innerWidth).toFixed(1)}px, ${((1 - proj.y) / 2 * innerHeight).toFixed(1)}px)`;
    if (hold < 0) this.holdAt = this.holdSince = -1;
    else if (hold !== this.holdAt) { this.holdAt = hold; this.holdSince = now; }
    const held = hold < 0 ? 0 : holdTimeOverride() ?? (now - this.holdSince) / 1000;
    const ring = 1 - ss(2.2, 3.4, held) * .78;
    const opacity = vis ? (.95 * ring * light * light).toFixed(2) : '0';
    if (opacity !== this.opacity) { this.opacity = opacity; this.el.style.opacity = opacity; }
    this.label.style.opacity = v < .02 ? '1' : '0';
  }
}
