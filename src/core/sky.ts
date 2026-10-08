import { Color, LinearSRGBColorSpace, Vector2, Vector3 } from 'three';
import { NO_SKY, SKIES, type Sky } from '../story/skies';
import { WORLDS } from '../story/worlds';

/** The sky as it is this frame: two worlds' skies blended, colours linear. */
export interface SkyState {
  amount: number;
  horizon: number;
  ground: Color;
  zenith: Color;
  low: Color;
  sun: Vector2;
  sunColour: Color;
  sunIntensity: number;
  sunSize: number;
  clouds: number;
  cloudColour: Color;
}

interface Linear { sky: Sky; ground: Color; zenith: Color; low: Color; sunColour: Color; cloudColour: Color }
/** sRGB hex to linear, by the formula: independent of three's colour management, which this module's
 * load may precede (core/renderer.ts turns it off), and which would otherwise convert twice */
const toLinear = (hex: string): Color => {
  const v = parseInt(hex.slice(1), 16), ch = (x: number): number => { const c = x / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; };
  return new Color().setRGB(ch(v >> 16 & 255), ch(v >> 8 & 255), ch(v & 255), LinearSRGBColorSpace);
};
const linear = (sky: Sky): Linear => {
  const c = toLinear;
  return { sky, ground: c(sky.ground), zenith: c(sky.zenith), low: c(sky.low), sunColour: c(sky.sunColour), cloudColour: c(sky.cloudColour) };
};
const PER_WORLD: readonly Linear[] = WORLDS.map((w) => linear(SKIES[w.slug] ?? NO_SKY));

/** The sky is drawn at this share of its colour (v27): the post chain's exposure brings it up. */
export const SKY_LEVEL = .62;
/** How far distant grains fog into the sky's horizon instead of the stage colour, at full sky. */
const FOG_TO_SKY = .7;

const num = (a: number, b: number, k: number): number => (k >= 1 ? b : a + (b - a) * k);
const col = (out: Color, a: Color, b: Color, k: number): Color => (k >= 1 ? out.copy(b) : out.copy(a).lerp(b, k));

/** Blends the skies of worlds a and b by k (the camera's easing, like the stage colour). */
export class SkyBlend {
  readonly state: SkyState = {
    amount: 0, horizon: .5, ground: new Color(), zenith: new Color(), low: new Color(), sun: new Vector2(), sunColour: new Color(),
    sunIntensity: 0, sunSize: .1, clouds: 0, cloudColour: new Color(),
  };
  /** the grains' fog colour, linear: the stage colour, drawn towards the sky's horizon where there is a sky */
  readonly fog = new Vector3();
  private readonly mix = new Color();

  update(a: number, b: number, k: number, stage: Vector3): SkyState {
    const A = PER_WORLD[a]!, B = PER_WORLD[b]!, s = this.state;
    s.amount = num(A.sky.amount, B.sky.amount, k);
    s.horizon = num(A.sky.horizon, B.sky.horizon, k);
    col(s.ground, A.ground, B.ground, k); col(s.zenith, A.zenith, B.zenith, k); col(s.low, A.low, B.low, k);
    col(s.sunColour, A.sunColour, B.sunColour, k); col(s.cloudColour, A.cloudColour, B.cloudColour, k);
    s.sun.set(num(A.sky.sun[0], B.sky.sun[0], k), num(A.sky.sun[1], B.sky.sun[1], k));
    s.sunIntensity = num(A.sky.sunIntensity, B.sky.sunIntensity, k);
    s.sunSize = num(A.sky.sunSize, B.sky.sunSize, k);
    s.clouds = num(A.sky.clouds, B.sky.clouds, k);
    // distant grains sink into the sky's horizon instead of the dark stage (exactly the stage where there is none)
    const f = s.amount * FOG_TO_SKY;
    if (f <= 0) this.fog.copy(stage);
    else { this.mix.copy(s.low).multiplyScalar(SKY_LEVEL); this.fog.set(stage.x + (this.mix.r - stage.x) * f, stage.y + (this.mix.g - stage.y) * f, stage.z + (this.mix.b - stage.z) * f); }
    return s;
  }
}
