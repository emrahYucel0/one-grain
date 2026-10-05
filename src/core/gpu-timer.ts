/**
 * GPU time per render pass (EXT_disjoint_timer_query_webgl2). Each pass is wrapped in a
 * TIME_ELAPSED query; results arrive a few frames later and are smoothed per pass. Frames the
 * driver marks as disjoint (power state change, context switch) are thrown away. Only one query
 * can run at a time, so passes are timed back to back, never nested.
 *
 * A development tool: enabled only with ?perf or ?debug (main.ts). Otherwise, and without the
 * extension, begin/end cost nothing and only the CPU frame interval is reported; a normal visit
 * measures nothing and nothing it measures changes what the site does.
 */
interface TimerExt { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number }
interface Pending { name: string; query: WebGLQuery; frame: number }

/** One frame's passes as measured, unsmoothed. */
export interface FrameSample { total: number; passes: Record<string, number> }

/** How many raw frames to keep. */
const RECENT = 240;

export interface GpuTimes {
  /** smoothed GPU milliseconds per pass, in pass order */
  passes: Record<string, number>;
  /** sum of the passes */
  total: number;
  /** smoothed CPU interval between frames, milliseconds (always available) */
  frame: number;
  /** whether passes are measured on the GPU */
  gpu: boolean;
  /** the last frames, raw, oldest first (frames the driver marked disjoint are left out) */
  recent: readonly FrameSample[];
}

const SMOOTH = .1;

export class GpuTimer {
  readonly gpu: boolean;
  /** ?perf or ?debug: otherwise every call returns at once */
  private readonly enabled: boolean;
  private readonly gl: WebGL2RenderingContext;
  private readonly ext: TimerExt | null;
  private readonly free: WebGLQuery[] = [];
  private readonly pending: Pending[] = [];
  private readonly ms = new Map<string, number>();
  private active: Pending | null = null;
  private lastFrame = -1;
  private frameMs = 0;
  private frameNo = 0;
  private sample: (FrameSample & { frame: number; ok: boolean }) | null = null;
  private readonly recent: FrameSample[] = [];

  constructor(gl: WebGL2RenderingContext, enabled: boolean) {
    this.gl = gl;
    this.enabled = enabled;
    this.ext = enabled ? (gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExt | null) : null;
    this.gpu = !!this.ext;
  }

  begin(name: string): void {
    if (!this.ext || this.active) return;
    const query = this.free.pop() ?? this.gl.createQuery();
    if (!query) return;
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, query);
    this.active = { name, query, frame: this.frameNo };
  }

  end(): void {
    if (!this.ext || !this.active) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pending.push(this.active);
    this.active = null;
  }

  /** Once per frame: collect finished queries and the CPU frame interval. */
  tick(now?: number): void {
    if (!this.enabled) return;
    now ??= performance.now();
    if (this.lastFrame >= 0) { const d = now - this.lastFrame; this.frameMs = this.frameMs ? this.frameMs + (d - this.frameMs) * SMOOTH : d; }
    this.lastFrame = now;
    this.frameNo++;
    if (!this.ext) return;
    const gl = this.gl;
    const disjoint = gl.getParameter(this.ext.GPU_DISJOINT_EXT) as boolean;
    while (this.pending.length) {
      const p = this.pending[0]!;
      if (!gl.getQueryParameter(p.query, gl.QUERY_RESULT_AVAILABLE)) break;
      this.pending.shift();
      if (this.sample && this.sample.frame !== p.frame) this.closeSample();
      this.sample ??= { frame: p.frame, ok: true, total: 0, passes: {} };
      if (!disjoint) {
        const v = (gl.getQueryParameter(p.query, gl.QUERY_RESULT) as number) / 1e6, prev = this.ms.get(p.name);
        this.ms.set(p.name, prev === undefined ? v : prev + (v - prev) * SMOOTH);
        this.sample.total += v; this.sample.passes[p.name] = v;
      } else this.sample.ok = false;
      this.free.push(p.query);
    }
  }

  times(): GpuTimes {
    const passes = Object.fromEntries(this.ms);
    return { passes, total: [...this.ms.values()].reduce((a, b) => a + b, 0), frame: this.frameMs, gpu: this.gpu, recent: this.recent };
  }

  /** A frame's queries resolve in order: the first query of a newer frame closes the previous one. */
  private closeSample(): void {
    const s = this.sample!;
    this.sample = null;
    if (!s.ok) return;
    this.recent.push({ total: s.total, passes: s.passes });
    if (this.recent.length > RECENT) this.recent.shift();
  }
}
