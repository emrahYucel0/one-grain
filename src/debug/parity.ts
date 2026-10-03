// URL switches for testing. None of them change anything unless present.
//   ?parity          the harness drives progress (window.__V) and shader time (window.__T)
//   ?tier=low|mid|high  force a quality tier
//   ?debug           frame-time / tier overlay
//   ?nosnap          scrolling does not settle on chapters (to hold a position mid-transition)
//   with ?parity, window.__AT = { tr, t, lean } renders transition tr at t with that camera lean
import type { GrainPack } from '../sim/pack';

declare global {
  interface Window {
    __V?: number | null;
    __T?: number | null;
    __PACK?: GrainPack;
    __progress?: number;
    __AT?: { tr: number; t: number; lean: number } | null;
  }
}

const params = new URLSearchParams(location.search);

export const flags = {
  parity: params.has('parity'),
  debug: params.has('debug'),
  tier: params.get('tier'),
  /** ?debug&forceDrop: pretend the frame budget is blown, to exercise the tier downgrade */
  forceDrop: params.has('forceDrop'),
  noSnap: params.has('nosnap'),
};

export const progressOverride = (): number | null => (flags.parity && typeof window.__V === 'number' ? window.__V : null);
export const transitionOverride = (): { tr: number; t: number; lean: number } | null => (flags.parity && window.__AT ? window.__AT : null);
export const timeOverride = (): number | null => (flags.parity && typeof window.__T === 'number' ? window.__T : null);

/** In parity mode, publish the story progress actually rendered (for the reverse-scrub check). */
export function reportProgress(v: number): void {
  if (flags.parity) window.__progress = v;
}

export function exposePack(pack: GrainPack): void {
  if (flags.parity) window.__PACK = pack;
}
