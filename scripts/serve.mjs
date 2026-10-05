// A production-like static server for dist/ (npm run serve [port]): Brotli or gzip by Accept-Encoding,
// the headers in dist/_headers (the CSP, the security headers, the cache rules) applied as a host would,
// the right MIME types. Over plain http the two HTTPS-only parts (HSTS, upgrade-insecure-requests) are
// left out. Used by npm run lighthouse; docs/deploy.md has the same rules for a real host.
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2',
};
const COMPRESS = new Set(['.html', '.js', '.css', '.json', '.webmanifest', '.svg', '.xml', '.txt']);

/** dist/_headers: [pattern, [name, value][]] in file order (later, more specific rules win). */
async function rules() {
  const out = [];
  let cur = null;
  for (const line of (await readFile(join(DIST, '_headers'), 'utf8')).split('\n')) {
    if (!line.trim()) continue;
    if (!/^\s/.test(line)) { cur = [line.trim(), []]; out.push(cur); continue; }
    const i = line.indexOf(':');
    cur?.[1].push([line.slice(0, i).trim(), line.slice(i + 1).trim()]);
  }
  return out;
}
const matches = (pattern, path) => (pattern.endsWith('*') ? path.startsWith(pattern.slice(0, -1)) : path === pattern);

export async function serve(port = 4173) {
  const headerRules = await rules(), cache = new Map();
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(DIST, path));
    if (!file.startsWith(normalize(DIST)) || path.endsWith('/_headers')) { res.writeHead(404).end(); return; }
    try { if (!(await stat(file)).isFile()) throw new Error(); } catch { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found'); return; }
    const ext = extname(file), headers = { 'Content-Type': TYPES[ext] ?? 'application/octet-stream', Vary: 'Accept-Encoding' };
    for (const [pattern, list] of headerRules) if (matches(pattern, url.pathname) || (pattern === '/index.html' && url.pathname === '/')) {
      for (const [name, value] of list) {
        if (name === 'Strict-Transport-Security') continue; // https only
        headers[name] = name === 'Content-Security-Policy' ? value.replace(/;\s*upgrade-insecure-requests/, '') : value;
      }
    }
    let body = await readFile(file);
    const accept = req.headers['accept-encoding'] ?? '';
    if (COMPRESS.has(ext)) {
      const enc = /\bbr\b/.test(accept) ? 'br' : /\bgzip\b/.test(accept) ? 'gzip' : null;
      if (enc) {
        const key = `${enc}:${file}`;
        if (!cache.has(key)) cache.set(key, enc === 'br' ? brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }) : gzipSync(body, { level: 9 }));
        body = cache.get(key); headers['Content-Encoding'] = enc;
      }
    }
    headers['Content-Length'] = body.length;
    res.writeHead(200, headers).end(req.method === 'HEAD' ? undefined : body);
  });
  await new Promise((ok) => server.listen(port, ok));
  return { origin: `http://localhost:${port}`, close: () => new Promise((ok) => server.close(ok)) };
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('serve.mjs')) {
  const { origin } = await serve(+(process.argv[2] ?? 4173));
  console.log(`dist/ with compression and _headers at ${origin}/`);
}
