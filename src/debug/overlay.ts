import type { GpuTimer } from '../core/gpu-timer';
import type { TierManager } from '../core/tiers';

/** ?debug: a corner readout of tier, grain count, pixel ratio and median frame time. Not part of the experience. */
export function debugOverlay(tiers: TierManager, pixelRatio: () => number, timer: GpuTimer): void {
  const el = document.createElement('pre');
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = 'position:fixed;left:8px;top:8px;z-index:9;margin:0;padding:6px 8px;font:12px/1.4 ui-monospace,monospace;background:rgba(0,0,0,.65);color:#fff;pointer-events:none;border-radius:4px';
  document.body.appendChild(el);
  const frames: number[] = [];
  const tick = (t: number): void => {
    frames.push(t);
    while (frames.length && t - frames[0]! > 1000) frames.shift();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  setInterval(() => {
    const m = tiers.monitor.median;
    el.textContent = `tier ${tiers.tier.name}${tiers.next ? ` → ${tiers.next.name} (queued)` : ''}\n` +
      `grains ${tiers.tier.n.toLocaleString('en-US')} · dpr ${pixelRatio().toFixed(2)}\n` +
      `fps ${frames.length} · median ${m > 0 ? m.toFixed(1) + ' ms' : '…'}` + gpuLine(timer);
  }, 500);
}

function gpuLine(timer: GpuTimer): string {
  const t = timer.times();
  if (!t.gpu) return '\ngpu timing unavailable';
  return `\ngpu ${t.total.toFixed(2)} ms · ` + Object.entries(t.passes).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(' · ');
}
