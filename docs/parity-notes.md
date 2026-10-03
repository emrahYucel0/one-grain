# Parity notes: what could not be matched exactly, and why

The port follows a behavioural spec: `reference/blockout-v5.html` in Phase 1, and
`reference/blockout-v6.html` since Phase 2 (content, clock semantics, four new transitions,
new camera moves; world generators unchanged). This page lists every place where the port is
not the reference, and why. It also lists what was verified and how, and what was not.

## How parity was measured

| Check | Result | How |
|---|---|---|
| Grain data | **Bit-identical** to v6 and to v5 at 90 000 and 36 000 grains per world | `npm run check:data` compares per-world digests of the packed texture and all 15 hero positions against an instrumented copy of each reference |
| Rendered frames vs v6 | 39/39 compared positions at 0.000 % differing pixels: 15 holds, 13 transition midpoints, 2 interaction shots, and t = 0.2 / 0.45 / 0.75 in drift, break and separate. The 4 purity → crystal shots differ on purpose (below) | `npm run parity`: same viewport, grain count, frozen shader time and scroll progress in both pages; real GPU |
| Text and clock vs v6 | 85/85 positions identical: clock value, sub-line, unit class, label state, interlude hiding, act, title, body, micro line | `npm run check:text`: every hold and t = 0.1 / 0.3 / 0.5 / 0.7 / 0.9 in every transition |
| Reverse scrub | 12/12: scrolled backwards, drift, break, separate and grow at t = 0.2 / 0.45 / 0.75 render exactly as scrolled forwards (0.000 %, same settled progress) | `npm run check:reverse`: real scrolling through ScrollTrigger, snapping off |
| Noise floor | The reference compared with itself: 0.015–0.019 % (0.195 % at the quarry hold), measured in Phase 1 with both pages in one window | Since Phase 2 each page has its own window (a background tab has its frames throttled), and the residuals are gone: 0.000 % everywhere, including the hover shots |
| Ending sequence | Title at 1.2 s and signature at 5.5 s, the same fade curves | Sampled every 500 ms in both pages |
| Console | 0 warnings or errors | `npm run check:console`: dev and build × Chromium and Firefox, real scrolling through all 29 positions, hash links, sound toggle, resize |

The reference is never edited. The harness serves a patched copy with three hooks: progress
override, time override, and exposing the built texture (`scripts/lib/reference.mjs`).

## Phase 2: one intentional change beyond v6

**purity → crystal is reframed.** In v6 the camera keeps looking where the purity and crystal
holds look, so while the rods melt the glowing pool sits in a corner of the frame (bottom right
at t = 0.3, half out of shot), and the crystal later rises at the right edge.

The port gives that transition a *subject* (`story/transitions.ts`, applied in
`camera/shot.ts`):

- it starts at the pool centre (0, −0.55, 0) and climbs by half the crystal's visible height as
  the growth front moves (`smoothstep(.45, 1, t)`, the same timing as the grow style in the
  shader);
- the camera's aim turns towards it with weight `smoothstep(0, .2, t) · (1 − smoothstep(.85, 1, t))`.

The weight is 0 at both ends, so the purity and crystal holds frame exactly as in v6 (both
0.000 % in the parity run) and there is no seam. Camera position and the orbit path are
unchanged; only the aim moves. Under reduced motion the move is a cross-fade, so the reframe
never shows.

Shots that differ from v6 because of it, and only these:

| Parity shot | Diff vs v6 |
|---|---|
| 18 · purity → crystal midpoint | 7.20 % |
| 41 · purity → crystal, t = 0.2 | 23.42 % |
| 42 · purity → crystal, t = 0.45 | 9.52 % |
| 43 · purity → crystal, t = 0.75 | 4.92 % |

## Phase 2: v6 behaviour ported as-is (worth knowing)

- **A hold renders with the next transition's style at t = 0.** For most styles that is
  invisible. For *separate* it is not: the furnace hold carries v6's residual heat tint and a
  slight sideways shimmer. For *grow*, the few crystal grains at the very tip of the seed cone
  already sit partly at the interface during the purity hold. Both are in v6 and are kept.
- **The final chapter's nav label is still "You"** (aria-label "Go to the end"), as in v6;
  only its slug changed to `now`. Display's label follows its new title.
- **Unused since v6, kept:** grain styles 3 (wind), 6 (pour), 7 (heat) and 8 (spiral) in the
  shader, and the fly, pour and heat camera moves. Nothing references them; they are cheap to
  keep and remove later.
- **Clock class order.** As in v6, a change of unit resets the clock's classes in the same
  frame that the interlude hides it; the next frame re-applies the hiding, behind a 0.3 s
  opacity transition, so it never shows.

## Differences, and why

### Rendering stack
- **three r149 → r186.** Modern three converts colours between sRGB and linear by default,
  which would darken every palette. The port turns colour management off and writes
  linear-sRGB output, the same as r149's legacy mode. Result: identical colours, confirmed
  by the pixel diffs.
- **GLSL moved to GLSL 3 (`#version 300 es`) in separate files.** The maths is the same, with
  one change: `pow(x, 3.)` and `pow(x, 5.)` on non-negative bases became explicit products.
  ANGLE/D3D11 can report info-log warnings for `pow`, and three prints those as console
  warnings. The two forms can differ in the last bit of a float, which is far below anything
  visible.
- **GSAP 3.12.5 → 3.15.** ScrollTrigger settings are copied verbatim (scrub 1, snap points,
  duration 0.4–1.2 s, delay 0.2 s, `power1.inOut`). Scroll feel was not compared
  frame by frame.

### Typography
- **Archivo is self-hosted** (`@fontsource-variable/archivo`, wght 100–900 and wdth 62–125)
  instead of the Google Fonts link. It is the same family with the same axes, and the text in
  the parity shots is identical. The CSS font stack falls back to "Archivo" if the
  self-hosted face fails.

### Quality tiers (new, as specified)
- **Low** (36 000 grains, DPR cap 1.5) is the reference's small-screen setting. **Mid**
  (90 000, 1.75) is its desktop setting and the parity baseline. **High** (160 000, 2.0) is
  new, so it has no reference to match. The reference chose between small and desktop only
  by `innerWidth < 760`. The port also drops to low on a software or "major performance
  caveat" GPU, and starts on high only with a discrete GPU, at least 8 cores and enough
  memory.
- **A tier drop changes the grain layout.** The single random stream depends on the grain
  count, so 36 000 grains are not a subset of 90 000. That is also true in the reference
  (small vs desktop). The swap happens only while resting on a chapter, behind a 250 ms fade.

### Behaviour added on purpose
- **Readable fallback.** Without WebGL2, the reference showed an empty HUD. The port shows the
  semantic article from `index.html`, which is also what you get without JavaScript.
- **Accessibility model.** In the reference (v5 and v6), the chapter card itself was the `aria-live`
  region. In the port, the card is `aria-hidden`, and the full article stays in the
  accessibility tree (visually hidden). A short status line ("Coast. Nature, chapter 4 of
  15.") is announced once the visitor settles on a chapter. Body text is never announced
  twice.
- **Signature link.** The visible link is not tabbable (no focusable content inside
  `aria-hidden`); keyboard users reach the link in the article. Focusing it takes the story
  to the end, shows the title and signature at once instead of after 1.2 s / 5.5 s, and draws
  the focus ring on the visible link.
- **Keyboard.** Arrow keys and Page Up / Page Down step one chapter at a time. In the
  reference they scrolled a little and then snapped. Space, Home and End are unchanged.
- **Hash links.** These also respond to `hashchange` (editing the address), not only to the
  hash present at load.
- **Grains are built in a Web Worker.** "Gathering sand…" shows for the same reason as before;
  the main thread no longer blocks. If module workers are unavailable, the same code runs on
  the main thread.
- **Empty inline favicon.** It avoids a 404 console error that the reference also produces.

### Not deterministic in either version
- **Audio** uses `Math.random` for its noise buffer and tick timing, so no two runs sound the
  same. The bed was smoke-tested (toggle on/off, no console output) but not compared by ear.
- **Pointer smoothing** advances a fixed fraction per frame, so it is frame-rate dependent
  in both versions. In Phase 1 the two hover shots differed slightly (0.073 % and 0.028 %) for
  that reason; with each page in its own window they now match too.

## Not verified here
- Visual parity was measured in Chromium only. Firefox passed the console gate and runs
  WebGL2, but no pixel diffs were taken there.
- No physical touch device was used. Tap interactions are ported verbatim but untested on a
  phone.
- Screen-reader behaviour was checked structurally (axe WCAG 2.1 AA: 0 violations; article
  in the tree; one status region) but not listened to with NVDA or Narrator.
- Performance was measured on one machine (i5-12450H, Intel UHD Graphics, 144 Hz panel); see
  the README.
