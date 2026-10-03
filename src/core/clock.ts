/**
 * The shader clock. Advances by real frame time, but never more than 50 ms per frame (so a
 * stalled tab or a long frame does not make every grain jump), and stands still while frozen
 * (reduced motion). Starts at 0 on the first tick, like THREE.Clock in the reference.
 */
export class FixedClock {
  static readonly MAX_STEP = .05;
  time = 0;
  private last = -1;

  tick(frozen: boolean, now: number = performance.now()): number {
    const dt = this.last < 0 ? 0 : Math.min((now - this.last) / 1000, FixedClock.MAX_STEP);
    this.last = now;
    if (!frozen) this.time += dt;
    return dt;
  }
}
