# Parity notes: what could not be matched exactly, and why

The port follows a behavioural spec: `reference/blockout-v5.html` in Phase 1, and
`reference/blockout-v6.html` since Phase 2 (content, clock semantics, four new transitions,
new camera moves; world generators unchanged). Phase 2.1 fixed v6's rest-state bugs on purpose.
This page lists every place where the port is not the reference, and why. It also lists what
was verified and how, and what was not.

## How parity was measured

| Check | Result | How |
|---|---|---|
| Grain data | **Bit-identical** to v6 and to v5 at 90 000 and 36 000 grains per world | `npm run check:data` compares per-world digests of the packed texture and all 15 hero positions against an instrumented copy of each reference |
| Rendered frames vs v6 | 30/30 compared positions at 0.000 % differing pixels. 13 positions differ on purpose and are listed below (the Phase 2 reframe and the Phase 2.1 rest-state fixes) | `npm run parity`: 15 holds, 14 transition midpoints, 2 interaction shots, and t = 0.2 / 0.45 / 0.75 in the four v6 transitions; same viewport, grain count, frozen shader time and scroll progress in both pages; real GPU |
| Rest states | 39/39 identical, byte for byte: for chapters 2–14, the previous transition at t = 1 equals the next at t = 0, which equals the hold as scrolled into and, with the hold's lean, the hold screenshot | `npm run check:seams` |
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

The weight is 0 at both ends, so the reframe leaves the purity and crystal holds exactly
as they were, and there is no seam. (The purity hold's 0.16 % difference since Phase 2.1 comes
from fix 5, not from the reframe.) Camera position and the orbit path are
unchanged; only the aim moves. Under reduced motion the move is a cross-fade, so the reframe
never shows.

Shots that differ from v6 because of it: 18 (purity → crystal midpoint) and 41, 42, 43 (t = 0.2,
0.45, 0.75). In Phase 2 they measured 7.20, 23.42, 9.52 and 4.92 %. Since Phase 2.1 they also
carry fix 5; current values are in the Phase 2.1 table below.

## Phase 2.1: rest-state fixes (intentional deviations from v6)

**Rule.** At t = 0 a transition must reproduce the previous world exactly, and at t = 1 the
next world exactly. No transition may leave any trace (position, size or colour) on a resting
chapter. A hold renders as the next transition at t = 0, so any trace there shows on the
chapter itself. `npm run check:seams` enforces the rule.

Before Phase 2.1 the seam check failed at every chapter. Three were large (furnace 75.8 %,
purity 46.3 %, crystal 0.27 %); the others were float-level (24–1 224 scattered pixels).

| Fix | Transition | v6 | Port |
|---|---|---|---|
| 1 | separate (19) | the vapour sway was not scaled by `rise`, so it displaced every grain at t = 0 | sway × `rise` |
| 2 | separate (19) | heat `(1 − rise) · .6`: 0.6 at t = 0, tinting the resting furnace | `.4 · sin(π · rise)`: zero at both ends |
| 3 | separate (19) | `dep = smoothstep(.55, 1., uT − (1 − R.y) · .08)` stopped short of 1 for delayed grains at t = 1 | ramp ends at .92, so every grain arrives |
| 4 | break (18) | heat ended at ~0.5 at t = 1 | `smoothstep(.45, .85, tb) · (1 − smoothstep(.85, 1., tb))` |
| 5 | grow (20) | the inclusion threshold was the rise offset (11.5 at t = 0), so the seed tip was already partly included during the purity hold, and grains at y = 0 only ~95 % at t = 1 | offset stays `11.5 · (1 − grow)`; inclusion uses `mix(12., −.4, grow)`: nothing at t = 0, everything at t = 1 |
| exact ends | all | GPUs evaluate `mix(a, b, 1.)` as `a + (b − a)` and `sin(π · 1.)` as ~1e-7; the camera's lerps and orbit drift the same way. This left a float-level trace at every chapter | blends and arcs return exactly the endpoint at t = 0 and 1 (`blend`, `hump` in `shaders/transitions.glsl`); dive and break return `pa` where their formula mathematically equals it; orbit, look-at and grain-size lerps end exactly on world B. Between the ends every formula is v6's |

There is deliberately no blanket "t = 0 → world A" clamp. It would make the seam check pass
while hiding real traces like the separate sway.

**Positions that now differ from v6, and only these** (the purity → crystal rows also carry
the Phase 2 reframe):

| Parity shot | Diff vs v6 | Cause |
|---|---|---|
| 14 · quarry → furnace midpoint | 0.22 % | fix 4 |
| 37 · quarry → furnace, t = 0.75 | 14.56 % | fix 4 |
| 15 · furnace hold | 50.80 % | fixes 1, 2 |
| 16 · furnace → purity midpoint | 0.04 % | fixes 1–3 |
| 38 · furnace → purity, t = 0.2 | 32.68 % | fixes 1–3 |
| 39 · furnace → purity, t = 0.45 | 0.78 % | fixes 1–3 |
| 40 · furnace → purity, t = 0.75 | 21.59 % | fixes 1–3 |
| 17 · purity hold | 0.16 % | fix 5 |
| 18 · purity → crystal midpoint | 7.35 % | reframe, fix 5 |
| 41 · purity → crystal, t = 0.2 | 23.44 % | reframe, fix 5 |
| 42 · purity → crystal, t = 0.45 | 9.58 % | reframe, fix 5 |
| 43 · purity → crystal, t = 0.75 | 4.92 % | reframe, fix 5 |
| 34 · coast → desert, t = 0.75 | 0.001 % (13 px) | exact ends: grains that have already finished their move sit exactly at rest instead of a float ulp off |

**Cleanup.** Grain styles 1 (fall), 3 (wind), 6 (pour), 7 (heat), 8 (spiral) and the camera
moves fly, pour and heat were removed: no transition used them. With them went the `uAxis`
uniform, which only spiral read. They live in git history.

## Phase 2: v6 behaviour ported as-is (worth knowing)

- **The final chapter's nav label is still "You"** (aria-label "Go to the end"), as in v6;
  only its slug changed to `now`. Display's label follows its new title.
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

## History

- **Commit `2f23bb9` ("Exact rest states") does not typecheck on its own.** Two lines in
  `src/core/loop.ts` call `transitionOverride` and `locateAt`, which only arrive in the next
  commit, `6335f88` ("check:seams"). The history is left as it is (no force push). When checking
  out or bisecting, use `6335f88` or later, or skip `2f23bb9` (`git bisect skip 2f23bb9`).
- Since then a versioned pre-commit hook typechecks and lints the staged state of every commit
  (see the README), so this cannot happen again unnoticed.

## Not verified here
- Visual parity was measured in Chromium only. Firefox passed the console gate and runs
  WebGL2, but no pixel diffs were taken there.
- No physical touch device was used. Tap interactions are ported verbatim but untested on a
  phone.
- Screen-reader behaviour was checked structurally (axe WCAG 2.1 AA: 0 violations; article
  in the tree; one status region) but not listened to with NVDA or Narrator.
- Performance was measured on one machine (i5-12450H, Intel UHD Graphics, 144 Hz panel); see
  the README.
