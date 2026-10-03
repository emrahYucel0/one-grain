import type { GpuTimer } from '../core/gpu-timer';
import { LAYER_NAMES, type LayerName, type RenderLayers } from '../core/layers';
import type { TierManager } from '../core/tiers';

const LABELS: Record<LayerName, string> = { light: 'Light', shadows: 'Shadows', dof: 'Depth of field', bloom: 'Bloom', grade: 'Grade' };

/**
 * ?debug: a corner panel. A readout of tier, grain count, pixel ratio, frame time and GPU time per
 * pass (live, smoothed, plus the raw medians of whole frames and of shadow-refresh frames), and a
 * toggle per render layer. A toggle overrides tier and downgrade until reset. Not part of the
 * experience.
 */
export function debugOverlay(tiers: TierManager, layers: RenderLayers, pixelRatio: () => number, timer: GpuTimer): void {
  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;left:8px;top:8px;z-index:9;display:flex;flex-direction:column;gap:6px;align-items:flex-start;font:12px/1.4 ui-monospace,monospace';
  const el = document.createElement('pre');
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = 'margin:0;padding:6px 8px;background:rgba(0,0,0,.65);color:#fff;pointer-events:none;border-radius:4px';
  const group = document.createElement('div');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', 'Render layers (debug)');
  group.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px';
  const button = (label: string, onClick: () => void): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = label;
    b.style.cssText = 'font:inherit;padding:2px 8px;border-radius:999px;border:1px solid rgba(255,255,255,.4);cursor:pointer';
    b.addEventListener('click', onClick);
    group.append(b);
    return b;
  };
  const toggles = LAYER_NAMES.map((k) => [k, button(LABELS[k], () => { layers.override[k] = !layers.on(k); sync(); })] as const);
  button('Reset', () => { for (const k of LAYER_NAMES) delete layers.override[k]; sync(); });
  const sync = (): void => {
    for (const [k, b] of toggles) {
      const on = layers.on(k), forced = k in layers.override;
      b.setAttribute('aria-pressed', String(on));
      b.style.background = on ? '#ece3d3' : 'rgba(0,0,0,.65)';
      b.style.color = on ? '#111' : '#fff';
      b.style.borderStyle = forced ? 'dashed' : 'solid';
      b.title = forced ? 'overridden (Reset returns it to the tier)' : 'set by the tier and the downgrade';
    }
  };
  panel.append(el, group);
  document.body.appendChild(panel);

  const frames: number[] = [];
  const tick = (t: number): void => {
    frames.push(t);
    while (frames.length && t - frames[0]! > 1000) frames.shift();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  sync();
  setInterval(() => {
    const m = tiers.monitor.median;
    el.textContent = `tier ${tiers.tier.name}${tiers.next ? ` → ${tiers.next} (queued)` : ''}\n` +
      `grains ${tiers.tier.n.toLocaleString('en-US')} · dpr ${pixelRatio().toFixed(2)}\n` +
      `fps ${frames.length} · median ${m > 0 ? m.toFixed(1) + ' ms' : '…'}` + gpuLines(timer);
    sync(); // the downgrade may have switched a layer off
  }, 500);
}

function gpuLines(timer: GpuTimer): string {
  const t = timer.times();
  if (!t.gpu) return '\ngpu timing unavailable';
  const recent = t.recent.slice(-120);
  const med = (a: number[]): string => { const s = a.sort((x, y) => x - y); return s.length ? `${s[s.length >> 1]!.toFixed(2)} ms` : '—'; };
  return `\ngpu frame ${med(recent.map((r) => r.total))} · refresh frames ${med(recent.filter((r) => 'shadow' in r.passes).map((r) => r.total))}\n` +
    Object.entries(t.passes).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(' · ');
}
