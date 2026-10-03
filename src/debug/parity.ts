// URL switches for testing. None of them change anything unless present.
//   ?parity          the harness drives progress (window.__V) and shader time (window.__T)
//   ?tier=low|mid|high  force a quality tier
//   ?debug           frame-time / tier overlay
import type { GrainPack } from '../sim/pack';

declare global {
  interface Window {
    __V?: number | null;
    __T?: number | null;
    __PACK?: GrainPack;
  }
}

const params = new URLSearchParams(location.search);

export const flags = {
  parity: params.has('parity'),
  debug: params.has('debug'),
  tier: params.get('tier'),
  /** ?debug&forceDrop: pretend the frame budget is blown, to exercise the tier downgrade */
  forceDrop: params.has('forceDrop'),
};

export const progressOverride = (): number | null => (flags.parity && typeof window.__V === 'number' ? window.__V : null);
export const timeOverride = (): number | null => (flags.parity && typeof window.__T === 'number' ? window.__T : null);

export function exposePack(pack: GrainPack): void {
  if (flags.parity) window.__PACK = pack;
}
