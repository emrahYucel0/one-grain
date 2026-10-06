# Deploying One Grain

`npm run build` writes a static site to `dist/`. Upload that folder to any static host and
serve it over HTTPS. Nothing runs on the server.

## Before the first deploy

- **Set the domain** in `site.config.json` (`url`, with a trailing slash). The canonical link,
  the Open Graph and Twitter URLs, the JSON-LD, `robots.txt` and `sitemap.xml` all come from
  this one value: `https://onegrain.world/`.
- Run `npm run build`, then `npm run lighthouse`. That command builds the site, serves it the
  way a host would (`scripts/serve.mjs`: Brotli, the headers below), and checks the console,
  the CSP, 404s and the request list. It writes `docs/lighthouse.md`.

## What `dist/` contains

| Path | What it is | Cache |
|---|---|---|
| `index.html` | The page, with the critical CSS and the class script inline | `no-cache` (revalidate every visit) |
| `assets/*` | Scripts, the stylesheet, the worker and fonts, all with content hashes in their names | 1 year, `immutable` |
| `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `og-image.jpg`, `site.webmanifest` | Icons, manifest and the sharing image. Their names have no hash. | 1 day |
| `robots.txt`, `sitemap.xml` | Generated from `site.config.json` | The host's default |
| `_headers` | The rules below, in Netlify / Cloudflare Pages format | (not served) |

The icons need a cache lifetime of their own: without one, Chromium fetches the favicon again from
the network whenever the address changes within the page (the story writes the chapter into the
URL hash). `index.html` must always revalidate. Each build changes the hashed file names it points to,
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
  Content-Security-Policy: default-src 'none'; script-src 'self' https://static.cloudflareinsights.com 'sha256-…'; style-src 'self' 'sha256-…'; img-src 'self'; font-src 'self'; connect-src 'self' https://cloudflareinsights.com; worker-src 'self'; manifest-src 'self'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'; upgrade-insecure-requests
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
/favicon.svg
  Cache-Control: public, max-age=86400
… (the same for favicon-32.png, apple-touch-icon.png, icon-192.png, icon-512.png, site.webmanifest, og-image.jpg)
https://:project.pages.dev/*
  X-Robots-Tag: noindex
```

On Cloudflare Pages (below) and Netlify, `_headers` works as it is. Other hosts need the same rules in
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
- **One other origin: Cloudflare Web Analytics.** With automatic setup, Cloudflare injects its
  beacon into the page at the edge: the script from `https://static.cloudflareinsights.com`, its
  reports to `https://cloudflareinsights.com`. Nothing else comes from elsewhere: the fonts are
  self-hosted and there are no CDNs. If the beacon is blocked (an ad blocker, a privacy browser), the
  site does not care: the startup guard only counts failures of our own scripts.
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

## Cloudflare Pages (onegrain.world)

The site is hosted on Cloudflare Pages, built from the private GitHub repository
`emrahYucel0/one-grain` on every push to `main`.

### Build settings

| Setting | Value |
|---|---|
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | (empty: the repository root) |
| Node version | 24, from `.node-version` in the repository (no environment variable needed) |
| Environment variables | none |
| Production branch | `main` |

Pages runs `npm clean-install` from `package-lock.json`, then the build command. In a clean clone that
takes about 20 s to install and 3 s to build, and the output is identical to a local build. With
Node 24 comes npm 11, which skips install scripts nobody approved: the `ffmpeg-static` download
(needed only for `npm run capture`) does not run there.

`_headers` is not a file in the repository. `npm run build` writes it into `dist/`, because the CSP
carries the hashes of the inline blocks in `index.html`, which change whenever those blocks change.
Pages applies `dist/_headers` as it is (the format is Cloudflare's). Its last rule adds
`X-Robots-Tag: noindex` to the project's own `*.pages.dev` address, so only onegrain.world is
indexed. HTTPS and Brotli are Cloudflare's: nothing to set.

### Step by step

These steps need the Cloudflare account that will hold the site, with onegrain.world added to it as
a zone. A custom domain at the root of a domain (an apex domain) needs the domain's DNS on
Cloudflare. If onegrain.world is registered elsewhere, first add it in the dashboard (**Add a
domain**) and change its nameservers at the registrar to the two Cloudflare shows. It is ready when
the zone shows **Active**.

**1. Create the project and connect the repository**

1. In the Cloudflare dashboard, open **Workers & Pages** and choose **Create**. On the **Pages**
   tab, choose **Import an existing Git repository**.
2. Choose **GitHub**, then **Connect GitHub** (or **Add account** if another one is connected
   already). GitHub opens the installation of the **Cloudflare Workers and Pages** app.
3. Under **Repository access**, choose **Only select repositories** and pick
   `emrahYucel0/one-grain`. Do not choose *All repositories*. Choose **Install & Authorize**.
   To change this later: GitHub → Settings → Applications → Installed GitHub Apps →
   **Cloudflare Workers and Pages** → Configure.
4. Back in Cloudflare, select `one-grain` and choose **Begin setup**.
5. Project name: `one-grain`. This gives the address `one-grain.pages.dev`. Production branch:
   `main`.
6. Enter the build settings from the table above, then choose **Save and Deploy**. The first build
   takes about a minute. When it is done, open `https://one-grain.pages.dev/` to check it.

**2. Add the domains**

1. In the project, open **Custom domains** → **Set up a custom domain**, enter `onegrain.world`,
   then **Continue** and **Activate domain**. Cloudflare creates the DNS record itself because the
   zone is on Cloudflare. It shows **Active** once the certificate is issued, usually within a
   few minutes.
2. Repeat for `www.onegrain.world`, so the www name gets a certificate and a DNS record.

**3. Redirect www to onegrain.world**

1. Open the **onegrain.world** zone (not the Pages project): **Rules** → **Overview** →
   **Create rule** → **Redirect Rule**. Or use the template **Redirect from WWW to root**.
2. Name it `www to root`. Under *If incoming requests match*, choose **Custom filter expression**:
   *Hostname* · *equals* · `www.onegrain.world`.
3. Under *Then*: **Dynamic**, expression `concat("https://onegrain.world", http.request.uri.path)`,
   status code **301**, and tick **Preserve query string**. Choose **Deploy**.
4. Check: `https://www.onegrain.world/anything?x=1` should answer 301 with
   `Location: https://onegrain.world/anything?x=1`.

**4. Zone settings to keep as they are, or check**

- **SSL/TLS → Edge Certificates → Always Use HTTPS**: on.
- **Web Analytics** with automatic setup is on (Pages project → Metrics): Cloudflare injects its
  beacon, which the CSP allows (see *The CSP*). Anything else that changes the page or injects
  scripts would be blocked by the CSP, so keep these **off**:
  - **Rocket Loader**;
  - **Email Address Obfuscation** (Scrape Shield). The page has no addresses, but it is safer off.
  - A blocked injection never breaks the site (the startup guard ignores other origins), but it
    shows a console error. To allow another service, add its origin to the CSP (`vite.config.ts`),
    then run `npm run lighthouse`, which reports violations.
- **Preview deployments**: every other branch gets its own `*.one-grain.pages.dev` address.
  They are kept out of search results by the noindex rule. They can be limited under
  **Settings → Builds & deployments → Preview branches** if unwanted.

After the first deploy, go through *After deploying* below with the real URL.

## Other hosts

**Netlify.** Set the build command to `npm run build` and the output directory to `dist`. `_headers`
is applied as it is.

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

`npm run check:live` checks all of the below against the real URL and writes `docs/live.md`.

- Open the site and check that the browser shows no console messages and no CSP reports.
- Check the response headers of `/` and of one file in `/assets/` (`curl -sI`).
- Paste the URL into a sharing debugger (for example the Open Graph preview of a social
  network) to confirm the image and the text.
