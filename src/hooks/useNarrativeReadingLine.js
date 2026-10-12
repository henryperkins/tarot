import { useEffect } from 'react';
import { readBlockFocus } from '../lib/narrativeCardLinks.js';
import { useNarrativeCardFocusApi } from '../components/reading/narrative/NarrativeCardFocus.jsx';

// The eye rests a little above the middle of the screen while reading.
const READING_LINE = 0.42;
// Described details count as reached once they are in the band the eye reads
// in, so a quick scroll can't skip over them.
const READING_ZONE = [0.26, 0.6];
// A tapped card name stays lit long enough to find it in the spread.
const PIN_MS = 2800;
const BLOCK = '[data-reading-block]';
const DETAIL = '.reading-imagery';
const LINKED_TEXT = '.reading-imagery, .reading-card-ref';

function detailOf(element) {
  const card = Number(element?.dataset?.cardIndex);
  const point = element?.dataset?.touchId || '';
  if (!Number.isInteger(card) || !point) return null;
  return { card, points: [point], element };
}

function pointerFocusFor(target, container) {
  const element = target?.closest?.(LINKED_TEXT);
  if (!element || !container.contains(element)) return null;
  const card = Number(element.dataset.cardIndex);
  if (!Number.isInteger(card)) return null;
  const point = element.dataset.touchId || '';
  return {
    element,
    detail: point ? { card, points: [point], element } : null,
    focus: {
      key: `pointer:${card}:${point}`,
      mode: 'single',
      cards: [card],
      primary: card,
      touches: point ? { [card]: [point] } : {}
    }
  };
}

function containsTracked(node) {
  return node.nodeType === 1 && (
    node.matches(BLOCK) || node.matches(DETAIL)
    || Boolean(node.querySelector(BLOCK)) || Boolean(node.querySelector(DETAIL))
  );
}

/**
 * Report what the querent has reached in the reading.
 *
 * - The passage at the reading line rests a hand on its card.
 * - Each described detail ("the lightning", "two pitchers") that comes into
 *   the band the eye reads in asks the card to show that part of its picture.
 *
 * While text is still arriving, the newest passage and the newest details are
 * the ones being "spoken". Pointing at (or tapping) a card name or detail
 * takes over while it lasts.
 */
export function useNarrativeReadingLine(containerRef, { enabled = false, isLive = false } = {}) {
  const api = useNarrativeCardFocusApi();

  useEffect(() => {
    const container = containerRef.current;
    if (!api || !enabled || !container) return undefined;
    api.registerContainer(container);

    let active = null;
    let blocks = [];
    let details = [];
    let frame = 0;
    let listFrame = 0;
    const inZone = new Set();
    const announced = new WeakSet();

    const activate = (block) => {
      if (block === active) return;
      active?.removeAttribute('data-reading-active');
      active = block;
      block?.setAttribute('data-reading-active', 'true');
      api.setScrollFocus(block ? readBlockFocus(block) : null);
    };

    // The block under the reading line, or the last one above it while the
    // line sits in the gap between two blocks.
    const blockAtLine = () => {
      const line = (window.innerHeight || 0) * READING_LINE;
      const box = container.getBoundingClientRect();
      if (box.top > line || box.bottom < line) return null;
      let above = null;
      for (const block of blocks) {
        const rect = block.getBoundingClientRect();
        if (rect.top > line) break;
        if (rect.bottom >= line) return block;
        above = block;
      }
      return above;
    };

    const read = () => {
      frame = 0;
      if (isLive) return;
      activate(blockAtLine());
      const height = window.innerHeight || 0;
      const top = height * READING_ZONE[0];
      const bottom = height * READING_ZONE[1];
      const entered = [];
      for (const element of details) {
        const rect = element.getBoundingClientRect();
        const inside = rect.bottom >= top && rect.top <= bottom;
        if (inside && !inZone.has(element)) entered.push(element);
        if (inside) inZone.add(element);
        else inZone.delete(element);
      }
      // Several at once (a jump, or one line holding two details) report in
      // reading order.
      for (const element of entered) {
        const detail = detailOf(element);
        if (detail) api.reachDetail(detail);
      }
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(read);
    };

    const collect = () => {
      listFrame = 0;
      blocks = Array.from(container.querySelectorAll(BLOCK));
      details = Array.from(container.querySelectorAll(DETAIL));
      for (const element of Array.from(inZone)) {
        if (!element.isConnected) inZone.delete(element);
      }
      if (isLive) {
        activate(blocks[blocks.length - 1] || null);
        // Details are shown as they are spoken, once each, in order.
        for (const element of details) {
          if (announced.has(element)) continue;
          announced.add(element);
          const detail = detailOf(element);
          if (detail) api.reachDetail(detail);
        }
        return;
      }
      schedule();
    };

    // Re-rendering the Markdown replaces its elements, so watch for new blocks
    // and details instead of trusting the ones found first.
    const mutations = new MutationObserver((records) => {
      if (records.some((record) => [...record.addedNodes, ...record.removedNodes].some(containsTracked))) {
        if (!listFrame) listFrame = window.requestAnimationFrame(collect);
      }
    });
    mutations.observe(container, { childList: true, subtree: true });

    collect();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });

    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(listFrame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      mutations.disconnect();
      active?.removeAttribute('data-reading-active');
      api.setScrollFocus(null);
      api.clearTraces();
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
    const leave = () => {
      if (!hovered) return;
      const wasDetail = hovered.matches(DETAIL);
      mark(null);
      api.clearPointerFocus();
      if (wasDetail) api.releaseDetail();
    };
    // Only a pointer that actually moves is hovering: text scrolling under a
    // resting cursor must not take the cards away from the reading.
    const handleMove = (event) => {
      if (event.pointerType === 'touch') return;
      if (!event.movementX && !event.movementY) return;
      const found = pointerFocusFor(event.target, container);
      if (found?.element === hovered) return;
      if (!found) {
        leave();
        return;
      }
      mark(found.element);
      api.setPointerFocus(found.focus);
      if (found.detail) api.inspectDetail(found.detail);
    };
    // Touch has no hover: a tap shows the detail (or the card) for a moment.
    const handleClick = (event) => {
      const found = pointerFocusFor(event.target, container);
      if (!found) return;
      mark(found.element);
      api.setPointerFocus(found.focus);
      if (found.detail) api.inspectDetail(found.detail);
      pinTimer = window.setTimeout(() => {
        mark(null);
        api.clearPointerFocus();
      }, PIN_MS);
    };

    container.addEventListener('pointermove', handleMove);
    container.addEventListener('pointerleave', leave);
    container.addEventListener('click', handleClick);
    return () => {
      container.removeEventListener('pointermove', handleMove);
      container.removeEventListener('pointerleave', leave);
      container.removeEventListener('click', handleClick);
      mark(null);
    };
  }, [api, containerRef, enabled]);
}
