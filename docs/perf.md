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
