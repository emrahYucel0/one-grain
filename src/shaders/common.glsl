// Shared declarations for the grain vertex shader.
precision highp sampler2D;

uniform sampler2D uLayer_pos;     // xyz position, w behaviour + tone
uniform sampler2D uLayer_surface; // xyz surface normal, w material id
uniform int uRows, uFrom, uTo, uStyle, uInteract;
uniform int uRest; // 0 moving · 1 resting in world A (t = 0) · 2 resting in world B (t = 1)
uniform float uLand;   // the final grain landing, 0..1 (its neighbours make room)
uniform vec3 uLandPos; // where it lands
uniform vec3 uScreen;  // the final world's sand taking the screen's proportions: x, y scale, how far (Awwwards P4)
uniform vec2 uRing;    // the grain's last light through the final world's sand: radius, strength (Awwwards P3)
uniform float uPointMax; // largest grain, in pixels, before the per-grain size factor
uniform float uSpecA, uSpecB; // each world's gloss
uniform float uGlowA, uGlowB, uRaysA, uRaysB, uPixA, uPixB, uWaterA, uWaterB; // each world's material look (story/lights.ts)
uniform vec4 uAccentA, uAccentB; // each world's accent (story/lights.ts heat, film): heat amount, its centre y, half-width; film
uniform float uPx;            // shadow map pixels per world unit
uniform float uShadowGrow;    // disc size factor in the shadow map (1; ?shadowgrow for measurements)
uniform mat4 uLightVP;        // the key light's view-projection (shadow map)
uniform float uTime, uT, uMotion, uScale, uGrain, uFogD, uK, uSpan, uSpread, uPress, uJitter;
uniform vec3 uHeroA, uHeroB, uDir, uMouseW, uLoA, uHiA, uLoB, uHiB, uFog;
uniform vec4 uTouch; // the cursor's touch: its NDC xy, radius (in half screen heights), strength (0: none)

// per-grain stable random from its id
float h1(float n){ return fract(sin(n * 12.9898 + 4.1) * 43758.5453); }

// grain `id` in world `s`: xyz position, w = behaviour code + palette tone
vec4 grab(int s, int id){ return texelFetch(uLayer_pos, ivec2(id % TEX_WIDTH, id / TEX_WIDTH + s * uRows), 0); }
vec4 grabSurface(int s, int id){ return texelFetch(uLayer_surface, ivec2(id % TEX_WIDTH, id / TEX_WIDTH + s * uRows), 0); }
