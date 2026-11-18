import { exposeAudio, flags } from '../debug/parity';
import { attr } from '../ui/copy';
import type { Sound } from './frame';

/** The sound's code (engine, score, ambience) loads when the visitor shows they may want it. */
const load = (): Promise<typeof import('./frame')> => import('./frame');

const KEY = 'og-sound';
const readPref = (): boolean => { try { return localStorage.getItem(KEY) === 'on'; } catch { return false; } };
const writePref = (on: boolean): void => { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* private mode: not remembered */ } };

/**
 * The sound button. It reads "Listen" until sound is first enabled, then "Sound on" / "Sound off"
 * (aria-pressed). Sound is off by default, and nothing is created or played before the visitor asks.
 * The choice is remembered: a returning visitor who chose sound gets it on their first gesture
 * (a gesture on the button itself is left to the button, which would otherwise switch it straight
 * back off). The audio is suspended while the tab is hidden.
 */
export class SoundToggle {
  sound: Sound | null = null;
  private readonly button: HTMLButtonElement;
  /** the button's words (its icon beside them is aria-hidden and empty) */
  private readonly label: HTMLElement;
  private disarm = (): void => {};

  constructor(button: HTMLButtonElement) {
    this.button = button;
    this.label = button.querySelector<HTMLElement>('.lbl') ?? button;
    this.label.textContent = attr(button, 'listen');
    button.addEventListener('click', () => void this.set(!this.on));
    // fetched on intent (a pointer over the button, focus, a touch), so the click that follows still
    // counts as the gesture that starts the audio, and nobody who never asks for sound downloads it
    for (const ev of ['pointerenter', 'focus', 'touchstart']) button.addEventListener(ev, () => void load(), { once: true, passive: true });
    document.addEventListener('visibilitychange', () => {
      const s = this.sound;
      if (!s) return;
      const ctx = s.engine.ctx as AudioContext; // the visitor's sound is always a realtime context
      if (document.hidden) void ctx.suspend(); else if (s.on) void ctx.resume();
    });
    if (readPref()) {
      void load(); // they chose sound before: it will start on their first gesture
      // a gesture on the button, or on the entry gate's choice (ui/gate.ts), is left to them
      const arm = (e: Event): void => { if (!button.contains(e.target as Node) && !(e.target as Element | null)?.closest?.('[data-sound-choice]')) void this.set(true); };
      addEventListener('pointerdown', arm); addEventListener('keydown', arm);
      this.disarm = () => { removeEventListener('pointerdown', arm); removeEventListener('keydown', arm); this.disarm = () => {}; };
    }
  }

  get on(): boolean { return !!this.sound?.on; }

  /** The sound's code, fetched ahead of a click that may ask for it (the entry gate's "with sound"). */
  preload(): void { void load(); }

  /** The visitor chose: sound on or off, as if they had pressed the button (the entry gate). */
  choose(on: boolean): void { if (on !== this.on) void this.set(on); else { this.disarm(); if (!on) writePref(false); } }

  private async set(on: boolean): Promise<void> {
    this.disarm();
    const b = this.button;
    if (on && !this.sound) {
      const { Sound } = await load();
      this.sound = Sound.create(flags.parity);
      if (!this.sound) { this.label.textContent = attr(b, 'unavailable'); return; }
      exposeAudio(this.sound);
    }
    if (!this.sound) return;
    this.sound.setOn(on);
    b.setAttribute('aria-pressed', String(on));
    this.label.textContent = attr(b, on ? 'on' : 'off');
    writePref(on);
  }
}
