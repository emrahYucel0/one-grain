import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/** Where the site lives (site.config.json): the one value behind canonical, sharing tags, robots and sitemap. */
const SITE: string = (JSON.parse(readFileSync(new URL('./site.config.json', import.meta.url), 'utf8')) as { url: string }).url.replace(/\/?$/, '/');

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
      handler(html) {
        const out = html.replaceAll('%SITE_URL%', SITE);
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
        "default-src 'self'", `script-src 'self' ${hashes.script.join(' ')}`, `style-src 'self' ${hashes.style.join(' ')}`,
        "img-src 'self' data:", "font-src 'self'", "connect-src 'self'", "worker-src 'self'", "media-src 'self'",
        "object-src 'none'", "base-uri 'self'", "form-action 'none'", "frame-ancestors 'none'", 'upgrade-insecure-requests',
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
  build: {
    target: 'es2022',
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
