// Gate: the port's grain data must be bit-identical to the reference's (every version in
// scripts/lib/reference.mjs). Worlds 0–13 have not changed since v5; the final world ("now") is
// new in v15, so v15 is its only baseline and the older references cover worlds 0–13.
// Compares the packed 'pos' texture (per-world digests) and hero positions at the
// reference's two grain counts: 90 000 (desktop, wide viewport) and 36 000 (small viewport).
// Where the reference has surface normals (v10, v15), the 'surface' layer's normals are compared too,
// after passing the reference's float32 values through the port's own half conversion; and the
// whole surface layer (material ids included) must come out identical when built twice.
//
//   node scripts/data-gate.mjs
import { launch } from './lib/browser.mjs';
import { createServer } from 'vite';
import { REFERENCES, digestInPage, routeReference } from './lib/reference.mjs';

const CASES = [{ n: 90000, width: 1440 }, { n: 36000, width: 700 }];
const FINAL = 14;
/** The worlds each reference is the baseline for. */
const inScope = (version, i) => version === 'v15' || i < FINAL;
/** Worlds expected to differ for now (reported, not failed). None at present. */
const PENDING = {};
const pending = (version, i) => (PENDING[version] ?? []).includes(i);
const counts = (version, i) => inScope(version, i) && !pending(version, i);

const server = await createServer({ server: { port: 5199, strictPort: true }, logLevel: 'error' });
await server.listen();
const origin = 'http://localhost:5199';
const browser = await launch();
let failed = false;

try {
  for (const version of REFERENCES) for (const { n, width } of CASES) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });

    const ref = await ctx.newPage();
    await routeReference(ref, `${origin}/__reference.html`, version);
    await ref.goto(`${origin}/__reference.html`);
    await ref.waitForFunction(() => window.__DATA, null, { timeout: 120000 });
    const refN = await ref.evaluate(() => window.__DATA.length / 15 / 4);
    const refDigest = await ref.evaluate(digestInPage('window.__DATA'));
    const refHeroes = await ref.evaluate(() => window.__HEROES);

    const port = await ctx.newPage();
    await port.goto(`${origin}/reference/README.md`); // any same-origin page will do
    await port.evaluate(async (count) => {
      const m = await import('/src/sim/build.ts');
      window.__PACK = m.buildPack(count);
    }, n);
    const portDigest = await port.evaluate(digestInPage('window.__PACK.layers[0].data'));
    const portHeroes = await port.evaluate(() => { const h = window.__PACK.heroes, o = []; for (let i = 0; i < h.length; i += 3) o.push([h[i], h[i + 1], h[i + 2]]); return o; });

    // surface normals vs the reference (v10), and determinism of the whole surface layer
    const hasNormals = await ref.evaluate(() => !!window.__NDATA);
    let surfaceOk = true, surfaceNote = '';
    if (hasNormals) {
      // FNV-1a per world over the normals' xyz half-float bits (w skipped), as a function body run in the page
      const xyzDigest = `const worlds = 15, per = d.length / worlds, out = [];
        for (let w = 0; w < worlds; w++) { let h = 0x811c9dc5; for (let i = w * per; i < (w + 1) * per; i++) { if (i % 4 === 3) continue; h ^= d[i]; h = Math.imul(h, 16777619) >>> 0; } out.push(h); }
        return out;`;
      const refN16 = await ref.evaluate(async (body) => {
        const { toHalf } = await import('/src/sim/half.ts');
        const nd = window.__NDATA, halves = new Uint16Array(nd.length);
        for (let i = 0; i < nd.length; i++) halves[i] = i % 4 === 3 ? 0 : toHalf(nd[i]);
        return new Function('d', body)(halves);
      }, xyzDigest);
      const portN16 = await port.evaluate((body) => new Function('d', body)(window.__PACK.layers[1].data), xyzDigest);
      const bad = refN16.map((d, i) => (d === portN16[i] || !counts(version, i) ? -1 : i)).filter((i) => i >= 0);
      surfaceOk = bad.length === 0;
      surfaceNote = surfaceOk ? ', normals IDENTICAL' : `, normals differ in worlds ${bad.join(', ')}`;
    }
    const twice = await port.evaluate(async (count) => {
      const m = await import('/src/sim/build.ts');
      const a = window.__PACK.layers[1].data, b = m.buildPack(count).layers[1].data;
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
      return true;
    }, n);
    surfaceOk &&= twice;
    surfaceNote += twice ? ', surface layer deterministic' : ', surface layer NOT deterministic';

    const worldsOk = refDigest.map((d, i) => !counts(version, i) || d === portDigest[i]);
    const heroesOk = refHeroes.map((h, i) => !counts(version, i) || h.every((v, k) => v === portHeroes[i][k]));
    const scope = refDigest.every((_, i) => inScope(version, i)) ? 'all 15 worlds' : `worlds 0–${FINAL - 1}`;
    const waiting = refDigest.map((_, i) => i).filter((i) => pending(version, i));
    const ok = worldsOk.every(Boolean) && heroesOk.every(Boolean) && surfaceOk;
    console.log(`${version} N=${n} (texture rows sized for ${Math.round(refN)}), ${scope}: positions ${worldsOk.every(Boolean) && heroesOk.every(Boolean) ? 'IDENTICAL' : 'MISMATCH'}${surfaceNote}${waiting.length ? ` · world ${waiting.join(', ')} pending (${refDigest[FINAL] === portDigest[FINAL] ? 'already identical' : 'differs, as expected until the new final is ported'})` : ''}`);
    if (!ok) {
      failed = true;
      worldsOk.forEach((w, i) => { if (!w) console.log(`  world ${i}: data differs`); });
      heroesOk.forEach((h, i) => { if (!h) console.log(`  world ${i}: hero ${refHeroes[i]} vs ${portHeroes[i]}`); });
      const first = worldsOk.indexOf(false);
      if (first >= 0) {
        const slice = (expr) => `(() => { const d = ${expr}, per = d.length / 15; return Array.from(d.subarray(${first} * per, ${first} * per + 400)); })()`;
        const a = await ref.evaluate(slice('window.__DATA')), b = await port.evaluate(slice('window.__PACK.layers[0].data'));
        const k = a.findIndex((v, i) => v !== b[i]);
        if (k >= 0) console.log(`  first difference in world ${first} at float ${k} (grain ${k >> 2}): ref ${a.slice(k - k % 4, k - k % 4 + 4)} port ${b.slice(k - k % 4, k - k % 4 + 4)}`);
      }
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  await server.close();
}
process.exit(failed ? 1 : 0);
