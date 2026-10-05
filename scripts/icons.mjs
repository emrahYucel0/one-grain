// The icon set from public/favicon.svg (npm run icons): favicon-32.png, apple-touch-icon.png (180,
// full bleed: iOS rounds the corners itself), icon-192.png and icon-512.png (the grain sits well
// inside the maskable safe zone) → public/. Rendered with Playwright.
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const svg = await readFile('public/favicon.svg', 'utf8');
const fullBleed = svg.replace('rx="14" ', '');
const browser = await chromium.launch();
for (const [file, size, src] of [['favicon-32.png', 32, svg], ['apple-touch-icon.png', 180, fullBleed], ['icon-192.png', 192, fullBleed], ['icon-512.png', 512, fullBleed]]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<body style="margin:0;background:transparent">${src.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`);
  await page.screenshot({ path: `public/${file}`, omitBackground: true });
  await page.close();
  console.log(`→ public/${file}`);
}
await browser.close();
