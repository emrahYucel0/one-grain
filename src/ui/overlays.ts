import { holdTimeOverride } from '../debug/parity';
import { ss } from '../core/ease';
import type { TransitionDef } from '../story/types';
import { attr } from './copy';

/** The black "One day," card that covers the hard cut from nature to industry. */
export function cutOpacity(tr: TransitionDef, t: number): number {
  return tr.cam === 'cut' ? ss(.12, .3, t) * (1 - ss(.7, .88, t)) : 0; // a wider window (v15)
}

/** Chapter text fades out early in a transition and back in at its end (slower around the cut). */
export function chapterOpacity(tr: TransitionDef, t: number): number {
  return tr.cam === 'cut' ? (t < .5 ? 1 - ss(0, .3, t) : ss(.7, 1, t)) : (t < .5 ? 1 - ss(0, .2, t) : ss(.8, 1, t));
}

/** Where the title card has faded completely (story progress). */
const INTRO_END = .02;

/**
 * Phones: the opening chapter's words wait for the first scroll and come in as the title fades (the
 * title is the first screen, and the largest thing on it). A multiplier for the chapter text's opacity
 * while the opening chapter is shown: the title's fade mirrored, until the story has passed it once;
 * from then on 1. Elsewhere (desktops, tablets), always 1.
 */
export class Opening {
  private open: boolean;
  constructor(phone: boolean) { this.open = !phone; }
  factor(v: number, chapter: number): number {
    if (v >= INTRO_END) this.open = true;
    return this.open || chapter !== 0 ? 1 : ss(0, INTRO_END, v);
  }
}

/** The title card: fades away over the first 2 % of the story; its hint changes once sand is ready. */
export class Intro {
  private readonly el: HTMLElement;
  private readonly hint: HTMLElement;
  constructor(el: HTMLElement, hint: HTMLElement) { this.el = el; this.hint = hint; }
  ready(): void { this.hint.textContent = attr(this.hint, 'ready'); }
  private opacity = '';
  update(v: number): void {
    const opacity = (1 - ss(0, INTRO_END, v)).toFixed(2);
    if (opacity !== this.opacity) { this.opacity = opacity; this.el.style.opacity = opacity; }
  }
}

/**
 * The ending. The screen arrives neutral, with "Now" on the clock; the sentence comes in 1.2 s
 * after resting on the last chapter; the sand image fades into the screen from 4 s to 8 s while
 * the end's stage colour comes in (the reveal); the signature and footnote at 8.5 s.
 */
export class Ending {
  static readonly TITLE_S = .4;
  static readonly SIGNATURE_S = 8;
  /** keyboard focus on the signature link: the end state at once */
  static readonly FORCED_S = 99;
  private since = -1;
  /** keyboard focus on the signature link: everything at once */
  forced = false;
  private readonly chapter: HTMLElement;
  constructor(chapter: HTMLElement) { this.chapter = chapter; }
  /** Seconds since the final chapter was reached (-1 elsewhere); the grain's light and landing follow it. */
  update(atEnd: boolean, now: number): number {
    if (!atEnd) { this.since = -1; return -1; }
    if (this.since < 0) this.since = now;
    const el = this.forced ? Ending.FORCED_S : holdTimeOverride() ?? (now - this.since) / 1000;
    this.chapter.classList.toggle('in', el > Ending.TITLE_S);
    this.chapter.classList.toggle('sig', el > Ending.SIGNATURE_S);
    return el;
  }
}
