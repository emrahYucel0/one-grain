import { Color, GLSL3, Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, Vector2, Vector3, type IUniform, type WebGLRenderer } from 'three';
import { SKY_LEVEL, type SkyState } from '../core/sky';
import { skyShaders } from '../shaders';
import type { CompileOne } from './post';

/** What the sky pass needs from the frame. */
export interface SkyFrame {
  state: SkyState;
  /** the stage colour, linear: the sky is mixed over it by its amount */
  stage: Vector3;
  /** shader time: the clouds drift with it (it stands still under reduced motion) */
  time: number;
  /** drawing-buffer width / height */
  aspect: number;
}

/** Below this amount the sky is not drawn at all (the stage colour is the clear colour). */
export const SKY_MIN = .002;

/** The sky (shaders/sky.glsl), a fullscreen quad drawn into the HDR target before the grains. */
export class SkyPass {
  private readonly u: Record<string, IUniform>;
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  constructor() {
    this.u = {
      uZenith: { value: new Color() }, uLow: { value: new Color() }, uSunC: { value: new Color() }, uCloudC: { value: new Color() },
      uStage: { value: new Vector3() }, uGround: { value: new Color() }, uSun: { value: new Vector2() },
      uHorizon: { value: .5 }, uAmount: { value: 0 }, uSunI: { value: 0 }, uSunS: { value: .1 }, uCloud: { value: 0 },
      uTime: { value: 0 }, uAspect: { value: 1 }, uLevel: { value: SKY_LEVEL },
    };
    const mesh = new Mesh(new PlaneGeometry(2, 2), new ShaderMaterial({ glslVersion: GLSL3, uniforms: this.u, depthTest: false, depthWrite: false, ...skyShaders }));
    mesh.frustumCulled = false;
    this.scene.add(mesh);
  }

  compile(one: CompileOne): Promise<unknown> { return one(this.scene, this.camera); }

  /** Draws into the current target (no clear). */
  render(renderer: WebGLRenderer, f: SkyFrame): void {
    const u = this.u, s = f.state;
    (u.uZenith!.value as Color).copy(s.zenith); (u.uLow!.value as Color).copy(s.low); (u.uGround!.value as Color).copy(s.ground);
    (u.uSunC!.value as Color).copy(s.sunColour); (u.uCloudC!.value as Color).copy(s.cloudColour);
    (u.uSun!.value as Vector2).copy(s.sun); (u.uStage!.value as Vector3).copy(f.stage);
    u.uHorizon!.value = s.horizon; u.uAmount!.value = s.amount; u.uSunI!.value = s.sunIntensity; u.uSunS!.value = s.sunSize;
    u.uCloud!.value = s.clouds; u.uTime!.value = f.time; u.uAspect!.value = f.aspect;
    renderer.render(this.scene, this.camera);
  }
}
