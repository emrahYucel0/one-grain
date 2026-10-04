import { attr, fill, type Copy } from './copy';

/** Touch phones: the rail is only an indicator (a progress line), with no buttons. */
const PHONE = '(hover:none) and (pointer:coarse) and (max-width:719px), (hover:none) and (pointer:coarse) and (max-height:559px)';

/**
 * The chapter timeline on the right: one group per act, one button per chapter. As a progress line
 * (short screens, touch phones) it also marks where one act gives way to the next (`boundaries`, 0..1).
 */
export class TimelineNav {
  private readonly buttons: HTMLButtonElement[] = [];
  private readonly nav: HTMLElement;
  private progress = '';

  constructor(nav: HTMLElement, copy: Copy, go: (i: number) => void, boundaries: readonly number[]) {
    this.nav = nav;
    for (const at of boundaries) {
      const tick = document.createElement('i'); tick.className = 'tick'; tick.setAttribute('aria-hidden', 'true');
      tick.style.setProperty('--at', at.toFixed(4)); nav.appendChild(tick);
    }
    // on phones navigation is scrolling; screen readers keep the article, not an empty landmark
    const phone = matchMedia(PHONE);
    const hide = (): void => { if (phone.matches) nav.setAttribute('aria-hidden', 'true'); else nav.removeAttribute('aria-hidden'); };
    hide(); phone.addEventListener('change', hide);
    for (const act of copy.acts) {
      const g = document.createElement('div'); g.className = 'group';
      const l = document.createElement('div'); l.className = 'label'; l.textContent = act.label; g.appendChild(l);
      copy.chapters.forEach((c, i) => {
        if (c.act !== act.id) return;
        const b = document.createElement('button'); b.type = 'button';
        const span = document.createElement('span'); span.textContent = c.navLabel;
        b.append(span, document.createElement('i'));
        b.setAttribute('aria-label', c.final ? attr(nav, 'goFinal') : fill(attr(nav, 'go'), { title: c.title }));
        b.addEventListener('click', () => go(i));
        g.appendChild(b); this.buttons[i] = b;
      });
      nav.appendChild(g);
    }
  }

  setCurrent(i: number): void {
    this.buttons.forEach((b, k) => (k === i ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current')));
  }

  /** Story progress, 0..1: the rail as a line (short screens, phones) draws it (--p, on the rail only). */
  setProgress(v: number): void {
    const p = v.toFixed(3);
    if (p !== this.progress) { this.progress = p; this.nav.style.setProperty('--p', p); }
  }
}
