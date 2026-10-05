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
  private disarm = (): void => {};

  constructor(button: HTMLButtonElement) {
    this.button = button;
    button.textContent = attr(button, 'listen');
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
      const arm = (e: Event): void => { if (!button.contains(e.target as Node)) void this.set(true); };
      addEventListener('pointerdown', arm); addEventListener('keydown', arm);
      this.disarm = () => { removeEventListener('pointerdown', arm); removeEventListener('keydown', arm); this.disarm = () => {}; };
    }
  }

  get on(): boolean { return !!this.sound?.on; }

  private async set(on: boolean): Promise<void> {
    this.disarm();
    const b = this.button;
    if (on && !this.sound) {
      const { Sound } = await load();
      this.sound = Sound.create(flags.parity);
      if (!this.sound) { b.textContent = attr(b, 'unavailable'); return; }
      exposeAudio(this.sound);
    }
    if (!this.sound) return;
    this.sound.setOn(on);
    b.setAttribute('aria-pressed', String(on));
    b.textContent = attr(b, on ? 'on' : 'off');
    writePref(on);
  }
}
