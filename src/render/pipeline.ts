import { Color, type Camera, type Scene, type Vector3, type WebGLRenderer } from 'three';
import type { GpuTimer } from '../core/gpu-timer';
import { PostChain, type PostFrame } from './post';
import { ShadowMap } from './shadow';

export interface PipelineFrame {
  grains: Scene;
  /** drawn over the grains without clearing (the hero grain) */
  overlay: Scene;
  camera: Camera;
  shadows: boolean;
  /** refresh the shadow map every n-th frame (2; ?shadowevery measures 3 at rest) */
  shadowEvery?: number;
  /** the stage colour, linear: the HDR target is cleared to it */
  clear: Vector3;
  /** debug: grains straight to the screen on black, no post (the overdraw view counts brightness) */
  direct: boolean;
  post: PostFrame;
}

/**
 * The frame's render passes, in order, each timed on the GPU (core/gpu-timer.ts):
 *   shadow     the key light's shadow map (every other frame, see render/shadow.ts)
 *   grains     the grain cloud, into the HDR target
 *   hero       the grain the story follows, drawn over everything (no clear in between)
 *   bloom, dof, composite   the post chain (render/post.ts)
 */
export class Pipeline {
  private readonly renderer: WebGLRenderer;
  private readonly timer: GpuTimer;
  readonly shadow = new ShadowMap();
  private readonly post = new PostChain();
  private readonly clear = new Color();

  constructor(renderer: WebGLRenderer, timer: GpuTimer) { this.renderer = renderer; this.timer = timer; }

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
    timer.begin('grains');
    renderer.render(f.grains, f.camera);
    timer.end();
    timer.begin('hero');
    renderer.render(f.overlay, f.camera);
    timer.end();
    renderer.autoClear = autoClear;
    if (!f.direct) post.render(renderer, timer, f.post);
  }
}
