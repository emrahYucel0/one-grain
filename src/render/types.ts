import type { Color, Vector3 } from 'three';
import type { Vec3 } from '../story/types';

/** Everything the grain layer needs to draw one frame. Filled by core/loop.ts. */
export interface FrameUniforms {
  /** world indices being blended, and progress between them (0 = from, 1 = to) */
  from: number;
  to: number;
  t: number;
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
  /** stage colour (CSS), grains fade into it with distance */
  fog: Color;
  /** 0 none · 1 brush the dunes · 2 light the switches */
  interact: number;
  mouse: Vector3;
  press: number;
}
