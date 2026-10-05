import { env } from '../core/env';
import { attr } from './copy';

const KEY = 'og-motion';
const readPref = (): string | null => { try { return localStorage.getItem(KEY); } catch { return null; } };
const writePref = (on: boolean): void => { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* private mode: not remembered */ } };
const system = matchMedia('(prefers-reduced-motion: reduce)');

/**
 * The motion button (WCAG 2.2.2 Pause, Stop, Hide): "Motion on" / "Motion off" (aria-pressed).
 * Off gives the reduced-motion experience: ambient motion stops, worlds swap behind a short fade,
 * no camera parallax or punch; scrolling still drives the story. It starts as the system setting
 * says; the visitor's choice is remembered and wins. html.motion-off mirrors it for the styles.
 */
export class MotionToggle {
  private readonly button: HTMLButtonElement;
  private chosen: boolean;

  constructor(button: HTMLButtonElement) {
    this.button = button;
    const pref = readPref();
    this.chosen = pref === 'on' || pref === 'off';
    this.apply(this.chosen ? pref === 'on' : !system.matches);
    button.addEventListener('click', () => { this.chosen = true; this.apply(env.reduced); writePref(!env.reduced); });
    system.addEventListener('change', (e) => { if (!this.chosen) this.apply(!e.matches); });
  }

  private apply(on: boolean): void {
    env.reduced = !on;
    document.documentElement.classList.toggle('motion-off', !on);
    this.button.setAttribute('aria-pressed', String(on));
    this.button.textContent = attr(this.button, on ? 'on' : 'off');
  }
}
