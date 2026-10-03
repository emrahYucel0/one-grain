// Grain colour: the world's lo→hi ramp by tone, unless the behaviour brings its own light.
vec3 paint(vec4 P, vec3 lo, vec3 hi, vec3 R){
  float f = floor(P.w + .001), tn = fract(P.w), t = uTime * uMotion;
  vec3 c = mix(lo, hi, tn);
  if (f > .5 && f < 2.5) c = mix(vec3(.2, .43, .47), vec3(.5, .75, .78), tn);
  else if (f > 4.5 && f < 5.5) c = mix(vec3(.75, .22, .08), vec3(1., .82, .45), tn) * (.85 + .25 * sin(t * 2. + R.x * 20.));
  else if (f > 6.5 && f < 7.5) c = vec3(1., .8, .45) * (1.2 - fract(t * (.3 + .4 * R.x) + R.y * 10.));
  else if (f > 7.5 && f < 8.5) { vec3 base = mix(vec3(.42, .47, .55), vec3(.7, .76, .84), R.y * .5); c = mix(base, vec3(.98, .74, .42), step(.6, tn) * step(.5, fract(t * .5 + floor(tn * 8.) / 8.)) * .75); }
  else if (f > 17.5 && f < 18.5) { float pulse = smoothstep(.88, 1., fract(tn * 4. - t * .6)); c = mix(vec3(.62, .38, .2), vec3(1.2, 1.05, .8), pulse); }
  else if (f > 18.5) { float ring = smoothstep(.82, 1., fract(t * .5 - tn * 1.5)); c = vec3(.82, .64, .32) + vec3(1., .88, .6) * ring * .9; }
  else if (f > 8.5 && f < 9.5) c = tn < .33 ? vec3(.72, .34, .3) : tn < .66 ? vec3(.38, .63, .42) : vec3(.3, .44, .72);
  else if (f > 11.5 && f < 12.5) c = hi * .9;
  else if (f > 12.5 && f < 13.5) c = mix(vec3(.8, .3, .1), vec3(1., .78, .4), tn) * (.9 + .15 * sin(t * 1.5 + R.x * 20.));
  else if (f > 13.5 && f < 14.5) c = hi * 1.1;
  else if (f > 16.5 && f < 17.5) c = vec3(.92, .9, 1.);
  return c;
}
