import { ss } from '../core/ease';
import type { TransitionDef } from '../story/types';
import { WORLDS } from '../story/worlds';
import type { Bed } from './bed';

type Act = 'nature' | 'industry' | 'now' | 'end';
const actOf = (i: number): Act => (WORLDS[i]!.final ? 'end' : WORLDS[i]!.act);
const DESERT = WORLDS.findIndex((w) => w.slug === 'desert');
const WINDY = new Set(['river', 'coast'].map((s) => WORLDS.findIndex((w) => w.slug === s)));
const LAST = WORLDS.length - 1;

/** Per frame: crossfade the act layers with the story (hard switch around the cut, silence at the end). */
export function mixBed(bed: Bed | null, a: number, b: number, t: number, tr: TransitionDef): void {
  if (!bed?.on) return;
  const w = (act: Act): number => {
    const x = actOf(a) === act ? 1 : 0, y = actOf(b) === act ? 1 : 0;
    if (tr.cam === 'cut') return t < .25 ? x : t > .75 ? y : 0;
    return x * (1 - t) + y * t;
  };
  const now = bed.ctx.currentTime, k = tr.cam === 'cut' || b === LAST ? .03 : .25;
  const chipW = w('now') * (b === LAST ? 1 - ss(0, .4, t) : 1);
  bed.nature.gain.setTargetAtTime(w('nature') * .5, now, k);
  const windy = (a === DESERT ? 1 - t : 0) + (b === DESERT ? t : 0) + (WINDY.has(a) ? .4 : 0);
  bed.wind.gain.setTargetAtTime(w('nature') * (.06 + .22 * windy), now, k);
  bed.windFilter.frequency.setTargetAtTime(a >= DESERT ? 1700 : 800, now, .5);
  bed.industry.gain.setTargetAtTime(w('industry') * .38, now, k);
  bed.chip.gain.setTargetAtTime(chipW * .22, now, k);
}
