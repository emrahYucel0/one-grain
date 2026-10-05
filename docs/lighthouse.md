# Lighthouse and the network (npm run lighthouse)

The production build served with Brotli and the headers of dist/_headers (scripts/serve.mjs),
Lighthouse 12, headless Chrome on this machine's GPU. Mobile = Lighthouse's default (simulated slow
4G, 4× CPU slowdown, Moto G Power viewport); desktop = its desktop preset.

| | Mobile | Desktop |
|---|---|---|
| performance | 80 | 98 |
| accessibility | 100 | 100 |
| best-practices | 100 | 100 |
| seo | 100 | 100 |
| LCP | 4.21 s | 0.81 s |
| FCP | 1.89 s | 0.43 s |
| CLS | 0.000 | 0.000 |
| TBT | 221 ms | 26 ms |
| JavaScript transferred | 176 kB | 176 kB |
| Fonts transferred | 363 kB | 363 kB |
| Everything transferred | 563 kB | 563 kB |

Binary audits not passed: mobile valid-source-maps; desktop valid-source-maps.

## The browser visit (1440×900 and 390×844)

- ✓ 1440×900: no console messages
- ✓ 1440×900: no CSP violations
- ✓ 1440×900: no 404s (no response of 400 or more)
- ✓ 1440×900: only the requests the first view uses
- ✓ 390×844: no console messages
- ✓ 390×844: no CSP violations
- ✓ 390×844: no 404s (no response of 400 or more)
- ✓ 390×844: only the requests the first view uses

Requests of the first view at 1440×900 (bytes on the wire, Brotli where it applies):

| Request | Type | Bytes |
|---|---|---|
| / | document | 3 kB |
| /assets/index-DsnOxiDD.js | script | 31 kB |
| /assets/gsap-BJZ90ViQ.js | script | 39 kB |
| /assets/newsreader-latin-opsz-italic-kJKFiXvB.woff2 | font | 144 kB |
| /assets/archivo-latin-wdth-normal-DY7AcnAa.woff2 | font | 89 kB |
| /assets/newsreader-latin-opsz-normal-s-izfB6B.woff2 | font | 130 kB |
| /assets/three-C5VjCHGg.js | script | 105 kB |
| /assets/main-Ba60en1F.css | stylesheet | 5 kB |
| /assets/sim.worker-Bg29GfVS.js | script | 1 kB |
| /favicon.svg | other | 1 kB |
| /favicon.svg | other | 1 kB |
