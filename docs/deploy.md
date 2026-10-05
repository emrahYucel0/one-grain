# Deploying One Grain

`npm run build` writes a static site to `dist/`. Upload that folder to any static host and
serve it over HTTPS. Nothing runs on the server.

## Before the first deploy

- **Set the domain** in `site.config.json` (`url`, with a trailing slash). The canonical link,
  the Open Graph and Twitter URLs, the JSON-LD, `robots.txt` and `sitemap.xml` all come from
  this one value. The repository ships with the placeholder `https://one-grain.example/`.
- Run `npm run build`, then `npm run lighthouse`. That command builds the site, serves it the
  way a host would (`scripts/serve.mjs`: Brotli, the headers below), and checks the console,
  the CSP, 404s and the request list. It writes `docs/lighthouse.md`.

## What `dist/` contains

| Path | What it is | Cache |
|---|---|---|
| `index.html` | The page, with the critical CSS and the class script inline | `no-cache` (revalidate every visit) |
| `assets/*` | Scripts, the stylesheet, the worker and fonts, all with content hashes in their names | 1 year, `immutable` |
| `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `og-image.jpg`, `site.webmanifest` | Icons and the sharing image. Their names have no hash. | The host's default, or about a day |
| `robots.txt`, `sitemap.xml` | Generated from `site.config.json` | The host's default |
| `_headers` | The rules below, in Netlify / Cloudflare Pages format | (not served) |

`index.html` must always revalidate. Each build changes the hashed file names it points to,
and an old cached copy would point to files that no longer exist.

## Required

- **HTTPS.** Redirect plain http to https. Browsers refuse module workers from `file://`, so the
  site has to be served over http(s) even for a local preview (`npm run serve`).
- **Compression.** Use Brotli where the host offers it, with gzip as a fallback, for `.html`,
  `.js`, `.css`, `.svg`, `.json`, `.webmanifest`, `.xml` and `.txt`. Fonts (woff2) and images are
  already compressed. With Brotli the first view's JavaScript goes from about 750 kB to 176 kB on the wire
  (`docs/lighthouse.md`).
- **MIME types.** Serve `.js` as `text/javascript`, `.webmanifest` as `application/manifest+json`
  and `.woff2` as `font/woff2`. The `nosniff` header makes browsers enforce these types.

## Headers

`npm run build` writes these headers to `dist/_headers`:

```
/*
  Content-Security-Policy: default-src 'none'; script-src 'self' 'sha256-…'; style-src 'self' 'sha256-…'; img-src 'self'; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'; upgrade-insecure-requests
  Strict-Transport-Security: max-age=63072000; includeSubDomains
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()
  Cross-Origin-Opener-Policy: same-origin
  X-Frame-Options: DENY
/
  Cache-Control: no-cache
/index.html
  Cache-Control: no-cache
/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

On Netlify and Cloudflare Pages, `_headers` works as it is. Other hosts need the same rules in
their own configuration. Take the CSP from the `_headers` of the build you deploy, not from this
page.

### The CSP

The CSP allows only what the site uses:

- **Scripts and styles from the site itself.** The two inline blocks in `index.html` are allowed
  by their SHA-256 hashes:
  - the script that sets the `js` class before the first paint;
  - the critical CSS that paints the stage and the loading line.

  The build computes the hashes. If you edit either block, rebuild and redeploy `_headers` with
  the new `index.html`; a stale hash leaves the first paint unstyled. The JSON-LD block is data,
  not a script, and needs no hash.
- **Nothing from other origins.** The fonts are self-hosted and there are no analytics or CDNs.
  The sound is synthesised in the browser and the worker comes from `assets/`.
- **Everything else is closed.** `default-src 'none'` blocks any kind of request the policy
  does not name. `img-src` covers the icons, `manifest-src` covers the manifest, and
  `connect-src 'self'` covers module preloading. The site loads no media files and makes no
  other connections.
- No `'unsafe-inline'`, no `'unsafe-eval'` and no `data:` URLs.

If you add an analytics script or an embed, add its origin to the matching directive. Then run
`npm run lighthouse`, which reports any CSP violation.

### Security headers

- `Strict-Transport-Security`: send it only over HTTPS. Add `preload` only once the domain is
  ready for the HSTS preload list.
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy` turns off features the site never asks for.
- `X-Frame-Options: DENY` and `frame-ancestors 'none'` stop the site from being framed. Remove
  both if it is meant to be embedded, for example on a competition page.
- `Cross-Origin-Opener-Policy: same-origin`.

## Host examples

**Netlify / Cloudflare Pages.** Set the build command to `npm run build` and the output
directory to `dist`. `_headers` is applied as it is.

**nginx:**

```nginx
server {
  listen 443 ssl http2;
  root /var/www/one-grain;
  brotli on; brotli_types text/javascript text/css image/svg+xml application/json application/manifest+json application/xml text/plain;
  gzip on;   gzip_types   text/javascript text/css image/svg+xml application/json application/manifest+json application/xml text/plain;
  types { application/manifest+json webmanifest; font/woff2 woff2; }

  location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable" always; include /etc/nginx/one-grain-security.conf; }
  location = /index.html { add_header Cache-Control "no-cache" always; include /etc/nginx/one-grain-security.conf; }
  location = / { add_header Cache-Control "no-cache" always; include /etc/nginx/one-grain-security.conf; try_files /index.html =404; }
  location / { include /etc/nginx/one-grain-security.conf; }
}
# one-grain-security.conf: one add_header … always; line per header in the /* block of dist/_headers.
# nginx drops inherited add_header lines inside a location that has its own, so every location includes it.
```

**Apache.** Put the same headers in `.htaccess` with `Header always set` under `mod_headers`,
use `mod_brotli` or `mod_deflate` for compression, and use `<FilesMatch>` blocks for the two
cache rules.

## Source maps

Source maps are not shipped. The production build has none (`build.sourcemap` is unset), so
`assets/` contains only what visitors run. Anyone who wants to read the code can read the
TypeScript in the repository. To debug a production problem, set `build.sourcemap: 'hidden'`
in `vite.config.ts`. That writes the `.map` files without the `sourceMappingURL` comment. Keep
them for an error tracker and do not upload them.

## After deploying

- Open the site and check that the browser shows no console messages and no CSP reports.
- Check the response headers of `/` and of one file in `/assets/` (`curl -sI`).
- Paste the URL into a sharing debugger (for example the Open Graph preview of a social
  network) to confirm the image and the text.
