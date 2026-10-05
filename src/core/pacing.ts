/**
 * Frame pacing. When a frame costs a little more than two display refreshes, frames land
 * alternately on two and three refreshes (13.9 / 20.8 ms on a 144 Hz panel), which judders worse
 * than a steady three. The pacer can then lock rendering to a fixed cadence: every n-th refresh.
 *
 *   off   never lock
 *   auto  (the default) lock only when frames mostly take three or more refreshes and at least 15 % of them come
 *         in faster: then they do not fit, and a steady cadence beats the mix. Frames that fit in
 *         one or two refreshes (60 Hz, 120 Hz at 16.7 ms) never engage it.
 *   on    lock to the most common cadence whenever it is two refreshes or more (measurements)
 *
 * Only rendering is paced: scroll input (ScrollTrigger runs on GSAP's own ticker) and the scrubbed
 * progress keep updating on every refresh; a skipped refresh simply draws nothing new.
 * The refresh interval is measured in every mode (?debug shows it), from 60 rAF intervals during
 * loading; the estimate is the interval the samples are whole multiples of, so frames that span two
 * or three refreshes do not fool it. An unusable sample (a hidden tab, a busy machine) is retried a
 * second later, up to five times, and again whenever the tab becomes visible while still unknown.
 * A lock is released and re-evaluated on a resize, a quality step, a tab switch, and for one second
 * every ten seconds (a probe), since a locked cadence hides whether frames would fit again.
 */
export type PacingMode = 'off' | 'on' | 'auto';

/**
 * The display's refresh interval from rAF intervals (ms), or 0 when they do not say. The 10th
 * percentile divided by 1–4: the smallest divisor that leaves (nearly) every interval a whole
 * multiple, within 20–330 Hz, refined as the median interval per refresh. Idle loading frames give the interval itself; rendered frames that
 * mix two and three refreshes give it too (14 and 21 ms → 7 ms).
 */
export function refreshFrom(deltas: readonly number[]): number {
  const d = deltas.filter((x) => x > 0).sort((a, b) => a - b);
  if (d.length < 20) return 0;
  const base = d[Math.floor(d.length * .1)]!;
  for (let k = 1; k <= 4; k++) {
    const r = base / k;
    if (r <= 3 || r >= 50) continue;
    const fits = d.filter((x) => Math.abs(x / r - Math.round(x / r)) < .15);
    if (fits.length < d.length * .85) continue;
    // refined: the median of each fitting interval divided by its whole multiple
    const per = fits.map((x) => x / Math.max(1, Math.round(x / r))).sort((a, b) => a - b);
    return per[per.length >> 1]!;
  }
  return 0;
}

const WINDOW_MS = 2000, MIN_FRAMES = 40, PROBE_EVERY_MS = 10000, PROBE_MS = 1000, QUIET_MS = 1500;
/** the slowest cadence it locks to (every 4th refresh: 36 fps at 144 Hz); slower frames are left as they come */
const MAX_LOCK = 4;

/**
 * The cadence a window of frame intervals asks for (0: render whenever ready). Each interval counts
 * as a whole number of refreshes; the most common one is the mode. auto locks only when the mode is
 * three refreshes or more and at least 15 % of the frames came faster (they do not fit, and a steady
 * cadence beats the mix); on locks whenever the mode is two or more; never beyond MAX_LOCK.
 */
export function lockFor(deltas: readonly number[], refresh: number, mode: PacingMode): number {
  if (mode === 'off' || !refresh || !deltas.length) return 0;
  const counts = new Map<number, number>();
  for (const d of deltas) { const k = Math.max(1, Math.round(d / refresh)); counts.set(k, (counts.get(k) ?? 0) + 1); }
  let most = 1, best = 0;
  for (const [k, c] of counts) if (c > best || (c === best && k > most)) { most = k; best = c; }
  const faster = [...counts].filter(([k]) => k < most).reduce((s, [, c]) => s + c, 0) / deltas.length;
  if (most > MAX_LOCK) return 0; // too slow for a cadence to help
  return mode === 'on' ? (most >= 2 ? most : 0) : most >= 3 && faster >= .15 ? most : 0;
}

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
    document.addEventListener('visibilitychange', () => {
      this.reset(performance.now());
      if (!document.hidden && !this.refresh) void this.measureRefresh(1);
    });
    addEventListener('resize', () => this.reset(performance.now()));
  }

  /** Measure the refresh interval (see above); resolves once known or given up. */
  measureRefresh(tries = 5): Promise<void> {
    return new Promise((done) => {
      const t: number[] = [];
      const f = (x: number): void => {
        t.push(x);
        if (t.length < 61) { requestAnimationFrame(f); return; }
        this.refresh = refreshFrom(t.slice(1).map((v, i) => v - t[i]!));
        if (this.refresh || tries <= 1) { done(); return; }
        setTimeout(() => void this.measureRefresh(tries - 1).then(done), 1000);
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
    const lock = lockFor(this.deltas, this.refresh, this.mode);
    this.lock = lock;
    this.deltas = []; this.windowStart = -1; this.probeUntil = 0;
    if (lock) this.nextProbe = now + PROBE_EVERY_MS;
  }

}
