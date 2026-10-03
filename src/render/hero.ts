import { AdditiveBlending, BufferAttribute, BufferGeometry, GLSL3, Points, ShaderMaterial, type Vector3 } from 'three';
import { haloShaders, heroShaders } from '../shaders';

/** The grain the story follows: a bright point with a soft halo, drawn over everything. */
export class HeroGrain {
  readonly objects: readonly [Points, Points];
  private readonly position = new BufferAttribute(new Float32Array(3), 3);
  private readonly materials: readonly [ShaderMaterial, ShaderMaterial];

  constructor(pixelRatio: number) {
    const geo = new BufferGeometry();
    geo.setAttribute('position', this.position);
    const halo = new ShaderMaterial({
      glslVersion: GLSL3, transparent: true, depthTest: false, depthWrite: false, blending: AdditiveBlending,
      uniforms: { uPR: { value: pixelRatio } }, ...haloShaders,
    });
    const point = new ShaderMaterial({ glslVersion: GLSL3, depthTest: false, depthWrite: false, uniforms: { uPR: { value: pixelRatio } }, ...heroShaders });
    const haloPts = new Points(geo, halo), heroPts = new Points(geo, point);
    haloPts.frustumCulled = heroPts.frustumCulled = false;
    haloPts.renderOrder = 10; heroPts.renderOrder = 11;
    this.objects = [haloPts, heroPts];
    this.materials = [halo, point];
  }

  get visible(): boolean { return this.objects[0].visible; }
  set visible(v: boolean) { this.objects[0].visible = this.objects[1].visible = v; }

  moveTo(p: Vector3): void { this.position.setXYZ(0, p.x, p.y, p.z); this.position.needsUpdate = true; }

  setPixelRatio(dpr: number): void { for (const m of this.materials) m.uniforms.uPR!.value = dpr; }
}
