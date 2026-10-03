// Shared declarations for the grain vertex shader.
precision highp sampler2D;

uniform sampler2D uLayer_pos;
uniform int uRows, uFrom, uTo, uStyle, uInteract;
uniform float uTime, uT, uMotion, uScale, uGrain, uFogD, uK, uSpan, uSpread, uPress;
uniform vec3 uHeroA, uHeroB, uDir, uMouseW, uLoA, uHiA, uLoB, uHiB, uFog;

// per-grain stable random from its id
float h1(float n){ return fract(sin(n * 12.9898 + 4.1) * 43758.5453); }

// grain `id` in world `s`: xyz position, w = behaviour code + palette tone
vec4 grab(int s, int id){ return texelFetch(uLayer_pos, ivec2(id % TEX_WIDTH, id / TEX_WIDTH + s * uRows), 0); }
