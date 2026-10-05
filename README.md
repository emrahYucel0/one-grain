# One Grain

A scroll-driven WebGL story about one grain of sand, from magma to the screen you are reading
it on. Fifteen worlds, each a cloud of grains computed on the GPU; scrolling carries the same
grains from one world to the next.

The behavioural spec is `reference/blockout-v8.html` (Phase 3: typography, art direction through
confinement, stage colour per act, reworked drift, break and grow, the final dramaturgy). Earlier
phases ported `blockout-v5.html` and `v6`, which are kept alongside. The port keeps its exact
transition endpoints (a transition reproduces its two worlds exactly at t = 0 and 1). Phase 1 ported `blockout-v5.html`, which is kept alongside. `npm run parity`
writes the evidence to `parity/` (only the reference captures in `parity/ref/` are tracked; the
port's captures, the diff masks, `index.html` and `checklist.md` are per-run output), and `docs/parity-notes.md` lists everything that is not identical,
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
| `npm run check:fonts` | No layout shift when the web fonts arrive (on the built site, fonts held back 1.5 s), and the wdth axis really renders |
| `npm run check:tiers` | The downgrade is queued mid-transition, applied only while resting, in order (depth of field, shadows, grains); the low tier's layers; the debug panel's toggles; with simulated loads: no step during the warm-up, none for an external slowdown, back up once the load is gone, no oscillation, and the three-window rule without the GPU timer |
| `npm run check:console` | Zero console warnings or errors in dev and build, Chromium and Firefox |
| `npm run check:a11y` | axe WCAG 2.1 AA, keyboard chapter steps, status line, focus ring, reduced motion, no-WebGL2 and no-JS fallbacks |
| `npm run check:load` | First load, dev and production: the first paint (script held back) hides the article and shows only the stage, brand and loading line; so does every frame until the scene arrives; the line fills forward; no layout shift; reduced motion without fades. Screenshots → `parity/load/` |
| `npm run check:responsive` | Across 14 viewports: the hero ring on the grain at every hold (≤ 2 px), 44 px touch targets, the pixel budget, a mobile browser bar changing nothing, and the tier picked per device class |
| `npm run responsive [label]` | Contact sheets of the built site at every hold across phones, tablets and desktops → `docs/responsive/<label>/` |
| `npm run check:audio` | Sound: nothing before the visitor asks; the button clickable at 900×560 and 1440×700; exact silence in the "One day," cut and after the final landing (and sound again after scrolling back); ambience above the music where it should be; peaks below −6 dBFS; off within 0.5 s; hidden tab suspends; the remembered choice; no console noise both ways |
| `npm run perf` | Frame times at every position and while scrubbing through the whole story, headed, on this machine's GPU |

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
| `src/audio` | The sound (v23): `engine` (context, buses, limiter, room, noise), `score` (pads, notes, motif, pulse), `ambience` (primitives, the water rush, the event scheduler), `frame` (the story → the sound, per frame), `toggle` (the button). Its data is `story/sound.ts`. Off by default; nothing is created before the visitor asks |
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
5. Hands a `FrameUniforms` object to `render/grains`, then `render/pipeline` draws the passes:
   - the key light's shadow map (every other frame);
   - grains and the hero grain into a half-float HDR target;
   - bloom, half-resolution depth of field focused on the hero, and the composite (shoulder
     tone curve, vignette, film grain, display gamma).

   Each pass is timed on the GPU with `?perf`; `docs/perf.md` has the numbers.

## Art direction

**Type.** Two variable families, self-hosted:

- Archivo (wdth 62–125, wght) carries the interface and the clock.
- Newsreader (opsz, roman and italic) carries the narrative: chapter body, micro lines, clock
  unit words, the intro line, the "One day," interlude.

Every type value is a custom property in one `:root` block at the top of `styles/main.css`.
Inside a chapter the order is title, body, micro, hint. The act label is gone; the rail carries
the act. The experience's text waits for the fonts (`ui/fonts.ts`, at most 3 s), and
metric-matched local fallbacks keep sizes close if they are late.

**Confinement.** One value per chapter, 0 natural … 1 controlled (`conf` in
`story/worlds.ts`). Nature fills the frame; industry concentrates matter until the crystal stands
alone; computation opens the space again; the end fills your screen. Through
`camera/confinement.ts` it drives:

- the lens, 48° → 30° (+9° in portrait); uScale follows every change;
- the camera distance, keeping each blockout composition under its lens, then the `frame`
  factor;
- the resting jitter, (1 − c) · 0.022;
- the title and clock axes, wdth 125 − 63c and wght 380 + 250c (the weight only compensates, v15).

All of it is interpolated through transitions with the camera's easing. Colour is not driven by
it.

**Stage colour.** One per act (Nature, Industry, Now, End), dark only as in v10
(`story/stages.ts`), eased between acts. Fog, the HDR clear colour and `--stage` stay in sync
(`core/stage-colour.ts`). The page declares `color-scheme: dark` and ignores the system
preference.

**The ending.** "Become" (display → now, 2.8 screens): the camera pushes in to macro, the
sub-pixels' light goes out, the glass vanishes, every sub-pixel cluster spreads into the area it lit
and turns into sand, and the camera pulls back; "Now" reaches the clock at 74 % of the move. In the
final hold the sentence comes in at 0.4 s; the grain we followed hovers, loses its light from 3 to
5.6 s and lands among the other grains from 5 to 6.4 s, after which it cannot be told apart; the
signature and footnote come in at 8 s. Under reduced motion the grain becomes matte in place.
Focusing the signature link from the keyboard jumps straight to the end state.

## First load

The first paint is the stage: the critical styles are inline in `index.html` (stage background,
no native scrollbar, the article visually hidden, HUD and words hidden), so neither the article nor
a scrollbar can flash before the stylesheet, which the dev server injects through the script. Then
the loader (`ui/loader.ts`): the brand where the HUD will show it and a thin line that the worker's
progress fills, one step per generated world. The first rendered frame sets `html.ready` and the
loader fades away in 0.6 s, so the scene and its words fade in together; under reduced motion the
line fills without animation and the loader goes at once. Without JavaScript or WebGL2 there is no
loader: the article is the page.

## Capture (the submission video)

`npm run capture -- [1920x1080|2560x1440] [--path capture/path.json] [--seconds a-b]` renders the
video offline, one frame at a time, from the built site in capture mode (`?capture`, `src/capture/`):

- **The path** (`capture/path.json`, editable; `--list` prints its timeline): seconds on each
  chapter (`hold`, `holds`), the pace of each move (`scroll` seconds per screen height of the
  story's track, `moves` per chapter), rests in the middle of a move (`rests`: the "One day," card
  for 2.5 s), the intro and the final hold. Moves ease like the scroll snap. The final hold's
  timeline (the light going out, the landing, the silence) runs at real-time pace.
- **Hands-on holds without hints.** Capture mode hides the interaction hints; an invisible scripted
  cursor (`cursor`: keys of seconds and normalised device coordinates per chapter, a smooth curve
  through them) hovers across the desert's dunes, which part around it, and the chip, whose
  switches light up. It steers the camera's pointer parallax at half strength.
- **Deterministic.** The page runs on a virtual clock that the script advances 1/60 s per frame
  (`performance.now()`, the shader clock and film grain, the live clock, the ring, the ending); CSS
  transitions and the clock's punch are moved to the same clock. High tier, every effect on, no
  downgrade, no pacing. Two renders of the same frames decode to identical pictures.
- **Read back** from the compositor (`Page.captureScreenshot`), so the HUD and the words are in the
  picture, and piped to ffmpeg: H.264 (CRF 14, yuv420p), 60 fps.
- **Sound**, rendered offline on an `OfflineAudioContext` (48 kHz) from the story state of every
  frame: the whole score is scheduled before rendering, frame by frame on each frame's exact time,
  the scheduler at its realtime 50 ms period, every random choice seeded (`seed`), then muxed in as
  AAC 320 kb/s; the WAV is kept too. Two renders agree to within one least significant bit on a
  few thousand of 12 million samples (about −150 dBFS before 16-bit rounding): Chrome sums a node's
  inputs in varying order. (Driving the render with suspend/resume gives the same: an earlier
  "−4.5 dB" difference was a measuring mistake, an ffmpeg mix that did not subtract.)
  `--sound-only` renders the sound again and puts it into the finished videos without re-encoding
  the picture.
- **Chunks.** Long browser sessions wore Chromium out here (a crash, a hung readback after thousands
  of frames), so the picture is rendered in chunks (`--chunk`, 1500 frames), each in a fresh
  browser that first steps the earlier frames without drawing (the last three drawn, so the shadow
  map matches): the same pixels as a continuous run. The parts are joined without re-encoding; a
  chunk whose browser fails is tried once more.
- **Output:** `capture/out/one-grain-<W>x<H>.mp4` (ignored by git). `--seconds a-b` renders an
  excerpt to check a passage.
- **Delivery encodes** (`npm run encode`): the 1080p submission file for Vimeo/YouTube, scaled from
  the 2560×1440 master, two-pass H.264 at the bitrate that lands on `--target-mb` (200), the
  master's sound copied → `capture/out/one-grain-1080p-submission.mp4`; and `--teaser <file.json>`,
  a short cut from `[{ "from": s, "to": s }, …]` with 0.6 s crossfades, faded in and out. The
  masters stay as rendered.
- **ffmpeg:** `$FFMPEG`, else the `ffmpeg-static` dev dependency (its install script downloads the
  binary; npm may ask to approve it: `npm install-scripts approve ffmpeg-static`), else `ffmpeg` on
  the PATH.

## Content

All words live in `index.html`:

- **Chapters** are semantic `<section data-slug>` elements grouped by act. JS reads them with
  `ui/copy.ts`, which also checks that their order matches `story/worlds.ts`.
- **Micro lines** (a small aside under a chapter's text) are `<p data-micro>` in the section.
- **Clock labels** belong to chapters: `data-clock` (and `data-clock-sub`) on the section.
  The clock means one thing, time elapsed on the grain's journey. *Years* chapters interpolate
  "≈" values on a log scale and may carry a label shown near their hold ("≈ hundreds
  of thousands"). *Production* chapters always show their label ("Day 1", "Weeks later"…). The
  final chapter shows "Now", and the interlude ("One day,") hides the clock.
  On the display the clock counts milliseconds since it got there ("on your screen"); a years
  chapter's own label holds within 15 % of either end of a move.
- **UI microcopy** (unit names, sound states, nav labels, the status-line format) lives in
  `data-*` attributes on the element that shows it.

No copy is hard-coded in TypeScript; the `?debug` overlay is a developer tool, not copy.

Without WebGL2 or without JavaScript, the article is the page.

## Quality tiers

| Tier | Grains per world | DPR cap | Pixel budget | Layers | Chosen when |
|---|---|---|---|---|---|
| low | 36 000 | 1.25 | 1.5 MP | no shadows, no depth of field | a screen whose shorter side is under 760 px (phones and small tablets, either way up), a software or "major performance caveat" GPU, or the texture would not fit |
| mid | 90 000 | 1.4 | 2.2 MP | all | default (v10's desktop setting; the parity baseline) |
| high | 160 000 | 1.75 | 4.5 MP, never below DPR 1 | all | a discrete GPU with at least 8 cores and enough memory, or Apple Silicon on a Mac (not an iPad) with at least 8 cores |

The tier is picked once per visit: turning a phone or resizing the window never changes it; only the
frame-time watchdog steps it down. The drawing buffer is the window × the screen's DPR, capped by the tier's DPR cap and by its pixel
budget, so 4K and Retina screens cannot multiply the cost (on high the budget never takes it below
DPR 1; on low and mid it may). It follows the window on every real
resize; height-only changes under 120 px (mobile browser bars) change nothing, and the canvas is
sized to the largest viewport. Wider than 2:1, the horizontal field of view stays at its 2:1 value
and the frame loses height; each world's `wideAnchor` (story/worlds.ts, eased between worlds like
the rest of the camera) says where: 0 keeps the 2:1 frame's bottom edge (crops from the top), 1
its top edge (crops from the bottom), .5 crops evenly. At 2:1 and below nothing changes.

The layers and pixel-ratio caps follow v10: post costs per pixel. Layers are light, shadows,
depth of field, bloom and grade (vignette and film grain); `core/layers.ts` combines the tier,
the downgrade and overrides.

`core/quality.ts` judges 2 s windows of the frame interval and, where the GPU timer exists
(`EXT_disjoint_timer_query_webgl2`, on every visit), of our own GPU time per frame. The budget is
25 ms.

- **Warm-up.** Nothing is judged for 8 s after the first rendered frame, nor for 3 s after a step or
  a tab switch. A window that overlaps grain generation, a shader compile or a pack upload is
  thrown away.
- **Down.** With the timer: our GPU time over budget in two windows in a row. Long frame intervals
  while our GPU time is within budget are an external slowdown (another app, a screen recorder):
  fewer grains would not help, so nothing changes. Without the timer: the frame interval over
  budget in three windows in a row.
- **Up.** Resting on a chapter, comfortably under budget (GPU under 65 %, or without the timer the
  frame interval under 75 %) for 10 s: the last step down is undone. After a step up that is
  followed by a step down, it stops stepping up for the session.

The steps down, queued in `core/tiers.ts`:

1. depth of field off;
2. shadows off;
3. fewer grains: the next tier's worlds and pixel ratio.

Steps up undo them in reverse.

- A step is applied only while the visitor rests on a chapter, behind a 250 ms canvas dip.
  Nothing changes mid-transition.
- New worlds are built in the worker, also only while resting.
- `?debug` shows the tier, the effects on, the monitor's last window, and every step with its
  reason and numbers.

Phase 1 measurement with `npm run perf`, headed Chromium, Intel UHD Graphics (i5-12450H laptop,
144 Hz panel):

| Tier and window | Typical frame | Worst position |
|---|---|---|
| mid, 1440×900 | 7.0 ms (vsync-bound at 144 fps) | 13.7 ms (73 fps) |
| mid, 1920×1080 | 7.2 ms | 13.9 ms (72 fps) |
| high, 1920×1080 (for comparison) | 13.8 ms | 20.8 ms; this is why integrated GPUs start on mid |

Phase 3, same machine, mid tier, 1440×900: 20.6 ms typical (49 fps), and 13.8 ms median while
scrubbing through the whole story with the lens changing every frame. On that day the machine was
slower across the board. Measured back to back, v6, v8 and the port all landed at 14–28 ms per
hold, where v6 ran at about 7 ms during the Phase 1 run. So the port costs the same as the
reference, and a lens change costs 0.18 µs. Re-measure on a quiet machine before comparing with
the Phase 1 numbers.

## Sound

Everything is synthesised with Web Audio (no files), ported from `reference/v23-sound.html`.

- **Music, beneath:** one chord per chapter, crossfaded between two pad banks with the camera's
  easing; sparse FM notes from the chord, with a timbre and register per act; a three-note falling
  motif when a chapter is reached; a soft repeated note in the production chapters (quarry →
  wafer). Music bus .42.
- **Ambience, in front:** per-world events (far thumps, cracks, ticks, gusts, waves, distant metal
  rings, the river's babbling bubbles) and one continuous sound, a soft water rush where there is
  water. Ambience bus 2.2. A world's ambience starts as the camera approaches it (eg ≥ .35), with its
  first sounds at once.
- **Silence:** the "One day," cut and the end (with the grain's light, 3–6.2 s). The master goes to
  exactly 0; scrolling back reopens it.
- **Output:** master .7 into a safety limiter (−10 dB), a long generated room. Events are scheduled
  0.3 s ahead by a 50 ms timer; after a stall, missed events are skipped, never bunched.
- **The button:** "Listen" until first enabled, then "Sound on" / "Sound off" (aria-pressed). Off by
  default; the choice is remembered (`localStorage`), and a returning visitor who chose sound gets
  it at their first gesture. Suspended while the tab is hidden.

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
| `?debug` | Corner panel: tier, effects, grains, DPR, fps, the quality monitor's last window and every step with its reason and numbers, GPU time per pass and per frame (live), and a toggle per render layer (overrides tier and downgrade until Reset) |
| `?capture` | Capture mode for `npm run capture`: implies `?parity` and the high tier; the page runs on a virtual clock, one frame per `window.__capture.step()` |
| `?notimer` | No GPU timer: the quality monitor judges frame intervals only (three windows) |
| `?debug&forceDrop` | Act as if the frame budget stayed blown, to watch the downgrade walk its steps |
| `?perf` | Time every render pass on the GPU (`window.__gpu`, with the last 240 raw frames) |
| `?off=a,b` | Switch render layers off (light, shadows, dof, bloom, grade), for measurements |
| `?grains=N` · `?pointcap=N` · `?shadowstride=N` | Measurements: grains per world, largest grain in pixels, every N-th grain casts shadows (default 1: all) |
| `?pacing=off\|on\|auto` | Frame pacing (`core/pacing.ts`, default auto): lock rendering to every n-th refresh when frames mostly take three or more and some come faster; never where frames fit (docs/perf.md) |
| `?parity` | Let a harness drive progress (`window.__V`) and shader time (`window.__T`), or render a transition point directly (`window.__AT = { tr, t, lean }`); pin the display's live clock (`window.__LIVE`, ms) and the seconds spent in the current hold (`window.__FT`: ring fade, final hold); the rendered progress is published as `window.__progress` |
| `?nosnap` | Scrolling does not settle on chapters, so a position mid-transition can be held |
| `#magma` … `#now` | Open at that chapter |
