import { Color, Vector3 } from 'three';
import { STAGES, type StageAct } from '../story/stages';
import { WORLDS } from '../story/worlds';

/**
 * Hex for --stage. Truncates each channel, as three r149 (the reference) did; current three
 * rounds, which differs by one level wherever an interpolated channel lands just under an integer
 * (seen in the scrim gradient mid-transition).
 */
const cssHex = (c: Color): string =>
  '#' + [c.r, c.g, c.b].map((x) => (Math.min(255, Math.max(0, x * 255)) | 0).toString(16).padStart(2, '0')).join('');
const actOf = (i: number): StageAct => (WORLDS[i]!.final ? 'end' : WORLDS[i]!.act);

/**
 * The stage colour follows the act, eased like the camera between acts; the final chapter has the
 * end colour. Fog, the HDR target's clear colour (render/pipeline.ts) and the page's background
 * (body and scrim) stay in sync. Dark only (v10).
 */
export class StageColour {
  /** the fog colour for the grains (the interpolated colour itself, not its 8-bit hex) */
  readonly fog = new Color();
  /** the same colour, linear (fog and the HDR clear colour); from the current colour every frame */
  readonly fogLinear = new Vector3();
  private readonly lin = new Color();
  private readonly ca = new Color();
  private readonly cb = new Color();
  private last = '';
  private readonly body: HTMLElement;
  private readonly scrim: HTMLElement | null;
  private readonly scrimTop: HTMLElement | null;
  /** the page's stage colour as last written (8-bit hex) */
  hex = '';

  constructor(body: HTMLElement = document.body) {
    this.body = body;
    this.scrim = document.querySelector<HTMLElement>('.scrim:not(.scrim-top)');
    this.scrimTop = document.querySelector<HTMLElement>('.scrim-top');
  }

  update(a: number, b: number, eg: number): void {
    this.ca.set(STAGES[actOf(a)]);
    this.cb.set(STAGES[actOf(b)]);
    if (eg >= 1) this.fog.copy(this.cb); else this.fog.copy(this.ca).lerp(this.cb, eg);
    this.lin.copy(this.fog).convertSRGBToLinear();
    this.fogLinear.set(this.lin.r, this.lin.g, this.lin.b);
    const hex = cssHex(this.fog);
    if (hex === this.last) return;
    this.last = hex;
    // set where it is used: a --stage change on :root would restyle the whole document every frame of a move
    this.hex = hex;
    this.body.style.backgroundColor = hex;
    if (this.scrim) this.scrim.style.background = `linear-gradient(to top,${hex} 8%,transparent)`;
    // behind the HUD: subtle (70 %), so bright scenes keep the clock readable
    if (this.scrimTop) this.scrimTop.style.background = `linear-gradient(to bottom,${hex}b3,transparent)`;
  }
}
