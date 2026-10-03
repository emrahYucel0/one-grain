// One point per grain. position.x carries the grain id; everything else comes from the layers.
out vec3 vCol;

void main(){
  int id = int(position.x + .5);
  vec3 R = vec3(h1(position.x), h1(position.x + 71.3), h1(position.x + 13.7));
  vec4 A = grab(uFrom, id), B = grab(uTo, id);
  float sa, sb, e, arc;
  Mods m;
  vec3 pa = animate(A, R, sa), pb = animate(B, R, sb);
  vec3 p = travel(A, B, pa, pb, R, e, arc, m);
  vec4 Pc = e < .5 ? A : B;
  float fl = floor(Pc.w + .001), sz = (e < .5 ? sa : sb) * m.size;
  p = brush(p, fl, R);
  vec3 c = e < .5 ? paint(A, uLoA, uHiA, R) : paint(B, uLoB, uHiB, R);
  // the last world arrives as a neutral screen; the sand image comes in with the reveal
  if (uTo == uLast && e >= .5) { float n = .4 + .06 * R.y; c = blend(vec3(n * .9, n * .94, n), c, uReveal); }
  c = glow(c, p, fl);
  c = mix(c, vec3(1., .48, .16) * (1.1 + .3 * R.x), m.heat * .75);
  c = mix(c, vec3(.95, .97, 1.), m.whiten * .8);
  c = mix(c, vec3(.18, .14, .12), m.darken * .85);
  c *= 1. + arc * .25;
  // resting restlessness: natural matter never quite settles (confinement)
  p += vec3(sin(uTime * 1.3 + R.x * 40.), sin(uTime * 1.1 + R.y * 40.), sin(uTime * 1.7 + R.z * 40.)) * uJitter * uMotion;
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  float depth = -mv.z;
  vCol = mix(c, uFog, clamp(1. - exp(-uFogD * depth), 0., .85));
  gl_PointSize = sz < .02 ? 0. : clamp(uGrain * uScale / max(depth, .05), 1.2, 7.) * (.8 + .4 * R.z) * sz;
  gl_Position = projectionMatrix * mv;
}
