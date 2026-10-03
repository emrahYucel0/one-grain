// Dev server (source) and preview server (dist/) for the harness scripts.
import { createServer, preview } from 'vite';

export async function startDev(port) {
  const server = await createServer({ server: { port, strictPort: true }, logLevel: 'error' });
  await server.listen();
  return { origin: `http://localhost:${port}`, close: () => server.close() };
}

/** Serves dist/ as it would be deployed (run `npm run build` first). */
export async function startPreview(port) {
  const server = await preview({ preview: { port, strictPort: true }, logLevel: 'error' });
  return { origin: `http://localhost:${port}`, close: () => new Promise((r) => server.httpServer.close(r)) };
}
