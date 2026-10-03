// One point per grain. position.x carries the grain id; everything else comes from the layers.
out vec3 vCol;

void main(){
  int id = int(position.x + .5);
  vec3 R = vec3(h1(position.x), h1(position.x + 71.3), h1(position.x + 13.7));
  vec4 A = grab(uFrom, id), B = grab(uTo, id);
  float sa, sb, e, arc;
  vec3 pa = animate(A, R, sa), pb = animate(B, R, sb);
  vec3 p = travel(A, pa, pb, R, e, arc);
  vec4 Pc = e < .5 ? A : B;
  float fl = floor(Pc.w + .001), sz = e < .5 ? sa : sb;
  p = brush(p, fl, R);
  vec3 c = e < .5 ? paint(A, uLoA, uHiA, R) : paint(B, uLoB, uHiB, R);
  c = glow(c, p, fl);
  c *= 1. + arc * .25;
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  float depth = -mv.z;
  vCol = mix(c, uFog, clamp(1. - exp(-uFogD * depth), 0., .85));
  gl_PointSize = sz < .02 ? 0. : clamp(uGrain * uScale / max(depth, .05), 1.2, 7.) * (.8 + .4 * R.z) * sz;
  gl_Position = projectionMatrix * mv;
}
