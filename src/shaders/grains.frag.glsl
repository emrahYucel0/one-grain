// A round grain with a little top-left light.
in vec3 vCol;
out highp vec4 fragColor;

void main(){
  vec2 q = gl_PointCoord * 2. - 1.; float r = dot(q, q);
  if (r > 1.) discard;
  fragColor = vec4(vCol * (.95 + .1 * (-q.x - q.y) - .08 * r), 1.);
}
