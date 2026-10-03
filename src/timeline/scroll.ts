import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { env } from '../core/env';
import { SCROLL_SNAP, SNAP_POINTS, TOTAL, nearestChapter } from './segments';

gsap.registerPlugin(ScrollTrigger);

/** How long a chapter jump owns the snap target. */
const JUMP_MS = 3000;

/**
 * Native page scroll drives the story. The track is as tall as the story (one screen height
 * per unit of segment length); progress follows the scroll with a 1.6 s scrub and settles on the
 * nearest hold (or the "One day," card) when scrolling stops, in 0.9–2 s (v15).
 */
export class ScrollTimeline {
  /** smoothed progress, 0..1 */
  readonly state = { v: 0 };
  private target = -1;
  private targetAt = 0;

  constructor(track: HTMLElement, { snap = true }: { snap?: boolean } = {}) {
    track.style.height = `${TOTAL * 100 + 100}vh`;
    gsap.to(this.state, {
      v: 1, ease: 'none',
      scrollTrigger: {
        trigger: track, start: 'top top', end: 'bottom bottom', scrub: 1.6,
        ...(snap ? { snap: { snapTo: this.snapTo, duration: { min: .9, max: 2 }, delay: .15, ease: 'power2.inOut' } } : {}),
      },
    });
  }

  /**
   * Scrolling settles on the nearest stop in its direction (as GSAP does with an array). A chapter
   * jump (keys, rail, hash, focus) lands where it was sent: ScrollTrigger measures velocity on the
   * scrubbed progress, which keeps moving for the 1.6 s scrub after the scroll stops, and that
   * inertia would carry a jump on to the next chapter.
   */
  private readonly directional = ScrollTrigger.snapDirectional([...SCROLL_SNAP]);
  private readonly snapTo = (value: number, self?: ScrollTrigger): number =>
    this.target >= 0 && performance.now() - this.targetAt < JUMP_MS ? SNAP_POINTS[this.target]! : this.directional(value, self?.direction ?? 0);

  goTo(i: number, instant = false): void {
    const max = document.documentElement.scrollHeight - innerHeight;
    this.target = i; this.targetAt = performance.now();
    scrollTo({ top: max * SNAP_POINTS[i]!, behavior: instant || env.reduced ? 'auto' : 'smooth' });
  }

  /** The chapter the visitor is at, or heading to if a jump is still under way. */
  current(): number {
    if (this.target >= 0 && performance.now() - this.targetAt < 1200) return this.target;
    const max = document.documentElement.scrollHeight - innerHeight;
    return nearestChapter(max > 0 ? scrollY / max : 0);
  }

  refresh(): void { ScrollTrigger.refresh(); }
}
