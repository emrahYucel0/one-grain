// Text parity (npm run check:text): overlay text and clock state, port vs reference v15 (its copy is
// v8's; its clock adds the production labels, the live count on the display, label hysteresis)
// (the act label is not compared: since v8 the rail carries the act and the label is gone),
// at every hold and at five points in every transition. Positions are matched by (world a → b, t),
// so the check also works while transition lengths differ between the two.
import { createServer } from 'vite';
import { launch } from './lib/browser.mjs';
import { readFile } from 'node:fs/promises';
import { referenceFile, routeReference } from './lib/reference.mjs';
import { startDev } from './lib/servers.mjs';

const TEXT_REFERENCE = 'v15';
/** Intentional changes since the reference, applied to its page (docs/parity-notes.md). None at present. */
const INTENTIONAL = [];
/** The reference publishes the progress each frame rendered, after its words and clock are set (as the port's __progress). */
const HOOKS = [['    fxTick();\n  }', '    fxTick(); window.__progress = state.v;\n  }']];

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { WORLDS } = await vite.ssrLoadModule('/src/story/worlds.ts');
const { TRANSITIONS } = await vite.ssrLoadModule('/src/story/transitions.ts');
const holds = WORLDS.map((w) => w.hold);
// the reference's transition lengths, read from its TR table
const refLens = [...(await readFile(referenceFile(TEXT_REFERENCE), 'utf8')).matchAll(/\{ g: \d+,\s*cam: '\w+',\s*len: ([\d.]+)/g)].map((m) => +m[1]);
if (refLens.length !== WORLDS.length - 1) throw new Error(`expected ${WORLDS.length - 1} reference transitions, found ${refLens.length}`);
const portLens = TRANSITIONS.map((t) => t.len);
await vite.close();
const dev = await startDev(5189);
const progress = (lens, i, t, kind) => { // kind: hold → middle of hold i; tr → transition i at t
  let s = 0; for (let k = 0; k < i; k++) s += holds[k] + lens[k];
  const total = holds.reduce((a, b) => a + b, 0) + lens.reduce((a, b) => a + b, 0);
  if (kind === 'hold') return i === 0 ? 0 : i === holds.length - 1 ? 1 : (s + holds[i] / 2) / total;
  return (s + holds[i] + lens[i] * t) / total;
};
const b = await launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const port = await ctx.newPage(), ref = await ctx.newPage();
await routeReference(ref, 'http://localhost:5189/__r.html', TEXT_REFERENCE, [...HOOKS, ...INTENTIONAL]);
await port.goto('http://localhost:5189/?parity&tier=mid'); await ref.goto('http://localhost:5189/__r.html');
await ref.waitForFunction(() => window.__DATA, null, { timeout: 90000 });
await port.waitForFunction(() => window.__PACK, null, { timeout: 90000 });
const read = (p) => p.evaluate(() => {
  const ch = document.getElementById('chapter'), q = (s) => ch.querySelector(s)?.textContent ?? '';
  const t = document.getElementById('time');
  // the live count (milliseconds since the clock got to the display) differs between the pages
  return [document.getElementById('clock').textContent.replace(/^[\d,]+ ms$/, '<n> ms'), document.getElementById('clockUnit').textContent,
    [...t.classList].filter((c) => c !== 'punch').sort().join(' '),
    q('h2'), ch.querySelector('p').textContent, document.getElementById('micro').textContent, getComputedStyle(document.getElementById('micro')).display].join(' | ');
});
let diffs = 0, n = 0;
const cases = [];
WORLDS.forEach((w, i) => { cases.push(['hold', i, 0]); if (i < WORLDS.length - 1) for (const t of [.1, .3, .5, .7, .9]) cases.push(['tr', i, t]); });
for (const [kind, i, t] of cases) {
  // each page publishes the progress it rendered (__progress): wait for the frame at v, then two more
  // for anything the frame's listeners write to the DOM, all by condition (no fixed delays)
  const at = async (p, v) => {
    await p.bringToFront(); await p.evaluate((x) => { window.__V = x; window.__T = 10; }, v);
    const rendered = await p.waitForFunction((x) => window.__progress === x, v, { timeout: 10000 }).then(() => true, () => false);
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    return { text: await read(p), rendered, v: await p.evaluate(() => window.__progress) };
  };
  const px = await at(port, progress(portLens, i, t, kind)), py = await at(ref, progress(refLens, i, t, kind));
  const x = px.text, y = py.text;
  n++;
  // a page that never rendered the position fails it too, with the progress it is stuck at
  if (x !== y || !px.rendered || !py.rendered) {
    diffs++;
    const note = (r) => (r.rendered ? '' : `  (no frame at this position; rendered ${r.v})`);
    console.log(`DIFF ${kind} ${WORLDS[i].slug} t=${t}\n  port: ${x}${note(px)}\n  ref:  ${y}${note(py)}`);
  }
}
console.log(`${n - diffs}/${n} positions identical`);
await b.close(); await dev.close();
process.exit(diffs ? 1 : 0);
