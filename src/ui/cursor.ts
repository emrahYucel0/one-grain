/** A mouse (or trackpad): the only pointer the cursor is drawn for. */
const FINE = '(hover: hover) and (pointer: fine)';
/** What counts as something to press. */
const PRESSABLE = 'a[href], button, [role="button"], summary, label';

/** The hands-on holds' shapes (input/interact.ts modes): 1 brush the dunes, 2 light the switches. */
const MODE_CLASS = ['', 'is-brush', 'is-light'] as const;

/**
 * The cursor (Awwwards P1). For a mouse only: a dot exactly at the pointer and, trailing it a little, a
 * ring in the grain marker's language (a white ring with a dark edge). Over anything pressable the ring
 * opens wide around it; on the hands-on holds it becomes the tool: a broad soft brush on the dunes, a
 * square probe on the chip. While pressed it tightens. The system cursor is hidden only while this one is
 * drawn (html.has-cursor), never on touch screens, in forced colours, or before the first mouse move;
 * with motion off the ring follows without the trail.
 */
export class Cursor {
  private readonly root = document.documentElement;
  private readonly el: HTMLElement;
  private readonly ring: HTMLElement;
  private readonly dot: HTMLElement;
  private x = -100; private y = -100;
  private rx = -100; ry = -100;
  private active = false;
  /** the frames have started (the cursor is drawn by them: before, the system cursor stays) */
  private ticking = false;
  private inside = false;
  private cls = { over: false, down: false, mode: 0, inside: false };
  private dotT = ''; private ringT = '';

  constructor(el: HTMLElement, enabled: boolean) {
    this.el = el;
    this.ring = el.querySelector<HTMLElement>('.cursor-ring')!;
    this.dot = el.querySelector<HTMLElement>('.cursor-dot')!;
    if (!enabled) return;
    const fine = matchMedia(FINE), forced = matchMedia('(forced-colors: active)');
    const allowed = (): boolean => fine.matches && !forced.matches;
    const off = (): void => { this.active = false; this.root.classList.remove('has-cursor'); };
    fine.addEventListener('change', () => { if (!allowed()) off(); });
    forced.addEventListener('change', () => { if (!allowed()) off(); });
    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      this.x = e.clientX; this.y = e.clientY;
      if (!this.active && this.ticking && allowed()) {
        this.active = true; this.rx = this.x; this.ry = this.y;
        this.root.classList.add('has-cursor');
      }
      this.inside = true;
      this.set('over', !!(e.target as Element | null)?.closest?.(PRESSABLE));
    }, { passive: true });
    addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') this.set('down', true); }, { passive: true });
    addEventListener('pointerup', () => this.set('down', false), { passive: true });
    // a click often hides what was under the pointer (the ending's row, the gate): look again once it has gone
    addEventListener('click', () => setTimeout(() => {
      if (this.active) this.set('over', !!document.elementFromPoint(this.x, this.y)?.closest(PRESSABLE));
    }, 900));
    // the pointer left the window (or the window lost focus): the cursor goes with it
    document.documentElement.addEventListener('pointerleave', () => { this.inside = false; });
    addEventListener('blur', () => { this.inside = false; this.set('down', false); });
    // touch: the system's own behaviour, no cursor
    addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse' && this.active) off(); }, { passive: true });
  }

  private set(k: 'over' | 'down', on: boolean): void {
    if (this.cls[k] === on) return;
    this.cls[k] = on;
    this.el.classList.toggle(k === 'over' ? 'is-over' : 'is-down', on);
  }

  /** Every frame: `dt` seconds since the last, `mode` the hands-on hold (0 none), `reduced` motion off. */
  frame(dt: number, mode: number, reduced: boolean): void {
    this.ticking = true;
    if (!this.active) return;
    if (this.cls.inside !== this.inside) { this.cls.inside = this.inside; this.el.classList.toggle('is-in', this.inside); }
    if (mode !== this.cls.mode) {
      if (this.cls.mode) this.el.classList.remove(MODE_CLASS[this.cls.mode as 1 | 2]);
      if (mode) this.el.classList.add(MODE_CLASS[mode as 1 | 2]);
      this.cls.mode = mode;
    }
    // the ring trails the dot: the same share of the way each 60th of a second, whatever the refresh rate
    const k = reduced ? 1 : 1 - Math.pow(1 - .24, Math.min(.1, dt) * 60);
    this.rx += (this.x - this.rx) * k; this.ry += (this.y - this.ry) * k;
    const dotT = `translate3d(${this.x.toFixed(1)}px,${this.y.toFixed(1)}px,0)`;
    const ringT = `translate3d(${this.rx.toFixed(1)}px,${this.ry.toFixed(1)}px,0)`;
    if (dotT !== this.dotT) { this.dotT = dotT; this.dot.style.transform = dotT; }
    if (ringT !== this.ringT) { this.ringT = ringT; this.ring.style.transform = ringT; }
  }
}
