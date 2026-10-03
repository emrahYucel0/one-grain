// Accessibility and behaviour checks (npm run check:a11y, against the dev server):
//  - axe (WCAG 2.1 A/AA) on the experience and on the readable fallback
//  - the article stays in the accessibility tree, the overlay does not duplicate it
//  - arrow keys / Page Down step between chapters; timeline buttons show a focus ring
//  - prefers-reduced-motion: no morph, the canvas fades instead
//  - no WebGL2, and no JavaScript: the article is the page
import AxeBuilder from '@axe-core/playwright';
import { launch } from './lib/browser.mjs';
import { startDev } from './lib/servers.mjs';

const server = await startDev(5195);
const url = `${server.origin}/`;
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const axe = async (page, label) => {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  check(`axe: ${label}`, r.violations.length === 0, r.violations.map((v) => `${v.id} ×${v.nodes.length}`).join(', '));
};

/** axe needs pages that live in an explicit context */
const newPage = async (b, opts) => (await b.newContext(opts)).newPage();

const browser = await launch();
try {
  // --- the experience
  const page = await newPage(browser, { viewport: { width: 1440, height: 900 } });
  await page.goto(url);
  await page.waitForFunction(() => document.getElementById('introHint').textContent.includes('Scroll'), null, { timeout: 60000 });
  await axe(page, 'experience');

  const tree = await page.evaluate(() => {
    const story = document.getElementById('story');
    return {
      storyHidden: story.closest('[aria-hidden="true"]') !== null || getComputedStyle(story).display === 'none' || getComputedStyle(story).visibility === 'hidden',
      sections: story.querySelectorAll('section[data-slug]').length,
      overlayHidden: document.querySelector('.story').getAttribute('aria-hidden') === 'true',
      liveRegions: [...document.querySelectorAll('[aria-live],[role=status]')].map((e) => e.id),
      overlayLinkTabbable: document.querySelector('#chapter a')?.tabIndex,
    };
  });
  check('article stays in the accessibility tree', !tree.storyHidden && tree.sections === 15, `${tree.sections} sections`);
  check('visual overlay is aria-hidden', tree.overlayHidden);
  check('one status region, no duplicate live text', tree.liveRegions.join() === 'status', tree.liveRegions.join());

  // keyboard: three steps forward, one back, then Page Down
  await page.locator('body').click({ position: { x: 700, y: 400 } });
  const current = () => page.evaluate(() => [...document.querySelectorAll('#timeline button')].findIndex((b) => b.getAttribute('aria-current') === 'step'));
  for (let i = 0; i < 3; i++) { await page.keyboard.press('ArrowDown'); await page.waitForTimeout(250); }
  await page.waitForTimeout(3000);
  const afterDown = await current();
  await page.keyboard.press('ArrowUp'); await page.waitForTimeout(3000);
  const afterUp = await current();
  await page.keyboard.press('PageDown'); await page.waitForTimeout(3000);
  const afterPgDn = await current();
  check('ArrowDown ×3 → chapter 4', afterDown === 3, `at ${afterDown + 1}`);
  check('ArrowUp → chapter 3', afterUp === 2, `at ${afterUp + 1}`);
  check('PageDown → chapter 4', afterPgDn === 3, `at ${afterPgDn + 1}`);
  const status = await page.locator('#status').textContent();
  check('status line announces the chapter reached', /^Coast\. Nature, chapter 4 of 15\.$/.test(status ?? ''), status ?? '');

  // focus ring on a timeline button
  await page.locator('#timeline button').first().focus();
  await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
  const ring = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return `${s.outlineStyle} ${s.outlineWidth}`; });
  check('timeline buttons show a visible focus ring', /solid 2px/.test(ring), ring);

  // focus on the article's signature link takes the story to the end and shows the link
  await page.locator('#story a').focus();
  await page.waitForTimeout(3500);
  const sig = await page.evaluate(() => ({ hash: location.hash, mirrored: document.querySelector('#chapter a')?.classList.contains('kbd-focus') }));
  check('signature link focus → final chapter, ring mirrored', sig.hash === '#you' && sig.mirrored === true, JSON.stringify(sig));
  await page.close();

  // --- reduced motion: a quarter into the first transition the canvas is fading, not morphing
  const rm = await newPage(browser, { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await rm.goto(`${url}?parity`);
  await rm.waitForFunction(() => window.__PACK, null, { timeout: 60000 });
  const seg = await rm.evaluate(async () => { const m = await import('/src/timeline/segments.ts'); const s = m.SEGMENTS[1]; return { quarter: (s.start + s.len * .25) / m.TOTAL, mid: (s.start + s.len * .5) / m.TOTAL }; });
  await rm.evaluate((v) => { window.__V = v; }, seg.quarter); await rm.waitForTimeout(300);
  const q = await rm.evaluate(() => +document.getElementById('scene').style.opacity);
  await rm.evaluate((v) => { window.__V = v; }, seg.mid); await rm.waitForTimeout(300);
  const m = await rm.evaluate(() => +document.getElementById('scene').style.opacity);
  check('reduced motion: canvas fades (≈0.29 at ¼, 0 at ½)', Math.abs(q - .293) < .01 && m < .01, `${q} / ${m}`);
  await rm.close();
} finally {
  await browser.close();
}

// --- no WebGL2: the article is the page
const noGl = await launch({ args: ['--disable-webgl', '--disable-webgl2'] });
try {
  const p = await newPage(noGl, { viewport: { width: 1440, height: 900 } });
  await p.goto(url); await p.waitForTimeout(1500);
  const s = await p.evaluate(() => ({ cls: document.documentElement.className, h: document.getElementById('story').getBoundingClientRect().height, hud: getComputedStyle(document.querySelector('.hud')).display }));
  check('no WebGL2: readable article, no HUD', /nogl/.test(s.cls) && s.h > 500 && s.hud === 'none', JSON.stringify(s));
  await axe(p, 'fallback (no WebGL2)');
} finally { await noGl.close(); }

// --- no JavaScript
const noJs = await launch();
try {
  const ctx = await noJs.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(url);
  const h = await p.evaluate(() => document.getElementById('story').getBoundingClientRect().height).catch(() => -1);
  const text = await p.locator('#story').innerText();
  check('no JavaScript: readable article', text.includes('Deep underground') && text.includes('You are looking at sand'), `${text.length} chars`);
  void h;
} finally { await noJs.close(); }

await server.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
