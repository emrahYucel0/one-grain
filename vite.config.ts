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

/** The faces the first view shows (fontsource's Latin subsets): preloaded. */
const FIRST_FONTS = ['archivo-latin-wdth-normal', 'newsreader-latin-opsz-normal', 'newsreader-latin-opsz-italic'];

/**
 * index.html's %SITE_URL%, robots.txt and sitemap.xml, and _headers (Netlify / Cloudflare Pages format,
 * docs/deploy.md): the security headers, cache rules, and a CSP that allows only what the site uses,
 * with the hashes of index.html's two inline blocks (the class script and the critical styles).
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
        if (ctx.bundle) {
          // the three faces the first view needs, found early; the stylesheet for visitors without JavaScript
          const files = Object.keys(ctx.bundle);
          const fonts = FIRST_FONTS.map((f) => files.find((n) => n.includes(f) && n.endsWith('.woff2'))).filter(Boolean);
          const css = files.find((n) => n.endsWith('.css')); // the one stylesheet
          const tags = [...fonts.map((f) => `<link rel="preload" href="./${f}" as="font" type="font/woff2" crossorigin>`), ...(css ? [`<noscript><link rel="stylesheet" href="./${css}"></noscript>`] : [])];
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
