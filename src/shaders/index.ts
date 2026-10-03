// Assembles the GLSL sources. Only render/ imports this module.
import behaviours from './behaviours.glsl?raw';
import common from './common.glsl?raw';
import grainsFrag from './grains.frag.glsl?raw';
import grainsVert from './grains.vert.glsl?raw';
import hero from './hero.glsl?raw';
import interact from './interact.glsl?raw';
import paint from './paint.glsl?raw';
import transitions from './transitions.glsl?raw';

export interface ShaderPair { vertexShader: string; fragmentShader: string }

/** The grain cloud: data access, resting behaviours, palette, transition styles, interaction, main. */
export const grainShaders: ShaderPair = {
  vertexShader: [common, behaviours, paint, transitions, interact, grainsVert].join('\n'),
  fragmentShader: grainsFrag,
};

const sections = new Map<string, string>();
for (const part of hero.split(/^\/\/#/m).slice(1)) {
  const nl = part.indexOf('\n');
  sections.set(part.slice(0, nl).trim(), part.slice(nl + 1));
}
const section = (name: string): string => {
  const s = sections.get(name);
  if (s === undefined) throw new Error(`hero.glsl is missing //#${name}`);
  return s;
};

export const heroShaders: ShaderPair = { vertexShader: section('vertex-hero'), fragmentShader: section('fragment-hero') };
export const haloShaders: ShaderPair = { vertexShader: section('vertex-halo'), fragmentShader: section('fragment-halo') };
