import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, GLSL3, Matrix4, NormalBlending, Points, ShaderMaterial, Vector3,
  type DataTexture, type IUniform,
} from 'three';
import { grainShaders } from '../shaders';
import type { GrainPack, LayerName } from '../sim/pack';
import { layerDefines, layerTextures, layerUniform } from './bind';
import type { FrameUniforms } from './types';

/** Until the HDR post pass exists, the grain shader applies the tone curve itself. */
const OUTPUT_DEFINES: Record<string, string> = { DIRECT_OUTPUT: '' };

/** The grain cloud: one point per grain, all motion computed on the GPU from the pack layers. */
export class GrainCloud {
  readonly object: Points;
  private readonly material: ShaderMaterial;
  private readonly u: Record<string, IUniform>;
  private textures = new Map<LayerName, DataTexture>();
  private colorKeys = ['', '', '', ''];

  constructor() {
    this.u = {
      uRows: { value: 1 }, uRest: { value: 0 }, uPointMax: { value: 9 }, uFrom: { value: 0 }, uTo: { value: 1 },
      uTime: { value: 0 }, uT: { value: 0 }, uMotion: { value: 1 }, uScale: { value: 1 }, uGrain: { value: .1 },
      uStyle: { value: 0 }, uK: { value: 1 }, uSpan: { value: .45 }, uSpread: { value: 30 }, uDir: { value: new Vector3(1, 0, 0) },
      uHeroA: { value: new Vector3() }, uHeroB: { value: new Vector3() },
      uInteract: { value: 0 }, uLast: { value: 0 }, uReveal: { value: 0 }, uMouseW: { value: new Vector3(0, -99, 0) }, uPress: { value: 0 },
      uLoA: { value: new Color() }, uHiA: { value: new Color() }, uLoB: { value: new Color() }, uHiB: { value: new Color() },
      uFog: { value: new Color() }, uFogD: { value: .02 }, uJitter: { value: 0 },
      // lighting (v10)
      uSpecA: { value: .3 }, uSpecB: { value: .3 }, uPx: { value: 1 }, uLightVP: { value: new Matrix4() },
      uKeyDir: { value: new Vector3(0, 1, 0) }, uKeyCol: { value: new Vector3() }, uSky: { value: new Vector3() }, uGround: { value: new Vector3() }, uRim: { value: new Vector3() },
      uPLPos: { value: new Vector3() }, uPLCol: { value: new Vector3() }, uPLRange: { value: 1 },
      uCamPos: { value: new Vector3() }, uCamR: { value: new Vector3() }, uCamU: { value: new Vector3() }, uCamB: { value: new Vector3() }, uFogLin: { value: new Vector3() },
      uUseShadow: { value: 0 }, uUseLight: { value: 1 }, uShadowTexel: { value: 1 / 1024 }, uShadow: { value: null },
      [layerUniform('pos')]: { value: null },
      [layerUniform('surface')]: { value: null },
    };
    this.material = new ShaderMaterial({ glslVersion: GLSL3, uniforms: this.u, defines: { TEX_WIDTH: 1024, ...OUTPUT_DEFINES }, ...grainShaders });
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
    this.material.defines = { ...layerDefines(pack), ...OUTPUT_DEFINES, ...('OVERDRAW' in this.material.defines ? { OVERDRAW: '' } : {}) };
    this.material.needsUpdate = true;

    const ids = new Float32Array(pack.n * 3);
    for (let i = 0; i < pack.n; i++) ids[i * 3] = i;
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(ids, 3));
    this.object.geometry.dispose();
    this.object.geometry = geo;
    this.object.visible = true;
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
    u.uLast!.value = f.last; u.uReveal!.value = f.reveal;
    u.uInteract!.value = f.interact; u.uPress!.value = f.press;
    if (f.interact) (u.uMouseW!.value as Vector3).copy(f.mouse);
    // lighting
    const rig = f.rig;
    (u.uKeyDir!.value as Vector3).copy(rig.keyDir); (u.uKeyCol!.value as Vector3).copy(rig.keyCol);
    (u.uSky!.value as Vector3).copy(rig.sky); (u.uGround!.value as Vector3).copy(rig.ground); (u.uRim!.value as Vector3).copy(rig.rim);
    (u.uPLPos!.value as Vector3).copy(rig.pointPos); (u.uPLCol!.value as Vector3).copy(rig.pointCol); u.uPLRange!.value = rig.pointRange;
    u.uSpecA!.value = rig.specA; u.uSpecB!.value = rig.specB;
    (u.uFogLin!.value as Vector3).copy(f.fogLinear);
    u.uUseLight!.value = f.light ? 1 : 0;
    const cam = f.camera;
    cam.updateMatrixWorld();
    const m = cam.matrixWorld.elements;
    (u.uCamR!.value as Vector3).set(m[0]!, m[1]!, m[2]!); (u.uCamU!.value as Vector3).set(m[4]!, m[5]!, m[6]!); (u.uCamB!.value as Vector3).set(m[8]!, m[9]!, m[10]!);
    (u.uCamPos!.value as Vector3).setFromMatrixPosition(cam.matrixWorld);
  }

  private color(slot: number, name: string, css: string): void {
    if (this.colorKeys[slot] === css) return;
    this.colorKeys[slot] = css;
    (this.u[name]!.value as Color).set(css);
  }
}
