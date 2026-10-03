import { ColorManagement, LinearSRGBColorSpace, PerspectiveCamera, Scene, WebGLRenderer } from 'three';

// Parity with the reference (three r149, legacy colour mode): hex colours reach the shaders
// as-is and shader output reaches the screen as-is. Modern three would convert both.
ColorManagement.enabled = false;

export interface Stage {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  /** current --stage colour (CSS), also the fog colour */
  stageColor: string;
}

export function createStage(canvas: HTMLCanvasElement, pixelRatio: number): Stage {
  const renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.outputColorSpace = LinearSRGBColorSpace;
  renderer.debug.checkShaderErrors = import.meta.env.DEV;
  renderer.setPixelRatio(pixelRatio);
  const stage: Stage = { renderer, scene: new Scene(), camera: new PerspectiveCamera(40, 1, .05, 200), stageColor: '#000' };

  const root = document.documentElement;
  const readTheme = (): void => {
    stage.stageColor = getComputedStyle(root).getPropertyValue('--stage').trim();
    renderer.setClearColor(stage.stageColor, 1);
  };
  readTheme();
  new MutationObserver(readTheme).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readTheme);
  return stage;
}
