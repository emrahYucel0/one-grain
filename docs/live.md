# The live site (npm run check:live)

https://onegrain.world/, checked 2026-10-06 10:38 UTC.

| Area | Check | Result | Detail |
|---|---|---|---|
| deploy | the live site serves this build | ✓ | assets/index-DvY5pM3Z.js |
| headers | content-security-policy | ✓ | as in dist/_headers |
| headers | strict-transport-security | ✓ | as in dist/_headers |
| headers | x-content-type-options | ✓ | as in dist/_headers |
| headers | referrer-policy | ✓ | as in dist/_headers |
| headers | permissions-policy | ✓ | as in dist/_headers |
| headers | cross-origin-opener-policy | ✓ | as in dist/_headers |
| headers | x-frame-options | ✓ | as in dist/_headers |
| headers | index.html: Cache-Control no-cache | ✓ | no-cache |
| headers | assets/index.js: Cache-Control | ✓ | 200, public, max-age=31536000, immutable |
| headers | assets/main.css: Cache-Control | ✓ | 200, public, max-age=31536000, immutable |
| headers | favicon.svg: Cache-Control | ✓ | 200, public, max-age=86400 |
| compression | /: Brotli | ✓ | br |
| compression | assets/index-DvY5pM3Z.js: Brotli | ✓ | br |
| compression | assets/main-BkpPuXis.css: Brotli | ✓ | br |
| redirects | http → https | ✓ | 301 → https://onegrain.world/ |
| redirects | www.onegrain.world → https://onegrain.world (path and query kept) | ✓ | 301 → https://onegrain.world/some/path?x=1 |
| redirects | one-grain.pages.dev: X-Robots-Tag noindex | ✓ | 200, noindex (resolved through 1.1.1.1) |
| card | og:image https://onegrain.world/og-image.jpg | ✓ | 200, image/jpeg, 1200×630, 76 kB |
| card | twitter:image is the same picture | ✓ | https://onegrain.world/og-image.jpg |
| icons | favicon.svg | ✓ | 200, image/svg+xml |
| icons | favicon-32.png | ✓ | 200, image/png |
| icons | apple-touch-icon.png | ✓ | 200, image/png |
| icons | site.webmanifest | ✓ | 200, application/manifest+json |
| Chromium | the scene starts | ✓ | the scene |
| Chromium | no response of 400 or more from our origin | ✓ | none |
| Chromium | no CSP violations | ✓ | none |
| Chromium | injected by the edge: the analytics beacon once, nothing else | ✓ | beacon ×1 |
| Chromium | the beacon reports (/cdn-cgi/rum) | ✓ | POST onegrain.world/cdn-cgi/rum 204 |
| Firefox | the scene starts | ✓ | the scene |
| Firefox | no response of 400 or more from our origin | ✓ | none |
| Firefox | no CSP violations | ✓ | none |
| Firefox | injected by the edge: the analytics beacon once, nothing else | ✓ | beacon ×1 |
| Firefox | the beacon reports (/cdn-cgi/rum) | ✓ | POST onegrain.world/cdn-cgi/rum 204 |
| WebKit | the scene starts | ✓ | the scene |
| WebKit | no response of 400 or more from our origin | ✓ | none |
| WebKit | no CSP violations | ✓ | none |
| WebKit | injected by the edge: the analytics beacon once, nothing else | ✓ | beacon ×1 |
| WebKit | the beacon reports (/cdn-cgi/rum) | ✓ | POST onegrain.world/cdn-cgi/rum 204 |
| Lighthouse | mobile | ✓ | performance 93 · accessibility 100 · best practices 100 · SEO 100 · LCP 1.6 s · CLS 0 · TBT 280 ms |
| Lighthouse | mobile: binary audits not passed | info | valid-source-maps |
| Lighthouse | desktop | ✓ | performance 100 · accessibility 100 · best practices 100 · SEO 100 · LCP 0.7 s · CLS 0 · TBT 60 ms |
| Lighthouse | desktop: binary audits not passed | info | valid-source-maps |
