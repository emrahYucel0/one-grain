// How grains travel from world A to world B (uStyle, see story/types.ts GrainStyle).
// Each grain starts after a delay d that depends on where it is, so the change sweeps the scene.
// Writes the eased progress e and the in-flight arc (0 at both ends, 1 midway).
vec3 travel(vec4 A, vec3 pa, vec3 pb, vec3 R, out float e, out float arc){
  vec3 p;
  arc = 0.;
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
  return p;
}
