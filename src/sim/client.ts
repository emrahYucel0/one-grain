import { isGrainPack, type GrainPack } from './pack';
import type { SimRequest } from './sim.worker';

type Reply = { id: number; pack?: unknown; error?: string; progress?: number };
type Pending = { n: number; resolve: (p: GrainPack) => void; reject: (e: Error) => void; progress?: (p: number) => void };

/**
 * Asks the simulation worker for grain packs. If module workers are unavailable, builds on
 * the main thread instead (same code, same result, just blocking).
 */
export class SimClient {
  private worker: Worker | null = null;
  private seq = 0;
  private readonly pending = new Map<number, Pending>();

  constructor() {
    try {
      this.worker = new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent<Reply>) => this.settle(e.data);
      this.worker.onerror = (e) => { e.preventDefault(); this.abandonWorker(); };
    } catch {
      this.worker = null;
    }
  }

  /** Build a pack of n grains per world; `progress` hears 0..1 as the worker finishes each world. */
  build(n: number, progress?: (p: number) => void): Promise<GrainPack> {
    return new Promise<GrainPack>((resolve, reject) => {
      const id = ++this.seq;
      this.pending.set(id, { n, resolve, reject, progress });
      if (this.worker) this.worker.postMessage({ id, n } satisfies SimRequest);
      else void this.buildHere(id);
    });
  }

  private settle({ id, pack, error, progress }: Reply): void {
    const p = this.pending.get(id);
    if (!p) return;
    if (progress !== undefined) { p.progress?.(progress); return; }
    this.pending.delete(id);
    if (error !== undefined) p.reject(new Error(error));
    else if (!isGrainPack(pack)) p.reject(new Error('unsupported grain pack version'));
    else p.resolve(pack);
  }

  private abandonWorker(): void {
    this.worker?.terminate();
    this.worker = null;
    for (const id of this.pending.keys()) void this.buildHere(id);
  }

  private async buildHere(id: number): Promise<void> {
    const p = this.pending.get(id);
    if (!p) return;
    const { buildPack } = await import('./build');
    this.settle({ id, pack: buildPack(p.n) });
  }
}
