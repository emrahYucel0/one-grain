import { MathUtils, Vector2 } from 'three';
import { PORTRAIT_EXTRA_DEG } from '../camera/confinement';
import type { Stage } from './renderer';

const buffer = new Vector2();

/**
 * The camera's projection: canvas size, portrait or landscape, and the lens, which confinement
 * changes from frame to frame. Every change of lens also updates uScale (point sizes follow the
 * field of view), through onScale.
 */
export class Projection {
  private lens = 40;
  private portrait = false;
  private readonly stage: Stage;
  private readonly onScale: (pxPerUnit: number) => void;

  constructor(stage: Stage, onScale: (pxPerUnit: number) => void) { this.stage = stage; this.onScale = onScale; }

  /** Fit renderer and camera to the canvas (after a resize or a pixel-ratio change). */
  fit(): void {
    const { renderer, camera } = this.stage;
    const canvas = renderer.domElement, w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    this.portrait = camera.aspect < .85;
    this.apply(this.lens);
  }

  /** Set the lens (vertical field of view, degrees, landscape); no-op when unchanged. */
  setLens(fov: number): void { if (fov !== this.lens) this.apply(fov); }

  private apply(fov: number): void {
    const { renderer, camera } = this.stage;
    this.lens = fov;
    camera.fov = fov + (this.portrait ? PORTRAIT_EXTRA_DEG : 0);
    camera.updateProjectionMatrix();
    renderer.getDrawingBufferSize(buffer);
    this.onScale(buffer.y / (2 * Math.tan(MathUtils.degToRad(camera.fov / 2))));
  }
}

/** Calls `fn` once things settle after a window resize (150 ms, as the reference). */
export function onResize(fn: () => void): void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(fn, 150); });
}
