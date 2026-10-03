import { Color, DepthTexture, Matrix4, OrthographicCamera, Scene, WebGLRenderTarget, type Vector3, type WebGLRenderer } from 'three';

/** Shadow map resolution (v10). */
export const SHADOW_SIZE = 1024;

/**
 * The key light's shadow map (v10): an orthographic depth view along the key light, framed around
 * what the camera looks at. Grains are drawn into it as discs (the grain shader's SHADOW variant).
 * Matter moves slowly at rest, so the map refreshes every other frame (and on the first frame after
 * it was off).
 */
export class ShadowMap {
  readonly target = new WebGLRenderTarget(SHADOW_SIZE, SHADOW_SIZE, { depthBuffer: true });
  readonly scene = new Scene();
  readonly camera = new OrthographicCamera(-10, 10, 10, -10, .1, 90);
  /** the light's view-projection, for the grain shader */
  readonly viewProjection = new Matrix4();
  /** shadow map pixels per world unit (grain discs keep their world size in the map) */
  pxPerUnit = 1;
  private tick = 0;
  private fresh = false;
  private readonly clear = new Color();

  constructor() { this.target.depthTexture = new DepthTexture(SHADOW_SIZE, SHADOW_SIZE); }

  get texture(): DepthTexture { return this.target.depthTexture!; }

  /** Frame the light: a square of half-size `size` around `look`, seen from 40 units along `keyDir`. */
  fit(look: Vector3, keyDir: Vector3, size: number): void {
    const c = this.camera;
    c.left = -size; c.right = size; c.top = size; c.bottom = -size; c.updateProjectionMatrix();
    c.position.copy(look).addScaledVector(keyDir, 40); c.lookAt(look); c.updateMatrixWorld();
    this.viewProjection.multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse);
    this.pxPerUnit = SHADOW_SIZE / (2 * size);
  }

  /** Whether this frame refreshes the map; call once per frame while shadows are on. */
  due(): boolean { return this.tick++ % 2 === 0 || !this.fresh; }

  /** Shadows were off: the next frame that has them refreshes the map first. */
  invalidate(): void { this.fresh = false; }

  render(renderer: WebGLRenderer): void {
    // the stage sets its clear colour only when it changes: keep it
    renderer.getClearColor(this.clear);
    const alpha = renderer.getClearAlpha();
    renderer.setRenderTarget(this.target);
    renderer.setClearColor(0xffffff, 1);
    renderer.clear();
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(null);
    renderer.setClearColor(this.clear, alpha);
    this.fresh = true;
  }
}
