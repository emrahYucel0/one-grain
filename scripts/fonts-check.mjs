// Fonts (npm run check:fonts):
//  1. no layout shift when the web fonts arrive: cumulative layout shift from the browser's own
//     'layout-shift' entries on a cold load, with font responses held back 1.5 s so the swap
//     happens while we measure. A control run without the font gate shows the measurement would
//     catch a shift. The no-WebGL2 article (no gate, metric-matched fallbacks only) is reported.
//  2. the wdth axis really renders: the same probe word, in the title's live font settings, is
//     measured at magma (wide) and at crystal (condensed); crops of both titles go to parity/fonts/.
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { launch } from './lib/browser.mjs';
import { startPreview } from './lib/servers.mjs';

const OUT = fileURLToPath(new URL('../parity/fonts/', import.meta.url));
await mkdir(OUT, { recursive: true });
// the built site, as deployed: under the dev server CSS is injected by script, so the very first
// paint has browser-default margins (a dev-only shift unrelated to fonts)
const dev = await startPreview(5181);
const results = [];
const check = (name, ok, detail) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (${detail})`); };
const info = (name, detail) => console.log(`INFO  ${name}  (${detail})`);

const observeShifts = () => {
  window.__cls = 0; window.__shifts = [];
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; window.__shifts.push(e.sources?.map((s) => s.node?.className || s.node?.nodeName).join(',')); }
  }).observe({ type: 'layout-shift', buffered: true });
};

/** Cold load with fonts delayed; returns CLS once fonts and the experience have settled. */
async function coldLoad(browser, { gate = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route(/\.woff2(\?|$)/, async (route) => { await new Promise((r) => setTimeout(r, 1500)); await route.continue(); });
  const page = await ctx.newPage();
  await page.addInitScript(observeShifts);
  if (!gate) await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
    const s = document.createElement('style'); s.textContent = 'html.fonts-pending *{visibility:visible !important}'; document.head.append(s);
  }));
  await page.goto(`${dev.origin}/`);
  await page.waitForFunction(() => document.fonts.status === 'loaded' && !document.documentElement.classList.contains('fonts-pending') || document.documentElement.classList.contains('nogl'), null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const r = await page.evaluate(() => ({ cls: window.__cls, shifts: window.__shifts, fonts: document.fonts.status }));
  await ctx.close();
  return r;
}

const browser = await launch();
try {
  const gated = await coldLoad(browser);
  check('no layout shift when fonts arrive late (experience)', gated.cls === 0, `CLS ${gated.cls.toFixed(4)}, fonts ${gated.fonts}`);
  const ungated = await coldLoad(browser, { gate: false });
  check('control: without the gate the same load does shift', ungated.cls > 0, `CLS ${ungated.cls.toFixed(4)} from ${[...new Set(ungated.shifts)].join(' / ') || '—'}`);

  // the wdth axis
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })).newPage();
  await page.goto(`${dev.origin}/?parity&tier=mid`);
  await page.waitForFunction(() => window.__PACK && !document.documentElement.classList.contains('fonts-pending'), null, { timeout: 90000 });
  const { SNAP_POINTS: SNAP } = await (await import('vite')).createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' }).then(async (v) => { const m = await v.ssrLoadModule('/src/timeline/segments.ts'); await v.close(); return m; });
  const measure = async (i, name) => {
    await page.evaluate((v) => { window.__V = v; window.__T = 10; }, i === 0 ? 0.001 : SNAP[i]);
    await page.waitForTimeout(1200);
    await page.locator('#chapter h2').screenshot({ path: `${OUT}title-${name}.png`, animations: 'disabled' });
    return page.evaluate(() => {
      const h2 = document.querySelector('#chapter h2'), cs = getComputedStyle(h2);
      const probe = document.createElement('span');
      probe.textContent = 'Crystal Magma';
      probe.style.cssText = `font-family:${cs.fontFamily};font-size:100px;font-weight:${cs.fontWeight};font-stretch:${cs.fontStretch};position:absolute;white-space:nowrap;visibility:hidden`;
      document.body.append(probe);
      const width = probe.getBoundingClientRect().width; probe.remove();
      const face = [...document.fonts].find((f) => f.family.includes('Archivo') && f.status === 'loaded');
      return { stretch: cs.fontStretch, weight: cs.fontWeight, width, face: face ? `${face.family} ${face.stretch}` : 'none' };
    });
  };
  const magma = await measure(0, 'magma'), crystal = await measure(9, 'crystal');
  const ratio = crystal.width / magma.width;
  check('wdth axis renders: crystal title condensed against magma', ratio < .8, `probe width ${magma.width.toFixed(0)} px at ${magma.stretch}/${magma.weight} vs ${crystal.width.toFixed(0)} px at ${crystal.stretch}/${crystal.weight}, ratio ${ratio.toFixed(2)}; face ${crystal.face}`);
} finally { await browser.close(); }

// the readable fallback (no WebGL2): no gate, metric-matched fallbacks only
const noGl = await launch({ args: ['--disable-webgl', '--disable-webgl2'] });
try {
  const r = await coldLoad(noGl);
  info('fallback article (no gate, metric-matched fallbacks)', `CLS ${r.cls.toFixed(4)}`);
} finally { await noGl.close(); }

await dev.close();
console.log(`\n${results.filter(Boolean).length}/${results.length} passed; title crops in parity/fonts/`);
process.exit(results.every(Boolean) ? 0 : 1);
