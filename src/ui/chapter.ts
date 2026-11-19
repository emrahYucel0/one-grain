import type { Copy } from './copy';

/**
 * The words' choreography (Awwwards P0). Each piece of the card has a start (--a) and a span (--w) on
 * the chapter's progress (--p, 0..1: the chapter text's opacity as the story sets it), and the
 * stylesheet turns that into motion: the index first, the title's letters rising through a mask one
 * after another, then the body word by word, then the asides. Leaving, the same in reverse, the title's
 * letters going up and out from the first (--b). Scroll-driven, so scrubbing back plays it backwards
 * exactly; with motion off the card only fades.
 */
const TITLE = { from: .04, to: .34, span: .58 };
const BODY = { from: .3, to: .5, span: .46 };
const INDEX = { a: 0, span: .5 };
const FACTS = { from: .06, to: .2, span: .46 };
const MICRO = { a: .52, span: .46 };
const HINT = { a: .56, span: .44 };

const spread = (i: number, n: number, r: { from: number; to: number }): number => n > 1 ? r.from + (r.to - r.from) * i / (n - 1) : r.from;
const timing = (el: HTMLElement, a: number, w: number): void => { el.style.setProperty('--a', a.toFixed(3)); el.style.setProperty('--w', w.toFixed(3)); };

/** The title: words that never break inside, each a mask its letters rise through. */
function splitTitle(text: string): Node[] {
  const words = text.split(' ').filter(Boolean);
  const n = words.reduce((s, w) => s + [...w].length, 0);
  const out: Node[] = [];
  let i = 0;
  words.forEach((word, k) => {
    if (k) out.push(document.createTextNode(' '));
    const w = document.createElement('span'); w.className = 'w';
    for (const c of word) {
      const ch = document.createElement('span'); ch.className = 'ch'; ch.textContent = c;
      timing(ch, spread(i, n, TITLE), TITLE.span);
      ch.style.setProperty('--b', spread(n - 1 - i, n, TITLE).toFixed(3));
      w.append(ch); i++;
    }
    out.push(w);
  });
  return out;
}

/** The body: word by word. */
function splitBody(text: string): Node[] {
  const words = text.split(' ').filter(Boolean);
  const out: Node[] = [];
  words.forEach((word, k) => {
    if (k) out.push(document.createTextNode(' '));
    const w = document.createElement('span'); w.className = 'wd'; w.textContent = word;
    timing(w, spread(k, words.length, BODY), BODY.span);
    out.push(w);
  });
  return out;
}

/** The visual chapter card (aria-hidden: assistive tech reads the article instead). */
export class ChapterView {
  readonly el: HTMLElement;
  private shown = -1;
  private lastP = '';
  private lastOpacity = '';
  private lastOut: boolean | null = null;
  private readonly title: HTMLElement;
  private readonly body: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly micro: HTMLElement;
  private readonly index: HTMLElement;
  private readonly facts: HTMLElement;
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
    this.index = el.querySelector('.idx')!;
    this.facts = el.querySelector('.facts')!;
    timing(this.index, INDEX.a, INDEX.span);
    timing(this.micro, MICRO.a, MICRO.span);
    timing(this.hint, HINT.a, HINT.span);
  }

  /** Shows chapter i (no-op if already shown). Returns true when it changed. */
  show(i: number): boolean {
    if (this.shown === i) return false;
    this.shown = i;
    const c = this.copy.chapters[i]!;
    this.title.replaceChildren(...splitTitle(c.title));
    this.body.replaceChildren(...splitBody(c.text));
    this.signatureLink = null;
    if (c.signature) {
      this.body.replaceChildren(...[...c.signature.childNodes].map((n) => n.cloneNode(true)));
      this.signatureLink = this.body.querySelector('a');
      this.signatureLink?.setAttribute('tabindex', '-1'); // reachable from the article instead
      this.signatureLink?.classList.toggle('kbd-focus', this.signatureFocused);
    }
    const n = this.index.querySelector('.n'), act = this.index.querySelector('.act');
    if (n) n.textContent = String(i + 1).padStart(2, '0');
    if (act) act.textContent = c.actLabel;
    this.el.classList.toggle('final', c.final);
    this.el.classList.remove('in', 'sig');
    const hint = this.touchOnly ? c.hintTouch : c.hintMouse;
    this.hint.textContent = hint;
    this.hint.style.display = hint ? '' : 'none';
    // the chapter's figures under its index, one after another (Awwwards P2)
    this.facts.replaceChildren(...c.facts.map((f, k) => {
      const s = document.createElement('span'); s.className = 'f';
      const l = document.createElement('span'); l.className = 'k'; l.textContent = f.label;
      const v = document.createElement('span'); v.className = 'v'; v.textContent = f.value;
      s.append(l, v); timing(s, spread(k, c.facts.length, FACTS), FACTS.span);
      return s;
    }));
    this.facts.style.display = c.facts.length ? '' : 'none';
    this.micro.textContent = c.micro;
    this.micro.style.display = c.micro ? '' : 'none';
    return true;
  }

  get current(): number { return this.shown; }

  /** Mirror keyboard focus on the article's signature link onto the visible link (now or when it appears). */
  setSignatureFocus(focused: boolean): void {
    this.signatureFocused = focused;
    this.signatureLink?.classList.toggle('kbd-focus', focused);
  }

  /**
   * The card's progress: `p` 0..1 (the chapter text's opacity as the story sets it), `leaving` while
   * the story moves away from this chapter, `motion` false for the plain fade.
   */
  setProgress(p: number, leaving: boolean, motion: boolean): void {
    const opacity = motion ? (p > .001 ? '1' : '0') : p.toFixed(2);
    const pv = motion ? p.toFixed(3) : '1';
    if (opacity !== this.lastOpacity) { this.el.style.opacity = opacity; this.lastOpacity = opacity; }
    if (pv !== this.lastP) {
      this.el.style.setProperty('--p', pv); this.lastP = pv;
      // at rest the letters' masks step aside, so nothing clips the title's shadow (its contrast halo)
      this.el.classList.toggle('settled', pv === '1' || pv === '1.000');
    }
    if (leaving !== this.lastOut) { this.el.classList.toggle('out', leaving); this.lastOut = leaving; }
  }
}
