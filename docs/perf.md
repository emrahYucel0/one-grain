# Performance

> **Phase 6d:** the runtime downgrade, its frame monitor and the frame-pacing lock described in the
> older sections below are gone. The tier is now picked once from the device and never changes,
> and a normal visit measures nothing (README, Quality tiers). GPU timing remains a development
> tool (`?perf`, `?debug`, `npm run perf`, `npm run perf:frame`). The numbers below stay as the
> record of what was measured.

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

## Delta 5: shadow map

1024² depth map from the key light, refreshed every other frame, 4-tap PCF in the grain shader.
Same method; GPU total counts the shadow pass at its full cost, so it is the cost of a frame that
refreshes the map (the frames in between are about 3 ms cheaper).

| Position | GPU total | shadow | grains | hero |
|---|---|---|---|---|
| hold magma | 13.49 ms | 3.14 | 10.29 | 0.07 |
| hold granite | 13.12 ms | 3.04 | 9.99 | 0.09 |
| hold river | 12.94 ms | 3.04 | 9.82 | 0.08 |
| hold coast | 14.96 ms | 3.05 | 11.83 | 0.08 |
| hold desert | 12.93 ms | 3.18 | 9.68 | 0.07 |
| hold again | 17.56 ms | 3.04 | 14.41 | 0.10 |
| hold quarry | 15.26 ms | 3.08 | 12.12 | 0.06 |
| hold furnace | 16.51 ms | 3.01 | 13.42 | 0.08 |
| hold purity | 14.65 ms | 2.98 | 11.56 | 0.11 |
| hold crystal | 11.96 ms | 3.03 | 8.82 | 0.11 |
| hold wafer | 11.57 ms | 3.15 | 8.36 | 0.07 |
| hold light | 19.87 ms | 3.42 | 16.36 | 0.09 |
| hold chip | 10.66 ms | 3.00 | 7.57 | 0.10 |
| hold display | 15.47 ms | 3.03 | 12.32 | 0.12 |
| hold now | 18.59 ms | 3.03 | 15.42 | 0.15 |

GPU total: median 13.58 ms, worst 19.87 ms (light). Scrub median 14.08 ms (worst 20.08).

- The shadow pass is about 3 ms whatever the world: it draws all 90 000 points into a small map,
  so it is the per-point cost again (about 33 ns a point), not fill.
- Sampling the map (4 taps per fragment) adds about 1–3 ms to the grain pass, more where grains
  cover more of the screen (light 13.3 → 16.4 ms).
- Before post, the light hold is already over the 16.7 ms budget on a refreshing frame. The
  options with numbers are collected after delta 6, once every layer is in.

## Per-grain lighting (before delta 6)

A grain is at most 9 px wide, and grains overlap, so per-pixel lighting and shadow taps repeated
the same work across every pixel of a grain. That work now happens once per grain, in the vertex
shader:

- the shadow lookup (4 samples, at the grain's centre);
- the point light, its specular, emission and fog;
- the light vectors (surface normal, half vector and view vector) in camera space.

The fragment shader keeps only the sphere. v10's shading normal is
`normalize(.62 n + .55 sw)`, where `sw` is the sprite's sphere normal. With the vectors already in
camera space, every N·X is `(.62 n·X + .55 sw·X) / |N|`, which takes a few dot products and one
inversesqrt. So key, sky/ground fill, specular, rim and the edge darkening keep v10's exact
per-pixel shape.

Same method as above (mid tier, 1920×909, Intel UHD Graphics through ANGLE/D3D11). The two runs
are on the same day.

| Position | Before: GPU total | Before: grains | After: GPU total | After: shadow | After: grains |
|---|---|---|---|---|---|
| hold magma | 15.41 ms | 11.81 | 10.23 ms | 3.37 | 6.80 |
| hold granite | 13.21 ms | 10.04 | 10.82 ms | 3.22 | 7.51 |
| hold river | 13.32 ms | 10.20 | 9.91 ms | 3.20 | 6.64 |
| hold coast | 15.41 ms | 12.24 | 12.41 ms | 3.34 | 9.00 |
| hold desert | 12.93 ms | 9.79 | 10.47 ms | 3.28 | 7.12 |
| hold again | 17.39 ms | 14.21 | 12.70 ms | 3.07 | 9.53 |
| hold quarry | 16.45 ms | 12.80 | 10.87 ms | 3.08 | 7.73 |
| hold furnace | 17.80 ms | 13.97 | 11.71 ms | 3.18 | 8.45 |
| hold purity | 14.77 ms | 11.65 | 10.36 ms | 3.03 | 7.22 |
| hold crystal | 11.36 ms | 8.17 | 9.36 ms | 3.25 | 5.99 |
| hold wafer | 11.74 ms | 8.45 | 8.75 ms | 3.15 | 5.53 |
| hold light | 19.46 ms | 15.95 | 14.00 ms | 3.52 | 10.40 |
| hold chip | 10.98 ms | 7.85 | 9.02 ms | 3.07 | 5.84 |
| hold display | 15.30 ms | 12.14 | 11.49 ms | 3.02 | 8.35 |
| hold now | 18.69 ms | 15.52 | 12.36 ms | 3.03 | 9.19 |

GPU total, before → after:

- median 14.96 → 10.72 ms;
- worst 19.46 → 14.00 ms (light);
- scrub median 14.41 → 10.63 ms.

The grain pass median goes from 11.81 to 7.51 ms. The shadow pass does not change.

Variants measured on the way:

| Variant | GPU median | Light hold | Look vs the old per-pixel shader (pixels that differ, perceptual) |
|---|---|---|---|
| **chosen: exact sphere, 4 shadow samples per grain** | 10.72 ms | 14.00 ms | desert 0.00 %, chip 0.00 %, magma 0.15 %, crystal 0.33 %, light 2.2 % (point-light specular is per grain) |
| exact sphere, 1 shadow sample per grain | 10.09 ms | 13.49 ms | desert 5.4 %: shaded troughs turn binary, with more grains fully dark |
| linear sphere term (fixed-length N), 1 sample | 9.56 ms | 12.49 ms | light 10 %: the wafer loses its sphere shading and gets a white specular dot in every grain |

- **Shadow samples.** The old shader read the shadow map at the grain's centre too (its varying is
  constant across a point sprite), so its 4-tap PCF was already a per-grain 4-sample average. One
  sample makes it binary, which is visible on the desert. Four samples in the vertex shader cost
  about 0.4 ms. Going back to one sample is a one-line change in `shadowAt()`.
- **Rest path in the shadow pass.** The shadow variant shares `uRest` and skips colour, normals
  and emission (`#ifndef SHADOW`). Forcing the full path changes the pass by at most 0.3 ms:
  3.0–3.5 ms at rest against 3.1–3.7 ms forced. The pass is bound by drawing the points (ANGLE emulates point
  sprites), not by vertex maths.

### Grain count (not changed; for the decision)

`?grains=N` overrides the tier's count for measurements. Each count was measured with the same
method and the current shaders (no post yet).

| Grains per world | GPU median | Worst (light hold) | Scrub median | Shadow pass | Grain pass, light hold |
|---|---|---|---|---|---|
| 36 000 (low tier) | 6.58 ms | 8.45 ms | 6.60 ms | 2.3–2.5 | 5.08 |
| 60 000 | 8.28 ms | 12.80 ms | 8.46 ms | 2.7–2.9 | 7.77 |
| **90 000 (mid tier, current)** | 10.72 ms | 14.00 ms | 10.63 ms | 3.0–3.5 | 10.40 |
| 120 000 | 13.17 ms | 17.54 ms | 13.16 ms | 3.5–4.3 | 13.20 |

Every 30 000 grains cost about 2–2.5 ms at the median and about 3 ms at the light hold. The
shadow pass fits a fixed part of about 1.7 ms plus about 17 ns per grain. The mid tier stays at 90 000 until it is decided. These numbers come back in the budget
report after delta 6, next to point size and DPR.

## Delta 6: HDR target and post

The grains and the hero grain now render into a half-float target with a depth texture, cleared to
the linear stage colour. The post chain (v10) follows:

- **bloom:** a bright pass into quarter resolution, then blurred, copied down to eighth resolution
  and blurred again;
- **dof:** half resolution, 12 taps, focused on the camera → hero distance;
- **composite:** depth of field, bloom, the shoulder tone curve, vignette, film grain, display
  gamma.

The grain shader no longer tones its own output (`DIRECT_OUTPUT` is gone). The hero grain is 2.4×
white, so it blooms. The overdraw view still draws straight to the screen.

Same method: mid tier, 1920×909, every layer on. GPU total counts the shadow pass at its full
per-refresh cost.

| Position | GPU total | shadow | grains | hero | bloom | dof | composite |
|---|---|---|---|---|---|---|---|
| hold magma | 14.03 ms | 3.07 | 4.47 | 0.05 | 1.15 | 2.88 | 2.42 |
| hold granite | 14.02 ms | 3.00 | 4.55 | 0.05 | 1.14 | 2.87 | 2.42 |
| hold river | 14.28 ms | 3.00 | 4.81 | 0.05 | 1.12 | 2.88 | 2.42 |
| hold coast | 14.77 ms | 3.02 | 5.24 | 0.05 | 1.14 | 2.88 | 2.43 |
| hold desert | 14.60 ms | 3.00 | 5.09 | 0.05 | 1.15 | 2.90 | 2.42 |
| hold again | 16.63 ms | 3.36 | 6.55 | 0.05 | 1.23 | 2.94 | 2.50 |
| hold quarry | 15.98 ms | 3.53 | 5.73 | 0.05 | 1.19 | 2.85 | 2.62 |
| hold furnace | 14.56 ms | 3.03 | 5.13 | 0.05 | 1.14 | 2.80 | 2.40 |
| hold purity | 13.83 ms | 2.93 | 4.46 | 0.05 | 1.14 | 2.85 | 2.40 |
| hold crystal | 13.84 ms | 3.03 | 4.37 | 0.05 | 1.13 | 2.87 | 2.40 |
| hold wafer | 14.17 ms | 3.13 | 4.60 | 0.05 | 1.12 | 2.85 | 2.41 |
| hold light | 16.20 ms | 3.39 | 6.47 | 0.05 | 1.15 | 2.74 | 2.40 |
| hold chip | 13.95 ms | 2.95 | 4.53 | 0.05 | 1.13 | 2.90 | 2.40 |
| hold display | 14.39 ms | 2.99 | 4.92 | 0.05 | 1.15 | 2.87 | 2.42 |
| hold now | 14.79 ms | 3.02 | 5.22 | 0.05 | 1.15 | 2.91 | 2.44 |

GPU total: median 14.77 ms. Worst 17.91 ms, at the coast → again midpoint. Scrub median 14.66 ms
(worst 15.90).

Back-to-back runs on this integrated GPU drift by up to about 1 ms, even in passes nothing touched.
Comparisons below therefore use interleaved A/B runs (`scripts/_ab.mjs`, a scratch tool): two
pages, one frozen while the other renders, alternating at desert, light, chip and again, median of
12 samples each.

### Cost per effect

| Effect | GPU time | How measured |
|---|---|---|
| bloom (bright pass, 2-level blur) | 1.15 ms | its own pass |
| depth of field, half resolution | 2.88 ms | its own pass |
| composite, tone curve only | 1.72 ms | `?off=dof,bloom,grade` |
| + depth-of-field mix and bloom add in the composite | +0.40 ms | composite without grade: 2.12 ms |
| + vignette and film grain | +0.30 ms | composite with everything: 2.42 ms |

Post costs about 6.5 ms in all. Depth of field is the most expensive single effect: 2.9 ms plus
0.2 ms of its mix in the composite.

The grain pass got cheaper (desert 7.12 → 5.09 ms, light 10.40 → 6.47 ms), because the HDR target
has no MSAA. The canvas has; v10 creates it with `antialias: true`. Turning that off is
pixel-identical (only the fullscreen composite lands on the canvas), but it was not faster: the
composite measured 2.68–2.69 ms without MSAA against 2.42–2.51 ms with it, in both A/B orders.
The canvas keeps MSAA.

### Option: every other grain in the shadow pass (measured, not adopted)

`?shadowstride=2` draws every second grain id into the shadow map (the same grains each frame).
`&shadowgrow=1.414` additionally grows their discs to keep the map's coverage.

| Shadow pass, A/B | GPU time per refresh |
|---|---|
| every grain | 3.69 ms |
| every other grain | 2.69 ms |
| every other grain, discs ×1.41 | 2.74 ms |
| 1 grain (fixed cost) | 1.78–1.90 ms |
| shadows off | — (the grain pass grows from 5.76 to 6.76 ms) |

- **Saving:** 1.0 ms on a refreshing frame. The map refreshes every other frame, so that is about
  0.5 ms per frame on average.
- **Look against every grain** (share of pixels that differ, perceptual; strict counts every
  changed byte):

  | Hold | Every other grain | Discs ×1.41 | No shadows at all |
  |---|---|---|---|
  | desert | 1.51 % | 1.37 % | 14.25 % |
  | chip | 0.01 % | 0.02 % | 0.02 % |

  In-focus crops at 2× look the same, with a few shaded grains marginally lighter. Chip hardly
  uses its shadows at all.
- **The fixed part is mostly not shadows.** With shadows off, the grain pass grows by 1.0 ms
  although it no longer samples the map. About 1 ms of work is left over at the start of each
  frame (the previous frame's present, presumably, on ANGLE/D3D11), and it lands in whichever
  pass is timed first. The shadow pass's own fixed cost is about 0.5 ms; drawing 90 000 grains
  into the map costs about 1.9 ms.

### Where the budget stands (mid tier, 1080p, every layer on)

The median of 14.8 ms is inside 16.7 ms. The again and light holds (16.2–16.6 ms) are at the
limit, and the busiest midpoints (coast → again 17.9 ms) are over it on frames that refresh the
shadow map. The levers, with their measured size:

| Lever | Saves | Cost to the look |
|---|---|---|
| depth of field off | about 3.1 ms | no focus falloff (v10 drops it on small screens) |
| every other grain in the shadow pass | 1.0 ms per refresh, about 0.5 ms per frame | desert 1.5 % of pixels, barely visible |
| 30 000 fewer grains (90 000 → 60 000) | about 2–2.5 ms median, about 3 ms at the light hold (measured before post) | thinner worlds |
| bloom off | about 1.2 ms | no glow on emissive matter or the hero |
| vignette and film grain off | about 0.3 ms | flatter frame |

The tiers and the adaptive downgrade (delta 9) build on this table.

## Before delta 7: half-grain shadow pass by default, raw frame times

**Every other grain casts shadows** (`?shadowstride=2` is now the default; `?shadowstride=1` restores
every grain for measurements). The look cost is above: desert 1.5 % of pixels, chip 0.01 %.

**Raw frame times.** The GPU timer now also keeps the last 240 frames as measured
(`window.__gpu.recent`), and `npm run perf` reports two raw medians:

- *GPU frame*: the median of whole frames;
- *refresh*: the median of the frames that also redraw the shadow map, the expensive ones.

The old "GPU total" added up per-pass averages. That overstated refresh frames by 1–2 ms: the
frame-start overhead (about 1 ms) was counted in the shadow pass and, half the time, in the grain
pass as well.

Refresh frames at the worst positions (`scripts/_refresh.mjs`, a scratch tool), 120 frames each,
settled. Both columns were measured in the same session:

| Position | Every grain | Every other grain |
|---|---|---|
| hold again | 14.72 ms | 14.09 ms (p95 14.29) |
| hold light | 14.58 ms | 13.76 ms (p95 13.97) |
| coast → again midpoint | 14.36 ms | 13.79 ms (p95 14.03) |

A full `npm run perf` afterwards, in the GPU's slower state (frame interval 20.8 ms, the shadow pass
3.7–4.0 ms instead of 2.4), still keeps every position under 16.7 ms:

- refresh frames: median 15.02 ms, worst 15.93 ms (desert → again midpoint);
- all frames: median 14.41 ms;
- scrub: refresh-frame p95 15.79 ms.

Isolated single frames still reach about 17 ms, on non-refresh frames too.

**Composite: the depth of field's own circle of confusion (tried, not kept).** The DOF pass
writes its circle of confusion to alpha at half resolution, so the composite could skip its depth
read. Interleaved A/B runs:

| Composite variant | GPU time | Look against the full-resolution depth read |
|---|---|---|
| full-resolution depth read (kept) | 2.42–2.44 ms | — |
| half-resolution circle of confusion | 2.18 ms | in-focus grains against blur get soft edges and dark fringe pixels (chip 0.19 % of pixels, perceptual) |
| half resolution, depth read only where `fwidth` of it exceeds 0.03 (about 10 % of pixels) | 2.88–2.90 ms | the same as the full read (chip 0.002 %) |

The depth read is one cached fetch and costs less than the derivative and branch that would avoid
it. The composite keeps v10's full-resolution read.

## Point light: specular per pixel again (found by the v10 parity run)

The new parity baselines against v10 turned up the furnace hold at 4.95 % of pixels. The cause was
the per-grain point light. Its specular, evaluated once with the shading normal at the sprite's
centre, lit whole grains where v10 draws a small highlight per pixel; the furnace is lit mostly by
its point light. The earlier before/after check (magma, crystal, desert, chip, light) had missed
it.

The specular is per pixel again, by the same exact-sphere method as the key. To keep the number
of per-point outputs flat, which on ANGLE's point sprites costs as much as the maths, two things
changed: the rim takes the camera's axis as the view vector, and the scalars share one vec4.

| Variant | Grain pass (A/B against the previous build) | Look against v10, every grain casting shadows |
|---|---|---|
| previous build (point light per grain) | — | furnace 4.95 %, light 1.20 %, crystal 0.49 % |
| diffuse and specular per pixel (12 more floats per point) | +1.7 ms | everything at most 0.03 % |
| diffuse per pixel only | +0.3 ms | furnace 4.68 % (the specular is the cause) |
| **specular per pixel, rim on the camera axis, packed (kept)** | +0.15 to +0.67 ms (two runs, both orders) | furnace 0.05 %, crystal 0.48 %, wafer → light 0.27 %, everything else at most 0.03 % |

Refresh frames at the worst positions afterwards (same session):

| Position | Every other grain casts shadows (default) | Every grain |
|---|---|---|
| hold again | 14.61 ms (p95 14.77) | 15.25 ms (p95 15.43) |
| hold light | 14.18 ms (p95 14.90) | 15.04 ms (p95 15.17) |
| coast → again midpoint | 13.90 ms (p95 14.07) | 14.54 ms (p95 14.72) |

## Phase 4a, final (every grain casts shadows again)

Every other grain in the shadow pass lightened the shadows of scattered clouds mid-transition: 3.7–12.2 % of pixels against
v10 at four transition midpoints, against at most 0.03 % with every grain. Every grain is the default again;
`?shadowstride=2` stays for measurements.

`npm run perf`, mid tier, 1920×909, every layer on, Intel UHD Graphics (ANGLE/D3D11):

| | Median | Worst (where) |
|---|---|---|
| GPU frame, 15 holds and 14 midpoints | 14.15 ms | 15.21 ms (desert → again midpoint) |
| shadow-refresh frames, same positions | 14.41 ms | 15.41 ms (desert → again midpoint) |
| scrub through the story, GPU frame | 13.52 ms | p95 16.39 ms |
| scrub through the story, refresh frames | 14.39 ms | p95 16.78 ms |

Per pass, typical: shadow 3.0–3.4 ms (per refresh; it includes about 1 ms of frame-start overhead), grains 4.4–6.3, hero
0.05, bloom 1.15, depth of field 2.85, composite 2.43.

Every standard position is inside 16.7 ms, refresh frames included. Scrubbing reaches the budget at its p95, and single
frames spike to 17–18 ms. The levers, if a machine needs them, are in the delta 6 table. The adaptive downgrade uses the
first two (depth of field, then shadows) before it touches the grain count.

The frame interval in these runs was 20.8 ms (48 fps) while the GPU needed about 14 ms, so something other than the GPU set
the pace on this machine during the measurement (earlier the same day it was 13.9 ms).

## Phase 4b, baseline: frame cost and cadence (before any change)

`npm run perf:frame` (`scripts/frame-cost.mjs`). Same machine (Intel UHD, 144 Hz panel), built
unminified so the trace names functions, mid tier, 1920×909. Each position is measured twice:

- untraced, for the cadence and the GPU (tracing slows the page);
- with a Chrome trace of the main thread, split per frame into script, style, layout and paint.

The refresh interval is measured on a blank page: 6.9 ms (145 Hz).

| Position | Frame interval | Cadence (refreshes per frame) | Main thread median / p95 | GPU frame median / p95 |
|---|---|---|---|---|
| hold magma | 20.8 ms (sd 4.6) | 2×27 % 3×64 % 4+ 9 % | 1.13 / 1.89 ms | 13.64 / 14.40 ms |
| hold granite | 20.7 ms (sd 3.4) | 2×35 % 3×64 % | 1.07 / 1.72 ms | 13.41 / 13.71 ms |
| hold desert | 20.7 ms (sd 3.3) | 2×28 % 3×71 % | 1.09 / 1.67 ms | 13.90 / 14.25 ms |
| hold again | 20.8 ms (sd 3.6) | 2×17 % 3×73 % 4×10 % | 1.00 / 1.58 ms | 15.11 / 15.45 ms |
| hold crystal | 20.7 ms (sd 3.8) | 2×40 % 3×57 % | 1.01 / 1.52 ms | 13.21 / 13.46 ms |
| hold light | 20.8 ms (sd 3.4) | 2×21 % 3×74 % | 1.10 / 1.65 ms | 14.90 / 15.17 ms |
| hold now | 20.8 ms (sd 3.2) | 2×22 % 3×75 % | 1.12 / 3.33 ms | 14.33 / 14.56 ms |
| all 15 holds | 20.7–20.8 ms (sd 3.2–4.6) | 2× 17–40 %, 3× 57–75 % | 0.95–1.13 ms | 11.98–15.11 ms |
| scroll-through (wheel, ScrollTrigger) | 20.8 ms (sd 8.3, p95 34.9) | 1×12 % 2×21 % 3×46 % 4×11 % 5+ 10 % | 1.67 / 15.60 ms (max 38) | 13.74 / 15.84 ms |

What it shows:

- **Holds: the main thread is not the problem.** It needs about 1 ms per frame. The GPU frame
  (12–15 ms) sits at the two-refresh boundary (13.9 ms), so frames alternate between 2 and 3 refreshes
  (13.9 and 20.8 ms). That alternation is the judder.
- **Scroll-through: layout is.** 150 frames carry more than 13.9 ms of main-thread work. Their
  Layout touches only 10–16 of 204 objects but takes 5–13 ms: every new width/weight value is a new
  variable-font instance to shape (title and clock, `--wdth/--wght` on `:root`). ScrollTrigger's
  `_onScroll` also forces a 5–6 ms layout after the frame's style writes (74 forced layouts in the
  run).

## Phase 4b, delta 10: frame pacing

`npm run perf:frame`, same machine and settings as the baseline above. The cadence comes from the
timestamps of **rendered** frames (`window.__renderT`): the pacer may skip refreshes, so rAF
timestamps alone would not show it.

### Main thread: before and after

| | Before delta 10 (after the Phase 4b look changes) | After |
|---|---|---|
| holds, main thread per frame (median) | 0.67–1.22 ms | 0.69–1.20 ms |
| scroll-through, main thread median / p95 / max | 1.15 / 10.64 / 35.3 ms | 1.05 / **2.77** / 32.6 ms |
| scroll-through, frames with more than 13.9 ms of main-thread work | 71 | **15** |
| scroll-through, layout in a slow frame | 5–13 ms (title and clock font instances) | gone; ScrollTrigger's scroll handler still forces a ~3 ms layout now and then |

What changed:

- **`--wdth/--wght`** are written on the chapter and clock elements, not on `:root`. They are
  quantised (width in 1 % steps, weight in steps of 10), and the title's only while it is visible.
- **The stage colour** goes straight to the body and the scrim, instead of `--stage` on `:root`,
  which restyled the whole document every frame of a move between acts.
- **The marker** caches the viewport size on resize instead of reading `innerWidth` after the
  frame's writes, writes its transform only when it changes, and has its own layer.
- **Unguarded writes are guarded** (canvas, cut card, intro, marker label).
- **The clock's punch** is replayed with the Web Animations API instead of restarting a CSS
  animation through `void el.offsetWidth` (a forced layout). That also fixes `className` wiping the
  `hide` class in the cut.
- **No GPU readout** (and no per-frame allocation) without `?perf` or `?debug`.

The remaining slow frames show almost no named work in the trace; they look like the main thread
waiting on a busy GPU.

### Cadence at the holds: the GPU decides

At the holds the main thread needs under 1.3 ms. The GPU frame is 12.6–15.2 ms, at the boundary of
two refreshes (13.9 ms). Without a lock, frames alternate:

| Hold | Cadence, no lock | sd |
|---|---|---|
| magma | 2×13 % 3×67 % 4×18 % | 4.2 ms |
| again | 2×13 % 3×78 % 4×9 % | 3.2 ms |
| crystal | 2×34 % 3×64 % | 3.5 ms |
| light | 2×12 % 3×62 % 4×23 % | 4.7 ms |
| now | 2×17 % 3×77 % 4×6 % | 3.3 ms |

A steady 72 fps (every frame within 13.9 ms) would need the GPU frame 1.5–2 ms shorter at the
heavier holds. The options for that (depth of field, bloom, fewer grains, every other grain
casting shadows) are in the delta 6 and Phase 4a tables, and all of them weaken the look, so none
is adopted.

### Option: the pacing lock (`?pacing=off|on|auto`, `core/pacing.ts`; default auto since Phase 6a)

- **Refresh:** measured from rAF while the worlds build.
- **When it engages (auto):** only when frames mostly take three refreshes or more and at least
  15 % come in faster. 60 Hz and 120 Hz displays, where frames fit in one or two refreshes, never
  engage it.
- **What it skips:** only rendering. Scroll input (GSAP's own ticker) keeps every refresh.
- **Re-evaluation:** the lock is released on resize, a quality step and a tab switch, rises one
  step if most frames of a second miss it (at most every 4th refresh), and is re-tested by a probe:
  one unlocked second every ten.

| Hold | auto: cadence (lock to 3) | sd |
|---|---|---|
| magma (no probe in the window) | 3×100 % | **0.1 ms** |
| again, crystal, light, now (a probe in the window) | 3× 66–89 %, 2× 7–33 % | 2.6–3.7 ms |
| scroll-through | 3×57 %, spread as without a lock | 9.3 ms (9.0 without) |

- **Between probes:** the lock gives an exactly steady 48 fps at the holds (sd 0.1 ms instead of
  3–5 ms).
- **The probe:** while it runs (1 s in 10), the old alternation is back.
- **Moving:** the lock does not help. Frame cost varies too much while moving.

To get the steadiness without the probe judder, the lock could be re-tested with the GPU timer
where the browser has it (Chrome on desktop) and with probes only elsewhere. That is a decision,
so the default stays off.

## Phase 4b, final timings

`npm run perf`, mid tier, 1920×909, every layer on, every grain casting shadows, pacing off.
"Become" is sampled at five points; the final hold carries the new sand surface (grain .085).

| | Median | Worst (where) |
|---|---|---|
| GPU frame, 15 holds, 14 midpoints, 5 points of "become" | 14.50 ms | 15.48 ms (become t = .85) |
| shadow-refresh frames, same positions | 15.07 ms | 16.19 ms (desert → again midpoint, become t = .85) |
| final hold | 14.82 ms (refresh 15.24 ms) | — |
| "become", t = .2 / .4 / .55 / .7 / .85 | 14.48–15.48 ms (refresh 14.93–16.19 ms) | — |
| scroll-through, GPU frame | 14.25 ms | p95 16.29 ms |
| scroll-through, refresh frames | 15.06 ms | p95 16.96 ms |

Every standard position is within 16.7 ms, refresh frames included. While scrolling, the refresh
frames' p95 is at the budget (16.96 ms). The frame interval is 20.8 ms throughout (see delta 10 for
the cadence and the pacing lock).

A first run of the same measurement, straight after the parity run, showed 28–48 ms frame intervals
at the same GPU times, plus one corrupted shadow sample (5031 ms in the smoothed column). Repeated
runs (`perf:frame`, then this one) show 20.8 ms, so that run was disturbed and is not reported.

## Phase 5: the sound's main-thread cost

The sound runs on the audio thread, except for the per-frame mapping (story → buses, chords,
gates) and the 50 ms event scheduler, which create the event nodes. `check:audio` counts both
during a scroll through the whole story and back with sound on (32 s):

- per-frame mapping 3.2 ms per second;
- event scheduling 2.5 ms per second;
- about 43 audio nodes created per second on average (the river's 75 bubbles a second, three nodes
  each, are the busiest).

That is about 0.1 ms per frame at 48 fps. `npm run perf:frame` with `SOUND=1` (the sound switched on
first) against without, same build:

| | Sound off | Sound on |
|---|---|---|
| river hold, main thread median / p95 | 0.84 / 1.34 ms | 1.11 / 1.91 ms |
| coast hold | 0.77 / 1.15 ms | 1.00 / 1.71 ms |
| furnace hold | 0.84 / 1.30 ms | 0.94 / 1.51 ms |
| scroll-through, main thread median / p95 | 1.15 / 3.18 ms | 1.34 / 3.81 ms |
| GPU frame and cadence | unchanged | unchanged |

## Phase 6a: pixel budget, timings at DPR 2

The drawing buffer is capped by total pixels per tier (low 1.5 MP, mid 2.2 MP, high 4.5 MP). At
1512×982 and 1920×1080, both at DPR 2:

| Tier | 1512×982 @2 | 1920×1080 @2 |
|---|---|---|
| low | 1519×987, GPU 5.5 ms | 1632×918, 5.7 ms |
| mid | 1840×1195, 16.7 ms (refresh 16.9) | 1977×1112, 16.2 ms (refresh 16.4) |
| high | 2632×1709, 32.6 ms | 2828×1590, 32.0 ms |

Details and the design questions: docs/responsive/README.md.

## Phase 6a: mid-tier headroom (shadows every 3rd frame at rest adopted; DOF stays at half resolution)

`?debug` on this laptop showed GPU frames of 13.7–19.3 ms at mid. Two options, behind measurement
switches only (`?dofres=4`, `?shadowevery=3`; the defaults are unchanged): depth of field at
quarter resolution instead of half (the taps keep their half-resolution spacing, so the blur radius
is the same), and the shadow map refreshed every 3rd frame while resting (every 2nd during
transitions, as now). Mid tier, 1920×909, built site, the four configurations interleaved per
position over two rounds, 3 s of raw GPU frames each (`EXT_disjoint_timer_query_webgl2`):

| Position | Config | GPU mean / frame | Shadow-refresh frames | Other frames | DOF pass |
|---|---|---|---|---|---|
| magma | base | 13.51 ms | 14.50 ms | 12.48 ms | 2.78 ms |
| magma | DOF ¼ | 13.00 ms | 14.01 ms | 11.95 ms | 2.29 ms |
| magma | shadows every 3rd | 13.11 ms | 14.51 ms | 12.46 ms | 2.80 ms |
| magma | both | 12.68 ms | 14.03 ms | 11.98 ms | 2.31 ms |
| desert | base | 13.28 ms | 14.21 ms | 12.11 ms | 2.93 ms |
| desert | DOF ¼ | 12.90 ms | 13.73 ms | 11.75 ms | 2.49 ms |
| desert | shadows every 3rd | 12.95 ms | 14.20 ms | 12.14 ms | 2.94 ms |
| desert | both | 12.51 ms | 13.74 ms | 11.68 ms | 2.50 ms |
| chip | base | 13.30 ms | 14.29 ms | 12.30 ms | 2.92 ms |
| chip | DOF ¼ | 12.84 ms | 13.85 ms | 11.85 ms | 2.47 ms |
| chip | shadows every 3rd | 12.99 ms | 14.33 ms | 12.32 ms | 2.92 ms |
| chip | both | 12.53 ms | 13.83 ms | 11.85 ms | 2.48 ms |
| final (15 s) | base | 13.44 ms | 13.97 ms | 12.04 ms | 2.95 ms |
| final (15 s) | DOF ¼ | 12.87 ms | 13.52 ms | 11.53 ms | 2.50 ms |
| final (15 s) | shadows every 3rd | 13.07 ms | 14.01 ms | 12.03 ms | 2.95 ms |
| final (15 s) | both | 12.55 ms | 13.53 ms | 11.58 ms | 2.51 ms |

- **DOF at quarter resolution** saves about 0.45 ms on every frame (the pass goes from 2.8–2.95 to
  2.3–2.5 ms: it is not bound by its output size; most of its cost is reading the full-resolution
  colour and depth). The worst frames (shadow refresh) drop by the same 0.45 ms.
- **Shadows every 3rd frame at rest** save about 0.35 ms per frame on average (a third of the frames
  instead of half carry the ~2 ms refresh) but not on the worst frames, which still refresh.
- **Both:** about 0.85 ms on average (6 %), 0.45 ms on the worst frames.
- **Looks** (100 % crops, docs/perf/headroom/: [magma](perf/headroom/magma.jpg),
  [desert](perf/headroom/desert.jpg), [chip](perf/headroom/chip.jpg), [final](perf/headroom/final.jpg)):
  quarter-resolution DOF makes the out-of-focus areas a little softer and blockier (most visible in
  magma's background and desert's far dunes); in-focus grains are unchanged. Shadows every 3rd frame
  show no difference in a still; any difference would be a shadow lagging matter by one more frame
  while it moves. The crops differ slightly in position (pointer parallax per page). Pixel-diff
  percentages are not given: the film grain changes every frame, so two pages differ by 8–40 %
  whatever the setting.
- The 13.7–19.3 ms seen in `?debug` includes transitions and the light and furnace holds; at these
  four holds the GPU frame is 12–14.5 ms here.
- **Decision:** shadows refresh every 3rd frame at rest by default (`render/shadow.ts` SHADOW_EVERY;
  every other frame while the story moves); depth of field stays at half resolution. `?shadowevery`
  and `?dofres` remain for measurements.

## Phase 7: skies, the loupe, the light chapter's pattern

`npm run perf` on main and on the branch, the same machine (i5-12450H, Intel UHD Graphics, 144 Hz panel),
1920×909, headed Chromium, built site. "Interval" is the median frame interval (the panel shows a frame
every 6.9 ms, so 20.8 ms is every third refresh, 27.7 ms every fourth); "GPU" is the median GPU frame.

| Position | mid, main: interval / GPU | mid, branch | high, main | high, branch |
|---|---|---|---|---|
| hold granite | 20.7 / 11.91 ms | 20.8 / 13.07 ms | 20.9 / 14.89 ms | 21.0 / 16.24 ms |
| granite → river | 20.8 / 14.63 ms | 20.9 / 17.22 ms | 21.0 / 19.06 ms | 27.7 / 21.63 ms |
| hold river | 20.8 / 12.36 ms | 20.8 / 13.52 ms | 21.0 / 15.33 ms | 21.0 / 16.43 ms |
| river → coast | 20.8 / 15.08 ms | 21.0 / 17.85 ms | 27.4 / 19.32 ms | 27.8 / 22.10 ms |
| hold coast | 20.8 / 12.86 ms | 20.9 / 15.46 ms | 21.0 / 16.00 ms | 27.7 / 18.52 ms |
| coast → desert | 20.8 / 14.79 ms | 21.0 / 17.28 ms | 21.1 / 19.24 ms | 27.7 / 21.69 ms |
| hold desert | 20.8 / 12.41 ms | 20.8 / 13.51 ms | 20.9 / 15.14 ms | 20.9 / 16.33 ms |
| hold again | 20.8 / 13.41 ms | 20.9 / 14.53 ms | 21.1 / 16.80 ms | 27.6 / 17.73 ms |
| hold quarry | 20.8 / 12.96 ms | 20.9 / 14.26 ms | 20.9 / 15.75 ms | 27.5 / 17.12 ms |
| hold wafer | 20.8 / 12.04 ms | 20.8 / 12.77 ms | 20.9 / 14.99 ms | 20.9 / 15.79 ms |
| hold light | 20.8 / 12.89 ms | 20.8 / 12.93 ms | 20.9 / 15.96 ms | 21.0 / 16.05 ms |
| hold display | 20.8 / 12.53 ms | 20.8 / 13.20 ms | 20.9 / 15.36 ms | 21.0 / 16.12 ms |
| all positions | median 14.25, worst 15.54 ms GPU; interval 20.8 | median 14.60, worst 17.85; interval 20.8, worst 21.0 | median 18.62, worst 20.19; interval 21.0 | median 18.84, worst 22.10; interval 27.5 |
| scrub through the story | GPU 13.19 (p95 15.50); interval p95 27.7 | GPU 14.39 (p95 17.51); p95 27.8 | GPU 16.70 (p95 20.21); p95 28.0 | GPU 17.95 (p95 21.91); p95 28.1 |

The passes (raw medians, mid): the sky 0.3 ms at a quarter of the resolution (the timer also puts about
1 ms of the previous frame's work into it, as it does into whichever pass comes first) plus 0.8 ms to
stretch it over the pixels no grain covers; the loupe 0.6 ms (wafer, display) to 1.1 ms (granite) and
1.4 ms (coast) at rest, 1.3–1.9 ms in transitions; the pattern costs nothing measurable (light hold
12.89 → 12.93 ms).

- **Mid (this laptop's tier):** every position keeps its cadence (a frame every third refresh, as on
  main); the GPU frame grows by up to 2.8 ms where the sky and the loupe meet (river → coast).
- **High** is the tier for discrete GPUs and Apple Silicon; on this Intel UHD it is only forced for the
  measurement. It was already at the edge on main (several positions at 27.5 ms); on the branch most of the
  loupe's and the sky's positions drop to every fourth refresh.
- **Getting there:** the first versions cost the sky 4.5 ms and the loupe up to 7.9 ms (coast 21.4 ms GPU,
  a frame every 27.8 ms at mid); the commits "Skies and the loupe within the frame budget on an integrated
  GPU" and "The loupe marches a quarter of its blocks a frame in transitions" list each step.
- **Compile:** the loupe's program links in 1.1–1.4 s on this GPU (Chromium, Firefox; v27's structure:
  7.5 s), after the first frame: in parallel in Chromium and Safari, in an idle moment in Firefox.

### Phase 7 review: river → coast, Firefox's compile

**River → coast** (the worst position, mid tier, Intel UHD, 1920×909). Measured as paired, interleaved
runs on one build, the sky and loupe layers on and off (`?off=sky,loupe` takes the cost back to main's),
because the GPU was not quiet (another browser drew ~10 % of it) and absolute times drifted by a
millisecond between runs:

| | before (7907a18) | after |
|---|---|---|
| GPU frame at the river → coast midpoint, features on | 17.85 ms | 16.30 ms (three runs: 16.29, 16.35, 16.30) |
| the same build with `?off=sky,loupe` | — | 15.35–15.44 ms in the same sessions (main measured 15.08 ms on a quiet GPU) |
| what the sky and the loupe add (paired) | 2.8 ms | about 0.9 ms (whole-frame A/B: sky 0.4, loupe 0.6) |

- **Sky:** no longer copied into the HDR target at full resolution (0.8 ms); drawn at a sixth of the
  resolution and added by the post passes where no grain is.
- **Loupe:** on an integrated GPU a small lens costs the length of one pixel's march, not its pixel count
  (a sixteenth of the pixels cost as much as a quarter), so in a transition it is marched at half the
  resolution, a quarter of its blocks a frame, with 28 steps instead of 72; below 55 % opacity (the middle
  of a transition) without surface detail or refraction, which fade back in up to 85 %.
- **Result:** the frame interval at river → coast stays at every third refresh (20.9 ms), as on main; the
  GPU frame is about 0.9 ms over main's. Measured here it is 16.3 ms, not under 16; with main's 15.1 ms on
  a quiet GPU the estimate is about 16.0 ms.
- **High** (forced on this GPU, for measurement only): median GPU frame 19.75 ms, interval 27.6 ms (main:
  18.62 ms, 21.0 ms); high is the tier for discrete GPUs and Apple Silicon.

**Firefox's compile** (no KHR_parallel_shader_compile; built site, fresh profile each run, three runs,
1440×900):

| | scene ready (median) | longest frame in the 8 s after |
|---|---|---|
| before: the loupe compiled in an idle moment 3 s after the scene | 4.8 s | 2.5 s (2.4–2.9 s freeze on the first screen) |
| after: compiled during the loader | 5.7 s (+0.9 s) | 70 ms |
| for reference: `?off=loupe` | 4.1 s | 69 ms |
