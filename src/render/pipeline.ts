import { Color, type Camera, type Scene, type Vector3, type WebGLRenderer } from 'three';
import type { GpuTimer } from '../core/gpu-timer';
import { PostChain, type CompileOne, type PostFrame } from './post';
import { ShadowMap } from './shadow';
import { LoupePass, type LoupeFrame } from './loupe';
import { SKY_MIN, SkyPass, type SkyFrame } from './sky';

export interface PipelineFrame {
  grains: Scene;
  /** drawn over the grains without clearing (the hero grain) */
  overlay: Scene;
  camera: Camera;
  shadows: boolean;
  /** refresh the shadow map every n-th frame (render/shadow.ts SHADOW_EVERY) */
  shadowEvery?: number;
  /** the stage colour, linear: the HDR target is cleared to it */
  clear: Vector3;
  /** the sky behind the grains, where the world has one (null: the stage colour alone) */
  sky: SkyFrame | null;
  /** the loupe's lens, drawn over the finished picture (null: none this frame) */
  loupe: LoupeFrame | null;
  /** debug: grains straight to the screen on black, no post (the overdraw view counts brightness) */
  direct: boolean;
  post: PostFrame;
}

/**
 * The frame's render passes, in order, each timed on the GPU (core/gpu-timer.ts):
 *   shadow     the key light's shadow map (every 3rd frame at rest, every other while moving; render/shadow.ts)
 *   sky        the sky behind the grains, only where the world has one (render/sky.ts)
 *   grains     the grain cloud, into the HDR target
 *   hero       the grain the story follows, drawn over everything (no clear in between)
 *   bloom, dof, composite   the post chain (render/post.ts)
 *   loupe      the hero grain magnified, in its own square of the canvas, at five chapters (render/loupe.ts)
 */
export class Pipeline {
  private readonly renderer: WebGLRenderer;
  private readonly timer: GpuTimer;
  readonly shadow = new ShadowMap();
  private readonly post: PostChain;
  private readonly sky = new SkyPass();
  private readonly loupe = new LoupePass();
  /** whether the post chain renders to half-float targets (render/post.ts) */
  readonly hdr: boolean;
  private readonly clear = new Color();

  constructor(renderer: WebGLRenderer, timer: GpuTimer) {
    this.renderer = renderer; this.timer = timer;
    this.hdr = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
    this.post = new PostChain(this.hdr);
  }

  /**
   * Compile every program the first frame needs (the grains and their shadow variant, the overlay,
   * the post passes) while the worlds are built, in parallel where the browser can: otherwise they
   * would all compile inside the first frame, one long task on a slow CPU.
   */
  compile(scene: Scene, overlay: Scene, camera: Camera): Promise<unknown> {
    // a program depends on where it draws (the screen or a target: colour space, tone mapping), so each
    // is compiled against the target the frame uses; compileAsync takes that state when it is called
    // without KHR_parallel_shader_compile (some Firefox and Safari setups) compileAsync only warns and
    // waits, so those browsers compile synchronously, still during loading rather than in the first frame
    const r = this.renderer, jobs: Promise<unknown>[] = [];
    const parallel = r.extensions.has('KHR_parallel_shader_compile');
    const one: CompileOne = (s, c) => (parallel ? r.compileAsync(s, c) : (r.compile(s, c), Promise.resolve()));
    this.post.fit(r);
    r.setRenderTarget(this.shadow.target); jobs.push(one(this.shadow.scene, this.shadow.camera));
    r.setRenderTarget(this.post.scene); jobs.push(one(scene, camera), one(overlay, camera), this.sky.compile(one));
    jobs.push(this.post.compile(r, one));
    r.setRenderTarget(null);
    // then each program's uniform table, one per task: three.js reads it with a synchronous WebGL call per
    // uniform on a program's first use, which would otherwise all land in the first frame
    return Promise.all(jobs).then(async () => {
      for (const p of r.info.programs ?? []) { await new Promise((ok) => setTimeout(ok)); p.getUniforms(); }
    });
  }

  /**
   * Capture mode's unrecorded frames: everything a frame does to state, without drawing. The shadow
   * map's cadence advances as if drawn (a later drawn frame refreshes on the same frames).
   */
  skip(shadows: boolean, every?: number): void {
    if (!shadows) this.shadow.invalidate(); else this.shadow.due(every);
  }

  /** The loupe's program, compiled once the scene runs (render/loupe.ts); call after the first frame. */
  prepareLoupe(): void { this.loupe.prepare(this.renderer); }

  render(f: PipelineFrame): void {
    const { renderer, timer, shadow, post } = this;
    if (!f.shadows) shadow.invalidate();
    else if (shadow.due(f.shadowEvery)) {
      timer.begin('shadow');
      shadow.render(renderer);
      timer.end();
    }
    if (f.direct) {
      renderer.setRenderTarget(null);
      this.clear.setRGB(0, 0, 0);
    } else {
      post.fit(renderer);
      renderer.setRenderTarget(post.scene);
      this.clear.setRGB(f.clear.x, f.clear.y, f.clear.z);
    }
    renderer.setClearColor(this.clear, 1);
    renderer.clear();
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    if (f.sky && !f.direct && f.sky.state.amount > SKY_MIN) {
      timer.begin('sky');
      this.sky.render(renderer, f.sky);
      timer.end();
    }
    timer.begin('grains');
    renderer.render(f.grains, f.camera);
    timer.end();
    timer.begin('hero');
    renderer.render(f.overlay, f.camera);
    timer.end();
    renderer.autoClear = autoClear;
    if (!f.direct) post.render(renderer, timer, f.post);
    if (f.loupe && !f.direct && this.loupe.ready) {
      timer.begin('loupe');
      renderer.setRenderTarget(null);
      renderer.autoClear = false;
      this.loupe.render(renderer, f.loupe);
      renderer.autoClear = autoClear;
      timer.end();
    }
  }
}
