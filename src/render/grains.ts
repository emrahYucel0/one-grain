import {
  BufferAttribute, BufferGeometry, Color, GLSL3, Points, ShaderMaterial, Vector3,
  type DataTexture, type IUniform,
} from 'three';
import { grainShaders } from '../shaders';
import type { GrainPack, LayerName } from '../sim/pack';
import { layerDefines, layerTextures, layerUniform } from './bind';
import type { FrameUniforms } from './types';

/** The grain cloud: one point per grain, all motion computed on the GPU from the pack layers. */
export class GrainCloud {
  readonly object: Points;
  private readonly material: ShaderMaterial;
  private readonly u: Record<string, IUniform>;
  private textures = new Map<LayerName, DataTexture>();
  private colorKeys = ['', '', '', ''];

  constructor() {
    this.u = {
      uRows: { value: 1 }, uFrom: { value: 0 }, uTo: { value: 1 },
      uTime: { value: 0 }, uT: { value: 0 }, uMotion: { value: 1 }, uScale: { value: 1 }, uGrain: { value: .1 },
      uStyle: { value: 0 }, uK: { value: 1 }, uSpan: { value: .45 }, uSpread: { value: 30 }, uDir: { value: new Vector3(1, 0, 0) },
      uHeroA: { value: new Vector3() }, uHeroB: { value: new Vector3() },
      uInteract: { value: 0 }, uLast: { value: 0 }, uReveal: { value: 0 }, uMouseW: { value: new Vector3(0, -99, 0) }, uPress: { value: 0 },
      uLoA: { value: new Color() }, uHiA: { value: new Color() }, uLoB: { value: new Color() }, uHiB: { value: new Color() },
      uFog: { value: new Color() }, uFogD: { value: .02 }, uJitter: { value: 0 },
      [layerUniform('pos')]: { value: null },
    };
    this.material = new ShaderMaterial({ glslVersion: GLSL3, uniforms: this.u, defines: { TEX_WIDTH: 1024 }, ...grainShaders });
    this.object = new Points(new BufferGeometry(), this.material);
    this.object.frustumCulled = false;
    this.object.visible = false;
  }

  /** Swap in a new set of worlds (first build, or a quality tier change). */
  setPack(pack: GrainPack): void {
    this.textures.forEach((t) => t.dispose());
    this.textures = layerTextures(pack);
    for (const [name, tex] of this.textures) {
      const key = layerUniform(name);
      (this.u[key] ??= { value: null }).value = tex;
    }
    this.u.uRows!.value = pack.rows;
    this.material.defines = layerDefines(pack);
    this.material.needsUpdate = true;

    const ids = new Float32Array(pack.n * 3);
    for (let i = 0; i < pack.n; i++) ids[i * 3] = i;
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(ids, 3));
    this.object.geometry.dispose();
    this.object.geometry = geo;
    this.object.visible = true;
  }

  /** Pixels per world unit at distance 1 (drawing-buffer height / (2·tan(fov/2))). */
  setScale(scale: number): void { this.u.uScale!.value = scale; }

  update(f: FrameUniforms): void {
    const u = this.u;
    u.uFrom!.value = f.from; u.uTo!.value = f.to; u.uT!.value = f.t; u.uTime!.value = f.time; u.uMotion!.value = f.motion;
    u.uStyle!.value = f.style; u.uK!.value = f.k; u.uSpan!.value = f.span; u.uSpread!.value = f.spread;
    (u.uDir!.value as Vector3).set(f.dir[0], f.dir[1], f.dir[2]);
    (u.uHeroA!.value as Vector3).copy(f.heroA); (u.uHeroB!.value as Vector3).copy(f.heroB);
    this.color(0, 'uLoA', f.loA); this.color(1, 'uHiA', f.hiA); this.color(2, 'uLoB', f.loB); this.color(3, 'uHiB', f.hiB);
    (u.uFog!.value as Color).copy(f.fog);
    u.uGrain!.value = f.grain; u.uJitter!.value = f.jitter;
    u.uLast!.value = f.last; u.uReveal!.value = f.reveal;
    u.uInteract!.value = f.interact; u.uPress!.value = f.press;
    if (f.interact) (u.uMouseW!.value as Vector3).copy(f.mouse);
  }

  private color(slot: number, name: string, css: string): void {
    if (this.colorKeys[slot] === css) return;
    this.colorKeys[slot] = css;
    (this.u[name]!.value as Color).set(css);
  }
}
