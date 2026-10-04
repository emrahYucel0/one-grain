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
| Touch targets | Sound button ~20 px high, rail ticks 3–22 px | Sound button 44×44 px; rail buttons 44 px wide (height: see decisions) |

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

## Needs a design decision (screenshots in the sheets above)

1. **The rail on phones.** Under 720 px wide the rail shows ticks only, and its buttons are 3–6 px
   tall (22 px on tablets). They are 44 px wide now, but 15 chapters at 44 px do not fit a phone's
   height. Options:
   - only the three acts as targets on phones;
   - the progress line (as on short screens) on all phones, perhaps as a scrubber;
   - spread the ticks over the full height (about 30 px each at 667 px);
   - keep it as a position indicator only (scrolling, keys and the article navigate).
2. **The landscape phone picks the mid tier.** 844×390 starts with 90 000 grains, because the tier
   follows the window width (760 px). Phones in landscape could start on low (for example by the
   shorter side, or touch with a short side under 500 px).
3. **21:9 framing.** With the clamp, wider screens crop top and bottom. Some worlds now have empty
   ground in the lower part (river, desert, chip; see the 2560×1080 sheet). Each world's framing
   (look offset) could be tuned for very wide screens.
4. **The pixel budget at DPR 1.** On large DPR-1 screens the budget also applies: 2560×1080 renders
   2283×963 (0.89×), upscaled. Alternative: never go below DPR 1 (2.76 MP at 2560×1080).

## Not verifiable here

Real iOS and iPadOS Safari, real Android Chrome, Apple Silicon. Chromium's mobile emulation has no
browser bars: it resizes vh with the window, so the bar check tests that ScrollTrigger keeps its
mapping and nothing rebuilds, not Safari's own viewport behaviour. A check on real devices is
recommended before launch.
