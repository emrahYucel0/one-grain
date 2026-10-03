import { WORLDS } from '../story/worlds';
import type { ScrollTimeline } from './scroll';

const NEXT = new Set(['ArrowDown', 'ArrowRight', 'PageDown']);
const PREV = new Set(['ArrowUp', 'ArrowLeft', 'PageUp']);

/** Arrow keys and Page Up / Page Down step between chapters instead of scrolling a little. */
export function bindChapterKeys(timeline: ScrollTimeline): void {
  addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const el = e.target as HTMLElement | null;
    if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
    const step = NEXT.has(e.key) ? 1 : PREV.has(e.key) ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const i = Math.max(0, Math.min(WORLDS.length - 1, timeline.current() + step));
    timeline.goTo(i);
  });
}
