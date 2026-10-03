// Stage colour per act: the background, the fog the grains fade into, and --stage for the page.
// Dark only (v10). The end has its own colour, which arrives with the final reveal.
export type StageAct = 'nature' | 'industry' | 'now' | 'end';

export const STAGES: Readonly<Record<StageAct, string>> = {
  nature: '#0d181c',
  industry: '#14171b',
  now: '#080b12',
  end: '#17110b',
};
