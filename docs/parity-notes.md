# Parity notes: what could not be matched exactly, and why

Phase 1 is a port of `reference/blockout-v5.html` with no new visuals. This page lists every
place where the port is not byte-for-byte the reference, and why. It also lists what was
verified and how, and what was not verified.

## How parity was measured

| Check | Result | How |
|---|---|---|
| Grain data | **Bit-identical** at 90 000 and 36 000 grains per world | `npm run check:data` compares per-world digests of the packed texture and all 15 hero positions against an instrumented copy of the reference |
| Rendered frames | 29/29 positions (15 holds and 14 transition midpoints) plus 2 interaction shots: all within 0.14 % differing pixels, 28 of 31 under 0.01 % | `npm run parity`: same viewport, grain count, frozen shader time and scroll progress in both pages; real GPU |
| Noise floor | The reference compared with itself: 0.015–0.019 % (0.195 % at the quarry hold) | Same harness, two copies of the reference. The port's residuals are the same size and sit in the same places, so they are capture noise, not port differences |
| Ending sequence | Title at 1.2 s and signature at 5.5 s, the same fade curves | Sampled every 500 ms in both pages |
| Console | 0 warnings or errors | `npm run check:console`: dev and build × Chromium and Firefox, real scrolling through all 29 positions, hash links, sound toggle, resize |

The reference is never edited. The harness serves a patched copy with three hooks: progress
override, time override, and exposing the built texture (`scripts/lib/reference.mjs`).

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
- **Accessibility model.** In the reference, the chapter card itself was the `aria-live`
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
  in both versions. The two hover shots (0.073 % and 0.028 %) differ slightly for that reason.

## Not verified here
- Visual parity was measured in Chromium only. Firefox passed the console gate and runs
  WebGL2, but no pixel diffs were taken there.
- No physical touch device was used. Tap interactions are ported verbatim but untested on a
  phone.
- Screen-reader behaviour was checked structurally (axe WCAG 2.1 AA: 0 violations; article
  in the tree; one status region) but not listened to with NVDA or Narrator.
- Performance was measured on one machine (i5-12450H, Intel UHD Graphics, 144 Hz panel); see
  the README.
