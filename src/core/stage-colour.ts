import { Color } from 'three';
import { STAGES, type StageAct } from '../story/stages';
import { WORLDS } from '../story/worlds';
import type { Stage } from './renderer';

const LAST = WORLDS.length - 1;

/**
 * Hex for --stage. Truncates each channel, as three r149 (the reference) did; current three
 * rounds, which differs by one level wherever an interpolated channel lands just under an integer
 * (seen in the scrim gradient mid-transition).
 */
const cssHex = (c: Color): string =>
  '#' + [c.r, c.g, c.b].map((x) => (Math.min(255, Math.max(0, x * 255)) | 0).toString(16).padStart(2, '0')).join('');
const actOf = (i: number): StageAct => (WORLDS[i]!.final ? 'end' : WORLDS[i]!.act);

/**
 * The stage colour follows the act, eased like the camera between acts. On the last chapter the
 * end colour comes in with the reveal. Clear colour, fog and the page's --stage stay in sync.
 * Dark or light comes from data-theme, else the system preference.
 */
export class StageColour {
  /** the fog colour for the grains (the interpolated colour itself, not its 8-bit hex) */
  readonly fog = new Color();
  private readonly ca = new Color();
  private readonly cb = new Color();
  private readonly ce = new Color();
  private last = '';
  private readonly stage: Stage;
  private readonly root: HTMLElement;
  private readonly dark = matchMedia('(prefers-color-scheme: dark)');

  constructor(stage: Stage, root: HTMLElement = document.documentElement) {
    this.stage = stage; this.root = root;
    const invalidate = (): void => { this.last = ''; };
    this.dark.addEventListener('change', invalidate);
    new MutationObserver(invalidate).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  }

  private get isDark(): boolean {
    const theme = this.root.dataset.theme;
    return theme ? theme === 'dark' : this.dark.matches;
  }

  /** Debug: a black clear colour (the overdraw view counts on it); the stage colour returns next update. */
  blackout(): void {
    this.stage.renderer.setClearColor(0x000000, 1);
    this.last = '';
  }

  update(a: number, b: number, eg: number, reveal: number): void {
    const k = this.isDark ? 0 : 1;
    this.ca.set(STAGES[actOf(a)][k]);
    this.cb.set(STAGES[b === LAST ? 'now' : actOf(b)][k]);
    if (b === LAST) this.cb.lerp(this.ce.set(STAGES.end[k]), reveal);
    if (eg >= 1) this.fog.copy(this.cb); else this.fog.copy(this.ca).lerp(this.cb, eg);
    const hex = cssHex(this.fog);
    if (hex === this.last) return;
    this.last = hex;
    this.stage.renderer.setClearColor(this.fog, 1);
    this.root.style.setProperty('--stage', hex);
  }
}
