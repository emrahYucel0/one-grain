# One Grain

A scroll-driven WebGL story about one grain of sand, from magma to the screen you are reading
it on. Fifteen worlds, each a cloud of grains computed on the GPU; scrolling carries the same
grains from one world to the next.

By Emrah Yücel. Fifteen chapters in three acts (Nature, Industry, Now) follow one grain of quartz: out
of magma and granite, down a river to the coast and the desert, then round again; from a quarry
into the furnace, through purification, a crystal, a wafer, light and a chip, to the display,
and finally to the sand on the reader's own screen. The whole story is also a plain article in the page,
so it can be read without WebGL, without JavaScript or with a screen reader.

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
npm run serve        # build, then serve dist/ as a host would (Brotli, the _headers rules) at :4173
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
| `npm run check:tiers` | The device rules pick the expected tier (iPhone 7 on iOS 15 and iPhone 15 → mid, iPad → mid, high-end / older Android tablet → high / mid, Intel UHD laptop → mid, RTX 4050 → high, Apple M1 Mac → high, SwiftShader → low, a texture limit too small for mid → low, too small for low → text version, a GPU name hidden, masked or randomised → mid) and `?tier=` overrides them; a normal visit runs no timing code (no GPU timer queries, a frame on every refresh, `powerPreference: 'high-performance'`); the tier never changes after the scene appears; the low tier's layers; `?debug` shows the rule and the GPU; its toggles work |
| `npm run check:console` | Zero console warnings or errors in dev and build, Chromium, Firefox and WebKit |
| `npm run check:a11y` | axe WCAG 2.2 AA, the WCAG 2.2 checks (target size, reflow at 320 px, text spacing, focus order and visibility, status once), the motion button, keyboard chapter steps, status line, focus ring, reduced motion, no-WebGL2 and no-JS fallbacks |
| `npm run check:load` | First load, dev and production: the first paint (script held back) hides the article and shows only the stage, the brand (its text painted) and the loading line; so does every frame until the scene arrives; the line fills forward; no layout shift; reduced motion without fades; under mobile throttling (4× CPU, slow 4G) the first contentful paint is the brand, at once; the same first paint and the scene's arrival in WebKit; and the startup guard with each failure forced, in Chromium and WebKit (a script not loading, startup throwing, no WebGL2, a texture limit too small, the worker and the main-thread build failing, a stall: the article and the note; the worker alone failing, no half-float targets: the scene still arrives). Screenshots → `parity/load/` |
| `npm run check:responsive` | Across 14 viewports: the hero ring on the grain at every hold (≤ 2 px), 44 px touch targets, the pixel budget, a mobile browser bar changing nothing, turning a phone keeping the tier, the pixel ratio per tier, and the hero grain inside its safe area (±0.6 × ±0.65, below the HUD scrim, clear of the text) at every hold and transition midpoint |
| `npm run responsive [label]` | Contact sheets of the built site at every hold across phones, tablets and desktops → `docs/responsive/<label>/` |
| `npm run check:audio` | Sound: nothing before the visitor asks; the button clickable at 900×560 and 1440×700; exact silence in the "One day," cut and after the final landing (and sound again after scrolling back); ambience above the music where it should be; peaks below −6 dBFS; off within 0.5 s; hidden tab suspends; the remembered choice; no console noise both ways |
| `npm run check:live [url] [pages.dev url]` | The deployed site (default https://onegrain.world/), once it serves this checkout's build: the headers of `dist/_headers`, Brotli, http → https and www → root redirects, noindex on pages.dev; in Chromium, Firefox and WebKit the scene starts with no 404s and no CSP violations, the edge injects only the analytics beacon, once, and the beacon reports; the sharing card (1200×630 JPEG) and the icons resolve; Lighthouse mobile and desktop → `docs/live.md` |
| `npm run check:robust` | Nothing outside our control breaks the site (production build, real headers): with uBlock Origin Lite loaded (the injected analytics beacon blocked, none of our requests blocked, nothing of ours hidden), with Dark Reader loaded (the lock honoured; a control without it), with a third-party script the CSP blocks, one that throws, the beacon blocked, the GPU name hidden (→ mid), a translator rewriting the text, and in Firefox and WebKit: the scene starts and our own code logs nothing. Also: no path, class or id of ours with a word filter lists block on. The extensions are downloaded once into `.cache/extensions/` |
| `npm run check:compat` | Safari/iOS 15 and up: the built scripts parse with no syntax Safari 15 lacks (class static blocks, regex lookbehind or v flag, `using`), call no newer methods (toSorted…, groupBy, withResolvers, AbortSignal.timeout…), and the stylesheet uses no nesting, container queries, color-mix or @scope; Safari 15.4 additions are listed. `npm run lint` also runs eslint-plugin-compat on `src/` against the browserslist in package.json |
| `npm run check:contrast` | Real contrast behind every text block (the text drawn, then hidden, the background under it measured) at every chapter hold and the loading screen, at 390×844, 1440×900 and 2560×1440: the worst 5 % of pixels at AA at least → `docs/a11y/contrast.md` |
| `npm run lighthouse` | The production build served with compression and the deploy headers: no console messages, no CSP violations, no 404s, only the requests the first view needs; Lighthouse mobile and desktop → `docs/lighthouse.md` |
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
browsers refuse module workers from `file://`. **[docs/deploy.md](docs/deploy.md)** lists what to
set before the first deploy (the domain in `site.config.json`), the compression, cache and
security headers (`dist/_headers`, with the CSP), and why no source maps are shipped.

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
- **Hands-on holds without hints or buttons.** Capture mode hides the interaction hints and the sound and motion buttons with their scrim (hidden in place: the HUD keeps its layout); an invisible scripted
  cursor (`cursor`: keys of seconds and normalised device coordinates per chapter, a smooth curve
  through them) hovers across the desert's dunes, which part around it (held down for 1.5 s mid-sweep,
  `press`, so the parting reads at small sizes), and the chip, whose switches light up. It steers the camera's pointer parallax at half strength.
- **Deterministic.** The page runs on a virtual clock that the script advances 1/60 s per frame
  (`performance.now()`, the shader clock and film grain, the live clock, the ring, the ending); CSS
  transitions and the clock's punch are moved to the same clock. High tier, every effect on. Two renders of the same frames decode to identical pictures.
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
  chunk whose browser fails is tried up to three times, and a rerun after a failure keeps the chunks
  already finished.
- **Output:** `capture/out/one-grain-<W>x<H>.mp4` (ignored by git). `--seconds a-b` renders an
  excerpt to check a passage.
- **Delivery encodes** (`npm run encode`): the 1080p submission file for Vimeo/YouTube, scaled from
  the 2560×1440 master, two-pass H.264 at the bitrate that lands on `--target-mb` (200), the
  master's sound copied → `capture/out/one-grain-1080p-submission.mp4`; and the teaser,
  `--teaser capture/teaser.json [--storyboard]`: clips of master seconds in story order (about
  38 s), hard cuts except 8-frame crossfades where the act changes, the sound following the picture
  with 150 ms fades at every cut, the last second silent, two passes at the submission file's
  13 Mb/s; `--storyboard` first writes a sheet of every clip's in, middle and out frames. The
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
| low | 36 000 | 1.25 | 1.5 MP | no shadows, no depth of field | only where mid cannot run: a software renderer (SwiftShader, llvmpipe, Microsoft Basic Render Driver…), a browser that offers only a "major performance caveat" context, or a texture limit too small for mid's grains |
| mid | 90 000 | 1.4 | 2.2 MP | all | phones, iPads, tablets, and laptops and desktops with integrated or unrecognised GPUs (v10's desktop setting; the parity baseline) |
| high | 160 000 | 1.75 | 4.5 MP, never below DPR 1 | all | laptops and desktops with a discrete GPU or Apple Silicon; Android tablets whose GPU is a recent high-end family |

**Picked once, never measured.** The tier is chosen at startup from what the device is and the GPU
the browser reports (`core/quality.ts`; the GPU name lists are in `core/gpus.ts`), and never changes:
no runtime downgrade or recovery, no calibration, no frame pacing, no GPU timer in a normal visit. The
browser shows frames at the display's own pace.

- **Phones:** mid, always.
- **Tablets:** mid. Android tablets whose GPU is a recent high-end family (Adreno 730 and up, Mali-G710
  and up, Immortalis, Xclipse) get high. iPads (a Mac user agent with touch points) stay mid.
- **Laptops and desktops:** high with a discrete GPU (NVIDIA, Radeon RX / Pro, Intel Arc A-series) or
  Apple Silicon (named "Apple M…", or Safari's "Apple GPU" on a Mac with ASTC textures, which Intel
  Macs lack). Otherwise mid. On a laptop with two GPUs the one the browser reports decides; the
  context asks for `powerPreference: 'high-performance'`.
- **GPU name hidden or randomised** by a privacy setting (nothing reported, the browser's generic
  name such as Firefox's "Mozilla", or a name of no known family): mid.
- **Low** only where mid cannot run, as in the table. If even low's grains do not fit the GPU's
  texture limit, the startup guard shows the text version.
- `?tier=low|mid|high` overrides the rules. `?debug` shows the tier, the rule that chose it and the
  GPU the browser reported; its frame rate and GPU times (`?perf`, `npm run perf`) are measured for
  development only and change nothing.
- **Support:** tuned for devices from about 2019 on. Older devices either run or get the text
  version; the build targets Safari/iOS 15 and up.

Turning a phone or resizing the window never changes the tier. The drawing buffer is the window × the screen's DPR, capped by the tier's DPR cap and by its pixel
budget, so 4K and Retina screens cannot multiply the cost (on high the budget never takes it below
DPR 1; on low and mid it may). It follows the window on every real
resize; height-only changes under 120 px (mobile browser bars) change nothing, and the canvas is
sized to the largest viewport. Wider than 2:1, the horizontal field of view stays at its 2:1 value
and the frame loses height; each world's `wideAnchor` (story/worlds.ts, eased between worlds like
the rest of the camera) says where: 0 keeps the 2:1 frame's bottom edge (crops from the top), 1
its top edge (crops from the bottom), .5 crops evenly. At 2:1 and below nothing changes.

The layers and pixel-ratio caps follow v10: post costs per pixel. Layers are light, shadows,
depth of field, bloom and grade (vignette and film grain); `core/layers.ts` combines the tier and
the overrides (`?off=`, the `?debug` toggles).

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
- **Reduced motion:** worlds swap behind a short fade instead of morphing. Resting motion,
  parallax, interactions and the clock punch are off, and chapter jumps are instant. It follows
  `prefers-reduced-motion` until the visitor uses the **Motion on / off** button beside the sound
  button. That choice is remembered (`localStorage`, `og-motion`).
- **Contrast:** every text block reaches AA against what is really behind it, and body text and
  titles reach AAA. This comes from scrims, halos and local shades, not from a change to the art
  (`npm run check:contrast`, `docs/a11y/contrast.md`).
- `npm run check:a11y` also covers the WCAG 2.2 checks: target size, reflow at 320 px, text
  spacing, focus order and visible focus, and each status announced once.

## URL switches

| Switch | Effect |
|---|---|
| `?tier=low\|mid\|high` | Force a tier instead of the device rules |
| `?debug` | Corner panel: the tier, the rule that chose it and the GPU the browser reported; effects, grains, DPR, fps, GPU time per pass and per frame (live, measured only here), and a toggle per render layer (overrides the tier until Reset). Also the startup guard's on-screen report from the first moment (index.html) |
| `?capture` | Capture mode for `npm run capture`: implies `?parity` and the high tier; the page runs on a virtual clock, one frame per `window.__capture.step()` |
| `?perf` | Time every render pass on the GPU (`window.__gpu`, with the last 240 raw frames) |
| `?off=a,b` | Switch render layers off (light, shadows, dof, bloom, grade), for measurements |
| `?grains=N` · `?pointcap=N` · `?shadowstride=N` | Measurements: grains per world, largest grain in pixels, every N-th grain casts shadows (default 1: all) |
| `?parity` | Let a harness drive progress (`window.__V`) and shader time (`window.__T`), or render a transition point directly (`window.__AT = { tr, t, lean }`); pin the display's live clock (`window.__LIVE`, ms) and the seconds spent in the current hold (`window.__FT`: ring fade, final hold); the rendered progress is published as `window.__progress` |
| `?nosnap` | Scrolling does not settle on chapters, so a position mid-transition can be held |
| `?nosafe` | No hero safe area: the camera as composed for 16:9, for comparison (`camera/safe-area.ts`) |
| `#magma` … `#now` | Open at that chapter |

## Credits

- Author: **Emrah Yücel**.
- Type: [Archivo](https://github.com/Omnibus-Type/Archivo) by Omnibus-Type and
  [Newsreader](https://github.com/productiontype/Newsreader) by Production Type, both under the
  SIL Open Font License 1.1 and self-hosted via [Fontsource](https://fontsource.org).
- [three.js](https://threejs.org) (MIT) for rendering and [GSAP](https://gsap.com) with
  ScrollTrigger (GreenSock standard license, free to use) for the scroll timeline.
- The sound is synthesised in the browser and uses no recordings.
