import { MathUtils, Vector3, type PerspectiveCamera } from 'three';

/** A box in normalised device coordinates (x and y in −1..1, y up). */
export interface NdcBox { left: number; right: number; bottom: number; top: number }

/**
 * Where the hero grain may sit on screen. The shots are composed for 16:9 and put the grain right of
 * centre; on a narrow portrait screen that side falls outside the frame.
 */
export interface SafeArea {
  /** |x| at most this */
  x: number;
  /** y between these (top: also below the HUD's scrim) */
  bottom: number;
  top: number;
  /** the chapter's text block, which the grain must not sit under (null: none on screen) */
  text: NdcBox | null;
  /** how much the text block counts, 0..1: its opacity, so the correction eases as the text fades */
  textWeight: number;
}

/** The shots' own bounds; the text block and the HUD scrim come from the page (ui/text-block.ts). */
export const SAFE = { x: .6, y: .65 } as const;

/** The grain is brought this far inside each edge (NDC), not onto it. */
const EDGE = .02;
const p = new Vector3();

/**
 * Turns the camera just enough to bring the hero grain into the safe area: first sideways (a yaw,
 * which pans the look target along the camera's right vector), up or down only where that is not
 * enough. Computed every frame from the camera as placed, so it eases through transitions by itself;
 * where the grain already sits inside, the camera is untouched (16:9 and wider are unchanged).
 */
export function keepInSafeArea(camera: PerspectiveCamera, hero: Vector3, area: SafeArea): void {
  const tanV = Math.tan(MathUtils.degToRad(camera.fov / 2)), tanH = tanV * camera.aspect;
  const ndc = (): Vector3 => p.copy(hero).project(camera);
  // the camera turns so the grain's NDC goes from `from` to `to` along one axis (angles, not NDC, add up)
  const yaw = (from: number, to: number, k = 1): void => { camera.rotateY(-k * (Math.atan(from * tanH) - Math.atan(to * tanH))); camera.updateMatrixWorld(); };
  const pitch = (from: number, to: number, k = 1): void => { camera.rotateX(k * (Math.atan(from * tanV) - Math.atan(to * tanV))); camera.updateMatrixWorld(); };
  if (ndc().z >= 1) return; // behind the camera: nothing to frame

  // 1. the screen's bounds (the correction starts where the target is: continuous)
  const X = area.x - EDGE, top = area.top - EDGE, bottom = area.bottom + EDGE;
  if (Math.abs(p.x) > X) yaw(p.x, Math.sign(p.x) * X);
  ndc();
  if (p.y > top) pitch(p.y, top); else if (p.y < bottom) pitch(p.y, bottom);

  // 2. out from under the text block: sideways past its far edge where that stays on screen, else up
  // above it; weighted by the text's opacity
  const t = area.text, k = area.textWeight;
  if (!t || k <= 0) return;
  ndc();
  if (p.x < t.left || p.x > t.right || p.y < t.bottom || p.y > t.top) return;
  if (t.right <= X) yaw(p.x, t.right, k);
  else if (t.top <= top) pitch(p.y, t.top, k);
}
