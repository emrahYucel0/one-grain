import { again } from './again';
import { chip } from './chip';
import { coast } from './coast';
import { crystal } from './crystal';
import { desert } from './desert';
import { furnace } from './furnace';
import { glass } from './glass';
import { granite } from './granite';
import { light } from './light';
import { magma } from './magma';
import { purity } from './purity';
import { quarry } from './quarry';
import { river } from './river';
import type { WorldGenerator } from './types';
import { wafer } from './wafer';
import { you } from './you';

/** Generator per world slug. Story order comes from story/worlds.ts. */
export const GENERATORS: Readonly<Record<string, WorldGenerator>> = {
  magma, granite, river, coast, desert, again,
  quarry, furnace, purity, crystal, wafer, light,
  chip, glass, you,
};

export { createContext } from './context';
export type { GenContext } from './context';
export type { Grains, Carry, WorldGenerator } from './types';
