// check:a11y's WCAG 2.2 checks beyond axe (scripts/a11y-check.mjs):
//  - the motion button (2.2.2): on/off, the reduced experience when off, remembered, the system default
//  - target size (2.5.8): every visible control takes a 24 px square, or has 24 px of room around it
//  - reflow (1.4.10) at 320 px: no horizontal scrolling, no text outside the viewport, at every hold
//  - text spacing (1.4.12): with the WCAG spacing applied, no text clipped or cut off, at every hold
//  - focus order, and a visible focus indicator on every control
//  - the status line announces each chapter reached once (no repeats on rest or resize)

const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true };
const DESK = { viewport: { width: 1440, height: 900 } };
const SPACING = '*{line-height:1.5 !important;letter-spacing:.12em !important;word-spacing:.16em !important}p{margin-bottom:2em !important}';

/** Visible text elements of the experience (overlay, HUD, rail, intro), in the page. */
function visibleText() {
  return [...document.querySelectorAll('.hud *, .intro *, #chapter *, .timeline .label, .timeline button span, .cut *')].filter((e) => {
    if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return false;
    for (let n = e; n && n.nodeType === 1; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < .05) return false; }
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
}

export async function wcag22(browser, url, check) {
  const page = async (opts) => (await browser.newContext(opts)).newPage();
  /** the experience resting at a hold (?parity), fonts in, the loader gone */
  const open = async (opts, query = 'parity') => {
    const p = await page(opts);
    await p.goto(`${url}?${query}`);
    await p.waitForFunction(() => !document.documentElement.classList.contains('fonts-pending') && document.documentElement.classList.contains('ready'), null, { timeout: 60000 });
    await p.addScriptTag({ content: `window.__visibleText = ${visibleText.toString()};` });
    return p;
  };
  const holds = (p) => p.evaluate(async () => (await import('/src/timeline/segments.ts')).SNAP_POINTS);
  const rest = async (p, v, ft = 0) => { await p.evaluate(([x, f]) => { window.__V = x; window.__T = 10; window.__FT = f; }, [v, ft]); await p.waitForTimeout(700); };

  // --- the motion button
  {
    const p = await open(DESK);
    const state = () => p.evaluate(() => { const m = document.getElementById('motion'); return { label: m.textContent, pressed: m.getAttribute('aria-pressed'), off: document.documentElement.classList.contains('motion-off') }; });
    const s0 = await state(), together = await p.evaluate(() => document.getElementById('motion').parentElement === document.getElementById('sound').parentElement);
    check('motion button: "Motion on", pressed, beside the sound button', s0.label === 'Motion on' && s0.pressed === 'true' && !s0.off && together, JSON.stringify(s0));
    await p.getByRole('button', { name: 'Motion on' }).click();
    const s1 = await state();
    const quarter = await p.evaluate(async () => { const m = await import('/src/timeline/segments.ts'); const g = m.SEGMENTS[1]; return (g.start + g.len * .25) / m.TOTAL; });
    await rest(p, quarter);
    const fade = await p.evaluate(() => +document.getElementById('scene').style.opacity);
    check('motion off: the reduced-motion experience (the canvas fades instead of morphing)', s1.label === 'Motion off' && s1.pressed === 'false' && s1.off && Math.abs(fade - .293) < .02, `${JSON.stringify(s1)}, canvas ${fade}`);
    await p.reload();
    await p.waitForFunction(() => document.documentElement.classList.contains('ready'), null, { timeout: 60000 });
    const s2 = await state();
    check('motion off is remembered on the next visit', s2.label === 'Motion off' && s2.off, JSON.stringify(s2));
    await p.context().close();
    const r = await open({ ...DESK, reducedMotion: 'reduce' });
    const s3 = await r.evaluate(() => document.getElementById('motion').textContent);
    check('system reduced motion: it starts "Motion off"', s3 === 'Motion off', s3);
    await r.context().close();
  }

  // --- target size
  for (const [name, opts] of [['1440×900', DESK], ['390×844', PHONE]]) {
    const p = await open(opts);
    await rest(p, (await holds(p))[3]);
    const res = await p.evaluate(() => {
      const els = [...document.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])')].filter((e) => {
        const r = e.getBoundingClientRect();
        if (!r.width || !r.height || e.closest('#story')) return false;
        if (getComputedStyle(e).pointerEvents === 'none') return false; // its own value: the HUD around the controls ignores pointers, the controls do not
        for (let n = e; n && n.nodeType === 1; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < .05) return false; }
        return true;
      });
      const rects = els.map((e) => e.getBoundingClientRect());
      return els.map((e, i) => {
        const r = rects[i], cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        let square = true;
        for (let dx = -11; dx <= 11; dx += 5.5) for (let dy = -11; dy <= 11; dy += 5.5) { const h = document.elementFromPoint(cx + dx, cy + dy); if (!h || !(h === e || e.contains(h))) square = false; }
        // the spacing exception: a 24 px circle on the target's centre meets no other target
        const room = rects.every((o, k) => k === i || Math.hypot(Math.max(o.left - cx, 0, cx - o.right), Math.max(o.top - cy, 0, cy - o.bottom)) >= 12);
        return { id: e.id || e.getAttribute('aria-label') || e.tagName, w: +r.width.toFixed(1), h: +r.height.toFixed(1), square, room };
      });
    });
    const bad = res.filter((t) => !t.square && !t.room);
    check(`target size (2.5.8) at ${name}: every visible control (${res.length})`, bad.length === 0,
      bad.length ? bad.map((t) => `${t.id} ${t.w}×${t.h}`).join(', ') : `${res.filter((t) => t.square).length} take a 24 px square, ${res.filter((t) => !t.square).length} have the room around them`);
    await p.context().close();
  }

  // --- reflow at 320 px
  for (const [name, opts] of [['320×640', { viewport: { width: 320, height: 640 } }], ['320×640, touch', { viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }]]) {
    const p = await open(opts);
    const out = [];
    for (const [i, v] of (await holds(p)).entries()) {
      await rest(p, v, i === 14 ? 15 : 0);
      const r = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, outside: window.__visibleText().filter((e) => { const b = e.getBoundingClientRect(); return b.left < -1 || b.right > innerWidth + 1; }).map((e) => e.textContent.trim().slice(0, 24)) }));
      if (r.sw > 321 || r.outside.length) out.push(`hold ${i + 1}: ${r.sw > 321 ? `scroll width ${r.sw} ` : ''}${r.outside.join(' | ')}`);
    }
    check(`reflow (1.4.10) at ${name}: no horizontal scrolling, no text outside the viewport (15 holds)`, out.length === 0, out.join('; ') || 'all holds');
    await p.context().close();
  }
  {
    const p = await (await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 640 } })).newPage();
    await p.goto(url);
    const sw = await p.evaluate(() => document.documentElement.scrollWidth);
    check('reflow (1.4.10) at 320 px: the article without JavaScript', sw <= 321, `scroll width ${sw}`);
    await p.context().close();
  }

  // --- text spacing
  for (const [name, opts] of [['1440×900', DESK], ['390×844', PHONE]]) {
    const p = await open(opts);
    await p.addStyleTag({ content: SPACING });
    const out = [];
    for (const [i, v] of (await holds(p)).entries()) {
      await rest(p, v, i === 14 ? 15 : 0);
      const r = await p.evaluate(() => window.__visibleText().filter((e) => {
        const cs = getComputedStyle(e), clips = cs.overflow !== 'visible' || cs.webkitLineClamp !== 'none' || cs.textOverflow === 'ellipsis', b = e.getBoundingClientRect();
        return (clips && (e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1)) || b.right > innerWidth + 1 || b.left < -1;
      }).map((e) => e.textContent.trim().slice(0, 24)));
      if (r.length) out.push(`hold ${i + 1}: ${r.join(' | ')}`);
    }
    check(`text spacing (1.4.12) at ${name}: nothing clipped or cut off (15 holds)`, out.length === 0, out.join('; ') || 'all holds');
    await p.context().close();
  }

  // --- focus order and a visible focus indicator
  {
    const p = await open(DESK);
    await p.evaluate(() => document.activeElement?.blur());
    const seen = [];
    for (let k = 0; k < 40; k++) {
      await p.keyboard.press('Tab');
      await p.waitForTimeout(80);
      const f = await p.evaluate(() => {
        const e = document.activeElement;
        if (!e || e === document.body) return null;
        const ring = (x) => { const c = getComputedStyle(x); return (c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) >= 2) || /\d+px \d+px 0px [1-9]/.test(c.boxShadow); };
        const mirror = e.closest('#story') ? document.querySelector('#chapter a.kbd-focus') : null;
        const cs = getComputedStyle(e);
        return { id: e.id || (e.closest('#timeline') ? `rail:${e.getAttribute('aria-label')}` : e.textContent.trim().slice(0, 20)), visible: ring(e) || (!!mirror && ring(mirror)), outline: `${cs.outlineStyle} ${cs.outlineWidth}` };
      });
      if (!f || seen.some((x) => x.id === f.id)) break;
      seen.push(f);
    }
    const order = seen.map((f) => f.id), rail = order.filter((x) => x.startsWith('rail:'));
    check('focus order: sound, motion, the 15 chapters in story order, then the article', order[0] === 'sound' && order[1] === 'motion' && rail.length === 15 && order.indexOf(rail[0]) === 2,
      `${order.slice(0, 4).join(' → ')} … ${order.length} stops`);
    const none = seen.filter((f) => !f.visible);
    check('every focus stop shows a visible focus indicator', none.length === 0, none.map((f) => `${f.id} (${f.outline})`).join(', ') || `${seen.length} stops`);
    await p.context().close();
  }

  // --- status announcements
  {
    const p = await open(DESK, 'x');
    await p.evaluate(() => { window.__said = []; const s = document.getElementById('status'); new MutationObserver(() => window.__said.push(s.textContent)).observe(s, { childList: true, characterData: true, subtree: true }); });
    await p.locator('body').click({ position: { x: 700, y: 400 } });
    for (const key of ['ArrowDown', 'ArrowDown', 'ArrowUp']) { await p.keyboard.press(key); await p.waitForTimeout(3000); }
    await p.setViewportSize({ width: 1200, height: 800 });
    await p.waitForTimeout(4000);
    const said = (await p.evaluate(() => window.__said)).filter(Boolean);
    const repeats = said.filter((t, i) => i > 0 && t === said[i - 1]);
    check('the status line announces each chapter reached once (no repeats on rest or resize)', said.length === 3 && repeats.length === 0, said.join(' / '));
    await p.context().close();
  }
}
