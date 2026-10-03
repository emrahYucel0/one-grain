/**
 * Pointer state. A mouse hovers (and steers a little camera parallax); a touch or pen tap
 * counts as a press for 1.4 s at the tapped spot.
 */
export class Pointer {
  /** -0.5..0.5 from the centre of the window, and its smoothed follower */
  x = 0; y = 0; sx = 0; sy = 0;
  /** normalised device coordinates of the last hover or tap */
  nx = 0; ny = 0;
  /** a mouse has moved over the page */
  hovering = false;
  /** press strength, eases towards 1 while a tap is active */
  press = 0;
  /** a tap is active until this time (performance.now) */
  until = 0;

  constructor() {
    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      this.hovering = true;
      this.x = e.clientX / innerWidth - .5; this.y = e.clientY / innerHeight - .5;
      this.nx = e.clientX / innerWidth * 2 - 1; this.ny = -(e.clientY / innerHeight) * 2 + 1;
    }, { passive: true });
    addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      this.nx = e.clientX / innerWidth * 2 - 1; this.ny = -(e.clientY / innerHeight) * 2 + 1;
      this.until = performance.now() + 1400; this.press = 1;
    }, { passive: true });
  }

  /** Once per frame, before the camera is placed. */
  smooth(): void { this.sx += (this.x - this.sx) * .05; this.sy += (this.y - this.sy) * .05; }

  tapping(now: number): boolean { return now < this.until; }
}
