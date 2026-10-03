// Small numeric helpers shared by the generators (ported verbatim).

export const ss = (a: number, b: number, x: number): number => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const fr = (x: number): number => x - Math.floor(x);
/** sediment banding for the "again" strata */
export const band = (x: number, y: number): number => { const yy = y + .35 * Math.sin(x * .3) + .2 * Math.sin(x * .9 + 1); return fr(Math.floor((yy + 9) / 1.25) * .618) * .75 + .12; };
