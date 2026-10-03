// Shared declarations for the grain vertex shader.
precision highp sampler2D;

uniform sampler2D uLayer_pos;
uniform int uRows, uFrom, uTo, uStyle, uInteract, uLast;
uniform int uRest; // 0 moving · 1 resting in world A (t = 0) · 2 resting in world B (t = 1)
uniform float uReveal;
uniform float uPointMax; // largest grain, in pixels, before the per-grain size factor
uniform float uTime, uT, uMotion, uScale, uGrain, uFogD, uK, uSpan, uSpread, uPress, uJitter;
uniform vec3 uHeroA, uHeroB, uDir, uMouseW, uLoA, uHiA, uLoB, uHiB, uFog;

// per-grain stable random from its id
float h1(float n){ return fract(sin(n * 12.9898 + 4.1) * 43758.5453); }

// grain `id` in world `s`: xyz position, w = behaviour code + palette tone
vec4 grab(int s, int id){ return texelFetch(uLayer_pos, ivec2(id % TEX_WIDTH, id / TEX_WIDTH + s * uRows), 0); }
