import { Vector3, type Camera } from 'three';

const proj = new Vector3();

/** The ring that points at the grain on screen, and its "this grain" label at the very start. */
export class HeroMarker {
  private readonly el: HTMLElement;
  private readonly label: HTMLElement;

  constructor(el: HTMLElement, label: HTMLElement) { this.el = el; this.label = label; }

  update(hero: Vector3, camera: Camera, heroVisible: boolean, v: number): void {
    proj.copy(hero).project(camera);
    const vis = proj.z < 1 && Math.abs(proj.x) < 1.1 && Math.abs(proj.y) < 1.1 && heroVisible;
    this.el.style.transform = `translate(${((proj.x + 1) / 2 * innerWidth).toFixed(1)}px, ${((1 - proj.y) / 2 * innerHeight).toFixed(1)}px)`;
    this.el.style.opacity = vis ? '.95' : '0';
    this.label.style.opacity = v < .02 ? '1' : '0';
  }
}
