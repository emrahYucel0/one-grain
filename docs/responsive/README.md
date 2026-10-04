# Responsive pass (Phase 6a)

Contact sheets of the built site, headed Chromium on this laptop's GPU (Intel UHD), every chapter
hold plus display → now at t = .3 and .7, the tier picked as on a real visit:

| Viewport | Device emulation | Before | After |
|---|---|---|---|
| 360×800 | phone, touch, DPR 3 | [before](before/phone-360x800.jpg) | [after](after/phone-360x800.jpg) |
| 375×667 | phone, touch, DPR 3 | [before](before/phone-375x667.jpg) | [after](after/phone-375x667.jpg) |
| 390×844 | phone, touch, DPR 3 | [before](before/phone-390x844.jpg) | [after](after/phone-390x844.jpg) |
| 430×932 | phone, touch, DPR 3 | [before](before/phone-430x932.jpg) | [after](after/phone-430x932.jpg) |
| 844×390 | phone landscape, touch, DPR 3 | [before](before/phone-844x390-landscape.jpg) | [after](after/phone-844x390-landscape.jpg) |
| 744×1133 | tablet, touch, DPR 2 | [before](before/tablet-744x1133.jpg) | [after](after/tablet-744x1133.jpg) |
| 820×1180 | tablet, touch, DPR 2 | [before](before/tablet-820x1180.jpg) | [after](after/tablet-820x1180.jpg) |
| 1180×820 | tablet landscape, touch, DPR 2 | [before](before/tablet-1180x820.jpg) | [after](after/tablet-1180x820.jpg) |
| 1024×1366 | tablet, touch, DPR 2 | [before](before/tablet-1024x1366.jpg) | [after](after/tablet-1024x1366.jpg) |
| 1512×982 | MacBook 14, DPR 2 | [before](before/desktop-1512x982.jpg) | [after](after/desktop-1512x982.jpg) |
| 1728×1117 | MacBook 16, DPR 2 | [before](before/desktop-1728x1117.jpg) | [after](after/desktop-1728x1117.jpg) |
| 1920×1080 | desktop, DPR 1 | [before](before/desktop-1920x1080.jpg) | [after](after/desktop-1920x1080.jpg) |
| 2560×1080 | 21:9, DPR 1 | [before](before/desktop-2560x1080-21x9.jpg) | [after](after/desktop-2560x1080-21x9.jpg) |

Regenerate with `npm run responsive <label> [viewport]`; check with `npm run check:responsive`.

## Fixes

| Issue | In the port before? | Fix |
|---|---|---|
| a. Rail over the clock and sound button on short screens | Yes (844×390) | Below 560 px high the rail is a thin progress line at the right edge, clear of the top 96 px; its buttons come back while focused (keyboard) |
| b. Clock crowding narrow phones | Yes (≤ 430 px wide) | Under 480 px: years 1.4rem, a chapter label 1rem, production 1.6rem, "Now" 2.4rem; at most two lines, right-aligned |
| c. Clock hard to read on bright scenes | Partly (quarry, furnace) | A top scrim in the stage colour behind the HUD on every chapter (70 %, fading over 20vh), on top of the text shadow |
| d. World edges at 21:9 | Yes (river's end, quarry's edges) | Past 2:1 the horizontal field of view holds its 2:1 value: wider screens crop top and bottom |
| e. Ring away from the grain | **No**: within 0.07 px at all 179 holds before any change | Automated in `check:responsive`; the ring is now placed through the canvas's own box (which matters on mobile, where the visible viewport and the canvas differ) |
| Apple Silicon | Started on mid | "Apple M…" / "Apple GPU" on a Mac (not an iPad) with ≥ 8 cores starts on high |
| Pixel budget | 2116×1374 at 1512×982 @2 (2.9 MP on mid) | low 1.5 MP, mid 2.2 MP, high 4.5 MP, whatever the DPR |
| Mobile browser bars | A bar resized the canvas and refreshed ScrollTrigger | Canvas sized to the largest viewport (lvh), dynamic units for the scrims; height-only resizes under 120 px rebuild and refresh nothing (ScrollTrigger's own rule only ignores changes under 25 %, less than a landscape phone's bar) |
| Touch targets | Sound button ~20 px high, rail ticks 3–22 px | Sound button 44×44 px; rail buttons 44 px wide on tablets and desktops (phones: no buttons, see decisions) |

## Timings at DPR 2 (pixel budget in effect)

`npm run perf` with `DPR=2`, this laptop (Intel UHD, ANGLE/D3D11):

| Tier | 1512×982 @2 | 1920×1080 @2 |
|---|---|---|
| low (36 000 grains, 1.5 MP) | buffer 1519×987 · GPU frame median 5.5 ms (worst 6.2) · 13.8 ms frames | buffer 1632×918 · 5.7 ms (6.3) · 13.8 ms |
| mid (90 000, 2.2 MP) | buffer 1840×1195 · 16.7 ms (18.8), refresh frames 16.9 ms · 21 ms frames | buffer 1977×1112 · 16.2 ms (17.8), refresh 16.4 ms · 21 ms |
| high (160 000, 4.5 MP) | buffer 2632×1709 · 32.6 ms (45.1) · 42 ms frames | buffer 2828×1590 · 32.0 ms (35.5) · 42 ms |

- **Mid:** at 2.2 MP this GPU is at its 16.7 ms budget. At 1920×909 @1 (1.75 MP) the same tier ran
  at 14.5 ms.
- **High:** this machine never starts on high (its GPU is integrated), so the high numbers only show
  the cost of 4.5 MP and 160 000 grains on a GPU this size.
- **Without the budget:** 1512×982 @2 would render 2.9 MP on mid, 32 % more pixels.

A first run of these measurements came right after the 15-minute matrix, with the GPU throttled
(mid 29–30 ms at both sizes). Re-measured once it had recovered; those numbers are above.

## Decisions (after the first report)

The "after" sheets above include these.

1. **The rail on phones: an indicator only.** On touch phones (coarse pointer, narrower than 720 px
   or shorter than 560 px) the rail is the thin progress line at the right edge, with a faint mark
   where one act gives way to the next (the middle of the transition between them), and no buttons.
   Phones navigate by scrolling; screen readers keep the article (the emptied nav is aria-hidden
   there). Short screens without touch keep the line and the marks, and their buttons come back
   while focused. Tablets keep the rail with 44 px wide buttons.
2. **Tier by device.** The starting tier follows the screen's shorter side (under 760 px: low), so
   844×390 starts on low, like the same phone upright. The tier is picked once per visit; turning a
   phone or resizing the window never changes it (checked on every phone viewport). A desktop window
   narrower than 760 px no longer starts on low by itself.
3. **21:9: one global rule.** Past 2:1 the camera's look target goes down in proportion to
   (aspect − 2): by (aspect − 2)/2 of the visible half-height, which keeps the 2:1 frame's bottom edge
   (nearly) where it was, so the crop comes from the top. 2560×1080, clamp only vs. look lowered:
   [before](21x9/before-clamp-only.jpg) · [after](21x9/after-look-lowered.jpg).
   - Better: crystal, wafer and purity sit lower with their bases in view; magma shows more of its
     crystals.
   - Worse: river, desert and quarry move up and leave more empty ground below them (the empty
     lower areas from the first report grow); quarry, the furnace's electrodes and the light column
     are cut at the top.
   - Per-world tweaks not made: waiting for a decision.
4. **Pixel budget.** On high the budget never takes the pixel ratio below 1 (a 4K screen at DPR 1
   renders all 8.3 MP; Retina screens still come down to the budget, not below DPR 1). Low and mid
   are unchanged (2560×1080 on mid: 2283×963).

## Found on the way

With the lowered look target the ring sat about 100 px below the grain at 21:9, while
`check:responsive` still passed. three.js's `lookAt` refreshes the camera's world matrix before it
turns the camera, so after the second `lookAt` every projection that frame (the ring and the
check's `window.__hero`) used the view before the turn. `frameShot` now refreshes the matrix at the
end, and the check measures the ring against `window.__heroRendered`, the grain projected after
rendering through the matrices the frame was drawn with, so it no longer shares the loop's path.

## Not verifiable here

Real iOS and iPadOS Safari, real Android Chrome, Apple Silicon. Chromium's mobile emulation has no
browser bars: it resizes vh with the window, so the bar check tests that ScrollTrigger keeps its
mapping and nothing rebuilds, not Safari's own viewport behaviour. A check on real devices is
recommended before launch.
