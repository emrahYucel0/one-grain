// What glows, by behaviour (fl = behaviour code, tn = palette tone, tt = shader time):
// magma, sparks, melt, light rays, signal pulses, the clock tree, sub-pixels, switching gates.
float emission(float fl, float tn, float tt){
  float em = 0.;
  if (fl > 4.5 && fl < 5.5) em = 1.4;                                                          // magma
  else if (fl > 6.5 && fl < 7.5) em = 2.4;                                                     // sparks
  else if (fl > 12.5 && fl < 13.5) em = 1.7;                                                   // melt
  else if (fl > 16.5 && fl < 17.5) em = 2.;                                                    // light rays
  else if (fl > 17.5 && fl < 18.5) em = .2 + 2.6 * smoothstep(.88, 1., fract(tn * 4. - tt * .6)); // signal pulses
  else if (fl > 18.5) em = .3 + 2. * smoothstep(.82, 1., fract(tt * .5 - tn * 1.5));          // clock tree
  else if (fl > 8.5 && fl < 9.5) em = 1.1;                                                     // sub-pixels
  else if (fl > 7.5 && fl < 8.5) em = 1.3 * step(.6, tn) * step(.5, fract(tt * .5 + floor(tn * 8.) / 8.)); // switching gates
  return em;
}
