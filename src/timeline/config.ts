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

  /**
   * Act II as a montage (Awwwards P7): out of these worlds the moves are quick and the stops firm. A larger
   * share of each chapter is the still world; the move runs at an even pace along the scroll (no slow
   * middle) and up to `speed` × the speed limit; the camera leaves and lands hard (ease quint). Transitions
   * marked critical keep their own pace.
   */
  staccato: { worlds: ['quarry', 'furnace', 'purity', 'crystal', 'wafer', 'light'] as readonly string[], holdShare: .5, speed: 1.8 },

  /** a jump (the right-hand rail, keys, a #link): Lenis's smoothing for it; the speed limit is off until it lands */
  jumpLerp: .1,

  /**
   * Touch screens (phones, tablets): the values above hold for the wheel and the trackpad; on touch these
   * override them. A swipe covers more of the story (a shorter track); the speed limit still applies, so a
   * hard flick never skips a transition: the sand flows on until it has caught up. The critical moves keep
   * their halved limit (critical.speed), and everything else above (shares, staccato) is the same.
   */
  touch: {
    /** what counts as touch */
    query: '(pointer: coarse)',
    /** the track's length as a share of the wheel's: 0.5 is half the finger travel for the whole journey */
    length: .5,
    /** the story's speed limit on touch, chapters per second */
    maxSpeed: 1,
    /**
     * Off (default): the phone's own scrolling and momentum, which runs on after the finger lifts as
     * everywhere else on the phone. On: Lenis takes the finger over (its own inertia), and only then do
     * touchMultiplier, syncTouchLerp and touchInertiaExponent apply.
     */
    syncTouch: false,
    /** Lenis (with syncTouch): page pixels per pixel of finger travel */
    touchMultiplier: 2,
    /** Lenis (with syncTouch): smoothing of the finger (0..1, lower is smoother) */
    syncTouchLerp: .075,
    /** Lenis (with syncTouch): how far the inertia carries after the finger lifts (default 1.7) */
    touchInertiaExponent: 1.7,
  },
} as const;

/** The visitor scrolls by touch (timeline/config.ts touch), read once at start. */
export const TOUCH = typeof matchMedia === 'function' && matchMedia(SCROLL.touch.query).matches;
/** The story's speed limit (chapters per second) for this device. */
export const MAX_SPEED: number = TOUCH ? SCROLL.touch.maxSpeed : SCROLL.maxSpeed;
