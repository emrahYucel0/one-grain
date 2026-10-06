// The deployed site (npm run check:live [url], default https://onegrain.world/). Waits until the site
// serves this checkout's build (the same index.html as a local build), then checks:
//  1. headers on the page, a hashed asset and an icon: the CSP of dist/_headers, the security headers,
//     the cache rules; Brotli for the page, scripts and stylesheet;
//  2. redirects: http → https, www → the root (path and query kept); *.pages.dev carries noindex;
//  3. Chromium, Firefox, WebKit: the scene starts (not the text fallback); no response of 400 or more
//     from our origin; no CSP violation; every script the edge injected (anything not ours) listed: the
//     analytics beacon, once, and nothing else; the beacon reports (on a proxied domain, to the site's
//     own /cdn-cgi/rum, which Cloudflare answers at the edge; else to cloudflareinsights.com);
//  4. the sharing card (og:image: 200, a 1200×630 JPEG) and the icons resolve;
//  5. Lighthouse 12, mobile and desktop.
// Writes docs/live.md. A second argument names the project's *.pages.dev address (default
// https://one-grain.pages.dev/), checked for noindex when it resolves.
import { spawn } from 'node:child_process';
import { readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { firefox, webkit } from 'playwright';
import { build } from 'vite';
import { launch } from './lib/browser.mjs';

const URL_ = (process.argv[2] ?? 'https://onegrain.world/').replace(/\/?$/, '/');
const ORIGIN = new URL(URL_).origin, HOST = new URL(URL_).host;
const PAGES = process.argv[3] ?? 'https://one-grain.pages.dev/';
const rows = [];
const check = (area, name, ok, detail) => { rows.push([area, name, ok, detail]); console.log(`${ok === null ? 'INFO' : ok ? 'PASS' : 'FAIL'}  ${area}: ${name}  (${detail})`); };
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';
const get = (url, opts = {}) => fetch(url, { redirect: 'manual', ...opts, headers: { 'User-Agent': UA, 'Accept-Encoding': 'br, gzip', ...(opts.headers ?? {}) } });

// 0: the live site serves this checkout's build
await build({ logLevel: 'error' });
const local = await readFile('dist/index.html', 'utf8');
const entry = local.match(/assets\/index-[\w-]+\.js/)[0];
const started = Date.now();
let live;
for (;;) {
  live = await (await fetch(`${URL_}?v=${Date.now()}`, { headers: { 'User-Agent': UA } })).text().catch(() => '');
  if (live.includes(entry) || Date.now() - started > 15 * 60000) break;
  console.log(`      waiting for the deploy (${entry} not live yet)…`);
  await new Promise((ok) => setTimeout(ok, 20000));
}
check('deploy', 'the live site serves this build', live.includes(entry), `${entry}${live.includes(entry) ? '' : ' not found after 15 min'}`);

// 1: headers and compression
const want = Object.fromEntries((await readFile('dist/_headers', 'utf8')).split('/\n')[0].split('\n').slice(1).filter(Boolean).map((l) => { const i = l.indexOf(':'); return [l.slice(0, i).trim().toLowerCase(), l.slice(i + 1).trim()]; }));
const page = await get(URL_);
const h = page.headers;
for (const [k, v] of Object.entries(want)) check('headers', k, h.get(k) === v, h.get(k) === v ? 'as in dist/_headers' : `got ${h.get(k) ?? 'none'}`);
check('headers', 'index.html: Cache-Control no-cache', h.get('cache-control') === 'no-cache', h.get('cache-control') ?? 'none');
const css = local.match(/assets\/main-[\w-]+\.css/)?.[0];
for (const [path, cache] of [[entry, 'public, max-age=31536000, immutable'], [css, 'public, max-age=31536000, immutable'], ['favicon.svg', 'public, max-age=86400']]) {
  const r = await get(URL_ + path);
  check('headers', `${path.replace(/-[\w-]{8}\./, '.')}: Cache-Control`, r.status === 200 && r.headers.get('cache-control') === cache, `${r.status}, ${r.headers.get('cache-control') ?? 'none'}`);
}
for (const path of ['', entry, css]) {
  const r = await get(URL_ + path);
  check('compression', `${path || '/'}: Brotli`, r.headers.get('content-encoding') === 'br', r.headers.get('content-encoding') ?? 'none');
}

// 2: redirects and the pages.dev address
{
  const r = await get(`http://${HOST}/`);
  check('redirects', 'http → https', [301, 302, 307, 308].includes(r.status) && r.headers.get('location')?.startsWith(`https://${HOST}/`), `${r.status} → ${r.headers.get('location') ?? 'none'}`);
  const w = await get(`https://www.${HOST}/some/path?x=1`).catch((e) => ({ status: `unreachable (${e.cause?.code ?? e.message})`, headers: new Headers() }));
  check('redirects', `www.${HOST} → ${ORIGIN} (path and query kept)`, w.status === 301 && w.headers.get('location') === `${ORIGIN}/some/path?x=1`, `${w.status} → ${w.headers.get('location') ?? 'none'}`);
  const p = await get(PAGES).catch(() => null);
  if (p) check('redirects', `${new URL(PAGES).host}: X-Robots-Tag noindex`, p.headers.get('x-robots-tag') === 'noindex', `${p.status}, ${p.headers.get('x-robots-tag') ?? 'none'}`);
  else check('redirects', `${new URL(PAGES).host}: X-Robots-Tag noindex`, null, 'does not resolve: pass the project’s pages.dev address as the second argument');
}

// 4: the card and the icons
{
  const og = live.match(/property="og:image" content="([^"]+)"/)?.[1];
  const r = og ? await get(og) : null, buf = r ? Buffer.from(await r.arrayBuffer()) : Buffer.alloc(0);
  let w = 0, hh = 0;
  for (let i = 2; i < buf.length - 9;) { // JPEG: the first SOF marker carries the size
    if (buf[i] !== 0xff) break;
    const m = buf[i + 1], len = buf.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xc3) { hh = buf.readUInt16BE(i + 5); w = buf.readUInt16BE(i + 7); break; }
    i += 2 + len;
  }
  check('card', `og:image ${og}`, r?.status === 200 && r.headers.get('content-type') === 'image/jpeg' && w === 1200 && hh === 630, `${r?.status}, ${r?.headers.get('content-type')}, ${w}×${hh}, ${(buf.length / 1024).toFixed(0)} kB`);
  const tw = live.match(/name="twitter:image" content="([^"]+)"/)?.[1];
  check('card', 'twitter:image is the same picture', tw === og, tw ?? 'none');
  for (const [path, type] of [['favicon.svg', 'image/svg+xml'], ['favicon-32.png', 'image/png'], ['apple-touch-icon.png', 'image/png'], ['site.webmanifest', 'application/manifest+json']]) {
    const x = await get(URL_ + path);
    check('icons', path, x.status === 200 && (x.headers.get('content-type') ?? '').startsWith(type), `${x.status}, ${x.headers.get('content-type')}`);
  }
}

// 3: the three engines
for (const [name, open] of [['Chromium', () => launch()], ['Firefox', () => firefox.launch()], ['WebKit', () => webkit.launch()]]) {
  const b = await open();
  try {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`)); });
    const p = await ctx.newPage(), bad = [], rum = [];
    p.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(ORIGIN)) bad.push(`${r.status()} ${r.url().replace(ORIGIN, '')}`); });
    p.on('response', (r) => { if (/\/cdn-cgi\/rum\b/.test(r.url())) rum.push(`${r.request().method()} ${new URL(r.url()).host}${new URL(r.url()).pathname} ${r.status()}`); });
    await p.goto(URL_);
    const state = await p.waitForFunction(() => /\bready\b|\bfailed\b/.test(document.documentElement.className), null, { timeout: 60000 })
      .then(() => p.evaluate(() => (document.documentElement.classList.contains('failed') ? 'the text fallback' : 'the scene')), () => 'neither within 60 s');
    await p.waitForTimeout(4000);
    const r = await p.evaluate((origin) => ({
      csp: window.__csp,
      injected: [...document.scripts].filter((s) => (s.src ? !s.src.startsWith(origin) : false)).map((s) => s.src.replace(/\/v[\w]+$/, '/…')),
      tier: document.documentElement.className,
    }), ORIGIN);
    check(name, 'the scene starts', state === 'the scene', state);
    check(name, 'no response of 400 or more from our origin', bad.length === 0, bad.join(', ') || 'none');
    check(name, 'no CSP violations', r.csp.length === 0, r.csp.join(' | ') || 'none');
    const beacon = r.injected.filter((s) => s.includes('static.cloudflareinsights.com/beacon.min.js')), others = r.injected.filter((s) => !beacon.includes(s));
    check(name, 'injected by the edge: the analytics beacon once, nothing else', beacon.length === 1 && others.length === 0, `beacon ×${beacon.length}${others.length ? `; also ${others.join(', ')}` : ''}`);
    check(name, 'the beacon reports (/cdn-cgi/rum)', rum.some((x) => / 20\d$/.test(x)), rum.length ? [...new Set(rum)].join(', ') : 'none seen');
    await ctx.close();
  } finally { await b.close(); }
}

// 5: Lighthouse
const OUT = 'parity/lighthouse';
await mkdir(OUT, { recursive: true });
const npx = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js');
for (const preset of ['mobile', 'desktop']) {
  const t0 = Date.now(), file = `${OUT}/live-${preset}.json`;
  await new Promise((ok) => spawn(process.execPath, [npx, '-y', 'lighthouse@12', URL_, '--quiet', '--output=json', `--output-path=${file}`,
    '--only-categories=performance,accessibility,best-practices,seo', '--chrome-flags=--headless=new --use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist',
    ...(preset === 'desktop' ? ['--preset=desktop'] : [])], { stdio: 'inherit' }).on('close', ok));
  const fresh = await stat(file).then((x) => x.mtimeMs >= t0, () => false);
  if (!fresh) { check('Lighthouse', preset, false, 'no report'); continue; }
  const j = JSON.parse(await readFile(file, 'utf8')), a = j.audits, s = Object.fromEntries(Object.entries(j.categories).map(([k, c]) => [k, Math.round(c.score * 100)]));
  check('Lighthouse', preset, s.accessibility === 100 && s['best-practices'] === 100 && s.seo === 100,
    `performance ${s.performance} · accessibility ${s.accessibility} · best practices ${s['best-practices']} · SEO ${s.seo} · LCP ${a['largest-contentful-paint'].displayValue} · CLS ${a['cumulative-layout-shift'].displayValue} · TBT ${a['total-blocking-time'].displayValue}`);
  const failing = Object.values(a).filter((x) => x.score !== null && x.score < 1 && x.scoreDisplayMode === 'binary').map((x) => x.id);
  if (failing.length) check('Lighthouse', `${preset}: binary audits not passed`, null, failing.join(', '));
}

const md = `# The live site (npm run check:live)\n\n${URL_}, checked ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC.\n\n| Area | Check | Result | Detail |\n|---|---|---|---|\n${rows.map(([a, n, ok, d]) => `| ${a} | ${n} | ${ok === null ? 'info' : ok ? '✓' : '✗'} | ${String(d).replace(/\|/g, '\\|')} |`).join('\n')}\n`;
await writeFile('docs/live.md', md);
const failed = rows.filter(([, , ok]) => ok === false).length;
console.log(`\n${rows.length - failed - rows.filter(([, , ok]) => ok === null).length}/${rows.length - rows.filter(([, , ok]) => ok === null).length} passed → docs/live.md`);
process.exit(failed ? 1 : 0);
