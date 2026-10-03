import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

// Layering rules: simulation never knows how grains are drawn, and drawing never
// knows how worlds are generated. Only render/ may touch the GLSL.
// (Later blocks override earlier ones for the same rule, so the general rule comes first.)
const pattern = (group, message) => ({ group, message });

export default tseslint.config(
  { ignores: ['dist/', 'reference/', 'parity/', 'node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [pattern(['**/shaders/**'], 'Only render/ imports GLSL.')],
      }],
    },
  },
  {
    files: ['src/worlds/**/*.ts', 'src/sim/**/*.ts'],
    languageOptions: { globals: { ...globals.worker } },
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{ name: 'three', message: 'worlds/ and sim/ stay renderer-agnostic.' }],
        patterns: [
          pattern(['three/*'], 'worlds/ and sim/ stay renderer-agnostic.'),
          pattern(['**/render/**', '**/shaders/**', '**/core/**', '**/ui/**', '**/camera/**', '**/timeline/**'], 'worlds/ and sim/ must not depend on rendering or UI.'),
        ],
      }],
    },
  },
  {
    files: ['src/render/**/*.ts', 'src/shaders/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [pattern(['**/worlds/**', '**/sim/build', '**/sim/build.ts', '**/sim/client', '**/sim/client.ts'], 'render/ only consumes the GrainPack type from sim/pack.')],
      }],
    },
  },
  {
    files: ['scripts/**/*.mjs', 'eslint.config.js', 'vite.config.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
);
