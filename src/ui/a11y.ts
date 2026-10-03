import { attr, fill, type Copy } from './copy';

/**
 * Assistive tech reads the semantic article (#story), which stays in the accessibility tree.
 * This module keeps it in step with the visual experience:
 *  - a short polite status line when the visitor comes to rest on a chapter (no body text, so
 *    nothing is read twice);
 *  - moving keyboard focus into a chapter of the article takes the experience there;
 *  - focus on the (visually hidden) signature link is mirrored onto the visible one.
 */
export class StoryA11y {
  private announced: number | null = null;
  private pending = -1;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly status: HTMLElement;
  private readonly copy: Copy;

  constructor(story: HTMLElement, status: HTMLElement, copy: Copy, opts: {
    go: (i: number) => void;
    /** called with true/false as the article's signature link gains/loses focus */
    onSignatureFocus: (focused: boolean) => void;
  }) {
    this.status = status; this.copy = copy;
    const sections = [...story.querySelectorAll<HTMLElement>('section[data-slug]')];
    story.addEventListener('focusin', (e) => {
      const i = sections.findIndex((s) => s.contains(e.target as Node));
      if (i >= 0) opts.go(i);
      if ((e.target as HTMLElement).closest('[data-signature] a')) opts.onSignatureFocus(true);
    });
    story.addEventListener('focusout', (e) => {
      if ((e.target as HTMLElement).closest('[data-signature] a')) opts.onSignatureFocus(false);
    });
  }

  /** Called every frame with the chapter being rested in (-1 in transitions). */
  rest(hold: number): void {
    if (this.announced === null) { // nothing to say on page load: remember where we started
      this.announced = hold >= 0 ? hold : null;
      return;
    }
    if (hold === this.pending) return;
    clearTimeout(this.timer); this.pending = -1;
    if (hold < 0 || hold === this.announced) return;
    // wait until the visitor has actually settled: scrubbing past chapters stays quiet
    this.pending = hold;
    this.timer = setTimeout(() => {
      const c = this.copy.chapters[hold]!;
      this.status.textContent = fill(attr(this.status, 'format'), { title: c.title, act: c.actLabel, n: hold + 1, total: this.copy.chapters.length });
      this.announced = hold; this.pending = -1;
    }, 700);
  }
}
