import { easeCubic, easeQuint, ss } from '../core/ease';

/** How long the story takes to run back from the ending to its start (s). */
const REWIND_S = 4.2;

/**
 * Away from the ending at once (its hold is long and still), fast through the middle of the story, slow
 * into its start: the second part of an ease-in-out, entered a little way in.
 */
const IN = .2, eased = (x: number): number => (easeCubic(x) + easeQuint(x)) / 2, E0 = eased(IN);
const curve = (k: number): number => (eased(IN + (1 - IN) * k) - E0) / (1 - E0);

/**
 * Start again (Awwwards P3): the story runs back to its start instead of cutting there behind a closed
 * veil. The sand flows back through every world, the clock counts the years back down to 0, and as the
 * first world comes in the camera pushes in onto the grain; from there the opening's pull-back takes
 * over (ui/gate.ts). The words, the ending's choices and the "One day," card stay out of the way while
 * it runs; html.rewinding is set for that long. With motion off the gate's veil does it instead.
 */
export class Rewind {
  private at = -1;
  private from = 1;
  private onDone: (() => void) | null = null;
  private readonly root = document.documentElement;

  get active(): boolean { return this.at >= 0; }

  start(from: number, now: number, onDone: () => void): void {
    if (this.at >= 0) return;
    this.at = now; this.from = Math.max(0, Math.min(1, from)); this.onDone = onDone;
    this.root.classList.add('rewinding');
  }

  /** The story's progress while it runs (null otherwise); at its end the story is handed back to the scroll. */
  value(now: number): number | null {
    if (this.at < 0) return null;
    const k = Math.min(1, (now - this.at) / 1000 / REWIND_S);
    if (k >= 1) {
      this.at = -1;
      this.root.classList.remove('rewinding');
      const done = this.onDone; this.onDone = null; done?.();
      return null;
    }
    return this.from * (1 - curve(k));
  }

  /** The camera's push onto the grain (0..1), over the run's last part. */
  pull(now: number): number {
    if (this.at < 0) return 0;
    return ss(.72, 1, (now - this.at) / 1000 / REWIND_S);
  }
}
