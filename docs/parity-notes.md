# Parity notes: what could not be matched exactly, and why

The port follows a behavioural spec: `reference/blockout-v5.html` in Phase 1,
`reference/blockout-v6.html` in Phase 2 (content, clock semantics, four new transitions, new
camera moves), with v6's rest-state bugs fixed on purpose in Phase 2.1, and
`reference/blockout-v8.html` in Phase 3 (typography, confinement, stage colour per act,
reworked drift, break and grow, the final dramaturgy), `reference/v10-lit.html` for the look in
Phase 4a, and `reference/v15-lit.html` since Phase 4b (look per world, type and HUD, clock, pacing,
hero grain, and a new final). The generators of worlds 0–13 have not changed since v5; the final
world is new in v15.
This page lists every place where the port is not the reference, and why. It also lists what
was verified and how, and what was not.

## How parity was measured

| Check | Result | How |
|---|---|---|
| Grain data | **Bit-identical**: worlds 0–13 to v15, v10, v8, v6 and v5; the final world (new in v15) to v15. At 90 000 and 36 000 grains per world, positions, hero positions and (v10, v15) surface normals | `npm run check:data` compares per-world digests of the packed texture, every hero position and the normals against an instrumented copy of each reference; each reference is the baseline only for the worlds it defines |
| Rendered frames vs v15 (since Phase 4b; v10 in 4a, v8 until Phase 3) | 42/42 compared positions within 2 %: 0.46 % at most (crystal hold), most under 0.1 %. "Become" (display → now) at t = .2 / .4 / .55 / .7 / .85: 0.02–0.10 %; the final hold at 1.5 s and 15 s: 0.001–0.002 %. The purity → crystal reframe (4 positions, 6.5–7.6 %) differs on purpose. v15's layer panel and version label are hidden in the reference for the captures; the display's live clock counts on its own in each page. Strict counts are high everywhere (lighting and post move many pixels by one level) and are not compared | `npm run parity`: 15 holds, 14 transition midpoints, 2 interaction shots, t = .3 / .55 / .8 in drift, break and grow, five points of "become", the final chapter at 1.5 s and 15 s; same viewport, grain count, frozen shader time and scroll progress in both pages; CSS transitions fast-forwarded; real GPU |
| Rest states | All identical, byte for byte: for chapters 2–14, the previous transition at t = 1 equals the next at t = 0, which equals the hold as scrolled into and, with the hold's lean, the hold screenshot; the rest path equals the full path at both ends; and the final hold (its first instant) equals the end of "become" | `npm run check:seams` (the live clock and the time spent in a hold pinned: `window.__LIVE`, `window.__FT`) |
| Text and clock vs v15 | 85/85 positions identical: clock value (the live count normalised), sub-line, unit class, label state, interlude hiding, title, body, micro line. v15's copy is v8's | `npm run check:text`: every hold and t = 0.1 / 0.3 / 0.5 / 0.7 / 0.9 in every transition, matched by (world, t); the port's frame is awaited through its published progress |
| Reverse scrub | 15/15: scrolled backwards, drift, break, separate, grow and become at t = 0.2 / 0.45 / 0.75 render exactly as scrolled forwards (at most 0.05 %, same settled progress) | `npm run check:reverse`: real scrolling through ScrollTrigger, snapping off |
| Fonts | No layout shift when the web fonts arrive late (CLS 0.0000 with fonts held back 1.5 s; without the font gate the same load shifts); the wdth axis renders (a probe word measures 802 px at magma's 118.5 % and 507 px at crystal's 62 %) | `npm run check:fonts`, on the built site; title crops in `parity/fonts/` |
| Quality tiers | A forced drop is queued mid-transition and swapped (90 000 → 36 000 grains) only once resting | `npm run check:tiers` |
| Noise floor | The reference compared with itself: 0.015–0.019 % (0.195 % at the quarry hold), measured in Phase 1 with both pages in one window | Since Phase 2 each page has its own window (a background tab has its frames throttled), and the residuals are gone: 0.000 % everywhere, including the hover shots |
| Ending sequence | v8: "Now", the sentence at 1.2 s, the End colour from 4 s to 8 s, the footnote at 8.5 s. The port matches, except that its signature also waits for 8.5 s (below) | Sampled every second in both pages |
| Console | 0 warnings or errors | `npm run check:console`: dev and build × Chromium and Firefox, real scrolling through all 29 positions, hash links, sound toggle, resize |

The reference is never edited. The harness serves a patched copy with three hooks: progress
override, time override, and exposing the built texture (`scripts/lib/reference.mjs`).

## Phase 5: the sound (reference v23)

`reference/v23-sound.html` is v15 plus the sound engine, the sound button's behaviour and two CSS
rules (the HUD above the rail, a tighter rail on short screens, so the rail no longer swallows the
sound button's clicks). The port takes exactly those; the rough Phase 1 bed is gone.

Measured against v23 with analysers on its music and ambience buses (the harness exposes its sound
state), 20 s windows at the holds where the ambience should lead:

| Hold | Port: ambience over music | v23: ambience over music |
|---|---|---|
| magma | 3.1 dB | 3.2 dB |
| river | 5.1 dB | 5.1 dB |
| desert | 8.2 dB | 9.0 dB |
| furnace | 2.9 dB | 4.3 dB |
| coast (three 15 s windows) | 2.4 / 8.1 / 6.4 dB | 4.3 / 4.9 / 6.2 dB |

The coast is slow random swells, so short windows spread widely in both; the music matches within
0.3 dB everywhere.

Where the port does not copy the file:

- **Off is silent within 0.3 s.** v23 glides the master towards 0 (time constant .2 s, so 8 % is left
  after half a second). The port ramps linearly to exactly 0 in 0.3 s and stops scheduling.
- **The remembered choice and the button.** v23 switches sound on at a returning visitor's first
  pointerdown, and if that gesture is a click on the sound button, its click handler switches it
  straight back off. The port leaves a gesture on the button to the button.
- **No scheduler timer while off.** v23's 50 ms timer runs from the first enable on; the port's runs
  only while sound is on.

## Phase 4b: reference v15, and where the port differs from the file

Since Phase 4b, `reference/v15-lit.html` is the reference for everything: look, text and clock,
pacing, the final. Positions of worlds 0–13 are still checked against every earlier reference too.
Where the port does not copy the file:

- **Chapter links land on their chapter.** v15 sorts the new "One day," scroll stop into the list
  its chapter links index, so from Quarry on every link lands one chapter early (`#display` lands on
  Chip). The port keeps the scroll stops (`SCROLL_SNAP`, holds plus the cut) apart from the chapter
  points (`SNAP_POINTS`, one per chapter) that the rail, hash links and keys use.
- **Chapter jumps snap exactly.** With v15's scrub of 1.6 s, ScrollTrigger's directional snap
  carries a jump on to the next chapter (it measures velocity on the lagging scrubbed progress). A
  jump the port makes itself (keys, rail, hash, focus) snaps to its target; free scrolling keeps
  GSAP's directional snap.
- **The square-pixel stage is deleted**, not left unreachable as in v15 (`uLast = -1`).
- **The marker's `!important`.** v10 pinned the ring's opacity with `opacity:.95 !important`, and the
  port had copied it; v15 removed it. Without it the ring fades as designed.
- **"River cyan −12 %"** is v15's water colour (behaviours 1–2), not the river's palette.
- **Exact ends for the macro camera.** At t = 0 and t = 1 it returns the resting cameras exactly
  (v15 lerps twice, which can land a float step off).
- **Frame pacing** (`?pacing`, default off) and the main-thread changes of Phase 4b (type axes on
  the title and clock, the stage colour on body and scrim, the clock's punch through the Web
  Animations API) have no counterpart in v15. They change no pixel; see docs/perf.md.

## Phase 4a: intentional changes to text and clock

In Phase 4a, `reference/v10-lit.html` was the reference for the look (lighting, colour, post), and
positions, text and clock, seams and reverse scrubbing were measured against v8 (since Phase 4b,
text and clock are measured against v15, which includes both changes below).

- **Clock rounding: one significant figure below a million (v10).** The clock between two dates
  reads "≈ 300,000", not v8's "≈ 340,000". Two figures suggested precision that isn't there.
  Whole millions are unchanged. `check:text` applies the same rounding to the v8 page
  (`INTENTIONAL` in `scripts/text-parity.mjs`), so any other clock difference still fails.

- **Dark only (v10).** The light stage set and the light CSS variables are gone. The page declares
  `color-scheme: dark` (meta and CSS) and looks the same whatever the system preference (checked
  byte for byte at three positions). v8 followed the system preference; the parity runs have always
  used the dark scheme. `check:a11y` (axe, contrast included) passes on the dark set.

## Phase 3: differences from v8

v8 already contains the Phase 2.1 rest-state fixes, so those no longer show up as differences.
What remains is listed here. Every other compared position is identical to v8 on the strict count.

| Parity shot | Diff vs v8 (perceptual / strict) | Cause |
|---|---|---|
| 18, 38, 39, 40 · purity → crystal (midpoint, t = 0.3, 0.55, 0.8) | 2.05–2.77 % / 5.4–11.0 % | the Phase 2 reframe: pool centred, crystal followed up (below) |
| 41 · final chapter at 2 s | 0.06 % / 0.11 % | the signature waits for 8.5 s with the footnote. In v8 the rule `.chapter.final p:not(.micro)` ties in specificity with `.chapter.final:not(.sig) p` and comes later, so its signature shows from the first second (verified on a v8 render); the brief puts both at 8.5 s |
| 13 · quarry hold | 0 % / 0.007 % | exact ends: break at t = 0 returns the resting grain itself; v8 computes bc + (pa − bc), a float ulp off |
| 14, 35, 36, 37 · quarry → furnace (midpoint, t = 0.3, 0.55, 0.8) | 0 % / 0.002–0.006 % | exact ends: once a block's crack completes, the port's arc is 0, v8's sin(3.14159)·.4 ≈ 1e-6 (a colour factor of 1 + 2.6e-7) |
| 20, 22, 26 · crystal → wafer, wafer → light, chip → display midpoints | 0 % / 0.001–0.003 % | exact ends: grains that have finished their move sit exactly at rest |
| 23 · light hold | 0 % / 0.003 % | exact ends: the hold renders the dive at t = 0, which returns the resting grain itself |
| 29 · final chapter at 11 s | 0 % / 0.023 % | exact ends: at reveal 1 the screen is exactly the sand image (`blend`, not `mix`) |

Implementation differences that do not show at any compared position:

- **No hysteresis on lens and type axes.** v8 updates the lens only when it moves more than 0.01°,
  and the type axes beyond 0.2 / 1. The port updates on every change (uScale follows the lens).
  What is shown then depends only on where the story is, forwards or backwards, which
  `check:reverse` and `check:seams` require. At every compared position the two agree; a
  lens change costs 0.18 µs.
- **Confinement is interpolated per derived value.** Lens, type axes and jitter are linear in
  the confinement value, so interpolating each (as v8 does) is the same as interpolating the value
  itself, and bit-identical to v8.
- **`--stage` is written by truncation**, as three r149 in the reference does (current three
  rounds). Mid-transition an interpolated channel can land just under an integer; rounding left the
  scrim gradient one level off over a fifth of the frame.
- **Fonts are self-hosted.** Their metric-matched fallback faces cover exactly the web fonts'
  unicode-range, so a glyph the fonts lack ("≈") falls through to the system font, as in v8. The
  experience's text waits for the fonts (at most 3 s), so nothing visible reflows when they arrive.
- **The act label is removed from the DOM**, where v8 hides it with `display: none`.
- **The fallback article** (no WebGL2) uses the same type system, with the micro lines at full
  muted colour instead of the overlay's 0.62 opacity, for AA contrast on a plain page.

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

## Phase 2.1: rest-state fixes (intentional deviations from v6; since folded into v8)

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

**Positions that differed from v6 in Phase 2.1, and only these** (the purity → crystal rows also carry
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
- **Low** (36 000 grains, DPR cap 1.25, no shadows, no depth of field) is v10's small-screen
  setting. **Mid** (90 000, 1.4, every layer) is its desktop setting and the parity baseline.
  Until Phase 4a the caps were v5–v8's 1.5 and 1.75; v10 lowered them because post costs per
  pixel. **High** (160 000, 1.75) is new, so it has no reference to match. Its cap came down
  from 2.0 for the same reason. The reference chose between small and desktop only
  by `innerWidth < 760`. The port also drops to low on a software or "major performance
  caveat" GPU, and starts on high only with a discrete GPU, at least 8 cores and enough
  memory.
- **A tier drop changes the grain layout.** The single random stream depends on the grain
  count, so 36 000 grains are not a subset of 90 000. That is also true in the reference
  (small vs desktop). The swap happens only while resting on a chapter, behind a 250 ms fade.
- **The adaptive downgrade is new in Phase 4a** (v10 has a manual layer panel and a benchmark,
  no automatic downgrade). It switches off depth of field, then shadows, then drops to the next
  tier's grains, one step per warm-up and only while resting. v10's `.fx` panel becomes the
  `?debug` panel's toggles.

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
- **Sound** uses `Math.random` for its noise, its event times and its note choices, as v23 does,
  so no two runs sound the same. Levels are compared statistically (`check:audio`; against v23
  with long windows, below), not sample by sample.
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
