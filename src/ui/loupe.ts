import { Vector3, type Camera } from 'three';
import type { NdcBox } from '../camera/safe-area';
import { ss } from '../core/ease';
import { flags, reportLoupe } from '../debug/parity';
import type { LoupeFrame } from '../render/loupe';
import { LOUPE, LOUPE_AVOID } from '../story/loupe';
import { WORLDS } from '../story/worlds';

/** A box on screen, CSS pixels (left, top, right, bottom). */
export interface Rect { l: number; t: number; r: number; b: number }

/** What the loupe reads from the frame (core/loop.ts). */
export interface LoupeInput {
  a: number;
  b: number;
  /** the blend between the two looks */
  k: number;
  /** progress in a hard cut (the loupe steps out of it), or -1 */
  cut: number;
  hero: Vector3;
  camera: Camera;
  heroVisible: boolean;
  /** the hero grain's light: the loupe fades with it */
  heroLight: number;
  /** the chapter's text block (ui/text-block.ts), null when there is none */
  text: NdcBox | null;
  /** reduced motion's cross-fade of the canvas (1 otherwise) */
  fade: number;
  /** shader time: the turn and the materials' motion (it stands still under reduced motion) */
  time: number;
  /** seconds since the last frame */
  dt: number;
  now: number;
}

const SHOW = LOUPE.map((l) => !!l.show);
const SWAY = LOUPE.map((l) => !!l.sway);
const AVOID = WORLDS.map((w) => LOUPE_AVOID[w.slug] ?? []);
/** around the HUD's and the rail's elements, and the viewport's edges */
const PAD = 14;
/** around the hero grain (its ring is 30 px) */
const HERO_CLEAR = 24;
/** candidate directions from the grain, screen angles in degrees (y down): up and to the right first (v27) */
const PREFERRED = -45;
const ANGLES = Array.from({ length: 12 }, (_, j) => PREFERRED + j * 30);
/** candidate distances from the grain, in lens radii */
const REACH = [1.9, 2.5, 3.3, 4.2];
/** and, where none of those is clear, a grid over the screen at this spacing (px) */
const GRID = 32;

const corner = new Vector3();

/** How far a circle (x, y, radius R) reaches into a rectangle, in pixels; 0 when clear. */
const intoRect = (x: number, y: number, R: number, q: Rect): number => {
  const dx = Math.max(q.l - x, 0, x - q.r), dy = Math.max(q.t - y, 0, y - q.b);
  const outside = Math.hypot(dx, dy);
  if (outside > 0) return Math.max(0, R - outside);
  return R + Math.min(x - q.l, q.r - x, y - q.t, q.b - y); // the centre inside: deeper still
};

/**
 * The loupe (reference v27): a magnified view of the hero grain beside it, joined to it by a thin line,
 * at granite, coast, quarry, wafer and display (story/loupe.ts), morphing between them and fading in and
 * out with the transitions, with the grain's light, and when the grain leaves the screen. Its lens is
 * drawn on the canvas (render/loupe.ts); its ring, line and caption are here, hidden from assistive
 * technology (aria-hidden in index.html).
 *
 * Placement: of a ring of candidate spots around the grain (up and to the right preferred, as in v27),
 * and failing those a grid over the screen, the nearest that keeps clear of the chapter's text, the HUD, the rail, the screen's edges, the grain
 * itself and the scene's main subject (the wafer stack, the display panel: a box in world space,
 * projected). Where no spot is clear the loupe stays away. The spot is chosen from the frame alone (no
 * memory), so a position looks the same however it is reached; the lens glides to it.
 */
export class LoupeView {
  private readonly el: HTMLElement;
  private readonly line: HTMLElement;
  private box = { left: 0, top: 0, width: innerWidth, height: innerHeight };
  private R = 88;
  private hud: Rect[] = [];
  private readonly cur = { x: 0, y: 0, placed: false };
  private avail = 0;
  private start = -1;
  private written = { frame: '', op: '', line: '', lineOp: '' };
  readonly frame: LoupeFrame = { x: 0, y: 0, r: 88, op: 0, a: 0, b: 0, k: 0, time: 0, yaw: 0, tilt: .55 };

  constructor(el: HTMLElement, line: HTMLElement, canvas: HTMLElement, hud: readonly HTMLElement[]) {
    this.el = el; this.line = line;
    const measure = (): void => {
      const r = canvas.getBoundingClientRect();
      this.box = { left: r.left, top: r.top, width: r.width, height: r.height };
      this.R = (el.offsetWidth || 176) / 2;
      this.hud = hud.map((h) => h.getBoundingClientRect()).filter((q) => q.width && q.height)
        .map((q) => ({ l: q.left - PAD, t: q.top - PAD, r: q.right + PAD, b: q.bottom + PAD }));
    };
    measure();
    addEventListener('resize', measure);
    // the HUD's clock and controls change size with their words
    const ro = new ResizeObserver(measure);
    for (const h of hud) ro.observe(h);
  }

  /** Off (the low tier, ?off=loupe): nothing shown, nothing drawn. */
  hide(): null {
    this.write('', '0', '', '0');
    this.cur.placed = false;
    reportLoupe(null);
    return null;
  }

  /** This frame's lens (null: nothing to draw), with the ring, line and caption placed. */
  update(f: LoupeInput): LoupeFrame | null {
    if (this.start < 0) this.start = f.now;
    const { box, R } = this;
    const ndc = corner.copy(f.hero).project(f.camera);
    const hx = box.left + (ndc.x + 1) / 2 * box.width, hy = box.top + (1 - ndc.y) / 2 * box.height;
    // how much of it there is: the chapters that show it, the grain on screen and lit, out of a cut
    const show = (SHOW[f.a] ? 1 - f.k : 0) + (SHOW[f.b] ? f.k : 0);
    const edge = Math.min(1 - Math.abs(ndc.x), 1 - Math.abs(ndc.y));
    const onScreen = f.heroVisible && ndc.z < 1 ? ss(0, .06, edge) : 0;
    const cut = f.cut < 0 ? 1 : 1 - ss(.06, .22, f.cut) * (1 - ss(.78, .94, f.cut));
    // it comes in a moment after the scene does (not under ?parity, where the harness drives each frame)
    let op = show * onScreen * f.heroLight * cut * f.fade * (flags.parity ? 1 : ss(1.2, 2.6, (f.now - this.start) / 1000));

    // where: the clearest nearby spot
    const blocks = this.obstacles(f);
    let best = { x: hx, y: hy, cost: Infinity, into: Infinity };
    const W = innerWidth, H = innerHeight;
    const consider = (x: number, y: number): void => {
      let into = Math.max(0, R + PAD - x, R + PAD - y, x + R + PAD - W, y + R + PAD - H);
      const dist = Math.hypot(x - hx, y - hy);
      into += Math.max(0, R + HERO_CLEAR - dist);
      for (const q of blocks) into += intoRect(x, y, R, q);
      const deg = Math.atan2(y - hy, x - hx) * 180 / Math.PI, turn = Math.abs(((deg - PREFERRED + 540) % 360) - 180) / 30;
      const cost = into * 1e3 + dist * .2 + turn * 10;
      if (cost < best.cost) best = { x, y, cost, into };
    };
    for (const reach of REACH) for (const deg of ANGLES) { const a = deg * Math.PI / 180; consider(hx + Math.cos(a) * reach * R, hy + Math.sin(a) * reach * R); }
    if (best.into >= .5) for (let y = R + PAD; y <= H - R - PAD; y += GRID) for (let x = R + PAD; x <= W - R - PAD; x += GRID) consider(x, y);
    const clear = best.into < .5;
    const glide = 1 - Math.exp(-f.dt * 9);
    if (op < .005 || !this.cur.placed) { this.avail = clear ? 1 : 0; if (clear) { this.cur.x = best.x; this.cur.y = best.y; this.cur.placed = true; } }
    else {
      this.avail += ((clear ? 1 : 0) - this.avail) * glide;
      if (clear) { this.cur.x += (best.x - this.cur.x) * glide; this.cur.y += (best.y - this.cur.y) * glide; }
    }
    op *= this.avail;
    if (!this.cur.placed) op = 0;

    // the ring and the line (from just off the grain to the ring)
    const cx = this.cur.x, cy = this.cur.y, dx = cx - hx, dy = cy - hy, dist = Math.max(1e-3, Math.hypot(dx, dy)), len = Math.max(0, dist - R - 10);
    const shown = op >= .005;
    this.write(
      shown ? `translate(${(cx - R).toFixed(1)}px,${(cy - R).toFixed(1)}px)` : this.written.frame, shown ? op.toFixed(3) : '0',
      shown ? `translate(${(hx + dx / dist * 10).toFixed(1)}px,${(hy + dy / dist * 10).toFixed(1)}px) rotate(${Math.atan2(dy, dx).toFixed(4)}rad) scaleX(${len.toFixed(1)})` : this.written.line,
      shown ? (op * .9).toFixed(3) : '0',
    );
    reportLoupe(shown ? { x: cx, y: cy, r: R, op, hero: [hx, hy], avoid: blocks } : null);
    if (!shown) return null;
    const fr = this.frame;
    fr.x = cx - box.left; fr.y = cy - box.top; fr.r = R; fr.op = op; fr.a = f.a; fr.b = f.b; fr.k = f.k; fr.time = f.time;
    // a slow turn so the surface reads, tilted to show the crystal's faces; a face that must stay towards
    // the viewer (the pixel) sways to and fro instead. It stands still with the clock (reduced motion).
    const sway = (SWAY[f.a] ? 1 - f.k : 0) + (SWAY[f.b] ? f.k : 0);
    fr.yaw = f.time * .35 * (1 - sway) + Math.sin(f.time * .3) * .45 * sway; fr.tilt = .55 + Math.sin(f.time * .21) * .12 - .25 * sway;
    return fr;
  }

  /** What the loupe must keep clear of this frame, on screen. */
  private obstacles(f: LoupeInput): Rect[] {
    const out = [...this.hud], { box } = this;
    const px = (x: number): number => box.left + (x + 1) / 2 * box.width, py = (y: number): number => box.top + (1 - y) / 2 * box.height;
    if (f.text) out.push({ l: px(f.text.left), t: py(f.text.top), r: px(f.text.right), b: py(f.text.bottom) });
    for (const [w, weight] of [[f.a, 1 - f.k], [f.b, f.k]] as const) {
      if (weight <= .01) continue;
      for (const avoid of AVOID[w] ?? []) {
      const q: Rect = { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity };
      for (let i = 0; i < 8; i++) {
        corner.set(avoid[i & 1 ? 1 : 0][0], avoid[i & 2 ? 1 : 0][1], avoid[i & 4 ? 1 : 0][2]).project(f.camera);
        if (corner.z > 1) continue; // behind the camera
        const x = px(Math.max(-1.5, Math.min(1.5, corner.x))), y = py(Math.max(-1.5, Math.min(1.5, corner.y)));
        q.l = Math.min(q.l, x); q.r = Math.max(q.r, x); q.t = Math.min(q.t, y); q.b = Math.max(q.b, y);
      }
      if (q.l < q.r) out.push(q);
      }
    }
    return out;
  }

  private write(frame: string, op: string, line: string, lineOp: string): void {
    const w = this.written;
    if (frame !== w.frame) { w.frame = frame; this.el.style.transform = frame; }
    if (op !== w.op) { w.op = op; this.el.style.opacity = op; }
    if (line !== w.line) { w.line = line; this.line.style.transform = line; }
    if (lineOp !== w.lineOp) { w.lineOp = lineOp; this.line.style.opacity = lineOp; }
  }
}
