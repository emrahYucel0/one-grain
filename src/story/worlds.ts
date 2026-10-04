import type { WorldDef } from './types';

// Behavioural spec: reference/blockout-v5.html. Order matters (grain order, RNG order, scroll order).
export const WORLDS: readonly WorldDef[] = [
  { slug: 'magma', act: 'nature', hold: 1.6, clock: { unit: 'years', value: 0 }, lo: '#3c302c', hi: '#ede6dc', grain: .07, cam: [3, 1.5, 10], look: [-2, -.6, -3], conf: .1, frame: 1, wideAnchor: 0 },
  { slug: 'granite', act: 'nature', hold: 1.1, clock: { unit: 'years', value: 3e5 }, lo: '#55514d', hi: '#cbbaa9', grain: .13, cam: [-2, 3, 30], look: [-2, 1, -6], conf: .3, frame: .85, wideAnchor: .5 },
  { slug: 'river', act: 'nature', hold: 1.0, clock: { unit: 'years', value: 2e7 }, lo: '#5e5040', hi: '#b39b74', grain: .07, cam: [-5, 2.4, 7.5], look: [2.5, -.2, -1], conf: 0, frame: 1, wideAnchor: .85 },
  { slug: 'coast', act: 'nature', hold: 1.0, clock: { unit: 'years', value: 2e7 }, lo: '#86714f', hi: '#e2cfa8', grain: .065, cam: [5, 1.8, 6.5], look: [-2, 0, .8], conf: .05, frame: 1, wideAnchor: .5 },
  { slug: 'desert', act: 'nature', hold: 1.6, clock: { unit: 'years', value: 2.1e7 }, lo: '#97653a', hi: '#e8ba7b', grain: .17, cam: [-7, 3.2, 11], look: [3, -.5, -4], conf: .15, frame: 1, wideAnchor: .85 },
  { slug: 'again', act: 'nature', hold: .9, clock: { unit: 'years', value: 3e8 }, lo: '#8a4a2c', hi: '#ead0a6', grain: .09, cam: [7, 3.5, 11], look: [-2.5, .5, -1.5], conf: 0, frame: 1, wideAnchor: .5 },

  { slug: 'quarry', act: 'industry', hold: 1.0, clock: { unit: 'prod' }, lo: '#6f6252', hi: '#e8dfd2', grain: .12, cam: [-17, 18, -2], look: [0, -2, -7.6], conf: .3, frame: 1, wideAnchor: .7 },
  { slug: 'furnace', act: 'industry', hold: 1.0, clock: { unit: 'prod' }, lo: '#2f2b29', hi: '#8c8178', grain: .08, cam: [0, 6, 12], look: [0, -2, -3], conf: .5, frame: 1.25, wideAnchor: .6 },
  { slug: 'purity', act: 'industry', hold: .8, clock: { unit: 'prod' }, lo: '#46525e', hi: '#dbe3ea', grain: .06, cam: [4, 1.2, 9], look: [-3.5, 1.5, -5], conf: .75, frame: 1.6, wideAnchor: 0 },
  { slug: 'crystal', act: 'industry', hold: 1.3, clock: { unit: 'prod' }, lo: '#46525e', hi: '#eef3f6', grain: .05, cam: [7, 5.5, 14], look: [-4.5, 4.6, -2], conf: 1, frame: 1.55, wideAnchor: 0 },
  { slug: 'wafer', act: 'industry', hold: .8, clock: { unit: 'prod' }, lo: '#3e4a59', hi: '#e8eef4', grain: .05, cam: [5, 2.6, 7], look: [-2, 1.8, -2], conf: .85, frame: 1.25, wideAnchor: 0 },
  { slug: 'light', act: 'industry', hold: .9, clock: { unit: 'prod' }, lo: '#2f2c40', hi: '#d4d0e6', grain: .045, cam: [2.2, 5.4, 4.2], look: [-.5, -1.2, -1.6], conf: .55, frame: 1.2, wideAnchor: .65 },

  { slug: 'chip', act: 'now', hold: 1.3, clock: { unit: 'prod' }, lo: '#121519', hi: '#b9c1cc', grain: .032, cam: [3, 3.8, 5], look: [-2.2, -1.6, -3.6], conf: .25, frame: 1, wideAnchor: .8 },
  { slug: 'display', act: 'now', hold: 1.4, clock: { unit: 'live' }, lo: '#4f8286', hi: '#dff2f0', grain: .06, cam: [6, 2, 9], look: [-6, -1, -2], conf: .4, frame: 1.15, wideAnchor: .5 },
  { slug: 'now', act: 'now', hold: 2.4, clock: { unit: 'now' }, lo: '#6f5338', hi: '#f0dcb4', grain: .085, cam: [0, 0, 17], look: [0, 0, -1], conf: 0, frame: .85, wideAnchor: .5, final: true },
];

/** Worlds where the visitor can play with the grains while resting (input/interact.ts). */
export const INTERACTIVE = { desert: 1, chip: 2 } as const;
