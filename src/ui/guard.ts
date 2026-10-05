// The startup guard (index.html's inline script, window.__og): it reveals the article with a note if
// startup fails or stalls, and lists errors on screen with ?debug and on the dev server. The bundle
// reports its progress through here; without the guard (a harness page), every call does nothing.

interface Guard {
  log(kind: string, text?: string): void;
  fail(reason: string): void;
  alive(): void;
  ready(): void;
  shown: boolean;
}

const g = (window as unknown as { __og?: Guard }).__og;

export const guard = {
  /** A line in the on-screen report (shown only with ?debug or on the dev server). */
  log: (kind: string, text?: string): void => g?.log(kind, text),
  /** Give up: the article and the note instead of the experience. */
  fail: (reason: string): void => g?.fail(reason),
  /** Loading moved forward: the 8 s stall timer starts again. */
  alive: (): void => g?.alive(),
  /** The first frame is on screen: the guard stands down. */
  ready: (): void => g?.ready(),
  /** ?debug: the report is on screen from the start (worth collecting details for it). */
  get shown(): boolean { return g?.shown ?? false; },
  /** The guard has revealed the fallback; the experience must not start. */
  get failed(): boolean { return document.documentElement.classList.contains('failed'); },
};
