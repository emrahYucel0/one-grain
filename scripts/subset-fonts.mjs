// The three faces the site uses, subset to the characters it can show (npm run fonts → src/fonts/):
// printable ASCII (numbers the clock formats, the debug overlay aside) and every other character in
// index.html, where all the copy lives. The variable axes (Archivo wdth + wght, Newsreader opsz + wght)
// and every OpenType feature (tabular figures for the clock, kerning, ligatures) are kept. Sources:
// fontsource's Latin files; characters outside them (≈) fall through to the system font, as before.
// Needs Python with fontTools and brotli (pip install fonttools brotli). Run again after copy changes;
// check:fonts fails if index.html uses a character the subsets lack.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';

const FACES = [
  ['@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2', 'archivo-wdth.woff2'],
  ['@fontsource-variable/newsreader/files/newsreader-latin-opsz-normal.woff2', 'newsreader-opsz.woff2'],
  ['@fontsource-variable/newsreader/files/newsreader-latin-opsz-italic.woff2', 'newsreader-opsz-italic.woff2'],
];
export const fontChars = () => {
  const set = new Set();
  for (let c = 0x20; c < 0x7f; c++) set.add(c);
  for (const ch of readFileSync('index.html', 'utf8')) { const c = ch.codePointAt(0); if (c >= 0xa0) set.add(c); }
  for (const c of [0xa0, 0x2009, 0x202f]) set.add(c); // the spaces toLocaleString groups digits with in some locales
  return [...set].sort((a, b) => a - b);
};

if (process.argv[1]?.endsWith('subset-fonts.mjs')) {
  const chars = fontChars(), unicodes = chars.map((c) => c.toString(16).padStart(4, '0')).join(',');
  writeFileSync('src/fonts/chars.txt', String.fromCodePoint(...chars) + '\n');
  mkdirSync('src/fonts', { recursive: true });
  for (const [src, out] of FACES) {
    const from = `node_modules/${src}`, to = `src/fonts/${out}`;
    execFileSync('python', ['-m', 'fontTools.subset', from, `--unicodes=${unicodes}`, '--flavor=woff2', '--layout-features=*', '--name-IDs=*', '--notdef-outline', `--output-file=${to}`], { stdio: 'inherit' });
    console.log(`${out}: ${(statSync(from).size / 1024).toFixed(1)} kB → ${(statSync(to).size / 1024).toFixed(1)} kB`);
  }
  console.log(`${chars.length} characters: ${String.fromCodePoint(...chars.filter((c) => c >= 0xa0))}`);
}
