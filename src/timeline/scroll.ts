import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { env } from '../core/env';
import { MAX_SPEED, SCROLL, TOUCH } from './config';
import { SNAP_POINTS, TOTAL, fromChapters, nearestChapter, speedAt, toChapters } from './segments';

gsap.registerPlugin(ScrollTrigger);
// Mobile browsers resize the viewport as their bars come and go: no refresh (no jump) for that.
// ScrollTrigger's own rule ignores height changes under 25 % only (a landscape phone's bar is more);
// resizes refresh it from core/resize.ts onResize instead, which skips height-only changes (touch: all of them).
ScrollTrigger.config({ ignoreMobileResize: true, autoRefreshEvents: 'visibilitychange,DOMContentLoaded,load' });

/** A jump hands the story back to the speed limit once it is this close (chapters), or after this long. */
const LANDED = .002, JUMP_MAX_MS = 5000;
/** The longest step the story takes in one frame, however long the frame (s). */
const MAX_DT = .1;

/**
 * Native page scroll, smoothed by Lenis (wheel and trackpad; touch stays native unless config's touch.syncTouch), gives the story a
 * target; the story shows a value that follows it, never faster than a speed limit (timeline/config.ts).
 * Everything that plays the story (the worlds, the clock, the words, the rail, the sound) reads that
 * shown value, never the scroll. Nothing scrolls on its own: no snapping. A jump (rail, keys, a #link)
 * lifts the limit until it lands; with motion off neither the smoothing nor the limit applies.
 */
export class ScrollTimeline {
  /** the story's progress as shown, 0..1 */
  readonly state = { v: 0 };
  private readonly lenis: Lenis;
  private readonly trigger: ScrollTrigger;
  /** chapter space (timeline/segments.ts) */
  private shown = 0;
  private last = -1;
  /** a jump under way: where to (chapter space) and since when; -1 when none */
  private jumpTo = -1;
  private jumpAt = 0;
  /** the next frame shows the target at once (the first frame, an instant jump) */
  private settle = true;
  private target = -1;
  private targetAt = 0;
  /** the scroll range as last measured (a resize changes it before refresh() runs) */
  private max = 0;

  constructor(track: HTMLElement) {
    // on touch a shorter track: a swipe carries further through the story (timeline/config.ts touch.length)
    track.style.height = `${TOTAL * 100 * (TOUCH ? SCROLL.touch.length : 1) + 100}vh`;
    this.trigger = ScrollTrigger.create({ trigger: track, start: 'top top', end: 'bottom bottom' });
    this.lenis = new Lenis({
      lerp: SCROLL.lerp, wheelMultiplier: SCROLL.wheelMultiplier, smoothWheel: SCROLL.smoothWheel && !env.reduced,
      syncTouch: TOUCH && SCROLL.touch.syncTouch && !env.reduced, touchMultiplier: SCROLL.touch.touchMultiplier,
      syncTouchLerp: SCROLL.touch.syncTouchLerp, touchInertiaExponent: SCROLL.touch.touchInertiaExponent,
      // the credits scroll on their own
      prevent: (node) => node.nodeName === 'DIALOG',
    });
    this.lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => this.lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    // the visitor's own scrolling takes over from a jump
    for (const ev of ['wheel', 'touchstart'] as const) addEventListener(ev, () => { this.jumpTo = -1; }, { passive: true });
    this.max = document.documentElement.scrollHeight - innerHeight;
  }

  /** Called once per frame, before anything reads the story's progress. */
  advance(now: number): void {
    const dt = this.last < 0 ? 0 : Math.min(MAX_DT, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    const reduced = env.reduced;
    this.lenis.options.smoothWheel = SCROLL.smoothWheel && !reduced;
    const target = toChapters(this.trigger.progress);
    if (this.jumpTo >= 0 && (Math.abs(this.shown - this.jumpTo) < LANDED || now - this.jumpAt > JUMP_MAX_MS)) this.jumpTo = -1;
    const gap = target - this.shown;
    if (reduced || this.settle) { this.shown = target; this.settle = false; }
    else if (gap !== 0) {
      // close a share of the gap (as 0.1 of it per 1/60 s would), at most at the speed limit
      let step = Math.abs(gap) * (1 - Math.pow(1 - SCROLL.follow, dt * 60));
      if (this.jumpTo < 0) step = Math.min(step, MAX_SPEED * speedAt(this.shown) * dt);
      this.shown = Math.abs(gap) < 1e-5 ? target : this.shown + Math.sign(gap) * step;
    }
    this.state.v = fromChapters(this.shown);
  }

  goTo(i: number, instant = false): void {
    const max = document.documentElement.scrollHeight - innerHeight;
    this.target = i; this.targetAt = performance.now();
    const now = instant || env.reduced;
    this.jumpTo = toChapters(SNAP_POINTS[i]!); this.jumpAt = performance.now();
    if (now) this.settle = true;
    this.lenis.scrollTo(max * SNAP_POINTS[i]!, { immediate: now, lerp: SCROLL.jumpLerp, force: true });
  }

  /**
   * Back to the start at once (the ending's "Start again", once the story has run back to it, or behind
   * the closed veil with motion off).
   */
  restart(): void {
    this.target = 0; this.targetAt = performance.now();
    this.jumpTo = -1;
    this.lenis.scrollTo(0, { immediate: true, force: true });
    ScrollTrigger.update();
    this.shown = 0; this.state.v = 0;
  }

  /** The chapter the visitor is at, or heading to if a jump is still under way. */
  current(): number {
    if (this.target >= 0 && performance.now() - this.targetAt < 1200) return this.target;
    const max = document.documentElement.scrollHeight - innerHeight;
    return nearestChapter(max > 0 ? this.lenis.targetScroll / max : 0);
  }

  /**
   * After a real resize: the track is measured in screen heights, so the same scroll offset in
   * pixels would be another place in the story. Keep the place: resting on a chapter, stay on it;
   * mid-transition, keep the same share of the track.
   */
  refresh(): void {
    const share = this.max > 0 ? this.lenis.targetScroll / this.max : 0;
    ScrollTrigger.refresh();
    this.lenis.resize();
    this.max = document.documentElement.scrollHeight - innerHeight;
    const at = SNAP_POINTS.findIndex((p) => Math.abs(p - share) < .002);
    if (at >= 0) this.goTo(at, true);
    else this.lenis.scrollTo(share * this.max, { immediate: true, force: true });
  }
}
