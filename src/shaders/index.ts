// Assembles the GLSL sources. Only render/ imports this module.
import behaviours from './behaviours.glsl?raw';
import common from './common.glsl?raw';
import grainsShadowFrag from './grains-shadow.frag.glsl?raw';
import grainsFrag from './grains.frag.glsl?raw';
import grainsVert from './grains.vert.glsl?raw';
import hero from './hero.glsl?raw';
import emission from './emission.glsl?raw';
import interact from './interact.glsl?raw';
import loupe from './loupe.glsl?raw';
import paint from './paint.glsl?raw';
import post from './post.glsl?raw';
import sky from './sky.glsl?raw';
import transitions from './transitions.glsl?raw';

export interface ShaderPair { vertexShader: string; fragmentShader: string }

/** The grain cloud: data access, resting behaviours, palette, transition styles, interaction, emission, main. */
export const grainShaders: ShaderPair = {
  vertexShader: [common, behaviours, paint, transitions, interact, emission, grainsVert].join('\n'),
  fragmentShader: grainsFrag,
};

/** The grain cloud drawn into the key light's shadow map (with the SHADOW define). */
export const grainShadowShaders: ShaderPair = { vertexShader: grainShaders.vertexShader, fragmentShader: grainsShadowFrag };

/** Splits a file into the sections marked //#name. */
function sectionsOf(file: string, src: string): (name: string) => string {
  const sections = new Map<string, string>();
  for (const part of src.split(/^\/\/#/m).slice(1)) {
    const nl = part.indexOf('\n');
    sections.set(part.slice(0, nl).trim(), part.slice(nl + 1));
  }
  return (name) => {
    const s = sections.get(name);
    if (s === undefined) throw new Error(`${file} is missing //#${name}`);
    return s;
  };
}

const heroSection = sectionsOf('hero.glsl', hero);
export const heroShaders: ShaderPair = { vertexShader: heroSection('vertex-hero'), fragmentShader: heroSection('fragment-hero') };
export const haloShaders: ShaderPair = { vertexShader: heroSection('vertex-halo'), fragmentShader: heroSection('fragment-halo') };

const postSection = sectionsOf('post.glsl', post);
const fullscreen = (name: string): ShaderPair => ({ vertexShader: postSection('vertex'), fragmentShader: postSection(name) });
/** The HDR post passes, each a fullscreen quad (render/post.ts). */
export const postShaders = {
  bright: fullscreen('bright'), blur: fullscreen('blur'), dof: fullscreen('dof'), composite: fullscreen('composite'),
} as const;

const skySection = sectionsOf('sky.glsl', sky);
/** The sky behind the grains, a fullscreen quad (render/sky.ts). */
export const skyShaders: ShaderPair = { vertexShader: skySection('vertex'), fragmentShader: skySection('fragment') };
/** The low-resolution sky stretched over the HDR target. */
export const skyCopyShaders: ShaderPair = { vertexShader: skySection('copy-vertex'), fragmentShader: skySection('copy') };

const loupeSection = sectionsOf('loupe.glsl', loupe);
/** The loupe's lens, raymarched into its own small target (render/loupe.ts). */
export const loupeShaders: ShaderPair = { vertexShader: loupeSection('vertex'), fragmentShader: loupeSection('fragment') };
/** The lens laid over the canvas. */
export const loupeBlitShaders: ShaderPair = { vertexShader: loupeSection('blit-vertex'), fragmentShader: loupeSection('blit') };
