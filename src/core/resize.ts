import { MathUtils, Vector2 } from 'three';
import type { Stage } from './renderer';

const buffer = new Vector2();

/** Fits renderer and camera to the canvas. Returns pixels per world unit at distance 1. */
export function fit({ renderer, camera }: Stage): number {
  const canvas = renderer.domElement, w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = camera.aspect < .85 ? 55 : 40;
  camera.updateProjectionMatrix();
  renderer.getDrawingBufferSize(buffer);
  return buffer.y / (2 * Math.tan(MathUtils.degToRad(camera.fov / 2)));
}

/** Calls `fn` once things settle after a window resize (150 ms, as the reference). */
export function onResize(fn: () => void): void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(fn, 150); });
}
