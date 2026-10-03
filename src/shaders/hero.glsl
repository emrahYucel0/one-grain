// The grain itself and its halo: always drawn on top, independent of the scene palette. Drawn into
// the HDR target (v15). uLight takes the grain from bright white (1) through warm quartz (.5) to a
// matte mineral at the size of any other grain (0); the halo goes with it.
// Sections are split by the //#vertex-hero, //#fragment-hero, //#vertex-halo, //#fragment-halo markers.

//#vertex-hero
uniform float uPR, uLight, uMatteSize;
void main(){ gl_PointSize = mix(uMatteSize, 7. * uPR, uLight); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }

//#fragment-hero
uniform float uLight;
uniform vec3 uMatte;
out highp vec4 fragColor;
void main(){
  vec2 q = gl_PointCoord * 2. - 1.; float r = dot(q, q); if (r > 1.) discard;
  vec3 bright = mix(vec3(1.), vec3(1., .88, .62), r) * 2.4;
  vec3 warm = vec3(1.25, .98, .68) * (.9 - .2 * r);
  vec3 matte = uMatte * (.62 + .5 * clamp(-q.x * .7 + q.y * .3 + .5, 0., 1.)) * mix(.62, 1., sqrt(max(0., 1. - r)));
  fragColor = vec4(uLight > .5 ? mix(warm, bright, (uLight - .5) * 2.) : mix(matte, warm, uLight * 2.), 1.);
}

//#vertex-halo
uniform float uPR;
void main(){ gl_PointSize = 38. * uPR; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }

//#fragment-halo
uniform float uLight;
out highp vec4 fragColor;
void main(){ vec2 q = gl_PointCoord * 2. - 1.; float r = length(q); if (r > 1.) discard; float a = exp(-r * r * 7.) * .32 * uLight * uLight; fragColor = vec4(vec3(1., .96, .88) * a, a); }
