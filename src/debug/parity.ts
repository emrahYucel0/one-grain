// URL switches for testing. None of them change anything unless present.
//   ?parity          the harness drives progress (window.__V) and shader time (window.__T)
//   ?tier=low|mid|high  force a quality tier
//   ?debug           the tier and the rule that chose it, the GPU, frame and GPU times (measured only here)
//   ?nosnap          scrolling does not settle on chapters (to hold a position mid-transition)
//   ?perf            time every render pass on the GPU and publish the timings as window.__gpu
//   ?pointcap=N      largest grain in pixels (performance experiments)
//   ?grains=N        grains per world instead of the tier's count (performance experiments)
//   ?shadowstride=N  every N-th grain casts shadows (default 1 = all); &shadowgrow=F scales its disc
//   ?dofres=N        depth of field at 1/N resolution (default 2 = half; 4 = quarter), measurements only
//   ?shadowevery=N   at rest the shadow map refreshes every N-th frame (default 3; every 2nd in transitions), measurements only
//   ?capture         the submission video's offline render (src/capture/, scripts/capture.mjs): implies
//                    ?parity and the high tier; the page runs on a virtual clock, one frame per step
//   ?off=a,b         switch render layers off (light, shadows, dof, bloom, grade), for measurements
//   with ?parity, window.__AT = { tr, t, lean } renders transition tr at t with that camera lean
//   with ?parity, window.__LIVE = ms pins the display's live clock (it counts real time otherwise)
//   with ?parity, window.__FT = s pins the seconds spent in the current hold (ring fade, final hold)
import { Vector3, type Camera } from 'three';
import type { GpuTimes } from '../core/gpu-timer';
import type { GrainPack } from '../sim/pack';

declare global {
  interface Window {
    __V?: number | null;
    __T?: number | null;
    __PACK?: GrainPack;
    __progress?: number;
    __gpu?: GpuTimes;
    __AT?: { tr: number; t: number; lean: number } | null;
    __noRest?: boolean;
    __overdraw?: boolean;
    __LIVE?: number | null;
    __FT?: number | null;
    /** ?capture: the virtual clock (ms) that performance.now() returns */
    __VNOW?: number;
    /** ?parity: the tier picked at startup and the rule that chose it (check:tiers) */
    __tier?: { name: string; n: number; rule: string };
    __renderT?: number[];
    /** ?parity: the sound, once created (the audio check reads its taps and counters) */
    __audio?: unknown;
    /** ?parity: the hero grain projected by the camera (NDC x, y, z) and whether it is shown, each frame */
    __hero?: { x: number; y: number; z: number; visible: boolean };
    /** ?parity: the same grain projected after rendering, through the matrices the frame was drawn with */
    __heroRendered?: { x: number; y: number };
  }
}

const params = new URLSearchParams(location.search);

const capture = params.has('capture');

export const flags = {
  capture,
  parity: params.has('parity') || capture,
  debug: params.has('debug'),
  tier: capture ? 'high' : params.get('tier'),
  noSnap: params.has('nosnap'),
  perf: params.has('perf'),
  pointCap: params.has('pointcap') ? Number(params.get('pointcap')) : null,
  grains: params.has('grains') ? Number(params.get('grains')) : null,
  shadowStride: Number(params.get('shadowstride') ?? 1),
  dofRes: Math.max(1, Number(params.get('dofres') ?? 2) | 0),
  shadowEvery: params.has('shadowevery') ? Math.max(1, Number(params.get('shadowevery')) | 0) : null,
  shadowGrow: Number(params.get('shadowgrow') ?? 1),
  off: new Set((params.get('off') ?? '').split(',').filter(Boolean)),
};

// ?capture: the page's clock is the capture's (every timed thing reads performance.now(): the ending,
// the live clock, the ring, the shader clock, the sound's hold timing), so a render is the same at any speed
if (capture) {
  const real = performance.now.bind(performance);
  performance.now = () => window.__VNOW ?? real();
}

export const progressOverride = (): number | null => (flags.parity && typeof window.__V === 'number' ? window.__V : null);
export const transitionOverride = (): { tr: number; t: number; lean: number } | null => (flags.parity && window.__AT ? window.__AT : null);
/** ?parity: window.__noRest forces the full vertex path at rest (to prove the cheap path equal). */
export const restPathAllowed = (): boolean => !(flags.parity && window.__noRest);
/** ?parity or ?debug: window.__overdraw shows how many grains cover each pixel. */
/** ?parity: window.__FT pins the seconds spent in the current hold. */
export const holdTimeOverride = (): number | null => (flags.parity && typeof window.__FT === 'number' ? window.__FT : null);
/** ?parity: window.__LIVE pins the live clock's count, in milliseconds. */
export const liveOverride = (): number | null => (flags.parity && typeof window.__LIVE === 'number' ? window.__LIVE : null);
export const overdrawView = (): boolean => (flags.parity || flags.debug) && !!window.__overdraw;
export const timeOverride = (): number | null => (flags.parity && typeof window.__T === 'number' ? window.__T : null);

/** In parity mode, publish the story progress actually rendered (for the reverse-scrub check). */
export function reportProgress(v: number): void {
  if (flags.parity) window.__progress = v;
}

/** With ?perf or ?debug, publish the per-pass GPU timings (for scripts/perf.mjs). */
/** ?parity: the hero grain in normalised device coordinates, for the ring check. */
export function reportHero(x: number, y: number, z: number, visible: boolean): void { if (flags.parity) window.__hero = { x, y, z, visible }; }

const rendered = new Vector3();
/** ?parity: the hero projected after rendering, so the ring check does not share the loop's projection path. */
export function reportHeroRendered(hero: Vector3, camera: Camera): void {
  if (!flags.parity) return;
  const p = rendered.copy(hero).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);
  window.__heroRendered = { x: p.x, y: p.y };
}

/** ?parity: the tier picked at startup, for check:tiers. */
export function exposeTier(tier: { name: string; n: number }, rule: string): void { if (flags.parity) window.__tier = { name: tier.name, n: tier.n, rule }; }

/** ?parity: expose the sound for the audio check. */
export function exposeAudio(sound: unknown): void { if (flags.parity) window.__audio = sound; }

/** ?perf: the rAF timestamp of every rendered frame, for the cadence. */
export function reportRender(t: number): void {
  if (!flags.perf) return;
  const a = (window.__renderT ??= []);
  a.push(t);
  if (a.length > 20000) a.splice(0, 10000);
}

export function reportGpu(timer: { times(): GpuTimes }): void {
  if (flags.perf || flags.debug) window.__gpu = timer.times();
}

export function exposePack(pack: GrainPack): void {
  if (flags.parity) window.__PACK = pack;
}
