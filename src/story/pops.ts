import { DataTexture, RGBAFormat, UnsignedByteType, Vector3, type PerspectiveCamera } from 'three';
import { ss } from '../core/ease';
import { TOUCH } from '../timeline/config';
import { WORLDS } from './worlds';

/**
 * Awwwards P10: the display, opened. Only through the loupe: clicking the display's loupe (ui/loupe.ts) takes the story to a place
 * partway into the display → now transition (T_PIN: the light out, the sub-pixels loosened into clusters,
 * the camera close). Resting there, one cluster at a time, chosen at random, glints; clicked (tapped), it
 * bursts and is gone, and the next one glints. The scroll leaves whenever the visitor wants (on into the
 * sand, or back to the display), and the line under it says so; after a few, it says where they went: in
 * the sand of the last chapter each one left a hollow, which the ending's ring fills back.
 *
 * State lives in a 66 × 40 texture, one texel per sub-pixel cell of worlds/display.ts (r: how far its burst
 * has gone, g: how brightly it glints), read by the grains (shaders/grains.vert.glsl).
 */

/** the display's sub-pixel grid (worlds/display.ts) and the sand's scale (worlds/now.ts) */
const COLS = 66, ROWS = 40, X0 = -9.9, Y0 = -5.9, CELL = .3, SAND = 1.36;
export const POP_WORLD = WORLDS.findIndex((w) => w.slug === 'display');
/** where in the display → now transition the popping happens (shaders/transitions.glsl style 21) */
export const T_PIN = .36;
/** how close to it counts as there */
const NEAR = .025;
const GLINT_IN = .35, BURST_S = .9, NEXT_S = .55;
/** after this many, the line says where they went */
const TELL_AFTER = 3;
/** clicks this far (CSS px) from a glinting cluster's centre count (at least) */
const HIT_PX = 34;
/** how far a glinting cluster keeps from the HUD (CSS px) */
const HUD_CLEAR = 56;

const v = new Vector3();

export class Pops {
  readonly texture: DataTexture;
  private readonly data = new Uint8Array(COLS * ROWS * 4);
  /** cell → when it was popped (s) */
  private readonly popped = new Map<number, number>();
  private glint = -1;
  private glintAt = 0;
  private nextAt = 0;
  private count = 0;
  private active = false;
  /** the visitor came in through the loupe (enter()); scrolling on past the place lets it go, so the story's
   * own transition plays untouched for everyone who did not */
  private entered = false;
  private inside = false;
  private live = false;
  private dirty = true;
  /** the glinting cluster on screen (CSS px), and how far one cell spans there */
  private readonly spot = { x: -1e4, y: -1e4, r: HIT_PX };
  private readonly el: HTMLElement | null;
  private readonly doEl: HTMLElement | null;
  private shown = { on: false, line: '', over: false };
  private press = { x: 0, y: 0, id: -1 };
  private hand = { x: -1e4, y: -1e4 };
  private now = 0;
  private freshT = 0;

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    this.texture = new DataTexture(this.data, COLS, ROWS, RGBAFormat, UnsignedByteType);
    this.texture.needsUpdate = true;
    this.el = document.getElementById('pops');
    this.doEl = this.el?.querySelector('.pops-do') ?? null;
    // a mouse pops on press; a finger on lifting, if it did not move (moving, it scrolls)
    addEventListener('pointermove', (e) => { this.hand.x = e.clientX; this.hand.y = e.clientY; }, { passive: true });
    addEventListener('pointerdown', (e) => {
      if (!this.active || e.button !== 0) return;
      if (e.pointerType === 'mouse') this.hit(e.clientX, e.clientY);
      else this.press = { x: e.clientX, y: e.clientY, id: e.pointerId };
    }, { passive: true });
    addEventListener('pointerup', (e) => {
      if (e.pointerId !== this.press.id) return;
      this.press.id = -1;
      if (this.active && Math.hypot(e.clientX - this.press.x, e.clientY - this.press.y) < 12) this.hit(e.clientX, e.clientY);
    }, { passive: true });
    addEventListener('pointercancel', () => { this.press.id = -1; }, { passive: true });
    if (import.meta.env.DEV) (window as unknown as { __pops: unknown }).__pops = { spot: this.spot, get count() { return self.count; }, get active() { return self.active; }, get glint() { return self.glint; } };
    addEventListener('keydown', (e) => { if (this.active && (e.key === 'Enter' || e.key === ' ') && this.glint >= 0) { e.preventDefault(); this.pop(this.glint); } });
  }

  /** The display's loupe was clicked: the popping opens when the story gets there. */
  enter(): void { this.entered = true; this.inside = false; }

  /** whether any cell is popped or glinting (the grains skip the work otherwise) */
  get on(): boolean { return this.live; }

  /** The visitor's click: the glinting cluster, if it is under it. */
  private hit(x: number, y: number): void {
    if (this.glint < 0 || this.now - this.glintAt < .15) return;
    if (Math.hypot(x - this.spot.x, y - this.spot.y) <= this.spot.r) this.pop(this.glint);
  }

  private pop(cell: number): void {
    this.popped.set(cell, this.now);
    this.glint = -1; this.nextAt = this.now + NEXT_S; this.count++;
    this.dirty = true;
  }

  /** Everything back as it was (the ending's ring has filled the sand). */
  reset(): void {
    if (!this.popped.size && this.glint < 0) return;
    this.popped.clear(); this.glint = -1; this.count = 0;
    this.data.fill(0); this.texture.needsUpdate = true; this.live = false;
  }

  /** the cluster of cell i, where it is at transition point t (shaders/transitions.glsl style 21, its mean) */
  private where(i: number, t: number, out: Vector3): Vector3 {
    const x = X0 + (i % COLS) * CELL, y = Y0 + Math.floor(i / COLS) * CELL;
    const rise = ss(.18, .4, t), part = ss(.32, .7, t - .025);
    return out.set(x + (x * SAND - x) * part, y + (y * SAND - y) * part, -1.2 + 1.2 * rise + (.03 + 1.2 - 1.2 * rise) * part);
  }

  /** a cell, at random, not popped, its cluster well inside the screen, clear of the grain and the HUD */
  private pick(camera: PerspectiveCamera, t: number, hero: Vector3): number {
    const w = innerWidth, h = innerHeight;
    const hp = v.copy(hero).project(camera), hx = (hp.x + 1) / 2 * w, hy = (1 - hp.y) / 2 * h;
    // the HUD's brand, clock and controls and the rail, with a finger's width round them (a tap meant for a
    // cluster must not land on a button)
    const hud = [...document.querySelectorAll('.hud .brand, #time, .controls, #timeline')].map((e) => e.getBoundingClientRect()).filter((r) => r.width && r.height);
    const pool: number[] = [];
    for (let i = 0; i < COLS * ROWS; i++) {
      if (this.popped.has(i)) continue;
      const q = this.where(i, t, v).project(camera);
      if (q.z >= 1) continue;
      const sx = (q.x + 1) / 2 * w, sy = (1 - q.y) / 2 * h;
      if (sx < w * .1 || sx > w * .8 || sy < h * .16 || sy > h * .74) continue;
      if (Math.hypot(sx - hx, sy - hy) < 90) continue;
      if (hud.some((r) => sx > r.left - HUD_CLEAR && sx < r.right + HUD_CLEAR && sy > r.top - HUD_CLEAR && sy < r.bottom + HUD_CLEAR)) continue;
      pool.push(i);
    }
    return pool.length ? pool[(Math.random() * pool.length) | 0]! : -1;
  }

  /**
   * Once per frame, after the camera is placed. `a`/`t`: the transition the story is in (a = -1 resting);
   * `fill`: 0..1, the sand filled back after the ending's ring (at 1 everything is reset).
   */
  update(now: number, a: number, hold: number, t: number, camera: PerspectiveCamera, hero: Vector3, fill: number): { on: boolean; fill: number } {
    this.now = now;
    if (fill >= 1) { this.reset(); return { on: false, fill: 0 }; }
    const there = a === POP_WORLD && hold < 0 && Math.abs(t - T_PIN) < NEAR;
    if (this.entered && there) this.inside = true;
    else if (this.inside || (this.entered && a !== POP_WORLD && hold !== POP_WORLD)) this.entered = this.inside = false;
    this.active = there && this.entered;
    if (this.active && this.glint < 0 && now >= this.nextAt) {
      this.glint = this.pick(camera, t, hero); this.glintAt = now; this.dirty = true;
    }
    if (!this.active && this.glint >= 0) { this.glint = -1; this.dirty = true; } // a new one glints on coming back
    // the texture: bursts under way and the glint change every frame; settled, nothing to write
    const bursting = [...this.popped.values()].some((at) => now - at < BURST_S);
    if (this.dirty || bursting || this.glint >= 0) {
      this.data.fill(0);
      for (const [i, at] of this.popped) this.data[i * 4] = Math.max(1, Math.round(Math.min(1, (now - at) / BURST_S) * 255));
      if (this.glint >= 0) this.data[this.glint * 4 + 1] = Math.round(ss(0, GLINT_IN, now - this.glintAt) * 255);
      this.texture.needsUpdate = true; this.dirty = false;
    }
    this.live = this.popped.size > 0 || this.glint >= 0;
    // where the glinting one is, for the click
    if (this.glint >= 0) {
      const q = this.where(this.glint, t, v).project(camera);
      this.spot.x = (q.x + 1) / 2 * innerWidth; this.spot.y = (1 - q.y) / 2 * innerHeight;
      const r = this.where(this.glint + 1, t, v).project(camera);
      this.spot.r = Math.max(HIT_PX, Math.abs(r.x - q.x) / 2 * innerWidth * .6);
    }
    this.view();
    return { on: this.live, fill };
  }

  /** the line under it, and the cursor over the one that glints */
  private view(): void {
    const el = this.el;
    if (el && this.active !== this.shown.on) { this.shown.on = this.active; el.classList.toggle('on', this.active); }
    const ds = el?.dataset ?? {};
    const line = (this.count >= TELL_AFTER ? ds.tell : this.count > 0 ? ds.again : TOUCH ? ds.tap : ds.click) ?? '';
    if (this.doEl && line !== this.shown.line) {
      this.shown.line = line; this.doEl.textContent = line;
      // the line arrives lit for its first seconds, so a quick look does not miss it
      el?.classList.add('fresh'); clearTimeout(this.freshT); this.freshT = window.setTimeout(() => el?.classList.remove('fresh'), 3200);
    }
    const over = this.active && this.glint >= 0 && Math.hypot(this.hand.x - this.spot.x, this.hand.y - this.spot.y) <= this.spot.r;
    if (over !== this.shown.over) { this.shown.over = over; document.documentElement.classList.toggle('pop-over', over); }
  }
}
