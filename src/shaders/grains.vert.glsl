// One point per grain. position.x carries the grain id; everything else comes from the layers.
// SHADOW: the same grain, drawn into the key light's shadow map.
out vec3 vCol;     // linear albedo
out vec3 vN;       // surface normal (world)
out vec3 vW;       // world position
out float vEmit;   // emission strength
out float vSpec;   // gloss 0..1
out float vSeed;   // per-grain random
out float vFog;    // fog amount
out float vPix;    // 1 for the final screen's pixels
out vec4 vLS;      // position in the key light's clip space

void main(){
  int id = int(position.x + .5);
  vec3 R = vec3(h1(position.x), h1(position.x + 71.3), h1(position.x + 13.7));
  vec3 p, c, n;
  float e, arc, sz, fl, tn, spec;
  Mods m = Mods(1., 0., 0., 0.);
  if (uRest != 0) {
    // at rest (t = 0 or 1): one world, one position fetch, one normal fetch, no transition. Every
    // transition lands exactly on its worlds at its ends (exact ends), so this is the full path's
    // result, only cheaper.
    bool atA = uRest == 1;
    int s = atA ? uFrom : uTo;
    vec4 P = grab(s, id);
    p = animate(P, R, sz);
    e = atA ? 0. : 1.; arc = 0.;
    fl = floor(P.w + .001); tn = fract(P.w);
    p = brush(p, fl, R);
    c = atA ? paint(P, uLoA, uHiA, R) : paint(P, uLoB, uHiB, R);
    n = grabSurface(s, id).xyz;
    spec = atA ? uSpecA : uSpecB;
  } else {
    vec4 A = grab(uFrom, id), B = grab(uTo, id);
    float sa, sb;
    vec3 pa = animate(A, R, sa), pb = animate(B, R, sb);
    p = travel(A, B, pa, pb, R, e, arc, m);
    vec4 Pc = e < .5 ? A : B;
    fl = floor(Pc.w + .001); tn = fract(Pc.w); sz = (e < .5 ? sa : sb) * m.size;
    p = brush(p, fl, R);
    c = e < .5 ? paint(A, uLoA, uHiA, R) : paint(B, uLoB, uHiB, R);
    n = blend(grabSurface(uFrom, id).xyz, grabSurface(uTo, id).xyz, e);
    spec = blend(uSpecA, uSpecB, e);
  }
  n = normalize(n + vec3(0., 1e-4, 0.));
  if (fl > .5 && fl < 2.5) spec = .7; // water is glossy
  // the last world arrives as a neutral screen; the sand image comes in with the reveal
  float isPix = (uTo == uLast && e >= .5) ? 1. : 0.;
  if (isPix > .5) { float g = .4 + .06 * R.y; c = blend(vec3(g * .9, g * .94, g), c, uReveal); }
  float em = emission(fl, tn, uTime * uMotion);
  c = glow(c, p, fl, em);
  c = mix(c, vec3(1., .48, .16) * (1.1 + .3 * R.x), m.heat * .75);
  c = mix(c, vec3(.95, .97, 1.), m.whiten * .8);
  c = mix(c, vec3(.18, .14, .12), m.darken * .85);
  em += m.heat * 2.2 + m.whiten * .5;
  c *= 1. + arc * .25;
  // resting restlessness: natural matter never quite settles (confinement)
  p += vec3(sin(uTime * 1.3 + R.x * 40.), sin(uTime * 1.1 + R.y * 40.), sin(uTime * 1.7 + R.z * 40.)) * uJitter * uMotion;
#ifdef SHADOW
  gl_Position = uLightVP * vec4(p, 1.);
  gl_PointSize = sz < .02 ? 0. : max(1., uGrain * uPx * (.8 + .4 * R.z) * sz);
#else
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  float depth = -mv.z;
  vCol = pow(max(c, 0.), vec3(2.2)); vN = n; vW = p; vEmit = isPix > .5 ? 1. : em; vSpec = spec; vSeed = R.x; vPix = isPix;
  vFog = clamp(1. - exp(-uFogD * depth), 0., .85); vLS = uLightVP * vec4(p, 1.);
  gl_PointSize = sz < .02 ? 0. : clamp(uGrain * uScale / max(depth, .05), 1.2, uPointMax) * (.8 + .4 * R.z) * sz;
  gl_Position = projectionMatrix * mv;
#endif
}
