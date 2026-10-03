import type { Copy } from './copy';

/** The visual chapter card (aria-hidden: assistive tech reads the article instead). */
export class ChapterView {
  readonly el: HTMLElement;
  private shown = -1;
  private lastOpacity = -1;
  private readonly title: HTMLElement;
  private readonly body: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly micro: HTMLElement;
  private readonly copy: Copy;
  private readonly touchOnly: boolean;
  /** the overlay's copy of the signature link, if the final chapter is showing */
  private signatureLink: HTMLAnchorElement | null = null;
  private signatureFocused = false;

  constructor(el: HTMLElement, copy: Copy, touchOnly: boolean) {
    this.el = el; this.copy = copy; this.touchOnly = touchOnly;
    this.title = el.querySelector('h2')!;
    this.body = el.querySelector('p:not(.hint):not(.micro)')!;
    this.hint = el.querySelector('.hint')!;
    this.micro = el.querySelector('.micro')!;
  }

  /** Shows chapter i (no-op if already shown). Returns true when it changed. */
  show(i: number): boolean {
    if (this.shown === i) return false;
    this.shown = i;
    const c = this.copy.chapters[i]!;
    this.title.textContent = c.title;
    this.body.textContent = c.text;
    this.signatureLink = null;
    if (c.signature) {
      this.body.replaceChildren(...[...c.signature.childNodes].map((n) => n.cloneNode(true)));
      this.signatureLink = this.body.querySelector('a');
      this.signatureLink?.setAttribute('tabindex', '-1'); // reachable from the article instead
      this.signatureLink?.classList.toggle('kbd-focus', this.signatureFocused);
    }
    this.el.classList.toggle('final', c.final);
    this.el.classList.remove('in', 'sig');
    const hint = this.touchOnly ? c.hintTouch : c.hintMouse;
    this.hint.textContent = hint;
    this.hint.style.display = hint ? '' : 'none';
    this.micro.textContent = c.micro;
    this.micro.style.display = c.micro ? '' : 'none';
    return true;
  }

  get current(): number { return this.shown; }

  /** Mirror keyboard focus on the article's signature link onto the visible one (now or when it appears). */
  setSignatureFocus(focused: boolean): void {
    this.signatureFocused = focused;
    this.signatureLink?.classList.toggle('kbd-focus', focused);
  }

  setOpacity(op: number): void {
    if (Math.abs(op - this.lastOpacity) > .01) { this.el.style.opacity = op.toFixed(2); this.lastOpacity = op; }
  }
}
