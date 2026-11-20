import { attr } from './copy';

/** Seconds after resting on the ending (its own clock, ui/overlays.ts Ending) before the last word comes in. */
const SHOW_S = 3.2;
/** How long the share button says what it did. */
const SAID_MS = 2400;

/**
 * The ending's last word (Awwwards P1): once the sentence, the reveal and the signature have had their
 * time, three choices come in under them. "Rewind 300 million years" runs the story back to its start
 * (ui/rewind.ts); "Send this grain to someone" uses the system's share sheet where there is one and
 * copies the link elsewhere; "Sample label" opens the credits as a specimen label, a native modal dialog
 * (Escape, focus and the backdrop are the browser's; focus comes back to the button). Hidden (and out of the tab order) everywhere else in the story; html.outro-on while shown (not .outro: that is the row's own class).
 */
export class Outro {
  private readonly root = document.documentElement;
  private shown = false;
  private readonly row: HTMLElement;
  private sayTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(opts: {
    again: HTMLButtonElement; share: HTMLButtonElement; credits: HTMLButtonElement; dialog: HTMLDialogElement;
    /** the polite status line (also used by ui/a11y.ts), for "Link copied" */
    status: HTMLElement;
    onAgain: () => void;
  }) {
    const { again, share, credits, dialog, status } = opts;
    this.row = again.parentElement!;
    again.addEventListener('click', () => {
      opts.onAgain();
      // the choices are going: keyboard focus moves to the story's own controls, not to the page's top
      document.getElementById('sound')?.focus({ preventScroll: true });
    });
    const label = share.textContent ?? '';
    const say = (text: string): void => {
      share.textContent = text; status.textContent = text;
      clearTimeout(this.sayTimer);
      this.sayTimer = setTimeout(() => { share.textContent = label; }, SAID_MS);
    };
    share.addEventListener('click', () => void (async () => {
      const url = shareUrl();
      const data = { title: attr(share, 'title'), text: attr(share, 'text'), url };
      if (typeof navigator.share === 'function' && (navigator.canShare?.(data) ?? true)) {
        try { await navigator.share(data); return; } catch (e) { if ((e as Error).name === 'AbortError') return; }
      }
      try { await navigator.clipboard.writeText(url); say(attr(share, 'copied')); } catch { say(attr(share, 'failed')); }
    })());
    // html.dialog-open: the dialog is in the top layer, above the drawn cursor, so the system's comes back (ui/cursor.ts)
    credits.addEventListener('click', () => { if (!dialog.open) { this.root.classList.add('dialog-open'); dialog.showModal(); } });
    // a click on the backdrop (outside the dialog's own box) closes it, as Escape does
    dialog.addEventListener('click', (e) => {
      if (e.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => { this.root.classList.remove('dialog-open'); credits.focus({ preventScroll: true }); });
  }

  /**
   * Every frame: `finalTime` the seconds spent on the ending (-1 elsewhere), `forced` the ending shown
   * whole at once (keyboard focus on the signature), `hidden` while the veil closes for a rewind. Once in,
   * it stays for as long as the story rests on the ending (focus moving on from the signature to these
   * choices must not take them away).
   */
  update(finalTime: number, forced: boolean, hidden: boolean): void {
    const on = !hidden && finalTime >= 0 && (this.shown || forced || finalTime >= SHOW_S);
    if (on === this.shown) return;
    this.shown = on;
    // the card rises by the row's height (it may wrap on a narrow screen): measured once, as it comes in
    if (on) this.row.parentElement?.style.setProperty('--outro-lift', `${this.row.offsetHeight}px`);
    this.root.classList.toggle('outro-on', on);
  }
}

/** The page's own address without the chapter (the canonical link in production; this page elsewhere). */
function shareUrl(): string {
  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? '';
  return /^https?:\/\//.test(canonical) && !canonical.includes('%') ? canonical : location.origin + location.pathname;
}
