import { exposeAudio, flags } from '../debug/parity';
import { attr } from '../ui/copy';
import { Sound } from './frame';

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
    button.addEventListener('click', () => this.set(!this.on));
    document.addEventListener('visibilitychange', () => {
      const s = this.sound;
      if (!s) return;
      if (document.hidden) void s.engine.ctx.suspend(); else if (s.on) void s.engine.ctx.resume();
    });
    if (readPref()) {
      const arm = (e: Event): void => { if (!button.contains(e.target as Node)) this.set(true); };
      addEventListener('pointerdown', arm); addEventListener('keydown', arm);
      this.disarm = () => { removeEventListener('pointerdown', arm); removeEventListener('keydown', arm); this.disarm = () => {}; };
    }
  }

  get on(): boolean { return !!this.sound?.on; }

  private set(on: boolean): void {
    this.disarm();
    const b = this.button;
    if (on && !this.sound) {
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
