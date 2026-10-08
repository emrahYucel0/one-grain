// The loupe (reference v27, materials reworked): the hero grain magnified, raymarched into a small
// target (half its pixels a frame, in an alternating checkerboard), masked to a circle, premultiplied
// alpha, then laid over the canvas after the post chain (//#blit; render/loupe.ts).
// Two looks, A and B (story/loupe.ts), blended by uK: the shapes' distances, the materials' numbers.
//   m1 = round, wear, frost, gloss · m2 = glass, milk, metal, emission · m3 = shape, pattern, speckle, panels
// shape: 0 natural grain (a crystal, rounded by `round`), 1 broken lump, 2 molten drop, 3 perfect
// crystal, 4 polished disc with its notch, 5 pixel. pattern: 1 lattice, 2 projected light, 3 circuit,
// 4 three sub-pixels. Lit in view space by a studio: a dome tinted by the world's light, a key softbox
// up and to the right, a strip light on the left, and for the factory's worlds a ceiling of light panels
// (a mirror shows them); clear materials refract through their body. Edges are smoothed by the ray's
// closest approach where it misses.
// Sections are split by the //#vertex, //#fragment, //#blit-vertex and //#blit markers.

//#vertex
void main(){ gl_Position = vec4(position.xy, 0., 1.); }

//#fragment
uniform vec2 uRes;
uniform float uTime, uK;
// which share of the 4×4 blocks to march this frame: block set uPhase of uCycle (2: a checkerboard; 4: one
// block in each 2×2 of blocks), or uPhase -1: all of them
uniform float uPhase, uCycle;
uniform mat3 uRot;
uniform vec4 uA1, uA2, uA3, uB1, uB2, uB3;
uniform vec3 uColA, uColB, uGlowA, uGlowB, uEnvA, uEnvB;
// 0, from a uniform: loops that start from it cannot be unrolled, and the distance function is called
// from one place only (a D3D compiler unrolls and inlines all it can: each call site of the distance
// function cost about a second of compile time on an integrated GPU)
uniform int uZero;
// the radius of a sphere around both looks' shapes (render/loupe.ts): rays that miss it are not marched
uniform float uBound;
out highp vec4 fragColor;

const vec3 KEY = vec3(.5516, .7522, .3609); // normalize(.55, .75, .36)
const vec3 KEY_COL = vec3(1.25, 1.2, 1.1);
// the dome's brightness: lower around clear materials, which read by the contrast of what they refract
float gDome = 1.;

float hash(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
float fbm(vec3 p){ float a = .5, s = 0.; for (int i = uZero; i < 3; i++){ s += a * noise(p); p *= 2.03; a *= .5; } return s + .0625; }

// ---- shapes (shape space: the view scaled by 1.6) ----
float sdHex(vec3 p, vec2 h){ const vec3 k = vec3(-.8660254, .5, .57735); p = abs(p); p.xy -= 2. * min(dot(k.xy, p.xy), 0.) * k.xy;
  vec2 d = vec2(length(p.xy - vec2(clamp(p.x, -k.z * h.x, k.z * h.x), h.x)) * sign(p.y - h.x), p.z - h.y); return min(max(d.x, d.y), 0.) + length(max(d, 0.)); }
float crystalSd(vec3 p){ float pr = sdHex(p, vec2(.62, 2.4)); float cone = dot(vec2(length(p.xy), abs(p.z)), normalize(vec2(1., .55))) - 1.05; return max(pr, cone); }
float sdEll(vec3 p, vec3 r){ float k0 = length(p / r), k1 = length(p / (r * r)); return k0 * (k0 - 1.) / k1; }
// without its relief (the dents of transport: shapeSd adds them near the surface)
float grainSd(vec3 p, float rnd){
  float cr = rnd > .99 ? 0. : crystalSd(p), el = rnd < .01 ? 0. : sdEll(p, vec3(1.3, 1.08, 1.18));
  return mix(cr, el, smoothstep(0., .85, rnd));
}
// broken stone: an ellipsoid cut by fracture planes (shapeSd adds the rough, rippled faces near the surface)
float lumpSd(vec3 p){ float d = sdEll(p, vec3(1.35, 1.05, 1.2));
  d = max(d, dot(p, normalize(vec3(.8, .5, .3))) - .8); d = max(d, dot(p, normalize(vec3(-.6, .7, -.2))) - .75);
  d = max(d, dot(p, normalize(vec3(.1, -.8, .6))) - .78); d = max(d, dot(p, normalize(vec3(-.5, -.3, -.8))) - .82);
  d = max(d, dot(p, normalize(vec3(.4, .2, -.9))) - .85); d = max(d, dot(p, normalize(vec3(-.9, -.2, .35))) - .9);
  return d; }
float dropSd(vec3 p){ return length(p * vec3(1., 1.1, 1.)) - 1.15 + sin(p.y * 5. + uTime * 2.) * .02; }
// a wafer: thin, polished, a small notch at its edge
float discSd(vec3 p){ vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(1.53, .04); float s = min(max(d.x, d.y), 0.) + length(max(d, 0.)) - .03;
  return max(s, -(length(p.xz - vec2(1.58, 0.)) - .085)); }
float pixSd(vec3 p){ vec3 q = abs(p) - vec3(1.05, 1.05, .2); return length(max(q, 0.)) + min(max(q.x, max(q.y, q.z)), 0.) - .05; }
float shapeSd(vec3 p, float sh, float rnd, float wear){
  float d;
  if (sh < 1.5) {
    // a grain's dents (at most .14 × wear) and a lump's rough faces (at most .062): the one relief noise
    // (written once: see uZero), only near the surface; farther out the plain shape is a safe step
    d = sh < .5 ? grainSd(p, rnd) : lumpSd(p);
    float reach = sh < .5 ? .14 * wear : .062;
    if (reach > 0. && d < reach + .05) {
      float r = fbm(p * (sh < .5 ? 1.7 : 2.6));
      d += sh < .5 ? (r - .5) * .28 * wear : (r - .5) * .1 + sin(dot(p, vec3(4.1, 2.3, -3.2)) + r * 6.) * .012;
    }
  }
  else if (sh < 2.5) d = dropSd(p);
  else if (sh < 3.5) d = crystalSd(p);
  else if (sh < 4.5) d = discSd(p);
  else d = pixSd(p);
  return d;
}
// both looks' shapes, blended; a side with no weight is skipped (one loop: the shape is written once)
float map(vec3 p){
  vec3 q = uRot * p * 1.6; float d = 0.;
  for (int s = uZero; s < 2; s++){
    float w = s == 0 ? 1. - uK : uK;
    if (w <= 0.) continue;
    vec4 m1 = s == 0 ? uA1 : uB1; float sh = s == 0 ? uA3.x : uB3.x;
    d += w * shapeSd(q, sh, m1.x, m1.y);
  }
  return d / 1.6;
}
// the tetrahedron's corners, for normals from four taps
vec3 tap(int i){ return .5773 * (2. * vec3(float(((i + 3) >> 1) & 1), float((i >> 1) & 1), float(i & 1)) - 1.); }

// ---- light ----
vec3 envAt(vec3 d, vec3 env, float panels){
  vec3 c = mix(env * .035, env * .5 * gDome, smoothstep(-.3, .9, d.y));          // a dark floor, the dome
  if (panels > 0. && d.y > .2) {                                                  // the ceiling's light panels
    vec2 g = d.xz / d.y * 3.2, f = abs(fract(g) - .5);
    float lit = smoothstep(.34, .31, f.x) * smoothstep(.16, .13, f.y) * smoothstep(.2, .45, d.y);
    c = mix(c, c * .25, panels) + vec3(1.15, 1.12, 1.05) * lit * 1.8 * panels;
  }
  c += env * .28 * exp(-abs(d.y + .05) * 14.);                                    // the horizon
  c += KEY_COL * smoothstep(.955, .975, dot(d, KEY)) * 2.6;                       // the key softbox
  c += vec3(.9, .95, 1.05) * smoothstep(.07, .03, abs(d.y - .12)) * smoothstep(-.5, -.72, d.x) * 1.5; // a strip on the left
  return c;
}
vec3 envIrr(vec3 n, vec3 env){ return mix(env * .06, env * .42, n.y * .5 + .5); }

// the surface patterns, weighted by w; pr is shape space
void pattern(float pat, vec3 pr, vec3 glow, float em, float w, inout vec3 c){
  if (w <= 0. || pat < .5) return;
  if (pat < 1.5){ vec3 q = pr * 5.; vec3 g = abs(fract(q) - .5);
    c += w * (vec3(.55, .65, .85) * smoothstep(.46, .5, max(g.x, max(g.y, g.z))) * .22 + vec3(.75, .85, 1.) * smoothstep(.16, .08, length(fract(q) - .5)) * .3); }
  else if (pat < 2.5){ float s = smoothstep(.42, .5, abs(fract(pr.x * 3.5 + uTime * .15) - .5)) * step(.35, fract(pr.z * 2.2)); c += w * glow * s * 1.4; }
  else if (pat < 3.5){ vec2 q = pr.xz * 4.5; vec2 g = abs(fract(q) - .5);
    c += w * (glow * smoothstep(.44, .5, max(g.x, g.y)) * step(.45, noise(vec3(floor(q), 1.))) * 1.3 + glow * .06); }
  else if (pr.z > .17) { // the pixel's face behind the cover glass: a black matrix and three fine sub-pixels
    vec3 sub = vec3(0.);
    for (int i = uZero; i < 3; i++){
      vec2 b = abs(pr.xy - vec2((float(i) - 1.) * .6, 0.)) - vec2(.13, .72);
      float sd = length(max(b, 0.)) + min(max(b.x, b.y), 0.) - .07;
      vec3 rgb = i == 0 ? vec3(1., .09, .05) : i == 1 ? vec3(.1, 1., .28) : vec3(.12, .28, 1.);
      float rows = .82 + .18 * smoothstep(.25, .45, abs(fract(pr.y * 10.) - .5)); // the emitter's fine structure
      sub += rgb * (smoothstep(.012, -.012, sd) * 2.6 * rows + exp(-max(sd, 0.) * 26.) * .3);
    }
    c = mix(c, c * .35 + sub * em, w);
  }
}

void main(){
  // the checkerboard is of 2×2 blocks: a GPU shades pixels in 2×2 quads, so only whole quads left out save work
  if (uPhase >= 0.) {
    vec2 bl = floor(gl_FragCoord.xy * .25);
    float set = uCycle < 3. ? mod(bl.x + bl.y, 2.) : mod(bl.x, 2.) + 2. * mod(bl.y, 2.);
    if (set != uPhase) discard;
  }
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y; float r = length(uv);
  float mask = smoothstep(.5, .5 - 1.5 / uRes.y, r);
  if (mask <= 0.) { fragColor = vec4(0.); return; }
  vec4 m1 = mix(uA1, uB1, uK), m2 = mix(uA2, uB2, uK);
  float speckle = mix(uA3.z, uB3.z, uK), panels = mix(uA3.w, uB3.w, uK);
  float frost = m1.z, gloss = m1.w, glass = m2.x, milk = m2.y, metal = m2.z, em = m2.w;
  vec3 col = mix(uColA, uColB, uK), glow = mix(uGlowA, uGlowB, uK), env = mix(uEnvA, uEnvB, uK);
  gDome = 1. - .5 * glass;
  vec3 ro = vec3(0., 0., 3.6), rd = normalize(vec3(uv, -1.55));
  vec3 c = env * .085 * (1. - r * 1.3) + vec3(.01);
  // One loop, one call of the distance function, walking through the steps in turn: the march to the
  // surface (only rays that meet the shapes' bounding sphere), the normal there (four taps), how open
  // the surface is (one tap off it), and for clear materials the way through the body to where the ray
  // leaves it, and the normal there.
  float bb = dot(ro, rd), disc = bb * bb - dot(ro, ro) + uBound * uBound;
  bool hit = false;
  vec3 p = vec3(0.), n = vec3(0., 0., 1.), nx = vec3(0., 0., 1.), acc = vec3(0.), q = vec3(0.), rdIn = rd, exitP = vec3(0.);
  float ao = 1., th = 0., cover = 1.;
  if (disc > 0.) {
    float t = max(0., -bb - sqrt(disc)), tEnd = -bb + sqrt(disc);
    int step = 0, k = 0, marched = 0; // step: 0 march, 1 normal, 2 openness, 3 through the body, 4 normal at the exit
    float dMin = 1e3, tMin = 0., px = 1. / (uRes.y * 1.55); // the ray's closest approach; a pixel's width at distance 1
    q = ro + rd * t;
    for (int i = uZero; i < 112; i++){
      float d = map(q);
      if (step == 0) {
        if (d < .0008) { hit = true; p = q; step = 1; k = 0; acc = vec3(0.); q = p + tap(0) * .0015; continue; }
        if (d < dMin) { dMin = d; tMin = t; }
        t += d * .9; marched++;
        if (t > tEnd || marched >= 72) {
          // missed: where it passed within a pixel of the surface, that pixel is partly covered
          cover = 1. - dMin / (px * tMin * 1.5);
          if (cover <= 0.) break;
          hit = true; p = ro + rd * tMin; step = 1; k = 0; acc = vec3(0.); q = p + tap(0) * .0015; continue;
        }
        q = ro + rd * t;
      } else if (step == 1 || step == 4) {
        acc += tap(k) * d; k++;
        vec3 at = step == 1 ? p : exitP;
        if (k < 4) { q = at + tap(k) * .0015; continue; }
        if (step == 4) { nx = normalize(acc); break; }
        n = normalize(acc); step = 2; q = p + n * .07;
      } else if (step == 2) {
        ao = .45 + .55 * clamp(d / .07, 0., 1.); // crevices are darker
        if (glass <= 0.) break;
        step = 3; rdIn = refract(rd, n, 1. / 1.55); q = p - n * .003;
      } else {
        float inside = -d;
        if (inside < .0015 || th > 3.) { exitP = q; step = 4; k = 0; acc = vec3(0.); q = exitP + tap(0) * .0015; continue; }
        float s = max(inside, .012); q += rdIn * s; th += s;
      }
    }
  }
  vec3 bg = c;
  if (hit){
    vec3 pr = uRot * p * 1.6, V = -rd;
    if (frost > 0.) n = normalize(n + (vec3(noise(pr * 26.), noise(pr * 26. + 7.), noise(pr * 26. + 13.)) - .5) * frost * 1.1);
    // mineral speckles: dark mica, pink feldspar, iron stains, in the stone's own grain
    if (speckle > 0.) {
      float s = noise(pr * 9.), s2 = noise(pr * 23. + 3.);
      vec3 mineral = s > .68 ? vec3(.07, .065, .06) : s < .3 ? vec3(.86, .62, .5) : col * (.85 + .3 * s2);
      col = mix(col, mineral, speckle * (s > .68 || s < .3 ? .85 : .5));
    }
    float ndv = max(dot(n, V), 0.), ndl = dot(n, KEY);
    vec3 H = normalize(KEY + V), R = reflect(rd, n);
    float sharp = gloss * (1. - frost * .7);
    vec3 F0 = mix(vec3(.04), col, metal);
    vec3 F = F0 + (1. - F0) * pow(1. - ndv, 5.) * mix(.25, 1., sharp);
    vec3 refl = mix(envIrr(R, env), envAt(R, env, panels), sharp);
    vec3 spec = KEY_COL * pow(max(dot(n, H), 0.), mix(8., 700., sharp * sharp)) * mix(.04, 3.2, sharp);
    vec3 diff = col * (max((ndl + .25) / 1.25, 0.) * KEY_COL * .85 + envIrr(n, env) * .7);
    // through the body: clear materials refract (thickness tints them), milky ones scatter inside
    vec3 trans = vec3(0.);
    if (glass > 0.) {
      vec3 rdOut = refract(rdIn, -nx, 1.55);
      if (dot(rdOut, rdOut) < .01) rdOut = reflect(rdIn, -nx);
      vec3 clear = envAt(rdOut, env, panels) * exp(-th * (1. - col) * 2.2);
      vec3 milky = col * (envIrr(n, env) * .9 + KEY_COL * .35) * (1. - exp(-th * 3.)) + clear * exp(-th * 3.) * .5;
      trans = mix(clear, milky, milk);
    }
    // frosted bodies glow at the edges with the light behind them
    float back = pow(clamp(dot(-n, KEY) * .5 + .5, 0., 1.), 2.);
    vec3 sss = col * milk * (1. - glass) * (back * .3 + .12) * (.4 + .6 * pow(1. - ndv, 2.));
    c = (diff * (1. - glass) * (1. - metal) + trans * glass * (1. - F)) * ao + refl * F + spec * (.3 + .7 * ao) + sss;
    for (int s = uZero; s < 2; s++) pattern(s == 0 ? uA3.y : uB3.y, pr, s == 0 ? uGlowA : uGlowB, em, s == 0 ? 1. - uK : uK, c);
    if (uA3.y < 3.5 && uB3.y < 3.5) c += glow * em * (.55 + .45 * pow(1. - ndv, 4.));
    c = mix(bg, c, clamp(cover, 0., 1.));
  }
  if (em > 0. && uA3.y < 3.5 && uB3.y < 3.5) c += glow * em * .22 * exp(-r * r * 7.);
  c = c / (1. + c * .55); c = pow(max(c, 0.), vec3(1. / 2.2));
  fragColor = vec4(c * mask, mask);
}

//#blit-vertex
out vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }

//#blit
uniform sampler2D uTex;
uniform float uOp;
in vec2 vUv; out highp vec4 fragColor;
void main(){ fragColor = texture(uTex, vUv) * uOp; }
