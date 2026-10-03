// Serves a reference blockout (v6 by default) with a few instrumentation hooks spliced in, so the
// harness can drive it exactly like the port's ?parity mode. The file on disk is never touched.
//
//   window.__V      scroll progress override (0..1), read every frame
//   window.__T      shader time override (seconds), read every frame
//   window.__DATA   the packed grain texture (Float32Array) once built
//   window.__HEROES hero positions [[x, y, z] × 15] once built
//   window.__NDATA  the surface normals (Float32Array, xyz per grain), where the reference has them (v10)
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/** The behavioural spec of the current phase comes first. */
export const REFERENCES = ['v10', 'v8', 'v6', 'v5'];
const FILES = { v10: 'v10-lit.html' };
export const referenceFile = (version = REFERENCES[0]) => fileURLToPath(new URL(`../../reference/${FILES[version] ?? `blockout-${version}.html`}`, import.meta.url));

const PATCHES = [
  ['const dt = Math.min(clock.getDelta(), .05);', 'if (window.__V != null) state.v = window.__V; const dt = Math.min(clock.getDelta(), .05);'],
  ['if (!reduced) time += dt;', 'if (!reduced) time += dt; if (window.__T != null) time = window.__T;'],
  ['U.uData.value = tex;', 'U.uData.value = tex; window.__DATA = data; window.__HEROES = heroes.map(h => [h.x, h.y, h.z]);'],
];
/** Hooks that only apply to references that have the thing they expose. */
const OPTIONAL_PATCHES = [
  ['U.uNorm.value = ntex;', 'U.uNorm.value = ntex; window.__NDATA = ndata;'],
];

export async function patchedReference(version) {
  let html = await readFile(referenceFile(version), 'utf8');
  for (const [find, replace] of PATCHES) {
    const count = html.split(find).length - 1;
    if (count !== 1) throw new Error(`reference patch target found ${count}× (expected 1): ${find}`);
    html = html.replace(find, replace);
  }
  for (const [find, replace] of OPTIONAL_PATCHES) if (html.split(find).length === 2) html = html.replace(find, replace);
  return html;
}

/** Answers `url` with the patched reference in this page. */
export async function routeReference(page, url, version) {
  const body = await patchedReference(version);
  await page.route(url, (route) => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body }));
}

/** FNV-1a over the 32-bit words of each world's slice; runs in the page. */
export const digestInPage = (expr) => `(() => {
  const d = ${expr}, worlds = 15, per = d.length / worlds, u = new Uint32Array(d.buffer, d.byteOffset, d.length), out = [];
  for (let w = 0; w < worlds; w++) { let h = 0x811c9dc5; for (let i = w * per; i < (w + 1) * per; i++) { h ^= u[i]; h = Math.imul(h, 16777619) >>> 0; } out.push(h); }
  return out;
})()`;
