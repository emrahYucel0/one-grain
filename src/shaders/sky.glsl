// The sky behind the grains (reference v27), drawn into the HDR target before them (render/sky.ts):
// a gradient from the horizon colour to the zenith, a sun with a soft glow, slowly drifting clouds, a
// darker zenith (the HUD sits there), and below the horizon a ground band, so no sky shows between the
// grains. Linear, at uLevel of its colour; uAmount mixes it over the stage colour.
// Sections are split by the //#vertex and //#fragment markers.

//#vertex
out vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }

//#fragment
uniform vec3 uZenith, uLow, uSunC, uCloudC, uStage, uGround;
uniform vec2 uSun;
uniform float uHorizon, uAmount, uSunI, uSunS, uCloud, uTime, uAspect, uLevel;
in vec2 vUv; out highp vec4 fragColor;
float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 5; i++){ s += a * n2(p); p = p * 2.02 + 3.1; a *= .5; } return s; }
void main(){
  float y = vUv.y, hgt = smoothstep(.18, .95, y);
  vec3 sky = mix(uLow, uZenith, pow(hgt, .75));
  vec2 d = (vUv - uSun) * vec2(uAspect, 1.); float sd = length(d);
  sky += uSunC * uSunI * (exp(-sd * sd / (uSunS * uSunS)) * 1.6 + exp(-sd * 3.) * .22);
  // clouds only above .3 of the screen (below, the mask is 0: the noise is not computed there)
  if (uCloud > 0. && y > .3) {
    vec2 cp = vec2(vUv.x * uAspect * 1.4 + uTime * .008, y * 3.4);
    float cl = smoothstep(.56 - uCloud * .22, .86, fbm(cp * 2.)) * smoothstep(.3, .62, y);
    sky = mix(sky, uCloudC * (.62 + .45 * exp(-sd * 1.8)), cl * .75 * uCloud);
  }
  sky *= 1. - smoothstep(.82, 1., y) * .3;                                  // a deeper zenith keeps the HUD readable
  sky = mix(uGround / uLevel, sky, smoothstep(uHorizon - .12, uHorizon + .04, y)); // below the horizon: ground
  fragColor = vec4(mix(uStage, sky * uLevel, uAmount), 1.);
}
