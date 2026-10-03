import type { Copy } from './copy';

/** The visual chapter card (aria-hidden: assistive tech reads the article instead). */
export class ChapterView {
  readonly el: HTMLElement;
  private shown = -1;
  private lastOpacity = -1;
  private readonly title: HTMLElement;
  private readonly body: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly act: HTMLElement;
  private readonly copy: Copy;
  private readonly touchOnly: boolean;
  /** the overlay's copy of the signature link, if the final chapter is showing */
  signatureLink: HTMLAnchorElement | null = null;

  constructor(el: HTMLElement, act: HTMLElement, copy: Copy, touchOnly: boolean) {
    this.el = el; this.act = act; this.copy = copy; this.touchOnly = touchOnly;
    this.title = el.querySelector('h2')!;
    this.body = el.querySelector('p:not(.hint)')!;
    this.hint = el.querySelector('.hint')!;
  }

  /** Shows chapter i (no-op if already shown). Returns true when it changed. */
  show(i: number): boolean {
    if (this.shown === i) return false;
    this.shown = i;
    const c = this.copy.chapters[i]!;
    this.act.textContent = c.actLabel;
    this.title.textContent = c.title;
    this.body.textContent = c.text;
    this.signatureLink = null;
    if (c.signature) {
      this.body.replaceChildren(...[...c.signature.childNodes].map((n) => n.cloneNode(true)));
      this.signatureLink = this.body.querySelector('a');
      this.signatureLink?.setAttribute('tabindex', '-1'); // reachable from the article instead
    }
    this.el.classList.toggle('final', c.final);
    this.el.classList.remove('in', 'sig');
    const hint = this.touchOnly ? c.hintTouch : c.hintMouse;
    this.hint.textContent = hint;
    this.hint.style.display = hint ? '' : 'none';
    return true;
  }

  get current(): number { return this.shown; }

  setOpacity(op: number): void {
    if (Math.abs(op - this.lastOpacity) > .01) { this.el.style.opacity = op.toFixed(2); this.lastOpacity = op; }
  }
}
