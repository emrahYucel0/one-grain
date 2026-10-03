// A lit grain: a sphere impostor (the point sprite's sphere normal blended with the grain's surface
// normal), key light with specular and shadow, sky/ground fill, a point light, rim, emission, fog.
// Output is linear HDR; DIRECT_OUTPUT applies the tone curve here while there is no post pass.
uniform vec3 uKeyDir, uKeyCol, uSky, uGround, uRim, uPLPos, uPLCol, uCamPos, uCamR, uCamU, uCamB, uFogLin;
uniform float uPLRange, uUseShadow, uUseLight, uShadowTexel;
uniform sampler2D uShadow;

in vec3 vCol; in vec3 vN; in vec3 vW; in float vEmit; in float vSpec; in float vSeed; in float vFog; in float vPix; in vec4 vLS;
out highp vec4 fragColor;

// 4-tap PCF on the key light's shadow map (textureLod: no derivatives inside a loop that can exit early)
float shadowAt(){
  vec3 lc = vLS.xyz / vLS.w * .5 + .5;
  if (lc.x <= 0. || lc.x >= 1. || lc.y <= 0. || lc.y >= 1. || lc.z >= 1.) return 1.;
  float d = 0.;
  for (int i = 0; i < 4; i++) { vec2 o = (vec2(float(i % 2), float(i / 2)) - .5) * uShadowTexel * 1.5; d += step(lc.z - .0016, textureLod(uShadow, lc.xy + o, 0.).r); }
  return d * .25;
}

#ifdef DIRECT_OUTPUT
// the tone curve of the post pass (a shoulder only) and display gamma
vec3 shoulder(vec3 x){ vec3 a = vec3(.62); return mix(x, a + (1. - a) * (1. - exp(-(x - a) / (1. - a))), step(a, x)); }
vec3 display(vec3 c){ return pow(clamp(shoulder(c * 1.3), 0., 1.), vec3(1. / 2.2)); }
#endif

void main(){
  vec2 q = gl_PointCoord * 2. - 1.;
#ifdef OVERDRAW
  if (dot(q, q) > 1.) discard;
  fragColor = vec4(vec3(1. / 32.), 1.);
  return;
#endif
  float r2 = dot(q, q); if (r2 > 1.) discard;
  vec3 sn = vec3(q.x, -q.y, sqrt(1. - r2));
  vec3 sw = normalize(uCamR * sn.x + uCamU * sn.y + uCamB * sn.z);
  vec3 N = normalize(normalize(vN) * .62 + sw * .55);
  vec3 V = normalize(uCamPos - vW);
  vec3 col = vCol;
  if (uUseLight > .5) {
    float sh = uUseShadow > .5 ? shadowAt() : 1.;
    float ndl = max(dot(N, uKeyDir), 0.);
    vec3 hemi = mix(uGround, uSky, N.y * .5 + .5);
    vec3 Lp = uPLPos - vW; float dist = max(length(Lp), .001), att = 1. / (1. + dist * dist / (uPLRange * uPLRange));
    vec3 pl = uPLCol * max(dot(N, Lp / dist), 0.) * att;
    float gloss = mix(10., 140., vSpec);
    float spec = pow(max(dot(N, normalize(uKeyDir + V)), 0.), gloss) * vSpec * 1.8;
    float specPl = pow(max(dot(N, normalize(Lp / dist + V)), 0.), gloss) * vSpec * 1.2 * att;
    float rim = pow(1. - max(dot(N, V), 0.), 3.);
    float ao = mix(.62, 1., sn.z);
    col = vCol * (uKeyCol * ndl * sh + hemi * ao + pl) + uKeyCol * spec * sh + uPLCol * specPl + uRim * rim * .6;
  }
  col += vCol * vEmit * (.88 + .2 * sin(vSeed * 30. + vW.x));
  col = mix(col, uFogLin, vFog);
#ifdef DIRECT_OUTPUT
  col = display(col);
#endif
  fragColor = vec4(col, 1.);
}
