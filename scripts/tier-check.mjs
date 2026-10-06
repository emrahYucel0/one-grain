// Quality tiers (npm run check:tiers). The tier is chosen once at startup from the device and the GPU
// the browser reports (core/quality.ts, names in core/gpus.ts) and never changes; nothing is measured.
//  1. the device rules pick the expected tier for each case (phones, iPads, Android tablets, laptops,
//     desktops, Apple Silicon, software renderers, texture limits), and ?tier= overrides them;
//  2. a normal visit runs no timing code: no GPU timer queries, no timer extension, a frame drawn on
//     every refresh the browser offers (no pacing), the context asked for 'high-performance';
//  3. the tier never changes after the scene appears: the same tier and grain pack after scrolling
//     through the whole story and resizing the window;
//  4. the low tier draws no shadows and no depth of field;
//  5. ?debug shows the tier, the rule that chose it and the GPU the browser reported, and its layer
//     toggles work;
//  and no console errors.
import { createServer } from 'vite';
import { launch, watchConsole } from './lib/browser.mjs';
import { startDev } from './lib/servers.mjs';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { TIERS, pickTier } = await vite.ssrLoadModule('/src/core/quality.ts');
await vite.close();

const results = [];
const check = (name, ok, detail) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (${detail})`); };

// 1: the device rules
const UA = {
  iphone7: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6.6 Mobile/15E148 Safari/604.1',
  iphone15: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  androidTablet: 'Mozilla/5.0 (Linux; Android 14; SM-X910) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  androidPhone: 'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
};
const caps = (renderer, extra = {}) => ({ webgl2: true, performant: true, maxTextureSize: 16384, renderer, astc: false, ...extra });
const CASES = [
  ['iPhone 7 / iOS 15', UA.iphone7, 5, caps('Apple GPU'), 'mid'],
  ['iPhone 15', UA.iphone15, 5, caps('Apple GPU', { astc: true }), 'mid'],
  ['iPad (desktop user agent + touch)', UA.mac, 5, caps('Apple GPU', { astc: true }), 'mid'],
  ['high-end Android tablet (Adreno 740)', UA.androidTablet, 10, caps('ANGLE (Qualcomm, Adreno (TM) 740, OpenGL ES 3.2)'), 'high'],
  ['high-end Android tablet (Mali-G715)', UA.androidTablet, 10, caps('Mali-G715-Immortalis MC11'), 'high'],
  ['older Android tablet (Adreno 618)', UA.androidTablet, 10, caps('ANGLE (Qualcomm, Adreno (TM) 618, OpenGL ES 3.2)'), 'mid'],
  ['Android phone with a high-end GPU (Adreno 750)', UA.androidPhone, 5, caps('ANGLE (Qualcomm, Adreno (TM) 750, OpenGL ES 3.2)'), 'mid'],
  ['Intel UHD laptop', UA.windows, 0, caps('ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00005917) Direct3D11 vs_5_0 ps_5_0, D3D11)'), 'mid'],
  ['Windows touch laptop, Intel Iris Xe', UA.windows, 10, caps('ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x00009A49) Direct3D11 vs_5_0 ps_5_0, D3D11)'), 'mid'],
  ['AMD integrated (Radeon Graphics)', UA.windows, 0, caps('ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001681) Direct3D11 vs_5_0 ps_5_0, D3D11)'), 'mid'],
  ['RTX 4050 laptop', UA.windows, 0, caps('ANGLE (NVIDIA, NVIDIA GeForce RTX 4050 Laptop GPU (0x000028A1) Direct3D11 vs_5_0 ps_5_0, D3D11)'), 'high'],
  ['AMD discrete (Radeon RX 7600)', UA.windows, 0, caps('ANGLE (AMD, AMD Radeon RX 7600 (0x00007480) Direct3D11 vs_5_0 ps_5_0, D3D11)'), 'high'],
  ['Apple M1 Mac (Chromium)', UA.macChrome, 0, caps('ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)'), 'high'],
  ['Apple M1 Mac (Safari: "Apple GPU", ASTC)', UA.mac, 0, caps('Apple GPU', { astc: true }), 'high'],
  ['Intel Mac (Safari: "Apple GPU", no ASTC)', UA.mac, 0, caps('Apple GPU'), 'mid'],
  ['SwiftShader', UA.windows, 0, caps('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)'), 'low'],
  ['Microsoft Basic Render Driver', UA.windows, 0, caps('ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0, D3D11)'), 'low'],
  ['only a major-performance-caveat context', UA.windows, 0, caps('', { performant: false }), 'low'],
  ['GPU name hidden (privacy setting)', UA.windows, 0, caps(''), 'mid'],
  ['GPU name masked: "WebKit WebGL"', UA.mac, 0, caps('WebKit WebGL'), 'mid'],
  ['GPU name masked: Firefox resistFingerprinting ("Mozilla")', UA.windows, 0, caps('Mozilla'), 'mid'],
  ['GPU name randomised', UA.windows, 0, caps('ANGLE (Xq7f, Zr3k9 Vp2 Direct3D11 vs_5_0 ps_5_0, D3D11)'), 'mid'],
  ['Android tablet, GPU name hidden', UA.androidTablet, 10, caps(''), 'mid'],
  ['texture limit too small for mid (1024)', UA.windows, 0, caps('ANGLE (Intel, Intel(R) UHD Graphics Direct3D11)', { maxTextureSize: 1024 }), 'low'],
  ['high-end GPU, texture limit too small for high (2048)', UA.windows, 0, caps('ANGLE (NVIDIA, NVIDIA GeForce RTX 4050 Laptop GPU Direct3D11)', { maxTextureSize: 2048 }), 'mid'],
  ['texture limit too small even for low (512): text version', UA.windows, 0, caps('ANGLE (Intel, Intel(R) UHD Graphics Direct3D11)', { maxTextureSize: 512 }), null],
];
for (const [name, ua, touch, c, want] of CASES) {
  const got = pickTier({ ua, touch }, c, null);
  check(`device rule: ${name} → ${want ?? 'text version'}`, (got?.tier.name ?? null) === want, got ? `${got.tier.name}: ${got.rule}` : 'none fits');
}
for (const name of ['low', 'mid', 'high']) {
  const got = pickTier({ ua: UA.iphone7, touch: 5 }, caps('Apple GPU'), name);
  check(`?tier=${name} overrides the rules`, got.tier.name === name, got.rule);
}

const dev = await startDev(5179);
const browser = await launch();
const logs = [];
const open = async (query, opts = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  // instrument WebGL before the page runs: timer queries, extensions asked for, context attributes,
  // and whether every refresh draws (a draw call between two animation frames)
  await ctx.addInitScript(() => {
    const w = (window.__probe = { queries: 0, timerExt: 0, attrs: null, drawn: [] });
    const P = WebGL2RenderingContext.prototype;
    const wrap = (k, f) => { const o = P[k]; P[k] = function (...a) { f.apply(this, a); return o.apply(this, a); }; };
    wrap('createQuery', () => { w.queries++; });
    wrap('beginQuery', () => { w.queries++; });
    wrap('getExtension', (n) => { if (/timer_query/i.test(n)) w.timerExt++; });
    let drew = false;
    wrap('drawArrays', () => { drew = true; }); wrap('drawElements', () => { drew = true; });
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, attrs) {
      const gl = getContext.call(this, type, attrs);
      if (type === 'webgl2' && gl && this.id === 'scene') w.attrs = attrs ?? null;
      return gl;
    };
    const tick = () => { if (document.documentElement.classList.contains('ready')) w.drawn.push(drew); drew = false; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  const page = await ctx.newPage();
  watchConsole(page, 'port', logs);
  await page.goto(`${dev.origin}/${query}`);
  await page.waitForFunction(() => document.documentElement.classList.contains('ready'), null, { timeout: 90000 });
  return page;
};
try {
  // 2: a normal visit
  {
    const page = await open('');
    await page.mouse.wheel(0, 900); await page.waitForTimeout(2500);
    const p = await page.evaluate(() => ({ ...window.__probe, drawn: window.__probe.drawn.slice(10) }));
    check('normal visit: no GPU timer queries, no timer extension asked for', p.queries === 0 && p.timerExt === 0, `${p.queries} queries, timer extension asked ${p.timerExt}×`);
    const drawn = p.drawn.filter(Boolean).length;
    check('normal visit: a frame is drawn on every refresh the browser offers (no pacing)', p.drawn.length > 60 && drawn >= p.drawn.length - 1, `${drawn} of ${p.drawn.length} refreshes drew`);
    check("normal visit: the context asks for powerPreference 'high-performance'", p.attrs?.powerPreference === 'high-performance', JSON.stringify(p.attrs));
    await page.context().close();
  }

  // 3: the tier never changes after the scene appears
  {
    const page = await open('?parity');
    const first = await page.evaluate(() => ({ tier: window.__tier, pack: window.__PACK }));
    await page.evaluate(() => { window.__packAtStart = window.__PACK; });
    for (const f of [.25, .5, .75, 1, 0]) {
      await page.evaluate((x) => scrollTo({ top: (document.documentElement.scrollHeight - innerHeight) * x }), f);
      await page.waitForTimeout(1200);
    }
    await page.setViewportSize({ width: 800, height: 1000 }); await page.waitForTimeout(800);
    await page.setViewportSize({ width: 1440, height: 900 }); await page.waitForTimeout(800);
    const after = await page.evaluate(() => ({ tier: window.__tier, same: window.__PACK === window.__packAtStart, n: window.__PACK.n }));
    check('the tier never changes after the scene appears (whole story scrolled, window resized)', after.same && after.tier.name === first.tier.name && after.n === first.tier.n,
      `${first.tier.name} (${first.tier.rule}), ${after.n} grains, same grain pack ${after.same}`);
    await page.context().close();
  }

  // 4: the low tier's layers; 5: the debug panel
  const layersOn = (page) => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[role=group] button[aria-pressed]')].map((b) => [b.textContent, b.getAttribute('aria-pressed') === 'true'])));
  {
    const page = await open('?parity&debug&tier=low');
    await page.waitForSelector('.og-debug');
    const on = await layersOn(page), n = await page.evaluate(() => window.__PACK.n);
    check('low tier: no shadows, no depth of field, the rest on', n === TIERS.low.n && !on.Shadows && !on['Depth of field'] && on.Light && on.Bloom && on.Grade, JSON.stringify(on));
    await page.context().close();
  }
  {
    const page = await open('?parity&debug');
    await page.waitForFunction(() => /fps \d/.test(document.querySelector('.og-debug')?.textContent ?? ''));
    const text = await page.evaluate(() => document.querySelector('.og-debug').textContent);
    const [l1, l2] = text.split('\n');
    check('?debug: the tier and the rule that chose it', /^tier (low|mid|high): \S/.test(l1), l1);
    check('?debug: the GPU the browser reported', /^gpu \S/.test(l2) && !/not reported/.test(l2), l2);
    await page.evaluate(() => { window.__V = 0; window.__T = 10; });
    await page.waitForTimeout(1500);
    const before = await page.evaluate(() => Object.keys(window.__gpu.recent.at(-1)?.passes ?? {}));
    await page.getByRole('button', { name: 'Bloom' }).click();
    await page.waitForTimeout(1500);
    const after = await page.evaluate(() => ({ passes: Object.keys(window.__gpu.recent.at(-1)?.passes ?? {}), pressed: document.querySelector('[role=group] button[aria-pressed]:nth-child(4)').getAttribute('aria-pressed') }));
    const gpu = before.length > 0;
    check('?debug: the Bloom toggle switches the bloom pass off', after.pressed === 'false' && (!gpu || (before.includes('bloom') && !after.passes.includes('bloom'))),
      gpu ? `passes before: ${before.join(', ')}; after: ${after.passes.join(', ')}` : 'GPU timer unavailable: toggle state only');
    await page.context().close();
  }

  const errors = logs.filter((x) => !x.harness);
  check('no console warnings or errors', errors.length === 0, errors.map((e) => e.text).join(' | ') || 'none');
} finally { await browser.close(); await dev.close(); }
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
process.exit(results.every(Boolean) ? 0 : 1);
