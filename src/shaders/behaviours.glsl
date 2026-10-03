// Every world has its own physics while it rests. Behaviour = integer part of w (see worlds/types.ts).
vec3 animate(vec4 P, vec3 R, out float sz){
  float f = floor(P.w + .001), tn = fract(P.w); vec3 p = P.xyz; float t = uTime * uMotion; sz = 1.;
  if (f > .5 && f < 1.5) { float x = mod(p.x + 13. + t * (.8 + .8 * R.x), 26.) - 13.; p = vec3(x, p.y + sin(t * 3. + R.y * 20.) * .05, 2.2 * sin(x * .22) + p.z); }       // river
  else if (f > 1.5 && f < 2.5) { p.y += .18 * sin(p.z * 1.3 - t * 1.6 + p.x * .15) + .05 * sin(p.x * .9 + t); }                                                          // sea
  else if (f > 2.5 && f < 3.5) { float ph = fract(t * (.5 + .5 * R.x) + R.y * 10.); p.x += ph * 1.4; p.y += 4. * ph * (1. - ph) * .4; }                                  // hop
  else if (f > 3.5 && f < 4.5) { float ph = fract(t * (.25 + .3 * R.x) + R.y * 10.); p.y -= ph * ph * 9.; p.x += (R.z - .5) * ph * .8; }                                 // fall
  else if (f > 4.5 && f < 5.5) { p += vec3(sin(t * .4 + R.x * 20.), sin(t * .3 + R.y * 15.) * .4, cos(t * .35 + R.z * 18.)) * .35; }                                   // magma
  else if (f > 6.5 && f < 7.5) { float ph = fract(t * (.3 + .4 * R.x) + R.y * 10.); p.y += ph * 6.; p.x += sin(ph * 6. + R.z * 20.) * .3; }                              // spark
  else if (f > 9.5 && f < 10.5) { float ph = fract(t * (.3 + .4 * R.x) + R.y * 10.); p.x += ph * 3.; p.z -= ph * 1.2; p.y += sin(ph * 3.14159) * .45; sz = 1. - ph; }   // wind streamer
  else if (f > 10.5 && f < 11.5) { p.y -= (sin(t * .6 + p.x * .25) * .5 + .5) * .09; }                                                                                  // pressure
  else if (f > 11.5 && f < 12.5) { p = mix(vec3(2., -7.2, 2.), vec3(20., 3., -4.), fract(tn + t * .05)) + (R - .5) * vec3(.3, .15, .3); }                                // conveyor
  else if (f > 12.5 && f < 13.5) { float rc = length(p.xz), an = atan(p.z, p.x), ph = t * .5 + R.x * 6.2832, r2 = rc + .5 * cos(ph); p = vec3(cos(an) * r2, p.y - .2 + .3 * sin(ph), sin(an) * r2); } // convection
  else if (f > 13.5 && f < 14.5) { float ph = fract(t * .15 + R.y), a = R.x * 6.2832; p += vec3(cos(a), (R.z - .5) * .6, sin(a)) * (1. - ph) * 1.6; sz = smoothstep(0., .15, ph); } // deposition
  else if (f > 14.5 && f < 15.5) { float a = t * .15, c = cos(a), s = sin(a); p.xz = vec2(p.x * c - p.z * s, p.x * s + p.z * c); }                                       // turning crystal
  else if (f > 16.5 && f < 17.5) { float ph = fract(t * (.6 + .4 * R.x) + R.y * 10.); p.y -= ph * 2.8; sz = 1. - ph * .7; }                                              // light ray
  return p;
}
