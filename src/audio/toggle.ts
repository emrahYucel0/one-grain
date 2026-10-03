import { attr } from '../ui/copy';
import { createBed, type Bed } from './bed';

/** Sound is off by default and only ever starts from the visitor's own click. */
export class SoundToggle {
  bed: Bed | null = null;

  constructor(button: HTMLButtonElement) {
    button.addEventListener('click', () => {
      if (!this.bed) this.bed = createBed();
      const bed = this.bed;
      if (!bed) { button.textContent = attr(button, 'unavailable'); return; }
      bed.on = !bed.on;
      void bed.ctx.resume();
      bed.master.gain.setTargetAtTime(bed.on ? .55 : 0, bed.ctx.currentTime, .3);
      button.setAttribute('aria-pressed', String(bed.on));
      button.textContent = attr(button, bed.on ? 'on' : 'off');
    });
  }
}
