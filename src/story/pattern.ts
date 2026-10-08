/**
 * The light chapter's pattern (reference v27): a circuit exposed onto the photosensitive layer. A grid
 * of cells around the chapter's hero grain; in each cell a horizontal trace, a vertical trace or a pad,
 * chosen per cell. Lit traces glow, the rest of the layer darkens. `cells` is cells per world unit.
 */
export const PATTERN = { world: 'light', cells: 1.5 } as const;
