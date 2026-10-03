import { ss } from '../core/ease';
import { TRANSITIONS } from '../story/transitions';
import type { TransitionDef } from '../story/types';
import { WORLDS } from '../story/worlds';

// The scroll track is a chain of uneven segments: hold(0) tr(0) hold(1) tr(1) … hold(14).
// Lengths are in screen heights; progress v ∈ [0, 1] maps onto the whole chain.

export interface Segment { type: 'hold' | 'tr'; i: number; start: number; len: number }

const CH = WORLDS.length;
export const SEGMENTS: readonly Segment[] = (() => {
  const segs: Segment[] = []; let total = 0;
  WORLDS.forEach((w, i) => {
    segs.push({ type: 'hold', i, start: total, len: w.hold }); total += w.hold;
    if (i < CH - 1) { segs.push({ type: 'tr', i, start: total, len: TRANSITIONS[i]!.len }); total += TRANSITIONS[i]!.len; }
  });
  return segs;
})();

const last = SEGMENTS[SEGMENTS.length - 1]!;
export const TOTAL = last.start + last.len;

/** Progress at the middle of each hold; the first and last are pinned to the ends. */
export const SNAP_POINTS: readonly number[] = WORLDS.map((_, i) => {
  if (i === 0) return 0;
  if (i === CH - 1) return 1;
  const h = SEGMENTS.find((s) => s.type === 'hold' && s.i === i)!;
  return (h.start + h.len / 2) / TOTAL;
});

/** Progress at the middle of transition i (used by the parity harness). */
export const transitionMidpoint = (i: number): number => {
  const s = SEGMENTS.find((x) => x.type === 'tr' && x.i === i)!;
  return (s.start + s.len / 2) / TOTAL;
};

export interface Located {
  /** blending world a → b by t */
  a: number;
  b: number;
  t: number;
  tr: TransitionDef;
  /** the world being rested in, or -1 mid-transition */
  hold: number;
  /**
   * How far the camera already leans into the next move: grows across a hold (0 → 1) and stays
   * at 1 in the transition, where the shot fades it out with the move. 0 on the last hold.
   */
  lean: number;
}

export function locate(v: number): Located {
  const s = Math.min(TOTAL - 1e-6, Math.max(0, v * TOTAL));
  const seg = SEGMENTS.find((x) => s >= x.start && s < x.start + x.len) ?? last;
  if (seg.type === 'tr') return { a: seg.i, b: seg.i + 1, t: (s - seg.start) / seg.len, tr: TRANSITIONS[seg.i]!, hold: -1, lean: 1 };
  if (seg.i === CH - 1) return { a: CH - 2, b: CH - 1, t: 1, tr: TRANSITIONS[CH - 2]!, hold: CH - 1, lean: 0 };
  return { a: seg.i, b: seg.i + 1, t: 0, tr: TRANSITIONS[seg.i]!, hold: seg.i, lean: ss(0, 1, (s - seg.start) / seg.len) };
}

/** The chapter whose snap point is nearest to progress v. */
export const nearestChapter = (v: number): number => {
  let best = 0;
  SNAP_POINTS.forEach((p, i) => { if (Math.abs(p - v) < Math.abs(SNAP_POINTS[best]! - v)) best = i; });
  return best;
};
