// The experience's text is hidden (html.fonts-pending) until both families are ready, so it never
// reflows in front of the visitor when a web font replaces its fallback. If the fonts take longer
// than TIMEOUT_MS, the text is shown with the metric-matched fallbacks (styles/main.css).

const TIMEOUT_MS = 3000;
const FACES = ['400 1em "Archivo Variable"', '400 1em "Newsreader Variable"', 'italic 400 1em "Newsreader Variable"'];

export function revealWhenFontsReady(root: HTMLElement = document.documentElement): void {
  const reveal = (): void => root.classList.remove('fonts-pending');
  if (!document.fonts) { reveal(); return; }
  const loaded = Promise.all(FACES.map((f) => document.fonts.load(f)))
    // then whatever else layout asked for (other unicode-range subsets of the same families)
    .then(() => new Promise<void>((r) => requestAnimationFrame(() => r())))
    .then(() => document.fonts.ready);
  const timeout = new Promise<void>((r) => setTimeout(r, TIMEOUT_MS));
  void Promise.race([loaded, timeout]).then(reveal, reveal);
}
