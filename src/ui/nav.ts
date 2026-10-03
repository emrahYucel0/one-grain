import { attr, fill, type Copy } from './copy';

/** The chapter timeline on the right: one group per act, one button per chapter. */
export class TimelineNav {
  private readonly buttons: HTMLButtonElement[] = [];

  constructor(nav: HTMLElement, copy: Copy, go: (i: number) => void) {
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
}
