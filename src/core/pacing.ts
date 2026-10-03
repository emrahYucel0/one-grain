/**
 * Frame pacing. When a frame costs a little more than two display refreshes, frames land
 * alternately on two and three refreshes (13.9 / 20.8 ms on a 144 Hz panel), which judders worse
 * than a steady three. The pacer can then lock rendering to a fixed cadence: every n-th refresh.
 *
 *   off   never lock
 *   auto  lock only when frames mostly take three or more refreshes and at least 15 % of them come
 *         in faster: then they do not fit, and a steady cadence beats the mix. Frames that fit in
 *         one or two refreshes (60 Hz, 120 Hz at 16.7 ms) never engage it.
 *   on    lock to the most common cadence whenever it is two refreshes or more (measurements)
 *
 * Only rendering is paced: scroll input (ScrollTrigger runs on GSAP's own ticker) and the scrubbed
 * progress keep updating on every refresh; a skipped refresh simply draws nothing new.
 * The refresh interval is measured once, from rAF while nothing heavy draws (during loading).
 * A lock is released and re-evaluated on a resize, a quality step, a tab switch, and for one second
 * every ten seconds (a probe), since a locked cadence hides whether frames would fit again.
 */
export type PacingMode = 'off' | 'on' | 'auto';

const WINDOW_MS = 2000, MIN_FRAMES = 40, PROBE_EVERY_MS = 10000, PROBE_MS = 1000, QUIET_MS = 1500;
/** the slowest cadence it locks to (every 4th refresh: 36 fps at 144 Hz); slower frames are left as they come */
const MAX_LOCK = 4;

export interface PacingState { mode: PacingMode; refresh: number; lock: number; probing: boolean }

export class Pacer {
  readonly mode: PacingMode;
  /** the display's refresh interval, ms (0: unknown, no pacing) */
  refresh = 0;
  /** render every lock-th refresh; 0 = whenever ready */
  lock = 0;
  private lastRender = -1;
  private windowStart = -1;
  private deltas: number[] = [];
  private quietUntil = 0;
  private probeUntil = 0;
  private nextProbe = 0;

  constructor(mode: PacingMode) {
    this.mode = mode;
    document.addEventListener('visibilitychange', () => this.reset(performance.now()));
    addEventListener('resize', () => this.reset(performance.now()));
  }

  /** Measure the refresh interval: the median rAF interval over ~60 frames. Call while nothing heavy draws. */
  measureRefresh(): Promise<void> {
    if (this.mode === 'off') return Promise.resolve();
    return new Promise((done) => {
      const t: number[] = [];
      const f = (x: number): void => {
        t.push(x);
        if (t.length < 61) { requestAnimationFrame(f); return; }
        const d = t.slice(1).map((v, i) => v - t[i]!).sort((a, b) => a - b);
        const m = d[d.length >> 1]!;
        this.refresh = m > 3 && m < 50 ? m : 0; // 20–330 Hz; otherwise (hidden tab) unknown
        done();
      };
      requestAnimationFrame(f);
    });
  }

  /** Release any lock and wait a moment before judging again (resize, quality step, tab switch). */
  reset(now: number): void {
    this.lock = 0; this.deltas = []; this.windowStart = -1; this.lastRender = -1; this.probeUntil = 0;
    this.quietUntil = now + QUIET_MS;
  }

  /** On every rAF: whether this refresh renders. */
  shouldRender(now: number): boolean {
    if (!this.lock || this.lastRender < 0 || now < this.probeUntil) return true;
    return now - this.lastRender >= (this.lock - .5) * this.refresh;
  }

  /** After a rendered frame. */
  rendered(now: number): void {
    if (this.mode === 'off' || !this.refresh) return;
    const prev = this.lastRender;
    this.lastRender = now;
    if (prev < 0 || now < this.quietUntil) return;
    const probing = now < this.probeUntil;
    if (this.lock && !probing) {
      if (now >= this.nextProbe) { this.probeUntil = now + PROBE_MS; this.deltas = []; this.windowStart = now; return; }
      // while locked: one step slower only if most frames of a second miss the cadence (occasional misses do not count)
      if (this.windowStart < 0) this.windowStart = now;
      this.deltas.push(now - prev);
      if (now - this.windowStart >= 1000) {
        const slow = this.deltas.filter((d) => d > (this.lock + .5) * this.refresh).length / this.deltas.length;
        if (slow >= .5 && this.lock < MAX_LOCK) this.lock++;
        this.deltas = []; this.windowStart = -1;
      }
      return;
    }
    if (this.windowStart < 0) this.windowStart = now;
    this.deltas.push(now - prev);
    if (now - this.windowStart >= (probing ? PROBE_MS : WINDOW_MS) && this.deltas.length >= (probing ? MIN_FRAMES / 2 : MIN_FRAMES)) this.decide(now);
  }

  get state(): PacingState { return { mode: this.mode, refresh: this.refresh, lock: this.lock, probing: performance.now() < this.probeUntil }; }

  private decide(now: number): void {
    const counts = new Map<number, number>();
    for (const d of this.deltas) { const k = Math.max(1, Math.round(d / this.refresh)); counts.set(k, (counts.get(k) ?? 0) + 1); }
    const n = this.deltas.length;
    let mode = 1, best = 0;
    for (const [k, c] of counts) if (c > best || (c === best && k > mode)) { mode = k; best = c; }
    const faster = [...counts].filter(([k]) => k < mode).reduce((s, [, c]) => s + c, 0) / n;
    const lock = mode > MAX_LOCK ? 0 // too slow for a cadence to help
      : this.mode === 'on' ? (mode >= 2 ? mode : 0)
      : mode >= 3 && faster >= .15 ? mode : 0;
    this.lock = lock;
    this.deltas = []; this.windowStart = -1; this.probeUntil = 0;
    if (lock) this.nextProbe = now + PROBE_EVERY_MS;
  }
}
