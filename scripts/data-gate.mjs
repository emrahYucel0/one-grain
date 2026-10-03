// Gate: the port's grain data must be bit-identical to the reference's (every version in
// scripts/lib/reference.mjs: world generators have not changed since v5).
// Compares the packed 'pos' texture (per-world digests) and hero positions at the
// reference's two grain counts: 90 000 (desktop, wide viewport) and 36 000 (small viewport).
//
//   node scripts/data-gate.mjs
import { launch } from './lib/browser.mjs';
import { createServer } from 'vite';
import { REFERENCES, digestInPage, routeReference } from './lib/reference.mjs';

const CASES = [{ n: 90000, width: 1440 }, { n: 36000, width: 700 }];

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

    const worldsOk = refDigest.map((d, i) => d === portDigest[i]);
    const heroesOk = refHeroes.map((h, i) => h.every((v, k) => v === portHeroes[i][k]));
    const ok = worldsOk.every(Boolean) && heroesOk.every(Boolean);
    console.log(`${version} N=${n} (texture rows sized for ${Math.round(refN)}): ${ok ? 'IDENTICAL' : 'MISMATCH'}`);
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
