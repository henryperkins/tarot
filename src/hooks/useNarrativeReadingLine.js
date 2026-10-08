import { useEffect } from 'react';
import { readBlockFocus } from '../lib/narrativeCardLinks.js';
import { useNarrativeCardFocusApi } from '../components/reading/narrative/NarrativeCardFocus.jsx';

// The eye rests a little above the middle of the screen while reading.
const READING_LINE = 0.42;
// A tapped card name or detail stays lit long enough to find it on the card.
const PIN_MS = 2800;
const BLOCK = '[data-reading-block]';
const LINKED_TEXT = '.reading-imagery, .reading-card-ref';

function pointerFocusFor(target, container) {
  const element = target?.closest?.(LINKED_TEXT);
  if (!element || !container.contains(element)) return null;
  const card = Number(element.dataset.cardIndex);
  if (!Number.isInteger(card)) return null;
  const point = element.dataset.touchId || '';
  return {
    element,
    focus: {
      key: `pointer:${card}:${point}`,
      mode: 'single',
      cards: [card],
      primary: card,
      touches: point ? { [card]: [point] } : {}
    }
  };
}

function containsBlock(node) {
  return node.nodeType === 1 && (node.matches(BLOCK) || Boolean(node.querySelector(BLOCK)));
}

/**
 * Report which block of the reading the querent has reached.
 *
 * While text is still arriving, the newest block is the one being "spoken".
 * Once it is all there, the block crossing the reading line is. Pointing at
 * (or tapping) a card name or described detail takes over while it lasts.
 */
export function useNarrativeReadingLine(containerRef, { enabled = false, isLive = false } = {}) {
  const api = useNarrativeCardFocusApi();

  useEffect(() => {
    const container = containerRef.current;
    if (!api || !enabled || !container) return undefined;
    api.registerContainer(container);

    let active = null;
    let blockObserver = null;
    let containerObserver = null;
    let frame = 0;
    let resizeTimer = 0;

    const activate = (block) => {
      if (block === active) return;
      active?.removeAttribute('data-reading-active');
      active = block;
      block?.setAttribute('data-reading-active', 'true');
      api.setScrollFocus(block ? readBlockFocus(block) : null);
    };
    const readingLine = () => Math.round((window.innerHeight || 0) * READING_LINE);

    // The block under the reading line, or the last one above it while the
    // line sits in the gap between two blocks.
    const blockAtLine = (list) => {
      const line = readingLine();
      const box = container.getBoundingClientRect();
      if (box.top > line || box.bottom < line) return null;
      let above = null;
      for (const block of list) {
        const rect = block.getBoundingClientRect();
        if (rect.top > line) break;
        if (rect.bottom >= line) return block;
        above = block;
      }
      return above;
    };

    const build = () => {
      frame = 0;
      blockObserver?.disconnect();
      containerObserver?.disconnect();
      blockObserver = null;
      containerObserver = null;
      const list = Array.from(container.querySelectorAll(BLOCK));

      if (isLive) {
        activate(list[list.length - 1] || null);
        return;
      }

      activate(blockAtLine(list));
      const height = window.innerHeight || 0;
      const line = readingLine();
      // A one-pixel band at the reading line.
      const rootMargin = `-${line}px 0px -${Math.max(0, height - line - 1)}px 0px`;
      const crossing = new Set();
      blockObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) crossing.add(entry.target);
          else crossing.delete(entry.target);
        }
        let next = null;
        for (const block of list) if (crossing.has(block)) next = block;
        // Between blocks, the last one read stays in hand.
        if (next) activate(next);
      }, { rootMargin });
      list.forEach((block) => blockObserver.observe(block));
      containerObserver = new IntersectionObserver(([entry]) => {
        if (entry && !entry.isIntersecting) activate(null);
      }, { rootMargin });
      containerObserver.observe(container);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(build);
    };

    // Re-rendering the Markdown replaces its block elements, so watch for new
    // blocks instead of trusting the ones observed first.
    const mutations = new MutationObserver((records) => {
      if (records.some((record) => [...record.addedNodes, ...record.removedNodes].some(containsBlock))) schedule();
    });
    mutations.observe(container, { childList: true, subtree: true });

    build();
    const handleResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(schedule, 150);
    };
    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(resizeTimer);
      window.removeEventListener('resize', handleResize);
      mutations.disconnect();
      blockObserver?.disconnect();
      containerObserver?.disconnect();
      active?.removeAttribute('data-reading-active');
      api.setScrollFocus(null);
    };
  }, [api, containerRef, enabled, isLive]);

  useEffect(() => {
    const container = containerRef.current;
    if (!api || !enabled || !container) return undefined;

    let hovered = null;
    let pinTimer = 0;
    const mark = (element) => {
      window.clearTimeout(pinTimer);
      if (hovered === element) return;
      hovered?.removeAttribute('data-touch-hover');
      hovered = element;
      hovered?.setAttribute('data-touch-hover', 'true');
    };
    const handleOver = (event) => {
      if (event.pointerType === 'touch') return;
      const found = pointerFocusFor(event.target, container);
      if (!found) return;
      mark(found.element);
      api.setPointerFocus(found.focus);
    };
    const handleOut = (event) => {
      if (event.pointerType === 'touch') return;
      const from = pointerFocusFor(event.target, container);
      if (!from) return;
      const to = pointerFocusFor(event.relatedTarget, container);
      if (to?.element === from.element) return;
      mark(null);
      api.clearPointerFocus();
    };
    // Touch has no hover: a tap lights the card for a moment instead.
    const handleClick = (event) => {
      const found = pointerFocusFor(event.target, container);
      if (!found) return;
      mark(found.element);
      api.setPointerFocus(found.focus);
      pinTimer = window.setTimeout(() => {
        mark(null);
        api.clearPointerFocus();
      }, PIN_MS);
    };

    container.addEventListener('pointerover', handleOver);
    container.addEventListener('pointerout', handleOut);
    container.addEventListener('click', handleClick);
    return () => {
      container.removeEventListener('pointerover', handleOver);
      container.removeEventListener('pointerout', handleOut);
      container.removeEventListener('click', handleClick);
      mark(null);
    };
  }, [api, containerRef, enabled]);
}
