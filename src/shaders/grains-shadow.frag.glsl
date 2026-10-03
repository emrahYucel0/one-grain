// A grain in the key light's shadow map: a disc; only its depth matters.
out highp vec4 fragColor;

void main(){
  vec2 q = gl_PointCoord * 2. - 1.;
  if (dot(q, q) > 1.) discard;
  fragColor = vec4(1.);
}
