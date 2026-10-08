// Real contrast (npm run check:contrast): for every chapter hold and the loader, at 390×844 (phone),
// 1440×900 and 2560×1440, each visible text block is measured against what is actually behind it.
// Two captures of the block's box: as rendered, and with only that text made transparent (its text
// shadow stays: it is part of the background the reader sees). The text's effective colour (its
// alpha and every ancestor's opacity) is composited over each background pixel and the WCAG
// contrast ratio computed per pixel; the block's figure is the worst 5 % (5th percentile), so a
// single bright grain does not decide it but a bright area does. A control's own underline is hidden
// with the text: it is not behind the letters.
// Targets: body text and titles AAA (7:1; 4.5:1 when large) where the design allows, everything
// else AA (4.5:1; 3:1 for large text, ≥ 24 px or ≥ 18.67 px bold). Fails only below AA.
// Writes docs/a11y/contrast.md.
import { mkdir, writeFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import { createServer } from 'vite';
import { launch } from './lib/browser.mjs';
import { startDev } from './lib/servers.mjs';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { SNAP_POINTS } = await vite.ssrLoadModule('/src/timeline/segments.ts');
const { WORLDS } = await vite.ssrLoadModule('/src/story/worlds.ts');
await vite.close();
const VIEWPORTS = [
  { name: '390×844', width: 390, height: 844, dpr: 3, touch: true, mobile: true },
  { name: '1440×900', width: 1440, height: 900, dpr: 1 },
  { name: '2560×1440', width: 2560, height: 1440, dpr: 1 },
];
/** the text blocks: [name, selector, primary (body text or title: AAA where the design allows)] */
const BLOCKS = [
  ['brand', '.hud .brand', false], ['clock', '#clock', false], ['unit', '#clockUnit', false],
  ['sound', '#sound', false], ['motion', '#motion', false],
  ['intro title', '.intro-title', true], ['intro hint', '#introHint', false],
  ['title', '#chapter h2', true], ['body', '#chapter > p:not(.hint):not(.micro)', true],
  ['micro / footnote', '#micro', false], ['hint', '#hint', false],
  ['rail label', '.timeline .label', false], ['loupe caption', '.loupe-cap', false],
];

const lum = (r, g, b) => { const f = (c) => { c /= 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
const ratio = (a, b) => { const [x, y] = a > b ? [a, b] : [b, a]; return (x + .05) / (y + .05); };

/** Visible text blocks in the page: box (css px), effective colour, size, weight. */
const blocksIn = (page) => page.evaluate((blocks) => {
  const out = [];
  for (const [name, sel, primary] of blocks) for (const el of document.querySelectorAll(sel)) {
    const text = el.textContent.trim();
    if (!text) continue;
    let op = 1, vis = true;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const cs = getComputedStyle(n); op *= +cs.opacity; if (cs.display === 'none' || cs.visibility === 'hidden') vis = false; }
    const cs = getComputedStyle(el), rects = [...el.getClientRects()].filter((r) => r.width > 1 && r.height > 1);
    if (!vis || op < .05 || !rects.length) continue;
    const r = rects.reduce((a, b) => ({ left: Math.min(a.left, b.left), top: Math.min(a.top, b.top), right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom) }), { left: 1e9, top: 1e9, right: -1e9, bottom: -1e9 });
    const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(cs.color);
    const size = parseFloat(cs.fontSize), weight = +cs.fontWeight || 400;
    out.push({ name, sel, primary, index: [...document.querySelectorAll(sel)].indexOf(el), text: text.slice(0, 40), box: { x: Math.max(0, r.left), y: Math.max(0, r.top), w: Math.min(innerWidth, r.right) - Math.max(0, r.left), h: Math.min(innerHeight, r.bottom) - Math.max(0, r.top) },
      color: [+m[1], +m[2], +m[3], (m[4] === undefined ? 1 : +m[4]) * op], large: size >= 24 || (size >= 18.66 && weight >= 700), size, weight });
  }
  return out;
}, BLOCKS);

/** The worst-5 % contrast of a block: its colour over every background pixel behind it. */
async function measure(page, b) {
  if (b.box.w < 2 || b.box.h < 2) return null;
  const clip = { x: b.box.x, y: b.box.y, width: b.box.w, height: b.box.h };
  await page.evaluate(({ sel, index }) => { const el = document.querySelectorAll(sel)[index]; el.dataset.cc = el.style.cssText; el.style.setProperty('color', 'transparent', 'important'); el.style.setProperty('-webkit-text-fill-color', 'transparent', 'important'); el.style.setProperty('border-color', 'transparent', 'important'); for (const a of el.querySelectorAll('*')) { a.style.setProperty('color', 'transparent', 'important'); a.style.setProperty('-webkit-text-fill-color', 'transparent', 'important'); } }, b);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const png = PNG.sync.read(await page.screenshot({ clip, scale: 'css' }));
  await page.evaluate(({ sel, index }) => { const el = document.querySelectorAll(sel)[index]; el.style.cssText = el.dataset.cc; delete el.dataset.cc; for (const a of el.querySelectorAll('*')) { a.style.removeProperty('color'); a.style.removeProperty('-webkit-text-fill-color'); } }, b);
  const [r, g, bl, a] = b.color, ratios = [];
  for (let i = 0; i < png.data.length; i += 4) {
    const br = png.data[i], bg = png.data[i + 1], bb = png.data[i + 2];
    ratios.push(ratio(lum(r * a + br * (1 - a), g * a + bg * (1 - a), bl * a + bb * (1 - a)), lum(br, bg, bb)));
  }
  ratios.sort((x, y) => x - y);
  return ratios[Math.floor(ratios.length * .05)];
}

const dev = await startDev(5208);
const browser = await launch();
const rows = [];
try {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dpr, hasTouch: !!vp.touch, isMobile: !!vp.mobile });
    // the loader: the page's script held back, so the loader is what is on screen
    {
      const page = await ctx.newPage();
      await page.route('**/src/main.ts', async (rt) => { await new Promise((ok) => setTimeout(ok, 4000)); await rt.continue(); });
      const nav = page.goto(`${dev.origin}/`).catch(() => {});
      await page.waitForTimeout(1500);
      await page.evaluate(() => document.documentElement.classList.remove('fonts-pending'));
      const b = (await page.evaluate(() => { const el = document.querySelector('.loader .brand'), r = el.getBoundingClientRect(), m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(getComputedStyle(el).color); return { box: { x: r.left, y: r.top, w: r.width, h: r.height }, color: [+m[1], +m[2], +m[3], 1], size: parseFloat(getComputedStyle(el).fontSize) }; }));
      const png = PNG.sync.read(await page.screenshot({ clip: { x: b.box.x, y: b.box.y + b.box.h + 4, width: b.box.w, height: 6 }, scale: 'css' }));
      const bgL = lum(png.data[0], png.data[1], png.data[2]);
      rows.push({ vp: vp.name, at: 'loader', name: 'brand', text: 'One Grain', ratio: ratio(lum(...b.color.slice(0, 3)), bgL), large: false, primary: false });
      await nav; await page.close();
    }
    const page = await ctx.newPage();
    await page.goto(`${dev.origin}/?parity`);
    await page.waitForFunction(() => window.__PACK && !document.documentElement.classList.contains('fonts-pending'), null, { timeout: 120000 });
    for (let i = 0; i < SNAP_POINTS.length; i++) {
      await page.evaluate(([v, ft]) => { window.__V = v; window.__T = 10; window.__FT = ft; }, [SNAP_POINTS[i], i === SNAP_POINTS.length - 1 ? 15 : 0]);
      await page.waitForTimeout(900);
      for (const b of await blocksIn(page)) {
        const r = await measure(page, b);
        if (r !== null) rows.push({ vp: vp.name, at: WORLDS[i].slug, name: b.name, text: b.text, ratio: r, large: b.large, primary: b.primary });
      }
    }
    await ctx.close();
  }
} finally { await browser.close(); await dev.close(); }

// verdicts
const need = (r) => ({ aa: r.large ? 3 : 4.5, aaa: r.large ? 4.5 : 7 });
let fails = 0, aaaMissed = 0;
const lines = rows.map((r) => {
  const n = need(r), aa = r.ratio >= n.aa, aaa = r.ratio >= n.aaa;
  if (!aa) fails++; if (r.primary && !aaa) aaaMissed++;
  return `| ${r.vp} | ${r.at} | ${r.name} | ${r.ratio.toFixed(2)} | ${r.large ? 'large' : 'normal'} | ${aaa ? 'AAA' : aa ? 'AA' : '**fail**'}${r.primary && !aaa && aa ? ' (AAA target missed)' : ''} |`;
});
const worst = [...rows].sort((a, b) => a.ratio / need(a).aa - b.ratio / need(b).aa).slice(0, 8);
await mkdir('docs/a11y', { recursive: true });
await writeFile('docs/a11y/contrast.md', `# Real contrast (npm run check:contrast)

Each visible text block at every chapter hold and on the loader, measured against the rendered
background behind it (the text made transparent, its shadow kept), worst 5 % of pixels. Targets:
AAA for body text and titles where the design allows, AA for everything else; large = at least
24 px, or 18.67 px bold.

- ${rows.length} measurements, ${fails} below AA, ${aaaMissed} body or title blocks below AAA.
- Lowest against their AA threshold: ${worst.map((r) => `${r.vp} ${r.at} ${r.name} ${r.ratio.toFixed(2)}`).join('; ')}.

| Viewport | At | Block | Contrast | Size | Level |
|---|---|---|---|---|---|
${lines.join('\n')}
`);
for (const r of worst) console.log(`lowest: ${r.vp} ${r.at} ${r.name} "${r.text}" ${r.ratio.toFixed(2)} (${r.large ? 'large' : 'normal'})`);
console.log(`\n${rows.length} measurements · ${fails} below AA · ${aaaMissed} body/title blocks below AAA → docs/a11y/contrast.md`);
process.exit(fails ? 1 : 0);
