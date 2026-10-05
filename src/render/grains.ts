import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, GLSL3, Matrix4, NormalBlending, Points, ShaderMaterial, Vector3,
  type DataTexture, type IUniform,
} from 'three';
import { grainShaders, grainShadowShaders } from '../shaders';
import type { GrainPack, LayerName } from '../sim/pack';
import { PACK_LAYERS, layerDefines, layerTextures, layerUniform, layoutDefines } from './bind';
import type { ShadowMap } from './shadow';
import type { FrameUniforms } from './types';

/** A point per n-th grain id (the same grains, so the same per-grain randoms). */
function strided(n: number, stride: number): BufferGeometry {
  const count = Math.ceil(n / stride), ids = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) ids[i * 3] = i * stride;
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(ids, 3));
  return geo;
}

/** The grain cloud: one point per grain, all motion computed on the GPU from the pack layers. */
export class GrainCloud {
  readonly object: Points;
  /** the same grains in the key light's shadow map (shares geometry and uniforms) */
  readonly shadowObject: Points;
  private readonly material: ShaderMaterial;
  private readonly shadowMaterial: ShaderMaterial;
  private readonly u: Record<string, IUniform>;
  private textures = new Map<LayerName, DataTexture>();
  private colorKeys = ['', '', '', ''];
  /** every n-th grain casts shadows (1: all; every other one lightens shadows in scattered clouds, docs/perf.md) */
  private shadowStride = 1;

  constructor() {
    this.u = {
      uRows: { value: 1 }, uRest: { value: 0 }, uPointMax: { value: 9 }, uFrom: { value: 0 }, uTo: { value: 1 },
      uTime: { value: 0 }, uT: { value: 0 }, uMotion: { value: 1 }, uScale: { value: 1 }, uGrain: { value: .1 },
      uStyle: { value: 0 }, uK: { value: 1 }, uSpan: { value: .45 }, uSpread: { value: 30 }, uDir: { value: new Vector3(1, 0, 0) },
      uHeroA: { value: new Vector3() }, uHeroB: { value: new Vector3() },
      uInteract: { value: 0 }, uLand: { value: 0 }, uLandPos: { value: new Vector3() }, uMouseW: { value: new Vector3(0, -99, 0) }, uPress: { value: 0 },
      uLoA: { value: new Color() }, uHiA: { value: new Color() }, uLoB: { value: new Color() }, uHiB: { value: new Color() },
      uFog: { value: new Color() }, uFogD: { value: .02 }, uJitter: { value: 0 },
      // lighting (v10)
      uSpecA: { value: .3 }, uSpecB: { value: .3 },
      uGlowA: { value: 0 }, uGlowB: { value: 0 }, uRaysA: { value: 1 }, uRaysB: { value: 1 }, uPixA: { value: 1 }, uPixB: { value: 1 }, uWaterA: { value: 0 }, uWaterB: { value: 0 }, uPx: { value: 1 }, uShadowGrow: { value: 1 }, uLightVP: { value: new Matrix4() },
      uKeyDir: { value: new Vector3(0, 1, 0) }, uKeyCol: { value: new Vector3() }, uSky: { value: new Vector3() }, uGround: { value: new Vector3() }, uRim: { value: new Vector3() },
      uPLPos: { value: new Vector3() }, uPLCol: { value: new Vector3() }, uPLRange: { value: 1 },
      uCamPos: { value: new Vector3() }, uCamR: { value: new Vector3() }, uCamU: { value: new Vector3() }, uCamB: { value: new Vector3() }, uFogLin: { value: new Vector3() },
      uUseShadow: { value: 0 }, uUseLight: { value: 1 }, uShadow: { value: null }, uKeyView: { value: new Vector3(0, 0, 1) }, uUpView: { value: new Vector3(0, 1, 0) },
      [layerUniform('pos')]: { value: null },
      [layerUniform('surface')]: { value: null },
    };
    // the final layout's defines from the start: the programs compile while the worlds are built (render/pipeline.ts compile())
    this.material = new ShaderMaterial({ glslVersion: GLSL3, uniforms: this.u, defines: layoutDefines(1024, PACK_LAYERS), ...grainShaders });
    // a position attribute from the start (the pack replaces it): three.js keys a program on having one,
    // and the programs are compiled before the first pack (render/pipeline.ts compile())
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(3), 3));
    this.object = new Points(geometry, this.material);
    this.object.frustumCulled = false;
    this.object.visible = false;
    this.shadowMaterial = new ShaderMaterial({ glslVersion: GLSL3, uniforms: this.u, defines: { ...layoutDefines(1024, PACK_LAYERS), SHADOW: '' }, ...grainShadowShaders });
    this.shadowObject = new Points(this.object.geometry, this.shadowMaterial);
    this.shadowObject.frustumCulled = false;
    this.shadowObject.visible = false;
  }

  /** Run fn with the cloud visible (three.js compiles only visible objects; the cloud shows from its first pack). */
  whileVisible<T>(fn: () => T): T {
    const was = this.object.visible;
    this.object.visible = this.shadowObject.visible = true;
    try { return fn(); } finally { this.object.visible = this.shadowObject.visible = was; }
  }

  /** Draw into this shadow map and sample it. */
  attachShadow(map: ShadowMap): void {
    map.scene.add(this.shadowObject);
    this.u.uShadow!.value = map.texture;
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
    this.material.defines = { ...layerDefines(pack), ...('OVERDRAW' in this.material.defines ? { OVERDRAW: '' } : {}) };
    this.material.needsUpdate = true;
    this.shadowMaterial.defines = { ...layerDefines(pack), SHADOW: '' };
    this.shadowMaterial.needsUpdate = true;

    const ids = new Float32Array(pack.n * 3);
    for (let i = 0; i < pack.n; i++) ids[i * 3] = i;
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(ids, 3));
    this.object.geometry.dispose();
    if (this.shadowObject.geometry !== this.object.geometry) this.shadowObject.geometry.dispose();
    this.object.geometry = geo;
    this.shadowObject.geometry = this.shadowStride > 1 ? strided(pack.n, this.shadowStride) : geo;
    this.object.visible = this.shadowObject.visible = true;
  }

  /**
   * Debug: draw every grain as a faint additive square-free disc with no depth test, so the
   * picture's brightness counts how many grains cover each pixel (1/32 per grain).
   */
  setOverdrawView(on: boolean): void {
    const mat = this.material;
    if (on === !!mat.defines.OVERDRAW) return;
    if (on) mat.defines.OVERDRAW = ''; else delete mat.defines.OVERDRAW;
    mat.blending = on ? AdditiveBlending : NormalBlending;
    mat.depthTest = mat.depthWrite = !on;
    mat.needsUpdate = true;
  }

  /**
   * Only every n-th grain casts shadows (1, all, by default), its disc in the shadow map scaled by `grow`.
   * ?shadowstride and ?shadowgrow change it for measurements. Applies from the next pack.
   */
  setShadowSubset(stride: number, grow: number): void { this.shadowStride = Math.max(1, Math.round(stride)); this.u.uShadowGrow!.value = grow; }

  /** Largest grain, in pixels, before the per-grain size factor (9 as v10). */
  setPointMax(px: number): void { this.u.uPointMax!.value = px; }

  /** Pixels per world unit at distance 1 (drawing-buffer height / (2·tan(fov/2))). */
  setScale(scale: number): void { this.u.uScale!.value = scale; }

  update(f: FrameUniforms): void {
    const u = this.u;
    u.uRest!.value = f.rest; u.uFrom!.value = f.from; u.uTo!.value = f.to; u.uT!.value = f.t; u.uTime!.value = f.time; u.uMotion!.value = f.motion;
    u.uStyle!.value = f.style; u.uK!.value = f.k; u.uSpan!.value = f.span; u.uSpread!.value = f.spread;
    (u.uDir!.value as Vector3).set(f.dir[0], f.dir[1], f.dir[2]);
    (u.uHeroA!.value as Vector3).copy(f.heroA); (u.uHeroB!.value as Vector3).copy(f.heroB);
    this.color(0, 'uLoA', f.loA); this.color(1, 'uHiA', f.hiA); this.color(2, 'uLoB', f.loB); this.color(3, 'uHiB', f.hiB);
    (u.uFog!.value as Color).copy(f.fog);
    u.uGrain!.value = f.grain; u.uJitter!.value = f.jitter;
    u.uLand!.value = f.land; (u.uLandPos!.value as Vector3).copy(f.landPos);
    u.uInteract!.value = f.interact; u.uPress!.value = f.press;
    if (f.interact) (u.uMouseW!.value as Vector3).copy(f.mouse);
    // lighting
    const rig = f.rig;
    (u.uKeyDir!.value as Vector3).copy(rig.keyDir); (u.uKeyCol!.value as Vector3).copy(rig.keyCol);
    (u.uSky!.value as Vector3).copy(rig.sky); (u.uGround!.value as Vector3).copy(rig.ground); (u.uRim!.value as Vector3).copy(rig.rim);
    (u.uPLPos!.value as Vector3).copy(rig.pointPos); (u.uPLCol!.value as Vector3).copy(rig.pointCol); u.uPLRange!.value = rig.pointRange;
    u.uSpecA!.value = rig.specA; u.uSpecB!.value = rig.specB;
    u.uGlowA!.value = rig.glowA; u.uGlowB!.value = rig.glowB; u.uRaysA!.value = rig.raysA; u.uRaysB!.value = rig.raysB;
    u.uPixA!.value = rig.pixA; u.uPixB!.value = rig.pixB; u.uWaterA!.value = rig.waterA; u.uWaterB!.value = rig.waterB;
    (u.uFogLin!.value as Vector3).copy(f.fogLinear);
    u.uUseLight!.value = f.light ? 1 : 0;
    u.uUseShadow!.value = f.light && f.shadows ? 1 : 0;
    (u.uLightVP!.value as Matrix4).copy(f.lightVP); u.uPx!.value = f.shadowPx;
    const cam = f.camera;
    cam.updateMatrixWorld();
    const m = cam.matrixWorld.elements;
    (u.uCamR!.value as Vector3).set(m[0]!, m[1]!, m[2]!); (u.uCamU!.value as Vector3).set(m[4]!, m[5]!, m[6]!); (u.uCamB!.value as Vector3).set(m[8]!, m[9]!, m[10]!);
    (u.uCamPos!.value as Vector3).setFromMatrixPosition(cam.matrixWorld);
    // the key direction and world up in camera space, for the sphere in the fragment shader
    const k = rig.keyDir;
    (u.uKeyView!.value as Vector3).set(k.x * m[0]! + k.y * m[1]! + k.z * m[2]!, k.x * m[4]! + k.y * m[5]! + k.z * m[6]!, k.x * m[8]! + k.y * m[9]! + k.z * m[10]!);
    (u.uUpView!.value as Vector3).set(m[1]!, m[5]!, m[9]!);
  }

  private color(slot: number, name: string, css: string): void {
    if (this.colorKeys[slot] === css) return;
    this.colorKeys[slot] = css;
    (this.u[name]!.value as Color).set(css);
  }
}
