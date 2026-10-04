// One browser setup for every harness script: Chromium's new headless mode on the real GPU
// (ANGLE/D3D11 on Windows, as desktop Chrome). The default headless shell falls back to
// SwiftShader, which renders 90 000 grains at a few frames per second.
import { chromium } from 'playwright';

export const launch = ({ args = [], ...extra } = {}) => chromium.launch({
  channel: 'chromium',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', ...args],
  ...extra,
});

/** Collects console warnings/errors and page errors. Driver chatter from screenshot read-backs is listed separately. */
export function watchConsole(page, label, sink) {
  page.on('console', (m) => {
    const type = m.type();
    if (type !== 'warning' && type !== 'error') return;
    const text = m.text();
    sink.push({ label, type, text, harness: /GPU stall due to ReadPixels/.test(text) });
  });
  page.on('pageerror', (e) => sink.push({ label, type: 'pageerror', text: e.message, harness: false }));
}
