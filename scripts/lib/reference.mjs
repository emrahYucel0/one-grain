// Serves reference/blockout-v5.html with a few instrumentation hooks spliced in, so the
// harness can drive it exactly like the port's ?parity mode. The file on disk is never touched.
//
//   window.__V      scroll progress override (0..1), read every frame
//   window.__T      shader time override (seconds), read every frame
//   window.__DATA   the packed grain texture (Float32Array) once built
//   window.__HEROES hero positions [[x, y, z] × 15] once built
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const REFERENCE_FILE = fileURLToPath(new URL('../../reference/blockout-v5.html', import.meta.url));

const PATCHES = [
  ['const dt = Math.min(clock.getDelta(), .05);', 'if (window.__V != null) state.v = window.__V; const dt = Math.min(clock.getDelta(), .05);'],
  ['if (!reduced) time += dt;', 'if (!reduced) time += dt; if (window.__T != null) time = window.__T;'],
  ['U.uData.value = tex;', 'U.uData.value = tex; window.__DATA = data; window.__HEROES = heroes.map(h => [h.x, h.y, h.z]);'],
];

export async function patchedReference() {
  let html = await readFile(REFERENCE_FILE, 'utf8');
  for (const [find, replace] of PATCHES) {
    const count = html.split(find).length - 1;
    if (count !== 1) throw new Error(`reference patch target found ${count}× (expected 1): ${find}`);
    html = html.replace(find, replace);
  }
  return html;
}

/** Answers `url` with the patched reference in this page. */
export async function routeReference(page, url) {
  const body = await patchedReference();
  await page.route(url, (route) => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body }));
}

/** FNV-1a over the 32-bit words of each world's slice; runs in the page. */
export const digestInPage = (expr) => `(() => {
  const d = ${expr}, worlds = 15, per = d.length / worlds, u = new Uint32Array(d.buffer, d.byteOffset, d.length), out = [];
  for (let w = 0; w < worlds; w++) { let h = 0x811c9dc5; for (let i = w * per; i < (w + 1) * per; i++) { h ^= u[i]; h = Math.imul(h, 16777619) >>> 0; } out.push(h); }
  return out;
})()`;
