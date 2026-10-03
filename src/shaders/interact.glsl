// Hands-on holds. uInteract 1: grains part around the cursor on the dunes (still, hop and
// streamer grains). uInteract 2: switches near the cursor light up on the chip.
vec3 brush(vec3 p, float fl, vec3 R){
  if (uInteract == 1 && (fl < .5 || (fl > 2.5 && fl < 3.5) || (fl > 9.5 && fl < 10.5))) {
    vec2 dm = p.xz - uMouseW.xz; float md = length(dm), rr = 1.8 + uPress * 1.5;
    if (md < rr) { p.xz += dm / (md + .001) * (rr - md) * .7; p.y += (rr - md) * .6 * R.y; }
  }
  return p;
}

vec3 glow(vec3 c, vec3 p, float fl, inout float em){
  if (uInteract == 2 && fl > 7.5) { float g = smoothstep(1.6 + uPress, .2, length(p.xz - uMouseW.xz)); c += vec3(1., .82, .5) * g * 1.1; em += g * 1.5; }
  return c;
}
