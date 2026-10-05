import { WORLDS } from '../story/worlds';
import type { ScrollTimeline } from './scroll';

const indexOfHash = (hash: string): number => WORLDS.findIndex((w) => `#${w.slug}` === hash);

/** Shareable chapter links: #slug opens there, and the address follows the visitor's holds. */
export class HashRouter {
  private last = '';
  private readonly timeline: ScrollTimeline;

  constructor(timeline: ScrollTimeline) {
    this.timeline = timeline;
    addEventListener('hashchange', () => {
      const i = indexOfHash(location.hash);
      if (i >= 0) { this.last = location.hash; timeline.goTo(i); }
    });
  }

  /** Jump to the chapter in the address, once the track has its final height. */
  restore(): void {
    const start = indexOfHash(location.hash);
    if (start > 0) requestAnimationFrame(() => { this.timeline.refresh(); this.timeline.goTo(start, true); });
  }

  /** Called every frame with the world being rested in (-1 in transitions). */
  update(hold: number): void {
    if (hold < 0) return;
    const h = `#${WORLDS[hold]!.slug}`;
    if (h === this.last) return;
    // the opening chapter on arrival leaves the address alone: a first visit keeps the plain URL, and the
    // browser is not sent fetching the favicon again for a same-document navigation before anyone scrolls
    const opening = !this.last && hold === 0 && !location.hash;
    this.last = h;
    if (!opening) history.replaceState(null, '', h);
  }
}
