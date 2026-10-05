# Lighthouse and the network (npm run lighthouse)

The production build served with Brotli and the headers of dist/_headers (scripts/serve.mjs),
Lighthouse 12, headless Chrome on this machine's GPU. Mobile = Lighthouse's default (simulated slow
4G, 4× CPU slowdown, Moto G Power viewport); desktop = its desktop preset.

| | Mobile | Desktop |
|---|---|---|
| performance | 82 | 97 |
| accessibility | 100 | 100 |
| best-practices | 100 | 100 |
| seo | 100 | 100 |
| LCP | 3.20 s | 0.69 s |
| FCP | 3.20 s | 0.65 s |
| CLS | 0.000 | 0.000 |
| TBT | 237 ms | 150 ms |
| JavaScript transferred | 176 kB | 176 kB |
| Fonts transferred | 222 kB | 222 kB |
| Everything transferred | 424 kB | 424 kB |

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
| / | document | 5 kB |
| /assets/index-CcpX8bqg.js | script | 30 kB |
| /assets/three-gZT1U6LH.js | script | 105 kB |
| /assets/gsap-BJZ90ViQ.js | script | 40 kB |
| /assets/archivo-wdth-C1H61SF-.woff2 | font | 51 kB |
| /assets/newsreader-opsz-italic-CPndpBRZ.woff2 | font | 91 kB |
| /assets/newsreader-opsz-Bfeafxts.woff2 | font | 80 kB |
| /assets/main-Bs8HiJUh.css | stylesheet | 5 kB |
| /assets/sim.worker-8Ol1L2VB.js | script | 1 kB |
| /favicon.svg | other | 1 kB |
