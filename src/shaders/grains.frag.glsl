// A lit grain. What depends only on the grain (the shadow samples, light directions, attenuation,
// emission, fog) is computed once per grain in the vertex shader: a grain is at most a few pixels
// wide, so doing it per pixel only repeated it. What stays here is the sphere: v10's shading normal
// blends the grain's surface normal n with the sprite's sphere normal sw, N = normalize(.62 n + .55 sw).
// With n and the light vectors handed over in camera space, every N·X is (.62 n·X + .55 sw·X) / |N|,
// a few dot products, so key, sky/ground fill, both specular highlights and rim keep v10's
// per-pixel shape. The point light's diffuse is per grain, and the rim takes the camera's axis as
// the view vector (both measured: docs/perf.md).
// Output is linear HDR; the post chain tones it (render/post.ts).
uniform vec3 uKeyView, uUpView, uKeyCol, uSky, uGround, uRim, uPLCol;

in vec3 vAlb; in vec3 vFlat; in vec3 vNv; in vec3 vHv; in vec3 vHp; in vec4 vDots; in vec4 vMisc; in vec4 vS;
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
  if (vMisc.z > 0.) { // lit (vMisc.z, the rim strength, is 0 when unlit)
    // vDots: .62 n·key, .62 n·half, .62 n·view, .62 n·up (world vectors, per grain)
    float il = inversesqrt(max(.6869 + .682 * dot(sn, vNv), 1e-4));
    float ndl = max((vDots.x + .55 * dot(sn, uKeyView)) * il, 0.);
    float ndh = max((vDots.y + .55 * dot(sn, vHv)) * il, 0.);
    float ndv = max((vDots.z + .55 * sn.z) * il, 0.); // the view vector taken as the camera's axis
    float ny = (vDots.w + .55 * dot(sn, uUpView)) * il;
    float ao = mix(.62, 1., sn.z), r = 1. - ndv;
    float ndhp = max((vS.z + .55 * dot(sn, vHp)) * il, 0.);
    // vS: key shadow, key and point specular strengths · vMisc: gloss, share left after fog, rim strength
    col = vAlb * (uKeyCol * ndl * vS.x + mix(uGround, uSky, ny * .5 + .5) * ao)
        + uKeyCol * (pow(ndh, vMisc.x) * vS.y) + uPLCol * (pow(ndhp, vMisc.x) * vS.w) + uRim * (r * r * r * vMisc.z);
  }
  col = col * vMisc.y + vFlat;
  fragColor = vec4(col, 1.);
}
