import { ss } from '../core/ease';
import { attr } from './copy';

/** The iris: how long it takes to open from the grain to the whole screen (s). */
const OPEN_S = 2.6;
/** With motion off the veil simply fades. */
const FADE_S = .8;
/** Scrolling this far into the story counts as entering (silently). */
const SCROLL_ENTERS = .003;
/** Starting again (the ending, ui/outro.ts): the iris closes onto the grain, rests shut, opens on the first world. */
const CLOSE_S = 1.6;
const SHUT_S = .45;

const easeInOut = (t: number): number => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/**
 * The entry gate (Awwwards P0). Once the scene is ready, the first screen is dark but for the grain
 * itself, glowing through a small opening in a veil of the stage colour, with the title and two
 * choices: "Enter with sound" and "Enter". Either one, or simply scrolling, opens the veil like an
 * iris from the grain outward until the whole world is there; the HUD and the chapter's words come in
 * behind it. The gate is never in the way: scrolling, chapter keys and #slug links all go straight
 * through, and the harnesses (?parity, ?capture) skip it unless ?gate asks for it.
 *
 * Starting again from the ending runs it the other way first: the iris closes onto the landed grain until
 * the veil is whole, the story goes back to its start behind it, and the iris opens again on the first
 * world's grain (rewind).
 *
 * html.gated: the gate is up (waiting, opening or closing); html.gate-opening: opening; html.gate-closing:
 * closing or shut. They all go once it is open.
 */
export class Gate {
  private readonly root = document.documentElement;
  private readonly veil: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly reduced: () => boolean;
  private state: 'off' | 'waiting' | 'opening' | 'closing' | 'shut' = 'off';
  private openedAt = -1;
  /** opening after a rewind: from a whole veil rather than the waiting gate's small opening */
  private replay = false;
  private onShut: (() => void) | null = null;
  private last = '';

  constructor(opts: {
    enabled: boolean;
    gate: HTMLElement; veil: HTMLElement; hint: HTMLElement;
    reduced: () => boolean;
    /** the visitor's choice: true for "with sound" */
    onChoice: (sound: boolean) => void;
    /** the sound's code, fetched on intent so the click still counts as the gesture that starts it */
    preloadSound: () => void;
  }) {
    this.veil = opts.veil; this.hint = opts.hint; this.reduced = opts.reduced;
    if (!opts.enabled) return;
    this.state = 'waiting';
    this.root.classList.add('gated');
    for (const b of opts.gate.querySelectorAll<HTMLButtonElement>('button[data-sound-choice]')) {
      const sound = b.dataset.soundChoice === 'on';
      b.addEventListener('click', () => { opts.onChoice(sound); this.open(); });
      if (sound) for (const ev of ['pointerenter', 'focus', 'touchstart']) b.addEventListener(ev, opts.preloadSound, { once: true, passive: true });
    }
  }

  get waiting(): boolean { return this.state === 'waiting'; }
  /** closing, shut or opening again after a rewind */
  get rewinding(): boolean { return this.state === 'closing' || this.state === 'shut' || (this.state === 'opening' && this.replay); }

  /**
   * Start again: the iris closes onto the grain; once the veil is whole `onShut` takes the story back to its
   * start, and the iris opens again there. No-op while the gate is up.
   */
  rewind(onShut: () => void, now = performance.now()): void {
    if (this.state !== 'off') return;
    this.state = 'closing'; this.openedAt = now; this.onShut = onShut;
    this.root.classList.add('gated', 'gate-closing');
  }

  /** Opens the veil (a choice was made, or the visitor scrolled). */
  open(now = performance.now()): void {
    if (this.state !== 'waiting') return;
    this.state = 'opening'; this.openedAt = now; this.replay = false;
    this.root.classList.add('gate-opening');
    this.hint.textContent = attr(this.hint, 'ready');
    // the choice buttons are going: keyboard focus moves to the story's own controls, not to the page's top
    const active = document.activeElement as HTMLElement | null;
    if (active?.closest('#gate')) document.getElementById('sound')?.focus({ preventScroll: true });
  }

  /**
   * Every frame: the veil around the grain (`x`, `y`: the hero ring's centre on screen, CSS px) and the
   * entry's progress. Returns a 0..1 multiplier for the chapter's words: 0 while waiting, rising as the
   * iris opens, 1 once it is open or when there is no gate.
   */
  update(v: number, now: number, x: number, y: number): number {
    if (this.state === 'off') return 1;
    if (this.state === 'waiting' && v > SCROLL_ENTERS) this.open(now);
    const reduced = this.reduced();
    const sec = (now - this.openedAt) / 1000;
    if (this.state === 'closing' && sec >= (reduced ? FADE_S : CLOSE_S)) {
      this.state = 'shut'; this.openedAt = now;
      const shut = this.onShut; this.onShut = null; shut?.();
    } else if (this.state === 'shut' && sec >= SHUT_S) {
      this.state = 'opening'; this.openedAt = now; this.replay = true;
      this.root.classList.remove('gate-closing'); this.root.classList.add('gate-opening');
    }
    const closing = this.state === 'closing' || this.state === 'shut';
    const span = closing ? (reduced ? FADE_S : CLOSE_S) : reduced ? FADE_S : OPEN_S;
    const e = this.state === 'waiting' ? 0 : this.state === 'shut' ? 1 : Math.min(1, (now - this.openedAt) / 1000 / span);
    if (!closing && e >= 1) {
      this.state = 'off'; this.replay = false;
      this.root.classList.remove('gated', 'gate-opening', 'gate-closing');
      return 1;
    }
    // the farthest corner from the grain, and past it the feather too
    const far = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    // waiting: a small opening that breathes slowly; opening: it grows geometrically (an even widening to
    // the eye, slow around the grain, fast at the edges) until even the feather is off screen. Closing (a
    // rewind): the other way, down to nothing, the feather too, so the veil is whole; opening again after
    // it starts from that whole veil
    const breathe = reduced ? 0 : Math.sin(now / 1100) * 5;
    const k = reduced ? 0 : closing ? 1 - easeInOut(e) : easeInOut(e);
    const whole = closing || this.replay;
    const r0 = whole ? 2 : 38 + breathe, r1 = far * 1.05;
    const r = reduced && whole ? 0 : r0 * Math.pow(r1 / r0, k);
    const feather = reduced && whole ? 0 : (150 + r * .55) * (whole ? ss(0, .3, k) : 1);
    const opacity = reduced ? (closing ? e : 1 - e) : 1;
    const key = `${x.toFixed(0)},${y.toFixed(0)},${r.toFixed(0)},${feather.toFixed(0)},${opacity.toFixed(2)}`;
    if (key !== this.last) {
      this.last = key;
      const s = this.veil.style;
      s.setProperty('--vx', `${x.toFixed(0)}px`); s.setProperty('--vy', `${y.toFixed(0)}px`);
      s.setProperty('--vr', `${r.toFixed(0)}px`); s.setProperty('--vf', `${feather.toFixed(0)}px`);
      s.opacity = opacity.toFixed(2);
    }
    if (closing) return 1 - ss(0, .5, e); // the words go as it closes
    return reduced ? ss(.3, 1, e) : ss(.42, .92, e);
  }
}
