// Lighthouse and the network (npm run lighthouse): the production build served as a host would
// (scripts/serve.mjs: Brotli, the _headers CSP and cache rules).
//  1. A browser visit at 1440×900 and at 390×844 (touch): no console messages, no CSP violations,
//     no response of 400 or more, and only the requests the first view uses (the page, its scripts,
//     the stylesheet, the worker, the three font faces, the icon); every request is listed.
//  2. Lighthouse 12 (installed on demand by npx), mobile and desktop presets: the four category
//     scores, LCP, CLS, TBT, FCP, and the bytes per resource type.
// Writes docs/lighthouse.md; the raw reports go to parity/lighthouse/ (ignored).
import { spawn } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { build } from 'vite';
import { launch } from './lib/browser.mjs';
import { serve } from './serve.mjs';

const OUT = 'parity/lighthouse';
await mkdir(OUT, { recursive: true });
await build({ logLevel: 'error' });
const server = await serve(4180);
const url = `${server.origin}/`;
const results = [];
const check = (name, ok, detail) => { results.push([name, ok, detail]); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (${detail})`); };
/** what the first view may request: everything else is unused */
const EXPECTED = [/\/$/, /\/assets\/index-[\w-]+\.js$/, /\/assets\/three-[\w-]+\.js$/, /\/assets\/gsap-[\w-]+\.js$/, /\/assets\/main-[\w-]+\.css$/,
  /\/assets\/sim\.worker-[\w-]+\.js$/, /\/assets\/build-[\w-]+\.js$/, /\/assets\/archivo-wdth-[\w-]+\.woff2$/, /\/assets\/newsreader-opsz(-italic)?-[\w-]+\.woff2$/,
  /\/favicon\.svg$/, /\/favicon-32\.png$/, /\/site\.webmanifest$/];

let network = [];
try {
  const browser = await launch();
  try {
    for (const [name, opts] of [['1440×900', { viewport: { width: 1440, height: 900 } }], ['390×844', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }]]) {
      const ctx = await browser.newContext(opts);
      await ctx.addInitScript(() => { window.__csp = []; addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`)); });
      const page = await ctx.newPage(), messages = [], bad = [], requests = [];
      page.on('console', (m) => messages.push(`${m.type()}: ${m.text()}`));
      page.on('pageerror', (e) => messages.push(`error: ${e.message}`));
      page.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
      page.on('requestfinished', async (r) => { const s = await r.sizes().catch(() => null); requests.push({ url: r.url(), type: r.resourceType(), bytes: s ? s.responseBodySize + s.responseHeadersSize : 0 }); });
      await page.goto(url);
      await page.waitForFunction(() => document.documentElement.classList.contains('ready'), null, { timeout: 120000 });
      await page.waitForTimeout(6000);
      const csp = await page.evaluate(() => window.__csp);
      check(`${name}: no console messages`, messages.length === 0, messages.join(' | ') || 'none');
      check(`${name}: no CSP violations`, csp.length === 0, csp.join(' | ') || 'none');
      check(`${name}: no 404s (no response of 400 or more)`, bad.length === 0, bad.join(' | ') || `${requests.length} requests`);
      const unused = requests.filter((r) => !EXPECTED.some((e) => e.test(r.url)));
      check(`${name}: only the requests the first view uses`, unused.length === 0, unused.map((r) => r.url.replace(server.origin, '')).join(', ') || requests.map((r) => r.url.replace(server.origin, '').replace(/-[\w-]{8}\./, '.')).join(', '));
      if (name === '1440×900') network = requests;
      await ctx.close();
    }
  } finally { await browser.close(); }

  // Lighthouse, mobile and desktop
  // npx through node itself (no shell); on Windows chrome-launcher may fail to delete its temporary
  // profile after the report is written (EPERM): a report newer than the run counts
  const npx = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js');
  const lighthouse = (preset) => new Promise((ok, fail) => {
    const started = Date.now();
    const args = [npx, '-y', 'lighthouse@12', url, '--quiet', '--output=json', `--output-path=${OUT}/${preset}.json`,
      '--only-categories=performance,accessibility,best-practices,seo', '--chrome-flags=--headless=new --use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist',
      ...(preset === 'desktop' ? ['--preset=desktop'] : [])];
    const p = spawn(process.execPath, args, { stdio: 'inherit' });
    p.on('close', async (c) => {
      const fresh = await stat(`${OUT}/${preset}.json`).then((x) => x.mtimeMs >= started, () => false);
      if (!c || fresh) ok(); else fail(new Error(`lighthouse exited with ${c}`));
    });
  });
  const summary = {};
  for (const preset of ['mobile', 'desktop']) {
    await lighthouse(preset);
    const r = JSON.parse(await readFile(`${OUT}/${preset}.json`, 'utf8')), a = r.audits;
    const bytes = Object.fromEntries((a['resource-summary']?.details?.items ?? []).map((i) => [i.resourceType, i.transferSize]));
    summary[preset] = {
      scores: Object.fromEntries(Object.entries(r.categories).map(([k, c]) => [k, Math.round(c.score * 100)])),
      lcp: a['largest-contentful-paint'].numericValue, cls: a['cumulative-layout-shift'].numericValue, tbt: a['total-blocking-time'].numericValue,
      fcp: a['first-contentful-paint'].numericValue, bytes,
      failing: Object.values(a).filter((x) => x.score !== null && x.score < 1 && x.scoreDisplayMode === 'binary').map((x) => x.id),
    };
    const s = summary[preset];
    console.log(`${preset}: ${Object.entries(s.scores).map(([k, v]) => `${k} ${v}`).join(' · ')} · LCP ${(s.lcp / 1000).toFixed(2)} s · CLS ${s.cls.toFixed(3)} · TBT ${Math.round(s.tbt)} ms`);
  }
  const kb = (n) => (n === undefined ? '—' : `${(n / 1024).toFixed(0)} kB`);
  const md = `# Lighthouse and the network (npm run lighthouse)

The production build served with Brotli and the headers of dist/_headers (scripts/serve.mjs),
Lighthouse 12, headless Chrome on this machine's GPU. Mobile = Lighthouse's default (simulated slow
4G, 4× CPU slowdown, Moto G Power viewport); desktop = its desktop preset.

| | Mobile | Desktop |
|---|---|---|
${['performance', 'accessibility', 'best-practices', 'seo'].map((k) => `| ${k} | ${summary.mobile.scores[k]} | ${summary.desktop.scores[k]} |`).join('\n')}
| LCP | ${(summary.mobile.lcp / 1000).toFixed(2)} s | ${(summary.desktop.lcp / 1000).toFixed(2)} s |
| FCP | ${(summary.mobile.fcp / 1000).toFixed(2)} s | ${(summary.desktop.fcp / 1000).toFixed(2)} s |
| CLS | ${summary.mobile.cls.toFixed(3)} | ${summary.desktop.cls.toFixed(3)} |
| TBT | ${Math.round(summary.mobile.tbt)} ms | ${Math.round(summary.desktop.tbt)} ms |
| JavaScript transferred | ${kb(summary.mobile.bytes.script)} | ${kb(summary.desktop.bytes.script)} |
| Fonts transferred | ${kb(summary.mobile.bytes.font)} | ${kb(summary.desktop.bytes.font)} |
| Everything transferred | ${kb(summary.mobile.bytes.total)} | ${kb(summary.desktop.bytes.total)} |

Binary audits not passed: mobile ${summary.mobile.failing.join(', ') || 'none'}; desktop ${summary.desktop.failing.join(', ') || 'none'}.

## The browser visit (1440×900 and 390×844)

${results.map(([n, ok, d]) => `- ${ok ? '✓' : '✗'} ${n}${ok ? '' : `: ${d}`}`).join('\n')}

Requests of the first view at 1440×900 (bytes on the wire, Brotli where it applies):

| Request | Type | Bytes |
|---|---|---|
${network.map((r) => `| ${r.url.replace(server.origin, '')} | ${r.type} | ${kb(r.bytes)} |`).join('\n')}
`;
  await writeFile('docs/lighthouse.md', md);
  console.log('→ docs/lighthouse.md');
} finally { await server.close(); }
const failed = results.filter(([, ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
