import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { env } from '../core/env';
import { SNAP_POINTS, TOTAL, nearestChapter } from './segments';

gsap.registerPlugin(ScrollTrigger);

/**
 * Native page scroll drives the story. The track is as tall as the story (one screen height
 * per unit of segment length); progress follows the scrollbar with a one-second scrub and
 * settles on the nearest hold when scrolling stops.
 */
export class ScrollTimeline {
  /** smoothed progress, 0..1 */
  readonly state = { v: 0 };
  private target = -1;
  private targetAt = 0;

  constructor(track: HTMLElement) {
    track.style.height = `${TOTAL * 100 + 100}vh`;
    gsap.to(this.state, {
      v: 1, ease: 'none',
      scrollTrigger: {
        trigger: track, start: 'top top', end: 'bottom bottom', scrub: 1,
        snap: { snapTo: [...SNAP_POINTS], duration: { min: .4, max: 1.2 }, delay: .2, ease: 'power1.inOut' },
      },
    });
  }

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
