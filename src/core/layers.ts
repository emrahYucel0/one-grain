/**
 * The render layers that can be switched. Three sources decide whether one is on:
 *   - the quality tier (core/quality.ts: v10 drops shadows and depth of field on small screens);
 *   - the adaptive downgrade (core/tiers.ts), which switches layers off and, once frames have
 *     headroom again, back on;
 *   - overrides for measurements: ?off=a,b and the ?debug panel. They win over both.
 */
export type LayerName = 'light' | 'shadows' | 'dof' | 'bloom' | 'grade';
export const LAYER_NAMES: readonly LayerName[] = ['light', 'shadows', 'dof', 'bloom', 'grade'];
export type LayerSet = Readonly<Record<LayerName, boolean>>;

export const isLayerName = (k: string): k is LayerName => (LAYER_NAMES as readonly string[]).includes(k);

export class RenderLayers {
  private readonly base: Record<LayerName, boolean>;
  /** forced on or off whatever the tier and the downgrade say (?off=, the debug panel) */
  readonly override: Partial<Record<LayerName, boolean>> = {};

  constructor(set: LayerSet) { this.base = { ...set }; }

  /** Whether the layer is drawn this frame. */
  on(k: LayerName): boolean { return this.override[k] ?? this.base[k]; }

  /** The downgrade switches a layer off. */
  drop(k: LayerName): void { this.base[k] = false; }

  /** The downgrade switches a layer back on (only layers it switched off). */
  restore(k: LayerName): void { this.base[k] = true; }

  /** A new tier: its layers, minus the ones the downgrade has switched off. */
  setTier(set: LayerSet, dropped: ReadonlySet<LayerName>): void { for (const k of LAYER_NAMES) this.base[k] = set[k] && !dropped.has(k); }
}
