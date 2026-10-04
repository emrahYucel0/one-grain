import { MathUtils, Vector3, type PerspectiveCamera } from 'three';
import { MAX_ASPECT } from './confinement';
import type { Shot } from './shot';

const up = new Vector3(), target = new Vector3();

/** Puts the camera on the shot, plus a little parallax from the (smoothed) pointer. */
export function frameShot(camera: PerspectiveCamera, s: Shot, parallax: { x: number; y: number } | null): void {
  camera.position.copy(s.pos);
  if (parallax) { camera.position.x += parallax.x * 1.2; camera.position.y -= parallax.y * .6; }
  camera.lookAt(s.look);
  // past 2:1 the frame is cropped top and bottom (core/resize.ts); the look target goes down in
  // proportion to (aspect − 2) so the crop comes from the top: (aspect − 2)/2 of the visible
  // half-height keeps the 2:1 frame's bottom edge (nearly) where it was
  const over = camera.aspect - MAX_ASPECT;
  if (over > 0) {
    const drop = over / 2 * camera.position.distanceTo(s.look) * Math.tan(MathUtils.degToRad(camera.fov / 2));
    up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    camera.lookAt(target.copy(s.look).addScaledVector(up, -drop));
  }
  // lookAt refreshes the world matrix before it turns the camera: refresh it after, so everything that
  // projects through the camera this frame (the ring, window.__hero) sees the view that is rendered
  camera.updateMatrixWorld();
}
