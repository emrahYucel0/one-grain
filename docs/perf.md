# Performance

## How it is measured

`npm run perf [tier] [width] [height] [extra-query]` opens the built site in headed Chromium
on the machine's default GPU, with `?parity&perf&tier=…`. It visits every hold and every
transition midpoint, then scrubs through the whole story (progress advancing every frame).

- **GPU time per render pass** is the number to compare. Each pass is wrapped in an
  `EXT_disjoint_timer_query_webgl2` TIME_ELAPSED query (`core/gpu-timer.ts`). Results are
  smoothed per pass, and frames the driver marks as disjoint are discarded.
- **The frame interval** (median rAF delta) is reported for context only. It is quantised by the
  display refresh rate: one refresh is 16.7 ms at 60 Hz and 6.9 ms at 144 Hz. A frame interval of
  16.9 ms means "fits in one 60 Hz refresh", not "costs 17 ms".
- Without the timer extension, the script falls back to frame intervals and says so.

The same timings are live in the `?debug` overlay.

## Baseline (Phase 4a, step 0): the v8 pipeline, before any 4a change

Measured 2026-10-03 on the target laptop: i5-12450H, Intel UHD Graphics (ANGLE/D3D11), 144 Hz
panel. Viewport 1920×909, DPR 1, mid tier (90 000 grains per world). Passes: `grains` (the
cloud) and `hero` (the followed grain, drawn on top).

| Position | Frame interval | GPU total | grains | hero |
|---|---|---|---|---|
| hold magma | 7.1 ms | 3.93 ms | 3.87 | 0.06 |
| mid magma | 7.0 ms | 4.32 ms | 4.21 | 0.11 |
| hold granite | 7.1 ms | 4.06 ms | 3.97 | 0.08 |
| mid granite | 7.0 ms | 3.40 ms | 3.34 | 0.06 |
| hold river | 7.1 ms | 3.98 ms | 3.88 | 0.09 |
| mid river | 7.1 ms | 4.44 ms | 4.34 | 0.10 |
| hold coast | 7.1 ms | 4.50 ms | 4.41 | 0.09 |
| mid coast | 7.1 ms | 4.45 ms | 4.39 | 0.06 |
| hold desert | 7.1 ms | 4.05 ms | 3.97 | 0.08 |
| mid desert | 7.1 ms | 4.50 ms | 4.39 | 0.11 |
| hold again | 7.3 ms | 5.16 ms | 5.05 | 0.11 |
| mid again | 7.0 ms | 4.75 ms | 4.75 | 0.00 |
| hold quarry | 7.2 ms | 4.83 ms | 4.78 | 0.06 |
| mid quarry | 7.0 ms | 3.95 ms | 3.86 | 0.09 |
| hold furnace | 7.2 ms | 5.24 ms | 5.16 | 0.08 |
| mid furnace | 7.0 ms | 2.90 ms | 2.83 | 0.07 |
| hold purity | 7.1 ms | 4.57 ms | 4.47 | 0.11 |
| mid purity | 7.0 ms | 4.39 ms | 4.33 | 0.06 |
| hold crystal | 7.0 ms | 3.74 ms | 3.63 | 0.12 |
| mid crystal | 7.0 ms | 3.30 ms | 3.23 | 0.07 |
| hold wafer | 7.0 ms | 3.90 ms | 3.84 | 0.07 |
| mid wafer | 13.6 ms | 5.76 ms | 5.68 | 0.07 |
| hold light | 13.8 ms | 7.41 ms | 7.32 | 0.09 |
| mid light | 7.0 ms | 3.00 ms | 2.94 | 0.06 |
| hold chip | 7.0 ms | 3.38 ms | 3.29 | 0.10 |
| mid chip | 7.0 ms | 3.26 ms | 3.12 | 0.14 |
| hold display | 7.2 ms | 4.75 ms | 4.64 | 0.11 |
| mid display | 7.0 ms | 3.05 ms | 2.98 | 0.07 |
| hold now | 13.7 ms | 5.36 ms | 5.21 | 0.15 |

**GPU total: median 4.32 ms, worst 7.41 ms (light hold).** While scrubbing through the whole
story: median 4.48 ms, worst 8.90 ms.

### What this says about the brief's numbers

The v10 measurements in the brief ("all layers off 16.9 ms", "unlit, no HDR/post 17.4 ms") are
frame intervals from v10's own panel, which averages rAF deltas. 16.9 ms is one refresh at
60 Hz: those configurations fit inside a 60 Hz frame, and their real cost is hidden by the cap.
On the same laptop, the unlit grain draw measures **≈ 4 ms of GPU time at 1920×909**, not 17.
So the budget is not dominated by the base draw. The 4a layers get measured pass by pass below,
as they land.

## Delta 1: the base draw

**Cheap rest path.** At t = 0 or 1 (a uniform), the grain vertex shader fetches one world,
animates and paints it once, and skips the transition. `check:seams` proves it renders exactly
what the full path renders, at t = 1 of the previous transition and t = 0 of the next, for every
chapter.

| Same laptop, mid tier, 1920×909 | GPU total, median of all positions | Worst position |
|---|---|---|
| before (full path everywhere) | 4.32 ms | 7.41 ms (light hold) |
| after (rest path at holds) | 4.66 ms | 7.29 ms (light hold) |

No measurable gain: **the grain draw is not vertex-bound** on this GPU. The path stays, because it
is proven identical and helps where vertex work does dominate (smaller GPUs, phones).

**Point size.** The largest grain is now a uniform (`uPointMax`, 7 px as the reference;
`?pointcap=N` for experiments).

| Point cap | GPU total median | Worst |
|---|---|---|
| 4 px | 3.67 ms | 6.18 ms |
| 7 px (reference) | 4.66 ms | 7.29 ms |
| 9 px (v10's lit cap) | 4.45 ms | 7.44 ms |

Large grains cost little: going from 4 to 9 px moves the median by under 1 ms.

**Overdraw** (`node scripts/overdraw.mjs`: every grain adds 1/32 with no depth test, counted per
pixel on a black clear colour; mid tier, 1920×909):

| Hold | Covered | Mean grains per covered pixel | p95 | Fragments / pixel |
|---|---|---|---|---|
| magma | 21 % | 3.14 | 9 | 0.66 |
| granite | 25 % | 2.93 | 8 | 0.74 |
| river | 29 % | 3.07 | 9 | 0.88 |
| coast | 30 % | 2.52 | 7 | 0.77 |
| desert | 28 % | 3.44 | 11 | 0.96 |
| again | 37 % | 2.35 | 7 | 0.86 |
| quarry | 33 % | 3.84 | 12 | 1.26 |
| furnace | 35 % | 2.79 | 6 | 0.98 |
| purity | 17 % | 2.43 | 6 | 0.41 |
| crystal | 6 % | 3.02 | 7 | 0.17 |
| wafer | 13 % | 5.71 | 18 | 0.72 |
| light | 39 % | 2.91 | 6 | 1.14 |
| chip | 18 % | 1.46 | 3 | 0.26 |
| display | 35 % | 1.97 | 5 | 0.68 |
| now | 56 % | 1.23 | 2 | 0.68 |

That is 0.75 fragments per pixel averaged over the holds, about 1.3 million fragments a frame.
Hot spots (the wafer stack, the quarry walls) reach the 32-grain saturation in places, but fill
is light overall.

**Where the time goes.** Neither vertex work nor fill dominates. The cost scales with the
**number of grains**: the low tier (36 000) measures 2.64 ms median against 4.3 ms for 90 000.
That is about 31 ns per grain plus ~1.5 ms fixed. On Windows, ANGLE draws WebGL points through
Direct3D 11, which has no native point size, so every point is expanded into a quad by
emulation. Per-point cost of that kind is the likely bottleneck.

**Options, if the lit pipeline needs headroom** (not done; numbers above):

- fewer grains: 36 000 saves about 1.7 ms;
- instanced quads instead of points, which avoids the point-sprite emulation; untested here, the
  win is to be measured;
- a lower point cap: 4 px saves about 0.6–1 ms but changes the look.

## Delta 4: lit grains

Same method (mid tier, 1920×909, `?parity&perf`). Shadow and post are not on yet; the grain
shader applies the tone curve itself until the HDR pass exists.

| Run | GPU median | GPU worst (where) | Scrub median |
|---|---|---|---|
| unlit, delta 1 | 4.66 ms | 7.41 ms (light) | — |
| lit | 10.08–10.39 ms | 13.34 ms (light) | 9.41–9.54 ms |
| lit, `?off=light` (lit vertex shader, flat fragment) | 6.09 ms | 8.41 ms (light) | 5.48 ms |
| lit, `?pointcap=7` | 11.63 ms | 14.93 ms (light) | 8.94 ms |

The lit look costs about 5.5 ms of GPU time over the unlit draw:

- about 1.4 ms from the vertex side (the surface fetch, emission, more varyings) and the 9 px
  point cap from v10 (it was 7);
- about 4 ms from the fragment lighting (sphere impostor, key with gloss, hemisphere fill, point
  light, rim, fog), which scales with covered pixels; the light hold, the most covered world, is
  the worst.

Capping points at 7 px does not help (the difference is within run-to-run noise). The cost is
per-fragment shading, not sprite size.

`?off=a,b` switches render layers off for measurements like these; delta 9 turns them into
the debug panel's toggles.
