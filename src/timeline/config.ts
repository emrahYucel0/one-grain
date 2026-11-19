/**
 * How scrolling moves the story: every hand-tuned value in one place.
 *
 * The scroll gives a target (where the page is); the story shows a value that follows it, never faster
 * than `maxSpeed`, so a hard flick of the wheel cannot carry a transition past in a few frames, nor skip
 * one. Speeds are in chapters per second: a chapter is one world's still part and the transition out of it.
 */
export const SCROLL = {
  /** Lenis: smoothing of the wheel (0..1, lower is smoother) */
  lerp: .075,
  /** Lenis: page pixels per pixel of wheel delta */
  wheelMultiplier: .7,
  /** Lenis: smooth the wheel and the trackpad (touch scrolling stays native) */
  smoothWheel: true,

  /** share of the remaining distance the story closes per 1/60 s (frame-rate independent) */
  follow: .1,
  /** the story's speed limit, chapters per second */
  maxSpeed: .8,

  /** each chapter's scroll length: this share is the still world, the rest its transition */
  holdShare: .35,
  /**
   * Inside a transition, the scroll moves the scene less around its middle (the grains in the air) and
   * more at its ends: 0 is even, up to 1. Ends and middle are where they were; only the pace changes.
   */
  midEase: .35,
  /** and the speed limit is lowered by this share at a transition's middle */
  midSlow: .3,

  /** transitions that are never hurried: the speed limit is multiplied by `speed` there */
  critical: {
    /** by the world they leave: again → quarry ("One day,"), quarry → furnace (the quarry breaks) */
    from: ['again', 'quarry'] as readonly string[],
    speed: .5,
    /** the limit eases down over this many chapters before the transition, and back up after it */
    ramp: .15,
  },

  /** a jump (the right-hand rail, keys, a #link): Lenis's smoothing for it; the speed limit is off until it lands */
  jumpLerp: .1,
} as const;
