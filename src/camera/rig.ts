import type { PerspectiveCamera } from 'three';
import type { Shot } from './shot';

/** Puts the camera on the shot, plus a little parallax from the (smoothed) pointer. */
export function frameShot(camera: PerspectiveCamera, s: Shot, parallax: { x: number; y: number } | null): void {
  camera.position.copy(s.pos);
  if (parallax) { camera.position.x += parallax.x * 1.2; camera.position.y -= parallax.y * .6; }
  camera.lookAt(s.look);
}
