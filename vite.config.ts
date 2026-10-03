import { defineConfig } from 'vite';

// Relative base so dist/ can be uploaded to any folder on a static host.
export default defineConfig({
  base: './',
  build: { target: 'es2022', outDir: 'dist', emptyOutDir: true },
  worker: { format: 'es' },
});
