// HDR post (v10): bright pass → blur pyramid (bloom), half-resolution depth of field, and the
// composite: depth of field, bloom, a shoulder-only tone curve, vignette, film grain, display gamma.
// Sections are split by the //#vertex, //#bright, //#blur, //#dof, //#composite markers.

//#vertex
out vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }

//#bright
uniform sampler2D uTex; uniform float uTh;
in vec2 vUv; out highp vec4 fragColor;
void main(){ vec3 c = texture(uTex, vUv).rgb; float l = dot(c, vec3(.2126, .7152, .0722)); fragColor = vec4(c * smoothstep(uTh, uTh + .8, l), 1.); }

//#blur
// 5-tap Gaussian along uDir (linear sampling places the taps between texels); uDir = 0 copies
uniform sampler2D uTex; uniform vec2 uDir;
in vec2 vUv; out highp vec4 fragColor;
void main(){
  vec3 c = texture(uTex, vUv).rgb * .2270;
  c += (texture(uTex, vUv + uDir * 1.385).rgb + texture(uTex, vUv - uDir * 1.385).rgb) * .3162;
  c += (texture(uTex, vUv + uDir * 3.231).rgb + texture(uTex, vUv - uDir * 3.231).rgb) * .0703;
  fragColor = vec4(c, 1.);
}

//#dof
// 12 taps on a golden-angle spiral, radius from the circle of confusion; taps that are sharper than
// their distance from the centre weigh less, so sharp grains do not bleed into the blur
uniform sampler2D uColor, uDepth; uniform float uNear, uFar, uFocus, uRange, uMaxBlur; uniform vec2 uTexel;
in vec2 vUv; out highp vec4 fragColor;
float linZ(float d){ float z = d * 2. - 1.; return 2. * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
float cocAt(vec2 uv){ float d = textureLod(uDepth, uv, 0.).r; if (d >= 1.) return 1.; return clamp(abs(linZ(d) - uFocus) / uRange, 0., 1.); }
void main(){
  float coc = cocAt(vUv), r0 = coc * uMaxBlur; vec3 acc = textureLod(uColor, vUv, 0.).rgb; float ws = 1.;
  for (int i = 0; i < 12; i++) {
    float fi = float(i), r = sqrt((fi + .5) / 12.) * r0, a = fi * 2.39996;
    vec2 uv = vUv + vec2(cos(a), sin(a)) * r * uTexel; float w = clamp(cocAt(uv) * uMaxBlur - r + 1.5, 0., 1.) + .12;
    acc += textureLod(uColor, uv, 0.).rgb * w; ws += w;
  }
  fragColor = vec4(acc / ws, coc);
}

//#composite
uniform sampler2D uColor, uDepth, uBloomA, uBloomB, uDof;
uniform float uNear, uFar, uFocus, uRange, uBloom, uUseDof, uUseBloom, uUseGrade, uTime, uGrainOn;
in vec2 vUv; out highp vec4 fragColor;
float linZ(float d){ float z = d * 2. - 1.; return 2. * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
float cocAt(vec2 uv){ float d = texture(uDepth, uv).r; if (d >= 1.) return 1.; return clamp(abs(linZ(d) - uFocus) / uRange, 0., 1.); }
// a shoulder only: darks stay exactly as art-directed, highlights roll off softly
vec3 shoulder(vec3 x){ vec3 a = vec3(.62); return mix(x, a + (1. - a) * (1. - exp(-(x - a) / (1. - a))), step(a, x)); }
float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(.06711056, .00583715)))); } // interleaved gradient noise
void main(){
  vec3 c = texture(uColor, vUv).rgb;
  if (uUseDof > .5) { vec4 bl = texture(uDof, vUv); c = mix(c, bl.rgb, smoothstep(.04, .35, cocAt(vUv))); }
  if (uUseBloom > .5) c += (texture(uBloomA, vUv).rgb * .6 + texture(uBloomB, vUv).rgb * .9) * uBloom;
  c = shoulder(c * 1.3);
  if (uUseGrade > .5) {
    vec2 d = vUv - .5; c *= 1. - dot(d, d) * .45;
    // film grain: moves with shader time (frozen under ?parity's __T), static under reduced motion
    c += (ign(gl_FragCoord.xy + floor(fract(uTime * 7.) * 64.) * vec2(5.588, 7.123) * uGrainOn) - .5) * .02;
  }
  fragColor = vec4(pow(clamp(c, 0., 1.), vec3(1. / 2.2)), 1.);
}
