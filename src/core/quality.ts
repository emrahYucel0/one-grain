import type { GpuCaps } from './env';
import { APPLE_GPU, APPLE_SILICON, DISCRETE, HIGH_END_TABLET, SOFTWARE } from './gpus';
import type { LayerSet } from './layers';

export type TierName = 'low' | 'mid' | 'high';

export interface Tier {
  name: TierName;
  /** grains per world */
  n: number;
  /** device-pixel-ratio cap */
  dpr: number;
  /** drawing-buffer budget in pixels, whatever the screen's DPR (4K and Retina must not multiply the cost) */
  pixels: number;
  /** the budget never takes the pixel ratio below this (high: never under the screen's own pixels) */
  dprFloor: number;
  /** the render layers this tier draws */
  fx: LayerSet;
}

const ALL: LayerSet = { light: true, shadows: true, dof: true, bloom: true, grade: true };

// mid = v10 on desktop (the parity baseline), the tier of every phone and most tablets and laptops;
// high = ours, for discrete GPUs and Apple Silicon; low = v10 on small screens (no shadows, no depth
// of field), now only where mid cannot run (pickTier). The pixel-ratio caps are v10's: post costs per pixel.
export const TIERS: Readonly<Record<TierName, Tier>> = {
  low: { name: 'low', n: 36000, dpr: 1.25, pixels: 1.5e6, dprFloor: 0, fx: { ...ALL, shadows: false, dof: false } },
  mid: { name: 'mid', n: 90000, dpr: 1.4, pixels: 2.2e6, dprFloor: 0, fx: ALL },
  high: { name: 'high', n: 160000, dpr: 1.75, pixels: 4.5e6, dprFloor: 1, fx: ALL },
};

const ORDER: readonly TierName[] = ['low', 'mid', 'high'];
const WORLDS = 15, TEX_WIDTH = 1024;

/** What the tier rules read about the device besides its GPU. */
export interface Device {
  /** navigator.userAgent */
  ua: string;
  /** navigator.maxTouchPoints */
  touch: number;
}

export const readDevice = (): Device => ({ ua: navigator.userAgent, touch: navigator.maxTouchPoints || 0 });

export type DeviceKind = 'phone' | 'tablet' | 'desktop';

/**
 * Phone, tablet or desktop, from the user agent. iPadOS asks for desktop sites with a Mac user agent:
 * a "Mac" with touch points is an iPad. Android tablets leave "Mobile" out of the user agent.
 */
export function deviceKind(d: Device): { kind: DeviceKind; ipad: boolean; android: boolean } {
  const ua = d.ua, android = /Android/i.test(ua);
  const ipad = /iPad/.test(ua) || (/Macintosh/.test(ua) && d.touch > 1);
  if (/iPhone|iPod/.test(ua)) return { kind: 'phone', ipad: false, android };
  if (ipad) return { kind: 'tablet', ipad, android };
  if (android) return { kind: /Mobile/.test(ua) ? 'phone' : 'tablet', ipad, android };
  return { kind: /Mobi|Windows Phone/i.test(ua) ? 'phone' : 'desktop', ipad, android };
}

/** Texture rows a tier's grain pack needs (every world's grains, TEX_WIDTH to a row). */
export const rowsFor = (t: Tier): number => Math.ceil(t.n / TEX_WIDTH) * WORLDS;
const fits = (t: Tier, caps: GpuCaps): boolean => rowsFor(t) <= caps.maxTextureSize;

/** The tier and the rule that chose it (shown by ?debug). */
export interface Picked { tier: Tier; rule: string }

/**
 * The tier, chosen once from what the device is and the GPU the browser reports, and never changed
 * afterwards; nothing is measured. Phones: mid. Tablets: mid; Android tablets with a recent high-end
 * GPU: high (iPads stay mid). Desktops and laptops: high with a discrete GPU or Apple Silicon, mid
 * otherwise (on hybrid laptops the GPU the browser reports decides). Low only where mid cannot run:
 * a software renderer, or a texture limit too small for mid's grain pack. Null when even low's pack
 * does not fit: the article is the page. The GPU name lists are in core/gpus.ts.
 */
export function pickTier(device: Device, caps: GpuCaps, forced: string | null): Picked | null {
  if (forced && forced in TIERS) return { tier: TIERS[forced as TierName], rule: `forced (?tier=${forced})` };
  const gpu = caps.renderer || 'renderer hidden', { kind, ipad, android } = deviceKind(device);
  let name: TierName, rule: string;
  if (SOFTWARE.test(caps.renderer)) { name = 'low'; rule = `software renderer (${gpu})`; }
  else if (!caps.performant) { name = 'low'; rule = 'the browser offers only a software context (failIfMajorPerformanceCaveat)'; }
  else if (kind === 'phone') { name = 'mid'; rule = 'phone'; }
  else if (kind === 'tablet') {
    if (ipad) { name = 'mid'; rule = 'iPad'; }
    else if (android && HIGH_END_TABLET.test(caps.renderer)) { name = 'high'; rule = `Android tablet, high-end GPU (${gpu})`; }
    else { name = 'mid'; rule = `tablet (${gpu})`; }
  } else if (DISCRETE.test(caps.renderer)) { name = 'high'; rule = `discrete GPU (${gpu})`; }
  else if (APPLE_SILICON.test(caps.renderer) || (APPLE_GPU.test(caps.renderer) && caps.astc)) { name = 'high'; rule = `Apple Silicon (${gpu})`; }
  else { name = 'mid'; rule = `integrated or unrecognised GPU (${gpu})`; }
  let tier = TIERS[name];
  while (!fits(tier, caps)) {
    if (tier.name === 'low') return null;
    const lower = TIERS[ORDER[ORDER.indexOf(tier.name) - 1]!];
    rule += `; ${tier.name} needs ${rowsFor(tier)} texture rows, the GPU allows ${caps.maxTextureSize} → ${lower.name}`;
    tier = lower;
  }
  return { tier, rule };
}

/** The screen's DPR, capped by the tier and by its pixel budget for this window size (not below the tier's floor). */
export const pixelRatioFor = (t: Tier, width = innerWidth, height = innerHeight): number =>
  Math.min(devicePixelRatio || 1, t.dpr, Math.max(t.dprFloor, Math.sqrt(t.pixels / Math.max(1, width * height))));
