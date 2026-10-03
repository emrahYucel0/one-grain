import { ColorManagement, LinearSRGBColorSpace, PerspectiveCamera, Scene, WebGLRenderer } from 'three';

// Parity with the reference (three r149, legacy colour mode): hex colours reach the shaders
// as-is and shader output reaches the screen as-is. Modern three would convert both.
ColorManagement.enabled = false;

export interface Stage {
  renderer: WebGLRenderer;
  /** the grains */
  scene: Scene;
  /** drawn over the grains without clearing (the hero grain) */
  overlay: Scene;
  camera: PerspectiveCamera;
}

export function createStage(canvas: HTMLCanvasElement, pixelRatio: number): Stage {
  const renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.outputColorSpace = LinearSRGBColorSpace;
  renderer.debug.checkShaderErrors = import.meta.env.DEV;
  renderer.setPixelRatio(pixelRatio);
  // the clear colour follows the act from the first frame on (core/stage-colour.ts)
  return { renderer, scene: new Scene(), overlay: new Scene(), camera: new PerspectiveCamera(40, 1, .05, 200) };
}
