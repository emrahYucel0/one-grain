// One point per grain. position.x carries the grain id; everything else comes from the layers.
// The grain is lit here, once (v10's lighting, moved from the fragment shader); grains.frag.glsl
// adds the sphere across the sprite.
// SHADOW: the same grain, drawn into the key light's shadow map (position only).
#ifndef SHADOW
uniform vec3 uKeyDir, uPLPos, uPLCol, uCamPos, uCamR, uCamU, uCamB, uFogLin;
uniform float uPLRange, uUseShadow, uUseLight;
uniform vec3 uPatC;      // the light chapter's pattern: its centre (story/pattern.ts)
uniform int uPatWorld;   // the world it is exposed onto
uniform float uPatCells; // cells per world unit
uniform sampler2D uShadow;

out vec3 vAlb;    // linear albedo
out vec3 vFlat;   // the point light's diffuse and emission (fogged), plus the fog colour
out vec3 vNv;     // surface normal, camera space
out vec3 vHv;     // the key's half vector, camera space
out vec4 vDots;   // .62 n·key, .62 n·half, .62 n·view, .62 n·up
out vec4 vMisc;   // gloss, share left after fog, rim strength (0: unlit), unused
out vec4 vS;      // key shadow, key specular strength × shadow, .62 n·the point light's half vector, its specular strength
out vec3 vHp;     // the point light's half vector, camera space

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
  Mods m = Mods(1., 0., 0., 0., 0., 0.);
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
    if (uStyle == 21) { // become: A's colours lose 70 % of their saturation, then the palette turns to sand
      vec3 ca = paint(A, uLoA, uHiA, R), cb = paint(B, uLoB, uHiB, R);
      c = blend(blend(ca, vec3(dot(ca, vec3(.299, .587, .114))), m.fade * .7), cb, smoothstep(.34, .72, uT));
    }
    n = blend(grabSurface(uFrom, id).xyz, grabSurface(uTo, id).xyz, e);
    spec = blend(uSpecA, uSpecB, e);
#endif
  }
  // Awwwards P10 (story/pops.ts): the sub-pixels the visitor popped, halfway from the display to the sand: the one
  // that glints, the burst (out towards the viewer, a flash, gone), and in the sand the hollows they leave, filled
  // back once the ending's ring has passed. k: how far from the display (0) to the sand (1)
  float popGlow = 0., popShade = 0.;
  if (uPopOn > 0. && uFrom == uPopWorld && uTo == uPopWorld + 1) {
    float k = uRest == 1 ? 0. : uRest == 2 ? 1. : uT;
    vec4 A0 = grab(uFrom, id), B0 = grab(uTo, id);
    float back = uPopFill;
    if (floor(A0.w + .001) == 9.) {
      vec4 s = texelFetch(uPops, clamp(ivec2(round((A0.xy + vec2(9.9, 5.9)) / .3)), ivec2(0), ivec2(65, 39)), 0);
      float g = s.g * smoothstep(.2, .3, k) * (1. - smoothstep(.5, .6, k));
      popGlow += g * (1.1 + .6 * sin(uTime * 6. + R.x * 5.));
      sz *= 1. + .3 * g;
      if (s.r > 0.) {
        float on = smoothstep(.12, .26, k) * (1. - back), fly = 1. - pow(1. - s.r, 3.);
        p += normalize(vec3(R.x - .5, R.y - .5, .4 + .6 * R.z)) * fly * (.3 + .6 * R.z) * on * uMotion;
        popGlow += on * (1. - smoothstep(0., .4, s.r)) * 3.;
        sz *= 1. - on * smoothstep(.2, .95, s.r);
      }
    }
    float sand = smoothstep(.55, .9, k) * (1. - back);
    if (sand > 0.) {
      ivec2 c0 = ivec2(round((B0.xy / 1.36 + vec2(9.9, 5.9)) / .3));
      float dep = 0., rim = 0.;
      for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
        ivec2 c = c0 + ivec2(i, j);
        if (c.x < 0 || c.y < 0 || c.x > 65 || c.y > 39) continue;
        float b = texelFetch(uPops, c, 0).r;
        if (b <= 0.) continue;
        vec2 ctr = (vec2(-9.9, -5.9) + vec2(c) * .3) * 1.36;
        float d = length(B0.xy - ctr), grow = smoothstep(0., .5, b);
        dep = max(dep, grow * (1. - smoothstep(.12, .5, d)));
        rim = max(rim, grow * smoothstep(.4, .55, d) * (1. - smoothstep(.55, .8, d))); // the sand thrown up round it
      }
      dep *= sand; rim *= sand * (1. - dep);
      p.z += rim * .06 - dep * .25;
      p.xy += normalize(B0.xy - (vec2(-9.9, -5.9) + vec2(c0) * .3) * 1.36 + 1e-4) * dep * .05;
      popShade = dep - rim * .35;
    }
  }
  // resting restlessness: natural matter never quite settles (confinement)
  p += vec3(sin(uTime * 1.3 + R.x * 40.), sin(uTime * 1.1 + R.y * 40.), sin(uTime * 1.7 + R.z * 40.)) * uJitter * uMotion;
  // the ending's last shot: the sand takes the proportions of the screen it is seen on (core/loop.ts)
  if (uScreen.z > 0. && uRest == 2) p.xy *= mix(vec2(1.), uScreen.xy, uScreen.z);
  // the final grain lands: its nearest neighbours move aside a little (v15)
  if (uLand > 0.) { vec2 dl = p.xy - uLandPos.xy; float l = length(dl); if (l < .14) p.xy += dl / (l + 1e-4) * (.14 - l) * .45 * uLand; }
#ifdef SHADOW
  gl_Position = uLightVP * vec4(p, 1.);
  gl_PointSize = sz < .02 ? 0. : max(1., uGrain * uPx * uShadowGrow * (.8 + .4 * R.z) * sz);
#else
  n = normalize(n + vec3(0., 1e-4, 0.));
  if (fl > .5 && fl < 2.5) spec = .7 + .25 * blend(uWaterA, uWaterB, e); // water is glossy (more so in the river)
  float em = emission(fl, tn, uTime * uMotion, blend(uRaysA, uRaysB, e), blend(uPixA, uPixB, e)) * (1. - m.fade); // the light goes out (style 21)
  em += popGlow;
  c *= 1. - .65 * popShade; // a hollow is in its own shadow, its rim catches the light
  c = glow(c, p, fl, em);
  c = mix(c, vec3(1., .48, .16) * (1.1 + .3 * R.x), m.heat * .75);
  c = mix(c, vec3(.95, .97, 1.), m.whiten * .8);
  c = mix(c, vec3(.18, .14, .12), m.darken * .85);
  // incandescence: the colour of heat itself, dull red through orange to white-hot, taking over from
  // the lit colour (which dims as it does), so a pale grain never passes through a pastel pink
  if (m.burn > 0.) {
    vec3 hot = m.burn < .5 ? mix(vec3(.72, .22, .04), vec3(1., .42, .08), m.burn * 2.) : mix(vec3(1., .42, .08), vec3(1., .8, .52), m.burn * 2. - 1.);
    float k = smoothstep(0., .35, m.burn);
    c = mix(c * (1. - .6 * k), hot * (1.05 + .25 * R.x), k);
    em += m.burn * 1.9;
  }
  em += m.heat * 2.2 + m.whiten * .5;
  // the industry's own colours (Awwwards P2; story/lights.ts heat, film). Heat: the base grains (and the
  // ingot's) incandescent around a height, cherry through amber, breathing a little: purity's rods, the
  // crystal's melt line. Film: the polished wafers take thin-film colour by their radius and the angle
  // they are seen at, so it turns as the camera moves (the discs: centre k × (.25, 1.3, 0), radius 1.6).
  if (fl < .5 || (fl > 14.5 && fl < 15.5)) {
    float hA = uAccentA.x * (1. - smoothstep(0., uAccentA.z, abs(p.y - uAccentA.y)));
    float hB = uAccentB.x * (1. - smoothstep(0., uAccentB.z, abs(p.y - uAccentB.y)));
    float h = blend(hA, hB, e) * (1. - m.fade);
    if (h > 0.) {
      float b = .9 + .1 * sin(uTime * uMotion * .8 + R.x * 30.);
      float w = clamp(h * (.75 + .5 * tn) + R.y * .2 - .1, 0., 1.); // hotter grains whiter
      vec3 hot = w < .5 ? mix(vec3(.8, .22, .04), vec3(1., .5, .12), w * 2.) : mix(vec3(1., .5, .12), vec3(1., .84, .58), w * 2. - 1.);
      c = mix(c, hot * b, smoothstep(0., .4, h));
      em += h * 2. * b;
    }
    float film = blend(uAccentA.w, uAccentB.w, e);
    if (film > 0. && fl < .5 && p.y > -.3) {
      float k = floor(p.y / 1.3 + .5);
      float r = length(p.xz - vec2(k * .25, 0.)) / 1.6;
      float ndv = abs(dot(n, normalize(uCamPos - p)));
      float hue = r * .85 + (1. - ndv) * 1.4 + k * .11;
      vec3 irid = .5 + .5 * cos(6.2832 * (hue + vec3(0., .33, .67)));
      c = mix(c, c * .5 + irid * .6, film);
    }
  }
  if (fl < .5) em += blend(uGlowA, uGlowB, e); // the world's inner glow for its base material (magma's quartz)
  // the river's current (Awwwards P3): ripples travelling downstream (+x, faster than the grains) catch the
  // light, most in the middle of the channel where the water is fastest, so the flow reads even in a still
  if (fl > .5 && fl < 1.5) {
    float tm = uTime * uMotion, mid = 1. - smoothstep(0., 1.7, abs(p.z - 2.2 * sin(p.x * .22)));
    float rip = sin(p.x * 2.1 - tm * 4.2 + sin(p.z * 3.1 + p.x * .4) * 1.2 + R.x * .6);
    float crest = smoothstep(.5, 1., rip) * (.4 + .6 * mid) * (1. - m.fade);
    c = mix(c, vec3(.84, .95, 1.), crest * .6);
    em += crest * .4;
  }
  // the light chapter (v27): the circuit pattern lands on the layer, its traces lit, the rest darkened;
  // the light rays themselves (behaviour 17) are not part of the layer
  float wL = (uFrom == uPatWorld ? 1. - e : 0.) + (uTo == uPatWorld ? e : 0.);
  if (wL > .01 && !(fl > 16.5 && fl < 17.5)) {
    vec2 q = (p.xz - uPatC.xz) * uPatCells, cell = floor(q), f = fract(q);
    float h = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453), h2 = fract(h * 7.13);
    float tx = step(abs(f.y - .5), .1) * step(.3, h), ty = step(abs(f.x - .5), .1) * step(h2, .5);
    float pad = step(length(f - .5), .22) * step(.82, h);
    float trace = clamp(tx + ty + pad, 0., 1.);
    c = mix(c * mix(1., .45, wL), vec3(.86, .76, 1.), trace * wL * .9);
    em += trace * wL * 1.5;
  }
  // the grain's last light (Awwwards P3): before it goes out, its light passes into the sand around it as a
  // ring, and the sand it crosses remembers the screen it was: each grain lit in its sub-pixel's colour
  if (uRing.y > 0. && uRest == 2) {
    float dr = length(p.xy - uLandPos.xy) - uRing.x;
    float band = exp(-dr * dr / .7) + .2 * exp(-(dr + 1.4) * (dr + 1.4) / 3.); // the front, and a softer wake behind it
    float k = band * uRing.y;
    vec3 sub = R.y < .34 ? vec3(1., .3, .22) : R.y < .67 ? vec3(.36, 1., .42) : vec3(.34, .5, 1.);
    c = mix(c, sub, clamp(k * .8, 0., .8));
    em += k * 1.5;
    p.z += k * .1;
  }
  c *= 1. + arc * .25;
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  float depth = -mv.z;
  // the cursor's touch (Awwwards P1): wherever there is no hands-on play, a moving mouse stirs the grains
  // under it, turning them a little about the pointer on screen (nothing opens: the centre barely moves),
  // and they catch a little light; once it rests the touch fades and they settle back
  if (uTouch.w > 0.) {
    vec4 cl = projectionMatrix * mv;
    float asp = projectionMatrix[1][1] / projectionMatrix[0][0];
    vec2 d = (cl.xy / max(cl.w, 1e-4) - uTouch.xy) * vec2(asp, 1.); // half screen heights
    float f = 1. - smoothstep(0., uTouch.z, length(d));
    f *= f * uTouch.w;
    float a = f * 1.3, ca = cos(a), sa = sin(a);
    vec2 turn = vec2(ca * d.x - sa * d.y, sa * d.x + ca * d.y) - d;
    // half screen heights to camera space at this depth (the same on screen at any depth)
    mv.xy += turn * depth / projectionMatrix[1][1];
    em += f * 1.1;
  }
  vec3 alb = pow(max(c, 0.), vec3(2.2));
  float fog = clamp(1. - exp(-uFogD * depth), 0., .85), keep = 1. - fog;
  vec3 flat_ = alb * em * (.88 + .2 * sin(R.x * 30. + p.x));
  vAlb = alb; vNv = vHv = vHp = vec3(0.); vDots = vS = vec4(0.); vMisc = vec4(1., keep, 0., 0.);
  if (uUseLight > .5) {
    vec3 V = normalize(uCamPos - p);
    vec3 H = normalize(uKeyDir + V);
    float sh = uUseShadow > .5 ? shadowAt(p) : 1.;
    float gloss = mix(10., 140., spec);
    vNv = toCamera(n); vHv = toCamera(H);
    vDots = .62 * vec4(dot(n, uKeyDir), dot(n, H), dot(n, V), n.y);
    vMisc.xz = vec2(gloss, .6);
    // the point light: direction and attenuation per grain (as in v10). Its specular keeps v10's
    // per-pixel highlight (a whole-grain highlight brightens the furnace); its diffuse is once per
    // grain, with the shading normal at the sprite's centre
    vec3 Lp = uPLPos - p; float dist = max(length(Lp), .001), att = 1. / (1. + dist * dist / (uPLRange * uPLRange));
    vec3 Ld = Lp / dist, Hp = normalize(Ld + V);
    vHp = toCamera(Hp);
    vS = vec4(sh, spec * 1.8 * sh, .62 * dot(n, Hp), spec * 1.2 * att);
    flat_ += alb * uPLCol * (max(dot(normalize(n * .62 + uCamB * .55), Ld), 0.) * att);
  } else flat_ += alb;
  vFlat = flat_ * keep + uFogLin * fog;
  gl_PointSize = sz < .02 ? 0. : clamp(uGrain * uScale / max(depth, .05), 1.2, uPointMax) * (.8 + .4 * R.z) * sz;
  gl_Position = projectionMatrix * mv;
#endif
}
