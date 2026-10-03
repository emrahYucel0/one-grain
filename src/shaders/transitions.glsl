// How grains travel from world A to world B (uStyle, see story/types.ts GrainStyle).
// Each grain starts after a delay d that depends on where it is, so the change sweeps the scene.
// Writes the eased progress e, the in-flight arc (0 at both ends, 1 midway) and per-grain
// modifiers that some styles use to show what is happening to the material.
struct Mods {
  float size;   // point size multiplier
  float heat;   // 0..1 glow towards molten orange
  float whiten; // 0..1 towards purified white
  float darken; // 0..1 towards impurity brown-black
};

vec3 travel(vec4 A, vec4 B, vec3 pa, vec3 pb, vec3 R, out float e, out float arc, out Mods m){
  vec3 p;
  arc = 0.;
  m = Mods(1., 0., 0., 0.);
  if (uStyle == 5) { e = step(.5, uT); return mix(pa, pb, e); } // cut
  float dd, w = .6;
  if (uStyle == 1) dd = clamp(.5 - (pa.y - uHeroA.y) / 10., 0., 1.);
  else if (uStyle == 2 || uStyle == 3 || uStyle == 9) { dd = clamp(dot(pa - uHeroA, uDir) / uSpread + .5, 0., 1.); if (uStyle == 9) w = .9; }
  else if (uStyle == 16) { dd = clamp(dot(pb - uHeroB, uDir) / uSpread + .5, 0., 1.); w = .85; }
  else if (uStyle == 4) dd = clamp((pb.y - uHeroB.y) / 12. + .5, 0., 1.);
  else if (uStyle == 13) { dd = 1. - clamp((pb.y - uHeroB.y) / 12. + .5, 0., 1.); w = .94; }
  else dd = clamp(length(A.xyz - uHeroA) / 25., 0., 1.);
  float d = w * dd + (1. - w) * R.x;
  if (uStyle == 11) d = R.x * .3;
  float t = clamp((uT - d * (1. - uSpan)) / uSpan, 0., 1.);
  float q = -2. * t + 2.;
  e = t < .5 ? 4. * t * t * t : 1. - q * q * q * .5;
  arc = sin(3.14159265 * e) * uMotion;
  float amt = clamp(length(pb - pa) / 12., .2, 1.);
  p = mix(pa, pb, e);
  if (uStyle == 0) { p.y += arc * (.6 + 2.4 * R.y) * amt * uK; p += arc * vec3(sin(e * 8. + R.x * 30.), cos(e * 6. + R.z * 20.), sin(e * 7. + R.y * 25.)) * .6 * amt; } // rise
  else if (uStyle == 1) { p.y -= arc * (1.5 + 4. * R.y) * uK; p.xz += (R.xz - .5) * arc * 1.2; }                                                                        // fall
  else if (uStyle == 2) { p += uDir * arc * (2. + 4. * R.y) * uK; p.y += arc * .4 * R.z; }                                                                               // flow
  else if (uStyle == 3) { p += uDir * arc * (4. + 8. * R.y) * uK; p.y += arc * (1. + 3. * R.z) * uK + sin(e * 10. + R.x * 30.) * arc * .5; }                            // wind
  else if (uStyle == 4) { p = mix(pa - vec3(0., uK * e * (.6 + R.y), 0.), pb + vec3(0., uK * (1. - e) * (.6 + R.y), 0.), e); }                                         // bury
  else if (uStyle == 6) { vec3 c = (uHeroA + uHeroB) * .5 + vec3(0., 4., 0.); p = mix(p, c + (R - .5) * vec3(.8, 3., .8), arc * .85); }                                // pour
  else if (uStyle == 7) { p.y += arc * (1. + 4. * R.y) * uK; p.x += sin(e * 14. + R.x * 40.) * arc * .35; }                                                             // heat
  else if (uStyle == 8) { vec2 q2 = p.xz - uAxis; float an = arc * 3.14159 * (.5 + R.y); float c = cos(an), s = sin(an); p.xz = uAxis + vec2(q2.x * c - q2.y * s, q2.x * s + q2.y * c); p.y += arc * 1.5 * R.y; } // spiral
  else if (uStyle == 9) { p.y += arc * .08; }                                                                                                                             // slice
  else if (uStyle == 11) { if (e < .5) { float k = e * 2.; p = uHeroA + (pa - uHeroA) * (1. + k * k * k * 25.); } else { float k = (e - .5) * 2.; p = uHeroB + (pb - uHeroB) * mix(.01, 1., k * k); } } // dive
  else if (uStyle == 12) { p.y += arc * (4. + 10. * R.y) * uK; p.xz = mix(p.xz, e < .5 ? pa.xz : pb.xz, arc); }                                                        // beam
  else if (uStyle == 13) { p.z += arc * 1.5; }                                                                                                                            // raster
  else if (uStyle == 15) { p.x += sign(pa.x - uHeroA.x + .001) * arc * (1.5 + 2.5 * R.y) * uK; p.y -= arc * arc * (2. + 4. * R.z); }                                  // crack
  else if (uStyle == 16) { p.y += arc * .6 * step(.01, length(pb - pa)); }                                                                                                // expose
  else if (uStyle == 17) { // drift: the carrying medium changes from water to wind
    float wnd = smoothstep(.25, .7, e), grow = mix(.12, 1., smoothstep(.45, 1., e));
    vec3 wave = vec3(0., sin(e * 9. + pa.x * .5) * .25, sin(e * 6.2832 + R.x * 6.) * 1.4) * arc * (1. - wnd);
    vec3 wind = uDir * arc * (2. + 7. * R.y) * wnd + vec3(0., sin(dot(p.xz, vec2(-uDir.z, uDir.x)) * 5. + e * 20.) * .15 * arc, 0.);
    p = vec3(p.x, mix(pa.y, pb.y * grow + sin(pb.x * 2.5 + pb.z) * .08 * (1. - grow), e), p.z) + wave + wind;
    float fa = floor(A.w + .001);
    // sea grains (behaviour 2) recede and thin out as the water goes
    if (fa > 1.5 && fa < 2.5) { p.z += smoothstep(0., .35, e) * 3. * (1. - wnd); m.size = mix(1., .45, sin(3.14159 * smoothstep(0., .6, e))); }
  }
  // the styles below take over the whole move: they replace p, e and arc computed above
  if (uStyle == 18) { // break: blocks crack apart, tumble into the hopper, heat up as they feed the furnace
    vec2 cell = floor(pa.xz / 2.4);                                   // block identity: a spatial hash, no data layer
    float hb = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
    vec3 bc = vec3((cell.x + .5) * 2.4, pa.y, (cell.y + .5) * 2.4);
    float tb = clamp((uT - hb * .45) / .55, 0., 1.);
    float crack = smoothstep(0., .18, tb), fall = smoothstep(.15, .7, tb), feed = smoothstep(.65, 1., tb);
    vec3 loc = (pa - bc) * (1. - .55 * fall) * (1. + .12 * crack);
    float an = fall * 2.4 * (hb - .5) * uMotion, ca = cos(an), sa2 = sin(an); loc.xz = vec2(loc.x * ca - loc.z * sa2, loc.x * sa2 + loc.z * ca);
    vec3 hop = uHeroB + vec3(0., 6., -.5), c1 = bc + vec3(0., 3., 0.), c2 = hop + vec3(0., 5., 0.);
    float u = fall, iu = 1. - u;
    vec3 ctr = iu * iu * iu * bc + 3. * iu * iu * u * c1 + 3. * iu * u * u * c2 + u * u * u * hop;
    p = mix(ctr + loc, pb, feed);
    e = feed; arc = sin(3.14159 * tb) * uMotion; m.heat = smoothstep(.45, .85, tb) * (1. - smoothstep(.95, 1., tb) * .5);
  }
  return p;
}
