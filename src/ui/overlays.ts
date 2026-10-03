import { ss } from '../core/ease';
import type { TransitionDef } from '../story/types';
import { attr } from './copy';

/** The black "One day," card that covers the hard cut from nature to industry. */
export function cutOpacity(tr: TransitionDef, t: number): number {
  return tr.cam === 'cut' ? ss(.22, .4, t) * (1 - ss(.6, .78, t)) : 0;
}

/** Chapter text fades out early in a transition and back in at its end (slower around the cut). */
export function chapterOpacity(tr: TransitionDef, t: number): number {
  return tr.cam === 'cut' ? (t < .5 ? 1 - ss(0, .3, t) : ss(.7, 1, t)) : (t < .5 ? 1 - ss(0, .2, t) : ss(.8, 1, t));
}

/** The title card: fades away over the first 2 % of the story; its hint changes once sand is ready. */
export class Intro {
  private readonly el: HTMLElement;
  private readonly hint: HTMLElement;
  constructor(el: HTMLElement, hint: HTMLElement) { this.el = el; this.hint = hint; }
  ready(): void { this.hint.textContent = attr(this.hint, 'ready'); }
  update(v: number): void { this.el.style.opacity = (1 - ss(0, .02, v)).toFixed(2); }
}

/** The ending: the title arrives 1.2 s after resting on the last chapter, the signature at 5.5 s. */
export class Ending {
  private since = -1;
  /** keyboard focus on the signature link shows everything at once */
  forced = false;
  private readonly chapter: HTMLElement;
  constructor(chapter: HTMLElement) { this.chapter = chapter; }
  update(atEnd: boolean, now: number): void {
    if (!atEnd) { this.since = -1; return; }
    if (this.since < 0) this.since = now;
    const el = (now - this.since) / 1000;
    this.chapter.classList.toggle('in', this.forced || el > 1.2);
    this.chapter.classList.toggle('sig', this.forced || el > 5.5);
  }
}
