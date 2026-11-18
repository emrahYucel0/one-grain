# Lighthouse and the network (npm run lighthouse)

The production build served with Brotli and the headers of dist/_headers (scripts/serve.mjs),
Lighthouse 12, headless Chrome on this machine's GPU. Mobile = Lighthouse's default (simulated slow
4G, 4× CPU slowdown, Moto G Power viewport); desktop = its desktop preset.

| | Mobile | Desktop |
|---|---|---|
| performance | 81 | 100 |
| accessibility | 100 | 100 |
| best-practices | 100 | 100 |
| seo | 100 | 100 |
| LCP | 3.31 s | 0.69 s |
| FCP | 3.31 s | 0.69 s |
| CLS | 0.000 | 0.000 |
| TBT | 236 ms | 42 ms |
| JavaScript transferred | 190 kB | 190 kB |
| Fonts transferred | 223 kB | 223 kB |
| Everything transferred | 444 kB | 444 kB |

Binary audits not passed: mobile valid-source-maps; desktop valid-source-maps.

## The browser visit (1440×900 and 390×844)

- ✓ 1440×900: no console messages
- ✓ 1440×900: no CSP violations
- ✓ 1440×900: no 404s (no response of 400 or more)
- ✓ 1440×900: nothing requested twice
- ✓ 1440×900: only the requests the first view uses
- ✓ 390×844: no console messages
- ✓ 390×844: no CSP violations
- ✓ 390×844: no 404s (no response of 400 or more)
- ✓ 390×844: nothing requested twice
- ✓ 390×844: only the requests the first view uses

Requests of the first view at 1440×900 (bytes on the wire, Brotli where it applies):

| Request | Type | Bytes |
|---|---|---|
| / | document | 7 kB |
| /assets/index-CTLFVGQr.js | script | 44 kB |
| /assets/archivo-wdth-BZh53edk.woff2 | font | 51 kB |
| /assets/newsreader-opsz-italic-SxWM2TE-.woff2 | font | 91 kB |
| /assets/three-DPSMDZzh.js | script | 105 kB |
| /assets/gsap-BJZ90ViQ.js | script | 40 kB |
| /assets/newsreader-opsz-Cd6xRf31.woff2 | font | 80 kB |
| /assets/main-B9_AfV-1.css | stylesheet | 7 kB |
| /assets/sim.worker-8Ol1L2VB.js | script | 1 kB |
| /favicon.svg | other | 1 kB |
