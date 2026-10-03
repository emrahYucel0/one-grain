// The grain itself and its halo: always drawn on top, independent of the scene palette.
// Sections are split by the //#vertex-hero, //#fragment-hero, //#vertex-halo, //#fragment-halo markers.

//#vertex-hero
uniform float uPR;
void main(){ gl_PointSize = 9. * uPR; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }

//#fragment-hero
out highp vec4 fragColor;
void main(){ vec2 q = gl_PointCoord * 2. - 1.; float r = dot(q, q); if (r > 1.) discard; fragColor = vec4(mix(vec3(1.), vec3(1., .88, .62), r), 1.); }

//#vertex-halo
uniform float uPR;
void main(){ gl_PointSize = 64. * uPR; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }

//#fragment-halo
out highp vec4 fragColor;
void main(){ vec2 q = gl_PointCoord * 2. - 1.; float r = length(q); if (r > 1.) discard; float a = exp(-r * r * 6.) * .55; fragColor = vec4(vec3(1., .96, .88) * a, a); }
