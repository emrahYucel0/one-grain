import type { Camera, Color, Matrix4, Vector3 } from 'three';
import type { RigState } from '../core/light-rig';
import type { Vec3 } from '../story/types';

/** Everything the grain layer needs to draw one frame. Filled by core/loop.ts. */
export interface FrameUniforms {
  /** world indices being blended, and progress between them (0 = from, 1 = to) */
  from: number;
  to: number;
  t: number;
  /** 0 moving · 1 resting in world A (t = 0) · 2 resting in world B (t = 1): the shader's cheap path */
  rest: number;
  /** shader clock, seconds */
  time: number;
  /** 0 freezes resting behaviours and transition arcs (reduced motion) */
  motion: number;
  /** transition style parameters (story/transitions.ts) */
  style: number;
  k: number;
  span: number;
  spread: number;
  dir: Vec3;
  heroA: Vector3;
  heroB: Vector3;
  loA: string;
  hiA: string;
  loB: string;
  hiB: string;
  grain: number;
  /** resting restlessness (confinement) */
  jitter: number;
  /** stage colour, grains fade into it with distance (linear, for the lit shader) */
  fog: Color;
  fogLinear: Vector3;
  /** the light rig this frame */
  rig: RigState;
  /** the camera the frame is drawn with (sphere impostors face it) */
  camera: Camera;
  /** layer switches */
  light: boolean;
  shadows: boolean;
  /** the key light's view-projection and shadow map pixels per world unit (render/shadow.ts) */
  lightVP: Matrix4;
  shadowPx: number;
  /** index of the last world: grains arriving there stay neutral until the reveal */
  last: number;
  /** the final reveal, 0..1 */
  reveal: number;
  /** 0 none · 1 brush the dunes · 2 light the switches */
  interact: number;
  mouse: Vector3;
  press: number;
}
