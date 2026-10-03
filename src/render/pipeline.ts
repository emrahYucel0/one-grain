import type { Camera, Scene, WebGLRenderer } from 'three';
import type { GpuTimer } from '../core/gpu-timer';
import { ShadowMap } from './shadow';

/**
 * The frame's render passes, in order, each timed on the GPU (core/gpu-timer.ts):
 *   shadow  the key light's shadow map (every other frame, see render/shadow.ts)
 *   grains  the grain cloud
 *   hero    the grain the story follows, drawn over everything (no clear in between)
 */
export class Pipeline {
  private readonly renderer: WebGLRenderer;
  private readonly timer: GpuTimer;
  readonly shadow = new ShadowMap();

  constructor(renderer: WebGLRenderer, timer: GpuTimer) { this.renderer = renderer; this.timer = timer; }

  render(grains: Scene, overlay: Scene, camera: Camera, shadows: boolean): void {
    const { renderer, timer, shadow } = this;
    if (!shadows) shadow.invalidate();
    else if (shadow.due()) {
      timer.begin('shadow');
      shadow.render(renderer);
      timer.end();
    }
    timer.begin('grains');
    renderer.render(grains, camera);
    timer.end();
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    timer.begin('hero');
    renderer.render(overlay, camera);
    timer.end();
    renderer.autoClear = autoClear;
  }
}
