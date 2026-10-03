import type { WorldDef } from './types';

// Behavioural spec: reference/blockout-v5.html. Order matters (grain order, RNG order, scroll order).
export const WORLDS: readonly WorldDef[] = [
  { slug: 'magma', act: 'nature', hold: 1.6, clock: [0, 'years'], lo: '#3c302c', hi: '#ede6dc', grain: .07, cam: [3, 1.5, 10], look: [-2, -.6, -3] },
  { slug: 'granite', act: 'nature', hold: 1.1, clock: [2e7, 'years'], lo: '#55514d', hi: '#cbbaa9', grain: .13, cam: [-2, 3, 30], look: [-2, 1, -6] },
  { slug: 'river', act: 'nature', hold: 1.0, clock: [2.01e7, 'years'], lo: '#5e5040', hi: '#b39b74', grain: .07, cam: [-5, 2.4, 7.5], look: [2.5, -.2, -1] },
  { slug: 'coast', act: 'nature', hold: 1.0, clock: [2.03e7, 'years'], lo: '#86714f', hi: '#e2cfa8', grain: .065, cam: [5, 1.8, 6.5], look: [-2, 0, .8] },
  { slug: 'desert', act: 'nature', hold: 1.6, clock: [2.05e7, 'years'], lo: '#97653a', hi: '#e8ba7b', grain: .17, cam: [-7, 3.2, 11], look: [3, -.5, -4] },
  { slug: 'again', act: 'nature', hold: .9, clock: [3e8, 'years'], lo: '#8a4a2c', hi: '#ead0a6', grain: .09, cam: [7, 3.5, 11], look: [-2.5, .5, -1.5] },

  { slug: 'quarry', act: 'industry', hold: 1.0, clock: [1, 'days'], lo: '#6f6252', hi: '#e8dfd2', grain: .12, cam: [-4, 8, 16], look: [3, -5, -8] },
  { slug: 'furnace', act: 'industry', hold: 1.0, clock: [3, 'days'], lo: '#2f2b29', hi: '#8c8178', grain: .08, cam: [0, 6, 12], look: [0, -2, -3] },
  { slug: 'purity', act: 'industry', hold: .8, clock: [10, 'days'], lo: '#46525e', hi: '#dbe3ea', grain: .06, cam: [4, 1.2, 9], look: [-3.5, 1.5, -5] },
  { slug: 'crystal', act: 'industry', hold: 1.3, clock: [14, 'days'], lo: '#46525e', hi: '#eef3f6', grain: .05, cam: [7, 4, 14], look: [-4.5, 3, -2] },
  { slug: 'wafer', act: 'industry', hold: .8, clock: [16, 'days'], lo: '#3e4a59', hi: '#e8eef4', grain: .05, cam: [5, 2.6, 7], look: [-2, 1.8, -2] },
  { slug: 'light', act: 'industry', hold: .9, clock: [90, 'days'], lo: '#2e2a45', hi: '#d6cff2', grain: .045, cam: [2.2, 5.4, 4.2], look: [-.5, -1.2, -1.6] },

  { slug: 'chip', act: 'now', hold: 1.3, clock: [.33, 'ns'], lo: '#121519', hi: '#b9c1cc', grain: .032, cam: [3, 3.8, 5], look: [-2.2, -1.6, -3.6] },
  { slug: 'glass', act: 'now', hold: 1.4, clock: [16.7, 'ms'], lo: '#4f8286', hi: '#dff2f0', grain: .06, cam: [6, 2, 9], look: [-6, -1, -2] },
  { slug: 'you', act: 'now', hold: 2.4, clock: [0, 'now'], lo: '#7e6142', hi: '#f2deb6', grain: .05, cam: [0, 0, 17], look: [0, 0, -1], final: true },
];

/** Worlds where the visitor can play with the grains while resting (input/interact.ts). */
export const INTERACTIVE = { desert: 1, chip: 2 } as const;
