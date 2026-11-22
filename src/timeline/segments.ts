import { ss } from '../core/ease';
import { TRANSITIONS } from '../story/transitions';
import type { TransitionDef } from '../story/types';
import { WORLDS } from '../story/worlds';
import { SCROLL } from './config';

// The scroll track is a chain of uneven segments: hold(0) tr(0) hold(1) tr(1) … hold(14).
// Lengths are in screen heights; progress v ∈ [0, 1] maps onto the whole chain.

export interface Segment { type: 'hold' | 'tr'; i: number; start: number; len: number }

const CH = WORLDS.length;
const CRITICAL = new Set(SCROLL.critical.from.map((slug) => WORLDS.findIndex((w) => w.slug === slug)));
/** Act II's worlds, told as a montage (timeline/config.ts staccato); not the critical ones' moves. */
export const STACCATO: ReadonlySet<number> = new Set(SCROLL.staccato.worlds.map((slug) => WORLDS.findIndex((w) => w.slug === slug)).filter((i) => !CRITICAL.has(i)));
const holdShareOf = (i: number): number => WORLDS[i]!.holdShare ?? (STACCATO.has(i) ? SCROLL.staccato.holdShare : SCROLL.holdShare);
/**
 * Each chapter keeps its authored scroll length (its world's hold and the transition out of it), shared
 * out in favour of the transition (timeline/config.ts holdShare). The last world is a hold only.
 */
export const SEGMENTS: readonly Segment[] = (() => {
  const segs: Segment[] = []; let total = 0;
  WORLDS.forEach((w, i) => {
    if (i === CH - 1) { segs.push({ type: 'hold', i, start: total, len: w.hold }); return; }
    const len = w.hold + TRANSITIONS[i]!.len, hold = len * holdShareOf(i);
    segs.push({ type: 'hold', i, start: total, len: hold }, { type: 'tr', i, start: total + hold, len: len - hold });
    total += len;
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
  // a world the camera drifts through (story/types.ts drift) is arrived at where the drift begins
  return (h.start + (WORLDS[i]!.drift ? Math.min(h.len / 2, .3) : h.len / 2)) / TOTAL;
});

/** Progress where transition i is at point t (its own pace, midEase, undone), for a place inside a move (story/pops.ts). */
export const progressAt = (i: number, t: number): number => {
  const s = SEGMENTS.find((x) => x.type === 'tr' && x.i === i)!;
  let u = t;
  if (!STACCATO.has(i)) for (let k = 0; k < 30; k++) u -= (midEase(u) - t) / (1 + SCROLL.midEase * Math.cos(2 * Math.PI * u));
  return (s.start + Math.min(1, Math.max(0, u)) * s.len) / TOTAL;
};

/** Progress at the middle of transition i (used by the parity harness). */
export const transitionMidpoint = (i: number): number => {
  const s = SEGMENTS.find((x) => x.type === 'tr' && x.i === i)!;
  return (s.start + s.len / 2) / TOTAL;
};

/**
 * A transition's pace along its scroll (timeline/config.ts midEase): slower through the middle, where the
 * grains are in the air, quicker at the ends; 0, ½ and 1 stay where they are.
 */
const midEase = (u: number): number => u + SCROLL.midEase * Math.sin(2 * Math.PI * u) / (2 * Math.PI);

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
  /**
   * How far through the hold, linearly (0 → 1), and 1 in the transition: the camera's own run through a
   * world that moves on while resting (story/types.ts dolly). 0 on the last hold.
   */
  run: number;
}

export function locate(v: number): Located {
  const s = Math.min(TOTAL - 1e-6, Math.max(0, v * TOTAL));
  const seg = SEGMENTS.find((x) => s >= x.start && s < x.start + x.len) ?? last;
  if (seg.type === 'tr') { const u = (s - seg.start) / seg.len; return { a: seg.i, b: seg.i + 1, t: STACCATO.has(seg.i) ? u : midEase(u), tr: TRANSITIONS[seg.i]!, hold: -1, lean: 1, run: 1 }; }
  if (seg.i === CH - 1) return { a: CH - 2, b: CH - 1, t: 1, tr: TRANSITIONS[CH - 2]!, hold: CH - 1, lean: 0, run: 0 };
  return { a: seg.i, b: seg.i + 1, t: 0, tr: TRANSITIONS[seg.i]!, hold: seg.i, lean: ss(0, 1, (s - seg.start) / seg.len), run: (s - seg.start) / seg.len };
}

/**
 * A transition at a given point, as locate() would report it, with the camera lean chosen
 * explicitly. At t = 0 or 1 it describes the resting world (used by the seam check).
 */
export function locateAt(trIndex: number, t: number, lean: number): Located {
  const hold = t === 0 ? trIndex : t === 1 ? trIndex + 1 : -1;
  return { a: trIndex, b: trIndex + 1, t, tr: TRANSITIONS[trIndex]!, hold, lean, run: t === 0 ? lean : 1 };
}

/** Chapter i's transition against its hold, in scroll length (to carry a speed across the seam). */
export const trOverHold = (i: number): number => {
  const h = SEGMENTS.find((x) => x.type === 'hold' && x.i === i)!, tr = SEGMENTS.find((x) => x.type === 'tr' && x.i === i);
  return tr ? tr.len / h.len : 0;
};

/** The chapter whose snap point is nearest to progress v. */
export const nearestChapter = (v: number): number => {
  let best = 0;
  SNAP_POINTS.forEach((p, i) => { if (Math.abs(p - v) < Math.abs(SNAP_POINTS[best]! - v)) best = i; });
  return best;
};

// Chapter space: c ∈ [0, CH], chapter i spanning [i, i + 1) (its hold, then its transition; the last world
// a hold only). The story's speed limit is measured in it (timeline/scroll.ts), so every chapter, long or
// short on the track, takes as long at the limit.
const CHAPTER_START = WORLDS.map((_, i) => SEGMENTS.find((x) => x.type === 'hold' && x.i === i)!.start);
const chapterLen = (i: number): number => (i < CH - 1 ? CHAPTER_START[i + 1]! : TOTAL) - CHAPTER_START[i]!;

/** Story progress (0..1) to chapter space. */
export function toChapters(v: number): number {
  const s = Math.min(TOTAL, Math.max(0, v * TOTAL));
  let i = CH - 1; while (i > 0 && CHAPTER_START[i]! > s) i--;
  return Math.min(CH, i + (s - CHAPTER_START[i]!) / chapterLen(i));
}

/** Chapter space to story progress (0..1). */
export function fromChapters(c: number): number {
  const i = Math.min(CH - 1, Math.max(0, Math.floor(c)));
  return Math.min(1, Math.max(0, (CHAPTER_START[i]! + (c - i) * chapterLen(i)) / TOTAL));
}

/**
 * The share of the speed limit allowed at chapter-space position c: lower through a transition's middle
 * (midSlow), and lower again through the transitions that must never be hurried (critical), eased in
 * before them and out after them.
 */
export function speedAt(c: number): number {
  const i = Math.min(CH - 1, Math.floor(c)), f = c - i, h = holdShareOf(i);
  let k = 1;
  if (STACCATO.has(i)) { if (f > h) k *= SCROLL.staccato.speed; }
  else if (i < CH - 1 && f > h) k *= 1 - SCROLL.midSlow * Math.sin(Math.PI * (f - h) / (1 - h));
  // a world with its own (longer) hold: its transition spans less of the chapter, so it is slowed to take
  // as long as one of the usual share would
  if (WORLDS[i]!.holdShare !== undefined && i < CH - 1 && f > h) k *= (1 - h) / (1 - SCROLL.holdShare);
  const { ramp, speed } = SCROLL.critical;
  for (const j of CRITICAL) {
    const a = j + SCROLL.holdShare, b = j + 1, w = c < a ? ss(a - ramp, a, c) : c > b ? 1 - ss(b, b + ramp, c) : 1;
    if (w > 0) k *= 1 - (1 - speed) * w;
  }
  return k;
}
