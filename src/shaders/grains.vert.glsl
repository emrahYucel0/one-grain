// One point per grain. position.x carries the grain id; everything else comes from the layers.
// The grain is lit here, once (v10's lighting, moved from the fragment shader); grains.frag.glsl
// adds the sphere across the sprite.
// SHADOW: the same grain, drawn into the key light's shadow map (position only).
#ifndef SHADOW
uniform vec3 uKeyDir, uPLPos, uPLCol, uCamPos, uCamR, uCamU, uCamB, uFogLin;
uniform float uPLRange, uUseShadow, uUseLight;
uniform sampler2D uShadow;

out vec3 vAlb;    // linear albedo
out vec3 vFlat;   // point light, its specular and emission (fogged), plus the fog colour
out vec3 vNv;     // surface normal, camera space
out vec3 vHv;     // the key's half vector, camera space
out vec3 vVv;     // towards the camera, camera space
out vec4 vDots;   // .62 n·key, .62 n·half, .62 n·view, .62 n·up
out vec4 vMisc;   // gloss, share left after fog, rim strength (0: unlit), 1 for the final screen's pixels
out vec2 vSh;     // key shadow, key specular strength × shadow

vec3 toCamera(vec3 v){ return vec3(dot(v, uCamR), dot(v, uCamU), dot(v, uCamB)); }

// one shadow-map sample for the whole grain (it is a few pixels wide; no PCF needed)
float shadowAt(vec3 p){
  vec4 ls = uLightVP * vec4(p, 1.);
  vec3 lc = ls.xyz / ls.w * .5 + .5;
  if (lc.x <= 0. || lc.x >= 1. || lc.y <= 0. || lc.y >= 1. || lc.z >= 1.) return 1.;
  float d = 0., o = .75 / float(textureSize(uShadow, 0).x);
  d += step(lc.z - .0016, textureLod(uShadow, lc.xy + vec2(-o, -o), 0.).r);
  d += step(lc.z - .0016, textureLod(uShadow, lc.xy + vec2(o, -o), 0.).r);
  d += step(lc.z - .0016, textureLod(uShadow, lc.xy + vec2(-o, o), 0.).r);
  d += step(lc.z - .0016, textureLod(uShadow, lc.xy + vec2(o, o), 0.).r);
  return d * .25;
}
#endif

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
#ifndef SHADOW
    c = atA ? paint(P, uLoA, uHiA, R) : paint(P, uLoB, uHiB, R);
    n = grabSurface(s, id).xyz;
    spec = atA ? uSpecA : uSpecB;
#endif
  } else {
    vec4 A = grab(uFrom, id), B = grab(uTo, id);
    float sa, sb;
    vec3 pa = animate(A, R, sa), pb = animate(B, R, sb);
    p = travel(A, B, pa, pb, R, e, arc, m);
    vec4 Pc = e < .5 ? A : B;
    fl = floor(Pc.w + .001); tn = fract(Pc.w); sz = (e < .5 ? sa : sb) * m.size;
    p = brush(p, fl, R);
#ifndef SHADOW
    c = e < .5 ? paint(A, uLoA, uHiA, R) : paint(B, uLoB, uHiB, R);
    n = blend(grabSurface(uFrom, id).xyz, grabSurface(uTo, id).xyz, e);
    spec = blend(uSpecA, uSpecB, e);
#endif
  }
  // resting restlessness: natural matter never quite settles (confinement)
  p += vec3(sin(uTime * 1.3 + R.x * 40.), sin(uTime * 1.1 + R.y * 40.), sin(uTime * 1.7 + R.z * 40.)) * uJitter * uMotion;
#ifdef SHADOW
  gl_Position = uLightVP * vec4(p, 1.);
  gl_PointSize = sz < .02 ? 0. : max(1., uGrain * uPx * uShadowGrow * (.8 + .4 * R.z) * sz);
#else
  n = normalize(n + vec3(0., 1e-4, 0.));
  if (fl > .5 && fl < 2.5) spec = .7; // water is glossy
  // the last world arrives as a neutral screen of pixels; the sand image comes in with the reveal (v10)
  float isPix = (uTo == uLast && e >= .5) ? 1. : 0.;
  if (isPix > .5) { float g = .24 + .04 * R.y; c = blend(vec3(g * .9, g * .94, g), c, uReveal); }
  float em = emission(fl, tn, uTime * uMotion);
  c = glow(c, p, fl, em);
  c = mix(c, vec3(1., .48, .16) * (1.1 + .3 * R.x), m.heat * .75);
  c = mix(c, vec3(.95, .97, 1.), m.whiten * .8);
  c = mix(c, vec3(.18, .14, .12), m.darken * .85);
  em += m.heat * 2.2 + m.whiten * .5;
  c *= 1. + arc * .25;
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  float depth = -mv.z;
  vec3 alb = pow(max(c, 0.), vec3(2.2));
  float emit = isPix > .5 ? 1. : em;
  float fog = clamp(1. - exp(-uFogD * depth), 0., .85), keep = 1. - fog;
  vec3 flat_ = alb * emit * (.88 + .2 * sin(R.x * 30. + p.x));
  vAlb = alb; vNv = vHv = vVv = vec3(0.); vDots = vec4(0.); vMisc = vec4(1., keep, 0., isPix); vSh = vec2(0.);
  if (uUseLight > .5 && isPix < .5) { // the screen's pixels are not lit (grains.frag.glsl)
    vec3 V = normalize(uCamPos - p);
    vec3 H = normalize(uKeyDir + V);
    float sh = uUseShadow > .5 ? shadowAt(p) : 1.;
    float gloss = mix(10., 140., spec);
    vNv = toCamera(n); vHv = toCamera(H); vVv = toCamera(V);
    vDots = .62 * vec4(dot(n, uKeyDir), dot(n, H), dot(n, V), n.y);
    vMisc.xz = vec2(gloss, .6);
    vSh = vec2(sh, spec * 1.8 * sh);
    // the point light is the same across a grain: once, with the shading normal at the sprite's centre
    vec3 N0 = normalize(n * .62 + uCamB * .55);
    vec3 Lp = uPLPos - p; float dist = max(length(Lp), .001), att = 1. / (1. + dist * dist / (uPLRange * uPLRange));
    vec3 Ld = Lp / dist;
    float specPl = pow(max(dot(N0, normalize(Ld + V)), 0.), gloss) * spec * 1.2 * att;
    flat_ += alb * uPLCol * max(dot(N0, Ld), 0.) * att + uPLCol * specPl;
  }
  vFlat = flat_ * keep + uFogLin * fog;
  gl_PointSize = sz < .02 ? 0. : clamp(uGrain * uScale / max(depth, .05), 1.2, uPointMax) * (.8 + .4 * R.z) * sz
    * (isPix > .5 ? mix(1., 1.42, uReveal) : 1.); // pixels swell into grains
  gl_Position = projectionMatrix * mv;
#endif
}
