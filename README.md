# One Grain

A scroll-driven WebGL story about one grain of sand, from magma to the screen you are reading
it on. Fifteen worlds, each a cloud of grains computed on the GPU; scrolling carries the same
grains from one world to the next.

The behavioural spec is `reference/blockout-v6.html` (Phase 2: content v1, clock semantics,
causal transitions), with its rest-state bugs fixed on purpose (Phase 2.1: a transition reproduces
its two worlds exactly at t = 0 and 1). Phase 1 ported `blockout-v5.html`, which is kept alongside. The parity
evidence is in `parity/`, and `docs/parity-notes.md` lists everything that is not identical,
with the reason, including the one intentional change beyond v6.

## Quick start

```sh
npm install
npm run dev          # http://localhost:5173
npm run build        # static site in dist/ (relative paths: upload the folder anywhere)
npm run preview      # serve dist/ locally
npm run typecheck
npm run lint
```

| Check | What it proves |
|---|---|
| `npm run check:data` | The grain data is bit-identical to every reference (v6 and v5) at 90 000 and 36 000 grains per world |
| `npm run parity` | Screenshots of the reference next to the port at every hold, every transition midpoint and three more points in each v6 transition, plus pixel diffs → `parity/` |
| `npm run check:text` | Overlay text and clock state match the reference at every hold and five points in every transition |
| `npm run check:reverse` | Scrolling backwards through drift, break, separate and grow renders exactly what scrolling forwards does |
| `npm run check:seams` | No transition leaves a trace on a resting chapter: the previous transition at t = 1 and the next at t = 0 render byte-identical frames, equal to the hold |
| `npm run check:console` | Zero console warnings or errors in dev and build, Chromium and Firefox |
| `npm run check:a11y` | axe WCAG 2.1 AA, keyboard chapter steps, status line, focus ring, reduced motion, no-WebGL2 and no-JS fallbacks |
| `npm run perf` | Frame times at every position, headed, on this machine's GPU |

**Pre-commit hook.** `npm install` runs the `prepare` script, which points git at the
versioned hooks (`git config core.hooksPath .githooks`). `.githooks/pre-commit` typechecks
and lints the *staged* state, the files as they will be committed, not the working tree, and
blocks the commit if either fails. In a checkout made without `npm install`, run
`npm run prepare` once.

The harness scripts use Playwright. Run `npx playwright install chromium firefox` once.
`parity` and the data gate load the reference, which pulls three r149 and GSAP from CDNs,
so they need network access.

Deploy by uploading `dist/` to any static host. Open it over http(s), not `file://`, because
browsers refuse module workers from `file://`.

## Architecture

```
index.html ──(chapter copy, microcopy)──► ui/copy ─► ui/*  (card, clock, nav, marker, ending, a11y)
                                                        ▲
story/worlds.ts, transitions.ts (typed data)           │ per frame
        │                                               │
        ├─► worlds/* generators ─► sim/build ─► GrainPack ─► render/grains ─► WebGL
        │     (pure, seeded)        (worker)    (versioned)     ▲
        │                                                       │ FrameUniforms
        └─► timeline/segments ─► core/loop ──► camera/shot ─────┘
              (scroll → a,b,t)      ▲   └────► input/*, audio/*, core/tiers
                                    │
                    timeline/scroll (ScrollTrigger scrub + snap)
```

One responsibility per module:

| Folder | Responsibility |
|---|---|
| `src/core` | Renderer and colour setup, render loop (`loop.ts`), fixed clock, resize, quality tiers and the frame-time monitor, environment probes |
| `src/story` | `worlds.ts` and `transitions.ts`: typed data only (slug, act, hold length, clock unit and value, palette, grain size, camera/look offsets; per transition its verb, grain style, camera move, length and hero curve). No logic, no copy |
| `src/worlds` | One generator per world: pure functions of `(context, N)` → typed arrays. `wafer` and `light` derive from the previous world's arrays, in the same grain order |
| `src/sim` | `build.ts` runs the generators in story order and packs the result into a `GrainPack`; `sim.worker.ts` does this off the main thread and transfers the buffers |
| `src/render` | How grains are drawn: the grain material and uniforms, the hero grain, and binding pack layers to textures |
| `src/shaders` | GLSL as raw-imported files: resting behaviours, palette, transition styles, interaction, main, hero/halo |
| `src/camera` | The shot director (bezier flights with per-style handles, orbit, cut, the hold lean, an optional subject to aim at) and the camera rig |
| `src/timeline` | Uneven scroll segments, `locate()`, ScrollTrigger scrub and snap to holds, `#slug` routing, keyboard chapter steps |
| `src/ui` | Clock, chapter card, act label, timeline nav, hero marker, cut card, intro, timed ending, accessibility glue |
| `src/input` | Mouse hover and touch tap state; projecting the pointer onto the scene for the desert and chip holds |
| `src/audio` | The rough three-act sound bed. Off by default; starts only from the visitor's click |
| `src/debug` | URL switches for testing (below) |

**Layering is enforced by ESLint** (`no-restricted-imports` in `eslint.config.js`):

- `worlds/` and `sim/` never import three, the renderer, UI or camera code.
- `render/` never imports `worlds/` or `sim/build`; it consumes only the `GrainPack` type.
- Only `render/` imports GLSL.

### Determinism

The reference draws every random number from one xorshift stream (seed 4242): first the noise
permutation, then each world in story order, then a jittered sort along x after each base
world. The port runs the same stream in the same order, and every generator body is a
line-for-line port, so the result is bit-identical. **Keep it that way:** reordering a single
`rnd()` call, even inside an argument list, changes every world after it. `check:data` will
catch it.

### The GrainPack, and adding data for later phases

`sim/pack.ts` defines the contract between simulation and rendering:

```ts
{ version: 1, n, texWidth: 1024, rows, worlds: 15, heroes: Float64Array, layers: [{ name: 'pos', format: 'rgba32f', data }] }
```

Each layer is one float texture, `texWidth × (rows · worlds)`. World *c*'s grains start at
row `c · rows`, and grain *id* sits at texel `(id % 1024, id / 1024)`. The `pos` layer holds
xyz plus `behaviour + tone` in w.

To add per-grain data such as normals or a material id (Phase 4):

1. Add the layer name to `LayerName` and bump `PACK_VERSION`.
2. Have `sim/build.ts` fill it.
3. In `render/`, sample it as `uLayer_<name>`. `render/bind.ts` binds every layer and defines
   `HAS_LAYER_<NAME>` automatically.

Drawing changes (materials, lighting) stay inside `render/` and `shaders/`, without touching
`sim/` or `worlds/`.

### The frame

`core/loop.ts` does the following each frame:

1. Reads progress (the ScrollTrigger-scrubbed scroll position).
2. `locate()`s it to worlds *a → b* at *t*.
3. Asks `camera/shot` for the camera and the hero grain. While resting, the camera already
   leans towards the next move (up to 0.6 units by the end of the hold); the lean fades out as
   the move runs, so a hold flows into its transition without a seam.
4. Runs listeners in two phases: `camera` (pointer smoothing, before the camera is placed) and
   `scene` (interaction, UI, audio, quality, after it).
5. Hands a `FrameUniforms` object to `render/grains` and draws.

## Content

All words live in `index.html`:

- **Chapters** are semantic `<section data-slug>` elements grouped by act. JS reads them with
  `ui/copy.ts`, which also checks that their order matches `story/worlds.ts`.
- **Micro lines** (a small aside under a chapter's text) are `<p data-micro>` in the section.
- **Clock labels** belong to chapters: `data-clock` (and `data-clock-sub`) on the section.
  The clock means one thing, time elapsed on the grain's journey. *Years* chapters interpolate
  "≈" values on a log scale and may carry a label shown only while resting there ("≈ hundreds
  of thousands"). *Production* chapters always show their label ("Day 1", "Weeks later"…). The
  final chapter shows "Now", and the interlude ("One day,") hides the clock.
- **UI microcopy** (unit names, sound states, nav labels, the status-line format) lives in
  `data-*` attributes on the element that shows it.

No copy is hard-coded in TypeScript; the `?debug` overlay is a developer tool, not copy.

Without WebGL2 or without JavaScript, the article is the page.

## Quality tiers

| Tier | Grains per world | DPR cap | Chosen when |
|---|---|---|---|
| low | 36 000 | 1.5 | window narrower than 760 px, a software or "major performance caveat" GPU, or the texture would not fit |
| mid | 90 000 | 1.75 | default (the reference's desktop setting; the parity baseline) |
| high | 160 000 | 2.0 | discrete GPU (from the renderer string), at least 8 cores and enough memory |

`core/quality.ts` tracks the median frame time in 2 s windows. After two windows in a row
over 25 ms, a one-tier drop is **queued**:

- the new worlds are built in the worker only while the visitor rests on a chapter;
- they are swapped in, together with the new pixel ratio, behind a 250 ms canvas dip, again
  only while resting;
- nothing changes mid-transition.

The tier never goes back up.

Measured with `npm run perf`, headed Chromium, Intel UHD Graphics (i5-12450H laptop,
144 Hz panel):

| Tier and window | Typical frame | Worst position |
|---|---|---|
| mid, 1440×900 | 7.0 ms (vsync-bound at 144 fps) | 13.7 ms (73 fps) |
| mid, 1920×1080 | 7.2 ms | 13.9 ms (72 fps) |
| high, 1920×1080 (for comparison) | 13.8 ms | 20.8 ms; this is why integrated GPUs start on mid |

## Accessibility

- **The semantic article stays in the accessibility tree**, visually hidden. Screen-reader
  users read and navigate every chapter by heading, including the signature link.
- **The visual overlay is `aria-hidden`.** One polite status line announces "*Title. Act,
  chapter n of 15.*" once the visitor settles on a chapter; body text is never read twice.
- **Keyboard:**
  - Timeline buttons are focusable and show a focus ring.
  - Arrow keys and Page Up / Page Down step between chapters.
  - Focus inside an article chapter takes the experience there.
  - Focus on the article's signature link draws the ring on the visible link.
- **`prefers-reduced-motion`:** worlds swap behind a short fade instead of morphing. Resting
  motion, parallax, interactions and the clock punch are off, and chapter jumps are instant.

## URL switches

| Switch | Effect |
|---|---|
| `?tier=low\|mid\|high` | Force a tier (also turns off the automatic drop) |
| `?debug` | Corner readout: tier, grains, DPR, fps, median frame time |
| `?debug&forceDrop` | Act as if the frame budget were blown, to watch a queued drop |
| `?parity` | Let a harness drive progress (`window.__V`) and shader time (`window.__T`), or render a transition point directly (`window.__AT = { tr, t, lean }`); the rendered progress is published as `window.__progress` |
| `?nosnap` | Scrolling does not settle on chapters, so a position mid-transition can be held |
| `#magma` … `#now` | Open at that chapter |
