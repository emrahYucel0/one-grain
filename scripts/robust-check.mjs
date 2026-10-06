// Nothing outside our control may break the site (npm run check:robust): the production build, served
// as a host would (scripts/serve.mjs: the CSP and the other headers), with what visitors bring along.
// In every case the scene must start (html.ready, not the text fallback) and the console must show no
// warning or error from our own code (messages about other origins' scripts are reported, not judged).
//  1. uBlock Origin Lite loaded (Chromium, its default filter lists), with the Cloudflare beacon injected
//     as on the live site: none of our own requests blocked, nothing of ours hidden;
//  2. Dark Reader loaded: the page's darkreader-lock is honoured (no injected styles); a control run
//     without the lock shows the extension is active;
//  3. a third-party script the CSP does not allow, injected; a third-party script that loads and throws;
//     the beacon blocked as an ad blocker blocks it;
//  4. the GPU name hidden (no WEBGL_debug_renderer_info, the masked "WebKit WebGL"): mid;
//  5. a page translator's DOM changes (text wrapped in <font>, as Google Translate does) while the
//     visitor moves through chapters: the chapter titles still follow;
//  6. Firefox and WebKit with the injected and blocked third-party scripts;
//  0. first, statically: no file or path of ours, and no class or id in the page or the stylesheet, has
//     a word filter lists block on (analytics, track, beacon, ads, telemetry, stats, pixel and the like).
// The extensions are fetched once from their GitHub releases into .cache/extensions/ (git-ignored).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, firefox, webkit } from 'playwright';
import { build } from 'vite';
import { launch } from './lib/browser.mjs';
import { serve } from './serve.mjs';

const CACHE = resolve('.cache/extensions');
const EXTENSIONS = {
  ubol: { repo: 'uBlockOrigin/uBOL-home', asset: /chromium\.zip$/ },
  darkreader: { repo: 'darkreader/darkreader', asset: /^darkreader-chrome-mv3\.zip$/ },
};
/** The extension's unpacked folder, downloaded and unzipped on first use. */
async function extension(name) {
  const dir = join(CACHE, name);
  if (existsSync(join(dir, 'manifest.json'))) return dir;
  const { repo, asset } = EXTENSIONS[name];
  const rel = await (await fetch(`https://api.github.com/repos/${repo}/releases/latest`)).json();
  const a = rel.assets.find((x) => asset.test(x.name));
  if (!a) throw new Error(`${name}: no asset matching ${asset} in ${repo} ${rel.tag_name}`);
  mkdirSync(dir, { recursive: true });
  const zip = join(CACHE, a.name);
  writeFileSync(zip, Buffer.from(await (await fetch(a.browser_download_url)).arrayBuffer()));
  if (process.platform === 'win32') execFileSync('powershell', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${dir}' -Force`]);
  else execFileSync('unzip', ['-q', zip, '-d', dir]);
  rmSync(zip);
  // some archives hold one folder with the extension inside
  if (!existsSync(join(dir, 'manifest.json'))) {
    const sub = readdirSync(dir).find((d) => existsSync(join(dir, d, 'manifest.json')));
    if (sub) return join(dir, sub);
  }
  console.log(`      ${name}: ${rel.tag_name} → ${dir}`);
  return dir;
}

const results = [];
const check = (name, ok, detail) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (${detail})`); };

await build({ logLevel: 'error' });

// 0: names filter lists react to, in our paths, classes and ids
{
  const BLOCKED = /(^|[^a-z])(analytics?|track(s|er|ers|ing)?|beacons?|ads?|advert\w*|adserver|banners?|sponsor\w*|promo\w*|popups?|telemetry|stats?|metrics?|pixels?|collect(or)?|counter|gtm|tagmanager|affiliate|fingerprint\w*|tracking|insights?)([^a-z]|$)/i;
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
  const paths = walk('dist').map((f) => f.replace(/\\/g, '/').replace(/^dist\//, ''));
  const html = readFileSync('dist/index.html', 'utf8'), css = paths.filter((f) => f.endsWith('.css')).map((f) => readFileSync(join('dist', f), 'utf8')).join('');
  const names = new Set([...html.matchAll(/\b(?:class|id)="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)));
  for (const m of css.matchAll(/[.#]([a-zA-Z][\w-]*)/g)) names.add(m[1]);
  const hits = [...paths.filter((p) => BLOCKED.test(p)), ...[...names].filter((n) => BLOCKED.test(n)).map((n) => `.${n}`)];
  check('no path, class or id of ours with a word filter lists block on', hits.length === 0, hits.join(', ') || `${paths.length} files, ${names.size} class and id names`);
}

const server = await serve(4192), origin = server.origin;
const BEACON = `<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"version":"2024.11.0","token":"check","r":1,"spa":2}' crossorigin="anonymous"></script>`;
const FOREIGN = '<script src="https://cdn.tracker.example/t.js"></script>';
const THROWS = '<script src="https://static.cloudflareinsights.com/throws.js"></script>';

/**
 * One visit: `inject` goes before </body> (as an edge injects), `strip` removes from the page, `init`
 * runs before the page, `routes` are [pattern, handler]. Returns the outcome and every console message
 * with whether it is ours.
 */
async function visit(ctx, { query = '?debug', inject = '', strip = null, init = null, routes = [], during = null } = {}) {
  const page = await ctx.newPage();
  const msgs = [], ownFailed = [], blocked = [];
  page.on('console', (m) => {
    if (m.type() !== 'error' && m.type() !== 'warning') return;
    const at = m.location()?.url ?? '', text = m.text();
    // ours: raised at our origin and naming no URL at another origin (Firefox also names the page itself)
    const urls = text.match(/https?:\/\/[^\s"'”“)]+/g) ?? [];
    const foreign = urls.some((u) => !u.startsWith(origin)) || (!!at && !at.startsWith(origin));
    msgs.push({ text: text.slice(0, 200), own: !foreign });
  });
  page.on('pageerror', (e) => msgs.push({ text: `uncaught: ${e.message}`, own: !e.stack || e.stack.includes(origin) }));
  page.on('requestfailed', (r) => {
    if (r.url().startsWith(origin)) ownFailed.push(`${r.url().replace(origin, '')} ${r.failure()?.errorText}`);
    else if (/BLOCKED_BY_CLIENT/.test(r.failure()?.errorText ?? '')) blocked.push(r.url());
  });
  if (init) await page.addInitScript(init);
  for (const [pattern, handler] of routes) await page.route(pattern, handler);
  if (inject || strip) {
    await page.route(`${origin}/${query}`, async (r) => {
      const res = await r.fetch();
      let body = await res.text();
      if (strip) body = body.replace(strip, '');
      await r.fulfill({ response: res, body: body.replace('</body>', `${inject}</body>`) });
    });
  }
  await page.goto(`${origin}/${query}`);
  const state = await page.waitForFunction(() => /\bready\b|\bfailed\b/.test(document.documentElement.className), null, { timeout: 45000 })
    .then(() => page.evaluate(() => (document.documentElement.classList.contains('failed') ? 'fallback' : 'scene')), () => 'neither within 45 s');
  if (during) await during(page);
  await page.waitForTimeout(1500);
  const report = await page.evaluate(() => document.querySelector('.og-errors')?.textContent ?? '').catch(() => '');
  return { page, state, own: msgs.filter((m) => m.own), other: msgs.filter((m) => !m.own), ownFailed, blocked, report };
}
const summary = (v) => `${v.state}; own console ${v.own.length ? v.own.map((m) => m.text).join(' | ') : 'clean'}; other-origin messages ${v.other.length}`;
const sceneOk = (v) => v.state === 'scene' && v.own.length === 0;

const PROFILE = (n) => join(tmpdir(), `one-grain-robust-${n}-${process.pid}`);
const withExtension = async (name, fn) => {
  const dir = await extension(name), profile = PROFILE(name);
  const ctx = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true, viewport: { width: 1440, height: 900 },
    args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', `--disable-extensions-except=${dir}`, `--load-extension=${dir}`],
  });
  try {
    // an MV3 extension runs in a service worker; give it a moment to load its rules
    if (!ctx.serviceWorkers().length) await ctx.waitForEvent('serviceworker', { timeout: 15000 }).catch(() => {});
    await new Promise((ok) => setTimeout(ok, 3000));
    await fn(ctx);
  } finally { await ctx.close(); rmSync(profile, { recursive: true, force: true }); }
};

try {
  // 1: uBlock Origin Lite
  await withExtension('ubol', async (ctx) => {
    const v = await visit(ctx, { inject: BEACON });
    const beacon = v.blocked.some((u) => u.includes('cloudflareinsights')) ? 'blocked by uBlock Origin Lite' : 'not blocked';
    const hidden = await v.page.evaluate(() => ['.hud', '.timeline', '#chapter', '#scene', '.story'].filter((s) => {
      const el = document.querySelector(s); if (!el) return true;
      const cs = getComputedStyle(el), r = el.getBoundingClientRect();
      return cs.display === 'none' || cs.visibility === 'hidden' || r.width === 0 || r.height === 0;
    }));
    check('uBlock Origin Lite: the scene starts, no console error from our code', sceneOk(v), `${summary(v)}; the beacon ${beacon}`);
    check('uBlock Origin Lite: none of our requests blocked, nothing of ours hidden', v.ownFailed.length === 0 && hidden.length === 0,
      `${v.ownFailed.join(', ') || 'no own request failed'}; ${hidden.length ? `hidden: ${hidden.join(', ')}` : 'HUD, rail, chapter, canvas shown'}`);
    await v.page.close();
  });

  // 2: Dark Reader
  await withExtension('darkreader', async (ctx) => {
    const marks = (page) => page.evaluate(() => ({ styles: document.querySelectorAll('style.darkreader').length, attrs: [...document.documentElement.attributes].filter((a) => a.name.startsWith('data-darkreader')).map((a) => a.name) }));
    const v = await visit(ctx);
    const locked = await marks(v.page);
    check('Dark Reader: the scene starts, no console error from our code, the lock honoured', sceneOk(v) && locked.styles === 0 && locked.attrs.length === 0,
      `${summary(v)}; Dark Reader styles ${locked.styles}, attributes ${locked.attrs.join(' ') || 'none'}`);
    await v.page.close();
    const control = await visit(ctx, { strip: /<meta name="darkreader-lock">\n?/ });
    await control.page.waitForTimeout(1500);
    const active = await marks(control.page);
    check('Dark Reader control: without the lock it does act on the page (the test sees a live extension)', active.styles > 0 || active.attrs.length > 0, `${active.styles} styles, attributes ${active.attrs.join(' ') || 'none'}`);
    await control.page.close();
  });

  // 3–5: plain Chromium
  const browser = await launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const throws = ['https://static.cloudflareinsights.com/throws.js', (r) => r.fulfill({ contentType: 'text/javascript', body: 'throw new Error("a third-party script failing");' })];
    const blocked = ['https://static.cloudflareinsights.com/beacon.min.js*', (r) => r.abort('blockedbyclient')];
    let v = await visit(ctx, { inject: FOREIGN });
    check('a third-party script the CSP does not allow: the scene starts', sceneOk(v) && /third-party load failed, ignored/.test(v.report), summary(v));
    await v.page.close();
    v = await visit(ctx, { inject: THROWS, routes: [throws] });
    check('a third-party script that loads and throws: the scene starts', sceneOk(v) && /third-party error, ignored/.test(v.report), summary(v));
    await v.page.close();
    v = await visit(ctx, { inject: BEACON, routes: [blocked] });
    check('the analytics beacon blocked (as by an ad blocker): the scene starts', sceneOk(v) && /third-party load failed, ignored/.test(v.report), summary(v));
    await v.page.close();
    v = await visit(ctx, { init: () => {
      const p = WebGL2RenderingContext.prototype, ge = p.getExtension, gp = p.getParameter;
      p.getExtension = function (n) { return n === 'WEBGL_debug_renderer_info' ? null : ge.call(this, n); };
      p.getParameter = function (k) { return k === 0x1F01 ? 'WebKit WebGL' : gp.call(this, k); };
    } });
    const tier = (v.report.split('\n').find((l) => /tier:/.test(l)) ?? '').replace(/^\s*[\d.]+ s\s+/, '');
    check('the GPU name hidden: mid, and the scene starts', sceneOk(v) && /tier: mid \(GPU not reported/.test(tier), `${summary(v)}; ${tier}`);
    await v.page.close();
    // a translator: every text node outside translate="no" wrapped in <font>, over and over
    const titles = [];
    v = await visit(ctx, {
      init: () => {
        const wrap = () => {
          const walk = document.createTreeWalker(document.body ?? document.documentElement, NodeFilter.SHOW_TEXT);
          const nodes = [];
          while (walk.nextNode()) { const n = walk.currentNode; if (n.nodeValue.trim() && !n.parentElement.closest('[translate="no"],script,style,font')) nodes.push(n); }
          for (const n of nodes) { const f = document.createElement('font'); f.style.verticalAlign = 'inherit'; n.replaceWith(f); f.append(n); }
        };
        setInterval(wrap, 50);
      },
      during: async (page) => {
        for (const slug of ['granite', 'desert', 'furnace']) {
          await page.evaluate((s) => { location.hash = s; }, slug);
          await page.waitForTimeout(2500);
          titles.push([slug, await page.evaluate(() => document.querySelector('#chapter h2').textContent.trim())]);
        }
      },
    });
    const wrapped = await v.page.evaluate(() => document.querySelectorAll('#chapter font, #story font').length);
    const follows = titles.every(([slug, t]) => t.toLowerCase() === slug);
    check('a page translator rewriting the text: the chapter titles still follow, no console error from our code', sceneOk(v) && follows && wrapped > 0,
      `${summary(v)}; ${titles.map(([s, t]) => `#${s} → "${t}"`).join(', ')}; ${wrapped} <font> wrappers`);
    await v.page.close();
    await ctx.close();
  } finally { await browser.close(); }

  // 6: Firefox and WebKit
  for (const [name, engine] of [['Firefox', firefox], ['WebKit', webkit]]) {
    const b = await engine.launch();
    try {
      const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
      await ctx.route('https://static.cloudflareinsights.com/**', (r) => r.abort('blockedbyclient'));
      const v = await visit(ctx, { inject: BEACON + FOREIGN });
      check(`${name}: the beacon blocked and a disallowed script injected: the scene starts`, sceneOk(v), summary(v));
      await ctx.close();
    } finally { await b.close(); }
  }
} finally { await server.close(); }
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
process.exit(results.every(Boolean) ? 0 : 1);
