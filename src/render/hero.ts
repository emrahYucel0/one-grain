import { AdditiveBlending, BufferAttribute, BufferGeometry, GLSL3, Points, ShaderMaterial, Vector3, type IUniform } from 'three';
import { haloShaders, heroShaders } from '../shaders';

/**
 * The grain the story follows: a bright point with a soft halo, drawn over everything. Its light
 * (1 → 0) takes it to a matte mineral the size of any other grain (the final hold, v15).
 */
export class HeroGrain {
  readonly objects: readonly [Points, Points];
  private readonly position = new BufferAttribute(new Float32Array(3), 3);
  private readonly u: Record<string, IUniform>;

  constructor(pixelRatio: number) {
    const geo = new BufferGeometry();
    geo.setAttribute('position', this.position);
    // one set of uniforms for both: the halo fades with the grain's light
    this.u = { uPR: { value: pixelRatio }, uLight: { value: 1 }, uMatte: { value: new Vector3(.36, .27, .17) }, uMatteSize: { value: 4 } };
    const halo = new ShaderMaterial({
      glslVersion: GLSL3, transparent: true, depthTest: false, depthWrite: false, blending: AdditiveBlending, uniforms: this.u, ...haloShaders,
    });
    const point = new ShaderMaterial({ glslVersion: GLSL3, depthTest: false, depthWrite: false, uniforms: this.u, ...heroShaders });
    const haloPts = new Points(geo, halo), heroPts = new Points(geo, point);
    haloPts.frustumCulled = heroPts.frustumCulled = false;
    haloPts.renderOrder = 10; heroPts.renderOrder = 11;
    this.objects = [haloPts, heroPts];
  }

  get visible(): boolean { return this.objects[0].visible; }
  set visible(v: boolean) { this.objects[0].visible = this.objects[1].visible = v; }

  moveTo(p: Vector3): void { this.position.setXYZ(0, p.x, p.y, p.z); this.position.needsUpdate = true; }

  /** 1 bright white, .5 warm quartz, 0 matte mineral; `mattePx` is a resting grain's size there. */
  setLight(light: number, mattePx: number): void { this.u.uLight!.value = light; this.u.uMatteSize!.value = mattePx; }

  setPixelRatio(dpr: number): void { this.u.uPR!.value = dpr; }
}
