/**
 * GPU time per render pass (EXT_disjoint_timer_query_webgl2). Each pass is wrapped in a
 * TIME_ELAPSED query; results arrive a few frames later and are smoothed per pass. Frames the
 * driver marks as disjoint (power state change, context switch) are thrown away. Only one query
 * can run at a time, so passes are timed back to back, never nested.
 *
 * Without the extension, or when switched off, begin/end cost nothing and only the CPU frame
 * interval is reported.
 */
interface TimerExt { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number }
interface Pending { name: string; query: WebGLQuery }

export interface GpuTimes {
  /** smoothed GPU milliseconds per pass, in pass order */
  passes: Record<string, number>;
  /** sum of the passes */
  total: number;
  /** smoothed CPU interval between frames, milliseconds (always available) */
  frame: number;
  /** whether passes are measured on the GPU */
  gpu: boolean;
}

const SMOOTH = .1;

export class GpuTimer {
  readonly gpu: boolean;
  private readonly gl: WebGL2RenderingContext;
  private readonly ext: TimerExt | null;
  private readonly free: WebGLQuery[] = [];
  private readonly pending: Pending[] = [];
  private readonly ms = new Map<string, number>();
  private active: Pending | null = null;
  private lastFrame = -1;
  private frameMs = 0;

  constructor(gl: WebGL2RenderingContext, enabled: boolean) {
    this.gl = gl;
    this.ext = enabled ? (gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExt | null) : null;
    this.gpu = !!this.ext;
  }

  begin(name: string): void {
    if (!this.ext || this.active) return;
    const query = this.free.pop() ?? this.gl.createQuery();
    if (!query) return;
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, query);
    this.active = { name, query };
  }

  end(): void {
    if (!this.ext || !this.active) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pending.push(this.active);
    this.active = null;
  }

  /** Once per frame: collect finished queries and the CPU frame interval. */
  tick(now: number = performance.now()): void {
    if (this.lastFrame >= 0) { const d = now - this.lastFrame; this.frameMs = this.frameMs ? this.frameMs + (d - this.frameMs) * SMOOTH : d; }
    this.lastFrame = now;
    if (!this.ext) return;
    const gl = this.gl;
    const disjoint = gl.getParameter(this.ext.GPU_DISJOINT_EXT) as boolean;
    while (this.pending.length) {
      const p = this.pending[0]!;
      if (!gl.getQueryParameter(p.query, gl.QUERY_RESULT_AVAILABLE)) break;
      this.pending.shift();
      if (!disjoint) {
        const v = (gl.getQueryParameter(p.query, gl.QUERY_RESULT) as number) / 1e6, prev = this.ms.get(p.name);
        this.ms.set(p.name, prev === undefined ? v : prev + (v - prev) * SMOOTH);
      }
      this.free.push(p.query);
    }
  }

  times(): GpuTimes {
    const passes = Object.fromEntries(this.ms);
    return { passes, total: [...this.ms.values()].reduce((a, b) => a + b, 0), frame: this.frameMs, gpu: this.gpu };
  }
}
