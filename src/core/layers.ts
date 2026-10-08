/**
 * The render layers that can be switched. Two sources decide whether one is on:
 *   - the quality tier, fixed for the visit (core/quality.ts: low drops shadows, depth of field and the loupe);
 *   - overrides for measurements: ?off=a,b and the ?debug panel. They win.
 */
export type LayerName = 'light' | 'shadows' | 'dof' | 'bloom' | 'grade' | 'sky' | 'loupe';
export const LAYER_NAMES: readonly LayerName[] = ['light', 'shadows', 'dof', 'bloom', 'grade', 'sky', 'loupe'];
export type LayerSet = Readonly<Record<LayerName, boolean>>;

export const isLayerName = (k: string): k is LayerName => (LAYER_NAMES as readonly string[]).includes(k);

export class RenderLayers {
  private readonly base: LayerSet;
  /** forced on or off whatever the tier says (?off=, the debug panel) */
  readonly override: Partial<Record<LayerName, boolean>> = {};

  constructor(set: LayerSet) { this.base = { ...set }; }

  /** Whether the layer is drawn this frame. */
  on(k: LayerName): boolean { return this.override[k] ?? this.base[k]; }
}
