import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/** Where the site lives (site.config.json): the one value behind canonical, sharing tags, robots and sitemap. */
const SITE: string = (JSON.parse(readFileSync(new URL('./site.config.json', import.meta.url), 'utf8')) as { url: string }).url.replace(/\/?$/, '/');

/**
 * The oldest browsers the site runs in, for every JavaScript transform: the build, the dev server's
 * source and its pre-bundled dependencies. The default ("baseline widely available") means Safari
 * 16.4; iOS 15 is the last system of the iPhone 6s/7 generation, and Safari 15 cannot parse syntax
 * three.js ships untransformed (class static blocks), so nothing would run at all.
 */
const TARGETS = ['chrome100', 'edge100', 'firefox100', 'safari15', 'ios15'];

/**
 * public/'s icons, manifest and sharing image: unhashed names, so a day's cache rather than a year's.
 * Without one, Chromium fetches the favicon again from the network on every same-document navigation
 * (the story writes the chapter into the URL hash).
 */
const ICONS = ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'site.webmanifest', 'og-image.jpg'];

/** main.css's web font faces (Archivo; Newsreader roman and italic), subset in src/fonts/ (npm run fonts). */
const WEB_FACES = 3;

/**
 * index.html's %SITE_URL%, robots.txt and sitemap.xml, the web font faces inline, and _headers
 * (Netlify / Cloudflare Pages format, docs/deploy.md): the security headers, cache rules, and a CSP
 * that allows only what the site uses, with the hashes of index.html's inline scripts and styles.
 */
function site(): Plugin {
  let hashes = { script: [] as string[], style: [] as string[] };
  const sha = (s: string): string => `'sha256-${createHash('sha256').update(s).digest('base64')}'`;
  return {
    name: 'one-grain-site',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        let out = html.replaceAll('%SITE_URL%', SITE);
        // the dev server shows the startup guard's error report from the first problem on (index.html)
        if (ctx.server) out = out.replace('<html lang="en">', '<html lang="en" data-dev>');
        if (ctx.bundle) {
          // The web font faces, copied from the built stylesheet into the page, so they load from the
          // first paint (the loader's brand and its hidden warm-up glyphs use them at once) instead of
          // after the script brings main.css. No <link rel=preload>: Safari fetches a preloaded font
          // (CORS) and the same font from CSS (no CORS) twice, and warns the preload went unused. And the
          // stylesheet for visitors without JavaScript.
          const css = Object.keys(ctx.bundle).find((n) => n.endsWith('.css')); // the one stylesheet
          const asset = css ? ctx.bundle[css] : undefined;
          const source = asset && asset.type === 'asset' ? String(asset.source) : '';
          const faces = source.match(/@font-face\{[^}]*(?:Archivo|Newsreader) Variable[^}]*\}/g) ?? [];
          if (faces.length !== WEB_FACES) throw new Error(`one-grain-site: expected ${WEB_FACES} web font faces in ${css}, found ${faces.length}`);
          // url(./x.woff2) is relative to assets/main-….css; from the page it is assets/x.woff2
          const inline = faces.map((f) => f.replace(/url\((?:\.\/)?([^)/]+\.woff2)\)/g, 'url(./assets/$1)')).join('');
          const tags = [`<style>${inline}</style>`, `<noscript><link rel="stylesheet" href="./${css}"></noscript>`];
          out = out.replace('</head>', `${tags.join('\n')}\n</head>`);
        }
        hashes = {
          script: [...out.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => sha(m[1]!)),
          style: [...out.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => sha(m[1]!)),
        };
        return out;
      },
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *\nAllow: /\n\nSitemap: ${SITE}sitemap.xml\n` });
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${SITE}</loc></url>\n</urlset>\n` });
    },
    writeBundle(opts) {
      const csp = [
        // closed by default; each source the site uses named (icons, fonts, module preloads, the worker, the manifest)
        "default-src 'none'", `script-src 'self' ${hashes.script.join(' ')}`, `style-src 'self' ${hashes.style.join(' ')}`,
        "img-src 'self'", "font-src 'self'", "connect-src 'self'", "worker-src 'self'", "manifest-src 'self'",
        "base-uri 'self'", "form-action 'none'", "frame-ancestors 'none'", 'upgrade-insecure-requests',
      ].join('; ');
      // the last rule keeps Cloudflare Pages' own address for the project (*.pages.dev) out of search
      // results, so only the custom domain is indexed (a host-qualified pattern: other hosts ignore it)
      writeFileSync(join(opts.dir!, '_headers'), `/*
  Content-Security-Policy: ${csp}
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
${ICONS.map((f) => `/${f}\n  Cache-Control: public, max-age=86400\n`).join('')}https://:project.pages.dev/*
  X-Robots-Tag: noindex
`);
    },
  };
}

// Relative base so dist/ can be uploaded to any folder on a static host.
export default defineConfig({
  base: './',
  plugins: [site()],
  oxc: { target: TARGETS },
  optimizeDeps: { rolldownOptions: { transform: { target: TARGETS } } },
  build: {
    target: TARGETS,
    outDir: 'dist',
    emptyOutDir: true,
    // three is ~530 kB minified (~130 kB gzipped) on its own; it gets its own long-cached chunk.
    chunkSizeWarningLimit: 700,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'three', test: /node_modules[\\/]three[\\/]/ },
            { name: 'gsap', test: /node_modules[\\/]gsap[\\/]/ },
          ],
        },
      },
    },
  },
  worker: { format: 'es' },
});
