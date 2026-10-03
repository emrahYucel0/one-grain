// A lit grain. What depends only on the grain (one shadow sample, the point light, emission, fog)
// is computed once per grain in the vertex shader: a grain is at most a few pixels wide, so doing it
// per pixel only repeated it. What stays here is the sphere: v10's shading normal blends the
// grain's surface normal n with the sprite's sphere normal sw, N = normalize(.62 n + .55 sw). With n
// and the light vectors handed over in camera space, every N·X is (.62 n·X + .55 sw·X) / |N|, a few
// dot products, so key, sky/ground fill, specular and rim keep v10's per-pixel shape.
// Output is linear HDR; the post chain tones it (render/post.ts).
uniform vec3 uKeyView, uUpView, uKeyCol, uSky, uGround, uRim;

in vec3 vAlb; in vec3 vFlat; in vec3 vNv; in vec3 vHv; in vec3 vVv; in vec4 vDots; in vec4 vMisc; in vec2 vSh;
out highp vec4 fragColor;

void main(){
  vec2 q = gl_PointCoord * 2. - 1.;
#ifdef OVERDRAW
  if (dot(q, q) > 1.) discard;
  fragColor = vec4(vec3(1. / 32.), 1.);
  return;
#endif
  float r2 = dot(q, q); if (r2 > 1.) discard;
  vec3 sn = vec3(q.x, -q.y, sqrt(1. - r2)); // sphere normal in camera space
  vec3 col = vAlb;
  if (vMisc.z > 0.) {
    // vDots: .62 n·key, .62 n·half, .62 n·view, .62 n·up (world vectors, per grain)
    float il = inversesqrt(max(.6869 + .682 * dot(sn, vNv), 1e-4));
    float ndl = max((vDots.x + .55 * dot(sn, uKeyView)) * il, 0.);
    float ndh = max((vDots.y + .55 * dot(sn, vHv)) * il, 0.);
    float ndv = max((vDots.z + .55 * dot(sn, vVv)) * il, 0.);
    float ny = (vDots.w + .55 * dot(sn, uUpView)) * il;
    float ao = mix(.62, 1., sn.z), r = 1. - ndv;
    // vSh: shadow, specular strength · vMisc: gloss, share left after fog, rim strength
    col = vAlb * (uKeyCol * ndl * vSh.x + mix(uGround, uSky, ny * .5 + .5) * ao)
        + uKeyCol * (pow(ndh, vMisc.x) * vSh.y) + uRim * (r * r * r * vMisc.z);
  }
  col = col * vMisc.y + vFlat;
  fragColor = vec4(col, 1.);
}
