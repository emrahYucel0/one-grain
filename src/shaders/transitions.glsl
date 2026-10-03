// How grains travel from world A to world B (uStyle, see story/types.ts GrainStyle).
// Each grain starts after a delay d that depends on where it is, so the change sweeps the scene.
// Writes the eased progress e, the in-flight arc (0 at both ends, 1 midway) and per-grain
// modifiers that some styles use to show what is happening to the material.
// Exact ends: a transition must give exactly world A at t = 0 and world B at t = 1. GPUs evaluate
// mix(a, b, 1.) as a + (b - a) and sin(PI * 1.) as ~1e-7, both a hair off, so blends and arcs go
// through these helpers. In between they are the plain formulas.
vec3 blend(vec3 a, vec3 b, float t) { return t <= 0. ? a : t >= 1. ? b : mix(a, b, t); }
float blend(float a, float b, float t) { return t <= 0. ? a : t >= 1. ? b : mix(a, b, t); }
float hump(float x, float pi) { return x <= 0. || x >= 1. ? 0. : sin(pi * x); }

struct Mods {
  float size;   // point size multiplier
  float heat;   // 0..1 glow towards molten orange
  float whiten; // 0..1 towards purified white
  float darken; // 0..1 towards impurity brown-black
  float fade;   // 0..1 the emitted light going out: saturation and emission drop (style 21)
};

vec3 travel(vec4 A, vec4 B, vec3 pa, vec3 pb, vec3 R, out float e, out float arc, out Mods m){
  vec3 p;
  arc = 0.;
  m = Mods(1., 0., 0., 0., 0.);
  if (uStyle == 5) { e = step(.5, uT); return blend(pa, pb, e); } // cut
  float dd, w = .6;
  if (uStyle == 2 || uStyle == 9) { dd = clamp(dot(pa - uHeroA, uDir) / uSpread + .5, 0., 1.); if (uStyle == 9) w = .9; }
  else if (uStyle == 16) { dd = clamp(dot(pb - uHeroB, uDir) / uSpread + .5, 0., 1.); w = .85; }
  else if (uStyle == 4) dd = clamp((pb.y - uHeroB.y) / 12. + .5, 0., 1.);
  else if (uStyle == 13) { dd = 1. - clamp((pb.y - uHeroB.y) / 12. + .5, 0., 1.); w = .94; }
  else dd = clamp(length(A.xyz - uHeroA) / 25., 0., 1.);
  float d = w * dd + (1. - w) * R.x;
  if (uStyle == 11) d = R.x * .3;
  float t = clamp((uT - d * (1. - uSpan)) / uSpan, 0., 1.);
  float q = -2. * t + 2.;
  e = t < .5 ? 4. * t * t * t : 1. - q * q * q * .5;
  arc = hump(e, 3.14159265) * uMotion;
  float amt = clamp(length(pb - pa) / 12., .2, 1.);
  p = blend(pa, pb, e);
  if (uStyle == 0) { p.y += arc * (.6 + 2.4 * R.y) * amt * uK; p += arc * vec3(sin(e * 8. + R.x * 30.), cos(e * 6. + R.z * 20.), sin(e * 7. + R.y * 25.)) * .6 * amt; } // rise
  else if (uStyle == 2) { p += uDir * arc * (2. + 4. * R.y) * uK; p.y += arc * .4 * R.z; }                                                                               // flow
  else if (uStyle == 4) { p = blend(pa - vec3(0., uK * e * (.6 + R.y), 0.), pb + vec3(0., uK * (1. - e) * (.6 + R.y), 0.), e); }                                         // bury
  else if (uStyle == 9) { p.y += arc * .08; }                                                                                                                             // slice
  else if (uStyle == 11) { if (e <= 0.) p = pa; else if (e >= 1.) p = pb; else if (e < .5) { float k = e * 2.; p = uHeroA + (pa - uHeroA) * (1. + k * k * k * 25.); } else { float k = (e - .5) * 2.; p = uHeroB + (pb - uHeroB) * mix(.01, 1., k * k); } } // dive
  else if (uStyle == 12) { p.y += arc * (4. + 10. * R.y) * uK; p.xz = mix(p.xz, e < .5 ? pa.xz : pb.xz, arc); }                                                        // beam
  else if (uStyle == 13) { p.z += arc * 1.5; }                                                                                                                            // raster
  else if (uStyle == 15) { p.x += sign(pa.x - uHeroA.x + .001) * arc * (1.5 + 2.5 * R.y) * uK; p.y -= arc * arc * (2. + 4. * R.z); }                                  // crack
  else if (uStyle == 16) { p.y += arc * .6 * step(.01, length(pb - pa)); }                                                                                                // expose
  else if (uStyle == 17) { // drift: the water recedes, the wet sand dries, wind ripples appear and grow into dunes
    float fa = floor(A.w + .001), water = step(1.5, fa) * step(fa, 2.5);   // sea grains (behaviour 2)
    float rec = smoothstep(0., .3, uT), rip = smoothstep(.22, .45, uT) * (1. - smoothstep(.8, 1., uT));
    float stag = .12 * clamp(dot(pb - uHeroB, uDir) / 30. + .5, 0., 1.);   // dunes form downwind first
    float grow = smoothstep(.5, .88, uT - stag);
    vec3 cp = pa;
    cp.z += water * rec * 5.; cp.y -= water * rec * .4;                     // the water recedes and drains
    cp.y += (1. - water) * sin(dot(cp.xz, uDir.xz) * 7. - uT * 18. * uMotion) * .07 * rip;   // wind ripples
    vec3 tgt = vec3(pb.x, pb.y * smoothstep(.55, 1., uT) + sin(dot(pb.xz, uDir.xz) * 7. - uT * 18. * uMotion) * .07 * (1. - grow) * rip, pb.z);
    p = blend(cp, tgt, grow) + uDir * hump(grow, 3.14159) * (1. + 2.5 * R.y) * uMotion;   // ripples grow into dunes
    e = grow; arc = hump(grow, 3.14159) * .5 * uMotion;
    m.darken = (1. - water) * smoothstep(-3., 0., pa.z) * rec * (1. - smoothstep(.3, .55, uT)) * .45;   // wet sand, drying
    m.size = blend(1. - water * rec * .85, 1., grow);
  }
  // the styles below take over the whole move: they replace p, e and arc computed above
  if (uStyle == 18) { // break: crack, fall grey into the dark hopper, glow only once fed; the furnace builds bottom-up from what falls in
    vec2 cell = floor(pa.xz / 2.4);                                   // block identity: a spatial hash, no data layer
    float hb = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
    vec3 bc = vec3((cell.x + .5) * 2.4, pa.y, (cell.y + .5) * 2.4);
    float tb = clamp((uT - hb * .25) / .55, 0., 1.);
    float crack = smoothstep(0., .2, tb), fall = smoothstep(.15, 1., tb);
    float fy = clamp((pb.y - uHeroB.y + 1.) / 10., 0., 1.);           // lower furnace grains are fed first
    float feed = clamp((uT - .55 - hb * .2 - fy * .1) / .15, 0., 1.); feed = feed * feed * (3. - 2. * feed);
    vec3 loc = (pa - bc) * (1. - .55 * fall) * (1. + .12 * crack);
    float an = fall * 2.4 * (hb - .5) * uMotion, ca = cos(an), sa2 = sin(an); loc.xz = vec2(loc.x * ca - loc.z * sa2, loc.x * sa2 + loc.z * ca);
    vec3 hop = uHeroB + vec3(0., 6., -.5), c1 = bc + vec3(0., 3., 0.), c2 = hop + vec3(0., 5., 0.);
    float u = fall * fall, iu = 1. - u;                                // gravity: a slow start, then an accelerating fall
    vec3 ctr = iu * iu * iu * bc + 3. * iu * iu * u * c1 + 3. * iu * u * u * c2 + u * u * u * hop;
    p = tb <= 0. ? pa : blend(ctr + loc, pb, feed); // at tb = 0, ctr + loc is pa (bc + (pa - bc))
    e = feed; arc = hump(crack, 3.14159) * .4 * uMotion;
    m.darken = smoothstep(.55, 1., fall) * .55 * (1. - feed);         // grey in the dark hopper
    m.heat = smoothstep(0., .45, feed) * (1. - smoothstep(.8, 1., feed));   // glow only once fed
  }
  else if (uStyle == 19) { // separate: rise as vapour into channels, impurities fall away, the rest whitens and deposits
    float rise = smoothstep(0., .45, uT - R.x * .1), sep = smoothstep(.3, .65, uT), dep = smoothstep(.55, .92, uT - (1. - R.y) * .08);
    float ch = floor(R.x * 6.); vec3 chan = vec3(-6. + ch * 2.4, 0., -1.);
    vec3 up = vec3(mix(pa.x, chan.x, rise) + sin(uT * 12. + R.y * 20.) * .2 * (1. - sep) * rise * uMotion, pa.y + rise * 8.5 * (.6 + .4 * R.z), mix(pa.z, chan.z, rise));
    float impure = step(R.z, .18);
    up.x += impure * sign(chan.x + .01) * sep * 5.; up.y -= impure * sep * sep * 7.;
    p = blend(up, pb, dep);
    e = dep; arc = hump(uT, 3.14159) * uMotion;
    m.whiten = sep * (1. - impure) * (1. - dep); m.darken = impure * sep * (1. - dep);
    m.size = mix(1., .25, impure * sep * (1. - dep)); m.heat = .4 * hump(rise, 3.14159265);
  }
  else if (uStyle == 20) { // grow: rods melt into the pool, the seed end appears, grains gather under their column and lock into the lattice
    float melt = smoothstep(0., .3, uT - R.x * .06);
    float rp = 3.6 * sqrt(R.x), ra = R.y * 6.2832;
    vec3 pool = vec3(cos(ra) * rp, -.55 + sin(uTime * uMotion * .5 + R.z * 6.) * .05, sin(ra) * rp);
    vec3 molten = mix(pa, pool, melt); molten.y -= hump(melt, 3.14159) * 1.2 * R.z;
    float fb = floor(B.w + .001), inC = 0.;
    if (fb > 14.5 && fb < 15.5) { // crystal grains: gather under their column, then lock into the lattice at the front
      // the crystal rises out of the pool by off; the inclusion threshold is separate, so no crystal
      // grain is included at t = 0 (seed tip at y < 11.4) and every one is at t = 1 (y >= 0)
      float grow = smoothstep(.36, 1., uT), off = 11.5 * (1. - grow), thr = mix(12., -.4, grow);
      inC = smoothstep(thr - .6, thr + .1, pb.y);
      vec3 slot = pb - vec3(0., off, 0.), under = vec3(pb.x, -.45, pb.z);
      p = blend(blend(molten, under, smoothstep(0., .5, inC)), slot, smoothstep(.35, 1., inC));
      e = max(melt * .49, inC);
      m.whiten = inC * (1. - inC) * 3.2;   // the crystallisation front glows as grains lock in
    } else { float k = smoothstep(.3, .7, uT); p = blend(molten, pb, k); e = max(melt * .49, k); inC = k; }
    arc = hump(uT, 3.14159) * .4 * uMotion; m.heat = melt * (1. - inC) * .85;
  }
  else if (uStyle == 21) { // become: the light goes out, the glass vanishes, sub-pixel clusters loosen and spread into the area they lit
    float fa = floor(A.w + .001), sub = step(8.5, fa) * step(fa, 9.5);
    m.fade = smoothstep(.12, .3, uT);                        // saturation 100 % → 30 %, emission off
    float rise = smoothstep(.18, .4, uT);                    // sub-pixels come up to the surface as the glass vanishes
    float loose = smoothstep(.2, .36, uT);                   // the perfect grid loosens slightly
    float part = smoothstep(.32, .7, uT - R.x * .05);        // neighbours separate and fill their own area
    vec3 from = pa + vec3(0., 0., 1.2 * sub * rise) + vec3((R.xy - .5) * .045 * loose * (1. - part), 0.);
    p = blend(from, pb, part);
    e = smoothstep(.34, .72, uT); arc = 0.;
    m.size = 1. - (1. - sub) * smoothstep(.06, .22, uT) * (1. - smoothstep(.6, .88, uT)); // the glass leaves no cloud: it vanishes, then returns as sand
  }
  return p;
}
