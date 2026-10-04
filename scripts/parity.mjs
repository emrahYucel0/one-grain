// Parity checklist: the reference next to the port at every hold and every transition midpoint.
//
//   npm run parity        (builds first, then runs this against dist/)
//
// Both pages run the same grain count (mid tier = reference desktop), the same viewport, the
// same frozen shader time (window.__T) and the same progress (window.__V), so differences are
// differences in the port. Pixel diffs are computed on lossless captures; JPEGs are kept for
// the record (PNG grain fields are several MB each).
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { createServer } from 'vite';
import { launch, watchConsole } from './lib/browser.mjs';
import { REFERENCES, routeReference } from './lib/reference.mjs';
import { startPreview } from './lib/servers.mjs';

const OUT = new URL('../parity/', import.meta.url);
const VIEW = { width: 1440, height: 900 };
const TIME = 10;
const SETTLE_MS = 1600;      // CSS: clock font-size .5 s, punch .7 s
const FINAL_EARLY_MS = 1500; // final chapter: the sentence is in (.4 s), the grain hovers in full light (it fades from 3 s)
const FINAL_LATE_MS = 15000; // final chapter: the grain has landed (6.4 s), signature and footnote in (8 s)
const REVIEW_PCT = 2;
// Since Phase 6a the port has a top scrim behind the HUD (fading over 20vh) that the reference lacks:
// positions are judged below that band; the full-frame diff is reported alongside.
const TOP_BAND = .2;

// Positions where the port differs from the reference on purpose (docs/parity-notes.md).
// Transitions with a camera subject (the purity → crystal reframe) are added automatically.
// Since Phase 4a the reference for the look is v10 (lit, with post); the v8-era entries (exact
// ends, the signature's CSS tie) are gone: v10 fixed the tie, and ulp-level differences from exact
// ends no longer stand out under lighting and post.
const DEVIATIONS = {};
// harness only: the reference's layer panel, benchmark box and version label are not part of the look
const HIDE_REFERENCE_TOOLS = ['</head>', '<style>.fx,.bench,.brand span{display:none !important}</style></head>'];
const SUBJECT_REASON = 'purity → crystal reframe (Phase 2): the pool centred, the crystal followed up';

// Story layout, straight from the source (no copy of the numbers here).
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { SEGMENTS, SNAP_POINTS, TOTAL, transitionMidpoint } = await vite.ssrLoadModule('/src/timeline/segments.ts');
const { WORLDS } = await vite.ssrLoadModule('/src/story/worlds.ts');
const { TRANSITIONS } = await vite.ssrLoadModule('/src/story/transitions.ts');
await vite.close();

const shots = [];
WORLDS.forEach((w, i) => {
  shots.push({ id: `${String(shots.length + 1).padStart(2, '0')}-hold-${w.slug}`, kind: 'hold', label: `Hold · ${w.slug}`, v: SNAP_POINTS[i], wait: i === WORLDS.length - 1 ? FINAL_LATE_MS : SETTLE_MS });
  if (i < WORLDS.length - 1) {
    const tr = TRANSITIONS[i];
    shots.push({ id: `${String(shots.length + 1).padStart(2, '0')}-tr-${w.slug}-${WORLDS[i + 1].slug}`, kind: 'transition', label: `Transition midpoint · ${w.slug} → ${WORLDS[i + 1].slug} (${tr.cam}, style ${tr.g})`, v: transitionMidpoint(i), wait: SETTLE_MS, intentional: !!tr.subject });
  }
});
// hands-on holds, with the pointer parked over the scene. Captured last (once a mouse has moved,
// it adds camera parallax to every later shot) and given time: pointer smoothing advances a fixed
// fraction per frame, so each page converges at its own frame rate
const hover = [
  { id: '30-hover-desert', kind: 'interaction', label: 'Desert · cursor brushing the dunes', v: SNAP_POINTS[4], mouse: [760, 560], wait: 6500 },
  { id: '31-hover-chip', kind: 'interaction', label: 'Chip · cursor lighting the switches', v: SNAP_POINTS[12], mouse: [640, 520], wait: 6500 },
];

// the transitions added from blockout v6, at three more points each
const REWORKED = new Set([17, 18, 20]); // drift, break, grow (reworked in v8)
const extra = [];
for (const seg of SEGMENTS.filter((x) => x.type === 'tr' && REWORKED.has(TRANSITIONS[x.i].g))) {
  const tr = TRANSITIONS[seg.i], a = WORLDS[seg.i].slug, b = WORLDS[seg.i + 1].slug;
  for (const t of [.3, .55, .8]) {
    extra.push({
      id: `${32 + extra.length}-tr-${a}-${b}-t${Math.round(t * 100)}`, kind: 'transition',
      label: `Transition · ${a} → ${b} at t = ${t} (${tr.cam}, style ${tr.g})`,
      v: (seg.start + seg.len * t) / TOTAL, wait: SETTLE_MS, intentional: !!tr.subject,
    });
  }
}

// "become" (display → now), at five points
for (const seg of SEGMENTS.filter((x) => x.type === 'tr' && TRANSITIONS[x.i].g === 21)) {
  const tr = TRANSITIONS[seg.i], a = WORLDS[seg.i].slug, b = WORLDS[seg.i + 1].slug;
  for (const t of [.2, .4, .55, .7, .85]) {
    extra.push({
      id: `${32 + extra.length}-tr-${a}-${b}-t${Math.round(t * 100)}`, kind: 'transition',
      label: `Transition · ${a} → ${b} at t = ${t} (${tr.cam}, style ${tr.g})`,
      v: (seg.start + seg.len * t) / TOTAL, wait: SETTLE_MS,
    });
  }
}

// the final chapter early in its sequence (the 15 s state is the standard final hold)
extra.push({ id: `${32 + extra.length}-final-1.5s`, kind: 'hold', label: 'Final chapter at 1.5 s (sentence in, the grain hovering in full light)', v: 1, wait: FINAL_EARLY_MS });

for (const s of [...shots, ...hover, ...extra]) {
  if (DEVIATIONS[s.id]) { s.intentional = true; s.reason = DEVIATIONS[s.id]; }
  else if (s.intentional) s.reason = SUBJECT_REASON;
}

await rm(OUT, { recursive: true, force: true });
for (const d of ['ref', 'port', 'diff']) await mkdir(new URL(`${d}/`, OUT), { recursive: true });

const server = await startPreview(5194);
const browser = await launch();
const consoleLog = [];
const results = [];
try {
  // one context (window) each: a background tab would have its frames throttled
  const ref = await (await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1 })).newPage();
  const port = await (await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1 })).newPage();
  watchConsole(ref, 'ref', consoleLog); watchConsole(port, 'port', consoleLog);
  await routeReference(ref, `${server.origin}/__reference.html`, REFERENCES[0], [HIDE_REFERENCE_TOOLS]);
  await Promise.all([ref.goto(`${server.origin}/__reference.html`), port.goto(`${server.origin}/?parity&tier=mid`)]);
  await ref.waitForFunction(() => window.__DATA, null, { timeout: 120000 });
  await port.waitForFunction(() => window.__PACK, null, { timeout: 120000 });
  const n = await port.evaluate(() => window.__PACK.n), refN = await ref.evaluate(() => window.__HEROES.length && Math.round(window.__DATA.length / 15 / 4));
  console.log(`grains per world: port ${n}, reference texture sized for ${refN}`);

  for (const s of [...shots, ...extra, ...hover]) {
    for (const p of [ref, port]) await p.evaluate(([v, t]) => { window.__V = v; window.__T = t; }, [s.v, TIME]);
    if (s.mouse) for (const p of [ref, port]) await p.mouse.move(s.mouse[0], s.mouse[1]);
    await ref.waitForTimeout(s.wait);
    // CSS transitions are fast-forwarded: the two pages' timers are not in step to the millisecond
    const shot = (p, opts = {}) => p.screenshot({ animations: 'disabled', ...opts });
    const [a, b] = [await shot(ref), await shot(port)];
    await shot(ref, { path: fileURLToPath(new URL(`ref/${s.id}.jpg`, OUT)), type: 'jpeg', quality: 82 });
    await shot(port, { path: fileURLToPath(new URL(`port/${s.id}.jpg`, OUT)), type: 'jpeg', quality: 82 });
    const A = PNG.sync.read(a), B = PNG.sync.read(b), D = new PNG({ width: A.width, height: A.height });
    const px = pixelmatch(A.data, B.data, D.data, A.width, A.height, { threshold: .1, diffMask: true });
    await writeFile(new URL(`diff/${s.id}.png`, OUT), PNG.sync.write(D));
    const top = Math.round(A.height * TOP_BAND);
    let below = 0;
    for (let i = top * A.width * 4 + 3; i < D.data.length; i += 4) if (D.data[i]) below++;
    const pct = below / (A.width * (A.height - top)) * 100, pctFull = px / (A.width * A.height) * 100;
    let strictPx = 0;
    for (let k = 0; k < A.data.length; k += 4) if (A.data[k] !== B.data[k] || A.data[k + 1] !== B.data[k + 1] || A.data[k + 2] !== B.data[k + 2]) strictPx++;
    const strict = strictPx / (A.width * A.height) * 100;
    results.push({ ...s, pct, pctFull, strict });
    console.log(`${pct.toFixed(3).padStart(7)} %  (full frame ${pctFull.toFixed(3)} %, strict ${strict.toFixed(3)} %)  ${s.id}`);
  }
} finally {
  await browser.close();
  await server.close();
}

// ---------- report ----------
const status = (r) => (r.intentional ? `intentional: ${r.reason}` : r.pct <= REVIEW_PCT ? '✓' : 'review');
const compared = results.filter((r) => !r.intentional), intentional = results.filter((r) => r.intentional);
const md = [
  `# Parity checklist: reference ${REFERENCES[0]} → port`,
  '',
  `Generated by \`npm run parity\` on ${new Date().toISOString().slice(0, 10)}. Viewport ${VIEW.width}×${VIEW.height} at DPR 1, mid tier (90 000 grains per world, the reference's desktop setting), shader time frozen at ${TIME} s, Chromium on the real GPU (ANGLE/D3D11).`,
  '',
  `"Diff" is the share of pixels that differ beyond pixelmatch's default perceptual threshold (0.1), measured on lossless captures. Rows above ${REVIEW_PCT} % are marked for review; open \`parity/index.html\` to see each pair and its diff mask. For scale: the reference compared with a second copy of itself under the same settings differs by about 0.02 % (0.2 % at the quarry hold), so differences of that size are capture noise; see docs/parity-notes.md.`,
  '',
  `${compared.filter((r) => r.pct <= REVIEW_PCT).length} of ${compared.length} compared positions within ${REVIEW_PCT} %. ` +
    `${intentional.length} positions show an intentional change beyond the reference and are not held to it: ${intentional.map((r) => r.id).join(', ')} (see docs/parity-notes.md).`,
  '',
  '"Strict" counts every pixel whose colour differs at all, however little; it catches uniform colour shifts the perceptual threshold absorbs.',
  '',
  '| # | Position | Progress | Diff (below the top 20 %) | Diff (full frame) | Strict | Status |',
  '|---|---|---|---|---|---|---|',
  ...results.map((r, i) => `| ${i + 1} | ${r.label} | ${r.v.toFixed(4)} | ${r.pct.toFixed(3)} % | ${r.pctFull.toFixed(3)} % | ${r.strict.toFixed(3)} % | ${status(r)} |`),
  '',
  `Console during the run: ${consoleLog.filter((c) => !c.harness).length} warnings/errors from the pages` +
    (consoleLog.some((c) => c.harness) ? `, plus ${consoleLog.filter((c) => c.harness).length} GPU driver notices caused by the screenshot read-backs themselves.` : '.'),
  ...consoleLog.filter((c) => !c.harness).map((c) => `- ${c.label} ${c.type}: ${c.text}`),
  '',
].join('\n');
await writeFile(new URL('checklist.md', OUT), md);

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Parity · One Grain</title>
<style>
:root{--bg:#f4f4f1;--ink:#16201e;--muted:#5b6662;--rule:#d5d8d3;--ok:#2f7a4a;--warn:#a5531d}
@media (prefers-color-scheme:dark){:root{--bg:#111819;--ink:#e9e3d6;--muted:#93a19c;--rule:#2a3436;--ok:#6cc08b;--warn:#e3955b}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,sans-serif}
header{padding:24px 16px 8px;max-width:1500px;margin:0 auto}h1{margin:0 0 4px;font-size:22px}header p{margin:0;color:var(--muted)}
main{max-width:1500px;margin:0 auto;padding:8px 16px 48px}
section{border-top:1px solid var(--rule);padding:16px 0}
h2{font-size:15px;margin:0 0 8px;display:flex;gap:12px;flex-wrap:wrap;align-items:baseline}
h2 .pct{font-variant-numeric:tabular-nums;color:var(--muted)}h2 .ok{color:var(--ok)}h2 .review{color:var(--warn)}h2 .intentional{color:var(--muted);font-style:italic}
.row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
figure{margin:0}figure img{width:100%;height:auto;display:block;border:1px solid var(--rule)}figcaption{font-size:12px;color:var(--muted);padding-top:2px}
@media (max-width:800px){.row{grid-template-columns:1fr}}
</style></head><body>
<header><h1>Parity: reference ${REFERENCES[0]} vs port</h1><p>${results.length} positions · ${compared.filter((r) => r.pct <= REVIEW_PCT).length} of ${compared.length} compared within ${REVIEW_PCT} % · ${intentional.length} intentional changes · see checklist.md for the method</p></header>
<main>
${results.map((r, i) => `<section id="${r.id}"><h2><span>${i + 1}. ${esc(r.label)}</span><span class="pct">v = ${r.v.toFixed(4)} · diff ${r.pct.toFixed(3)} %</span><span class="${r.intentional ? 'intentional' : r.pct <= REVIEW_PCT ? 'ok' : 'review'}">${status(r)}</span></h2>
<div class="row"><figure><img loading="lazy" src="ref/${r.id}.jpg" alt="Reference, ${esc(r.label)}"><figcaption>Reference</figcaption></figure>
<figure><img loading="lazy" src="port/${r.id}.jpg" alt="Port, ${esc(r.label)}"><figcaption>Port</figcaption></figure>
<figure><img loading="lazy" src="diff/${r.id}.png" alt="Differing pixels, ${esc(r.label)}"><figcaption>Differing pixels (red)</figcaption></figure></div></section>`).join('\n')}
</main></body></html>`;
await writeFile(new URL('index.html', OUT), html);

const review = compared.filter((r) => r.pct > REVIEW_PCT);
console.log(`\n${compared.length - review.length}/${compared.length} compared within ${REVIEW_PCT} %${review.length ? `; review: ${review.map((r) => r.id).join(', ')}` : ''}`);
console.log(`intentional: ${intentional.map((r) => `${r.id} (${r.pct.toFixed(2)} %)`).join(', ')}`);
