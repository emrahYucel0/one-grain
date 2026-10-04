import { MathUtils, Vector3, type PerspectiveCamera } from 'three';
import { MAX_ASPECT } from './confinement';
import type { Shot } from './shot';

const up = new Vector3(), target = new Vector3();

/**
 * Puts the camera on the shot, plus a little parallax from the (smoothed) pointer. `wideAnchor` is the
 * world's (eased) choice of which edge of the 2:1 frame stays on wider screens (story/types.ts).
 */
export function frameShot(camera: PerspectiveCamera, s: Shot, parallax: { x: number; y: number } | null, wideAnchor = .5): void {
  camera.position.copy(s.pos);
  if (parallax) { camera.position.x += parallax.x * 1.2; camera.position.y -= parallax.y * .6; }
  camera.lookAt(s.look);
  // past 2:1 the frame loses height (core/resize.ts). Measured in the visible half-height, the 2:1
  // frame's edges lie (aspect − 2)/2 beyond it: moving the look target down by that keeps the bottom
  // edge (anchor 0), up by it keeps the top edge (anchor 1), not at all crops evenly (.5)
  const over = camera.aspect - MAX_ASPECT;
  if (over > 0 && wideAnchor !== .5) {
    const drop = (1 - 2 * wideAnchor) * over / 2 * camera.position.distanceTo(s.look) * Math.tan(MathUtils.degToRad(camera.fov / 2));
    up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    camera.lookAt(target.copy(s.look).addScaledVector(up, -drop));
  }
  // lookAt refreshes the world matrix before it turns the camera: refresh it after, so everything that
  // projects through the camera this frame (the ring, window.__hero) sees the view that is rendered
  camera.updateMatrixWorld();
}
