import type { ActId } from '../story/types';
import { WORLDS } from '../story/worlds';

// All words come from index.html. Chapters are read from the semantic article (#story);
// UI microcopy from data-* attributes on the element that shows it.

export interface ChapterCopy {
  slug: string;
  act: ActId;
  actLabel: string;
  title: string;
  /** body text; empty for the final chapter, which shows its signature instead */
  text: string;
  /** the final chapter's signature paragraph (with its link) */
  signature: HTMLElement | null;
  hintMouse: string;
  hintTouch: string;
  /** a small aside under the text (empty if none) */
  micro: string;
  /** clock label for this chapter (years: shown only while resting; prod: always) and its sub-line */
  clockLabel: string;
  clockSub: string;
  /** label in the timeline nav */
  navLabel: string;
  final: boolean;
}

export interface Copy {
  chapters: ChapterCopy[];
  acts: { id: ActId; label: string }[];
}

const text = (el: Element | null): string => el?.textContent?.trim() ?? '';

export function readCopy(story: HTMLElement): Copy {
  const acts: Copy['acts'] = [];
  const chapters: ChapterCopy[] = [];
  for (const group of story.querySelectorAll<HTMLElement>('[data-act]')) {
    const id = group.dataset.act as ActId, label = text(group.querySelector('h2'));
    acts.push({ id, label });
    for (const s of group.querySelectorAll<HTMLElement>('section[data-slug]')) {
      const final = s.hasAttribute('data-final');
      const signature = s.querySelector<HTMLElement>('[data-signature]');
      const title = text(s.querySelector('h3'));
      chapters.push({
        slug: s.dataset.slug!, act: id, actLabel: label, title,
        text: final ? '' : text(s.querySelector('p:not([data-hint]):not([data-signature]):not([data-micro])')),
        signature,
        hintMouse: text(s.querySelector('[data-hint="mouse"]')),
        hintTouch: text(s.querySelector('[data-hint="touch"]')),
        micro: text(s.querySelector('[data-micro]')),
        clockLabel: s.dataset.clock ?? '',
        clockSub: s.dataset.clockSub ?? '',
        navLabel: s.dataset.nav ?? title,
        final,
      });
    }
  }
  const order = chapters.map((c) => c.slug).join(), expected = WORLDS.map((w) => w.slug).join();
  if (order !== expected) throw new Error(`index.html chapters (${order}) do not match story/worlds.ts (${expected})`);
  WORLDS.forEach((w, i) => {
    if (w.clock.unit === 'prod' && !chapters[i]!.clockLabel) throw new Error(`chapter "${w.slug}" needs a data-clock label (production time)`);
  });
  return { chapters, acts };
}

/** Fills {placeholders} in a microcopy template. */
export const fill = (template: string, values: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ''));

/** A required data-* attribute (microcopy) from an element. */
export const attr = (el: HTMLElement, name: string): string => {
  const v = el.dataset[name];
  if (v === undefined) throw new Error(`#${el.id} is missing data-${name.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}`);
  return v;
};
