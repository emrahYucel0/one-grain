// Stage colour per act: the background, the fog the grains fade into, and --stage for the page.
// [dark, light]. The end has its own colour, which arrives with the final reveal.
export type StageAct = 'nature' | 'industry' | 'now' | 'end';

export const STAGES: Readonly<Record<StageAct, readonly [dark: string, light: string]>> = {
  nature: ['#0d181c', '#d3d7d2'],
  industry: ['#14171b', '#d8d9d6'],
  now: ['#080b12', '#e1e3e7'],
  end: ['#17110b', '#e7ddcb'],
};
