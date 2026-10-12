import { useEffect } from 'react';
import { readBlockFocus } from '../lib/narrativeCardLinks.js';
import { useNarrativeCardFocusApi } from '../components/reading/narrative/NarrativeCardFocus.jsx';

// The eye rests a little above the middle of the screen while reading.
const READING_LINE = 0.42;
// Described details count as reached once they are in the band the eye reads
// in, so a quick scroll can't skip over them.
const READING_ZONE = [0.26, 0.6];
const BLOCK = '[data-reading-block]';
const DETAIL = '.reading-imagery';
const PERSONAL = '.reading-personal';
const WATCHED = `${DETAIL}, ${PERSONAL}`;
const LINKED_TEXT = '.reading-imagery, .reading-card-ref';
// Linked text that can be chosen (a heading's card name is only pointed at).
const CONTROL = '[role="button"]';
// A card name stands for the whole card.
const WHOLE_CARD = '*';

function detailOf(element) {
  const card = Number(element?.dataset?.cardIndex);
  const point = element?.dataset?.touchId || '';
  if (!Number.isInteger(card) || !point) return null;
  return { card, points: [point], element };
}

// Report one watched element: a described detail or the querent's own words.
function report(api, element) {
  if (element.matches(PERSONAL)) {
    const block = element.closest(BLOCK);
    const cards = (block?.dataset?.blockCards || '').split(' ').filter(Boolean).map(Number);
    api.reachPersonal({ source: element.dataset.personalSource, element, cards });
    return;
  }
  const detail = detailOf(element);
  if (detail) api.reachDetail(detail);
}

function pointerFocusFor(target, container) {
  const element = target?.closest?.(LINKED_TEXT);
  if (!element || !container.contains(element)) return null;
  const card = Number(element.dataset.cardIndex);
  if (!Number.isInteger(card)) return null;
  const point = element.dataset.touchId || '';
  return {
    element,
    detail: { card, points: [point || WHOLE_CARD], element },
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
    node.matches(BLOCK) || node.matches(WATCHED)
    || Boolean(node.querySelector(BLOCK)) || Boolean(node.querySelector(WATCHED))
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
 * the ones being "spoken". Pointing at a card name or detail (hover, keyboard
 * focus) takes over while it lasts. Choosing one (tap, click, Enter, Space)
 * opens a card name's card, or holds a detail on its card until the reader
 * lets it go: choosing it again, Escape, a tap elsewhere in the reading, or
 * scrolling it out of view.
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
      // Attention on words that have left the screen ends.
      api.checkDetails();
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
      for (const element of entered) report(api, element);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(read);
    };

    const collect = () => {
      listFrame = 0;
      blocks = Array.from(container.querySelectorAll(BLOCK));
      details = Array.from(container.querySelectorAll(WATCHED));
      for (const element of Array.from(inZone)) {
        if (!element.isConnected) inZone.delete(element);
      }
      if (isLive) {
        activate(blocks[blocks.length - 1] || null);
        // Details are shown as they are spoken, once each, in order.
        for (const element of details) {
          if (announced.has(element)) continue;
          announced.add(element);
          report(api, element);
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
    let held = false;
    const mark = (element) => {
      if (hovered === element) return;
      hovered?.removeAttribute('data-touch-hover');
      hovered = element;
      hovered?.setAttribute('data-touch-hover', 'true');
    };
    const point = (found) => {
      mark(found.element);
      api.setPointerFocus(found.focus);
      if (found.element.matches(DETAIL)) api.inspectDetail(found.detail);
    };
    const leave = () => {
      if (!hovered) return;
      const wasDetail = hovered.matches(DETAIL);
      mark(null);
      api.clearPointerFocus();
      if (wasDetail) api.releaseDetail();
    };
    const letGo = () => {
      if (!held) return;
      held = false;
      api.unholdDetail();
    };
    const choose = (found) => {
      if (found.element.matches(DETAIL)) {
        // Where the card can show it without covering the chosen words, if
        // its own plate is out of view.
        const rect = found.element.getBoundingClientRect();
        const place = rect.top + rect.height / 2 < (window.innerHeight || 0) / 2 ? 'bottom' : 'top';
        held = api.holdDetail({ ...found.detail, place });
        return;
      }
      letGo();
      api.selectCard(found.detail.card);
    };
    // Selecting text to copy it is not choosing what it names.
    const selecting = () => {
      const selection = window.getSelection?.();
      return Boolean(selection && !selection.isCollapsed && container.contains(selection.anchorNode));
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
      point(found);
    };
    const handleClick = (event) => {
      if (selecting()) return;
      const found = pointerFocusFor(event.target, container);
      if (found?.element.matches(CONTROL)) choose(found);
      else letGo();
    };
    const handleKey = (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const found = pointerFocusFor(event.target, container);
      if (!found || found.element !== event.target || !found.element.matches(CONTROL)) return;
      // Space would scroll the page.
      event.preventDefault();
      choose(found);
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') letGo();
    };
    // Keyboard focus points like a hovering pointer. Focus a tap leaves
    // behind (or a dialog hands back) must not keep the cards from following
    // the reading as it scrolls.
    const handleFocusIn = (event) => {
      if (!event.target.matches?.(':focus-visible')) return;
      // A browser brings a focused control into view only when it is off
      // screen, not when it sits under the sticky bar or the action dock;
      // its scroll margins keep it clear of both.
      if (event.target.matches(`${CONTROL}, .card-touch-plate`)) event.target.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      const found = pointerFocusFor(event.target, container);
      if (found && found.element === event.target) point(found);
    };
    const handleFocusOut = (event) => {
      if (event.target === hovered) leave();
    };

    container.addEventListener('pointermove', handleMove);
    container.addEventListener('pointerleave', leave);
    container.addEventListener('click', handleClick);
    container.addEventListener('keydown', handleKey);
    container.addEventListener('focusin', handleFocusIn);
    container.addEventListener('focusout', handleFocusOut);
    document.addEventListener('keydown', handleEscape);
    return () => {
      container.removeEventListener('pointermove', handleMove);
      container.removeEventListener('pointerleave', leave);
      container.removeEventListener('click', handleClick);
      container.removeEventListener('keydown', handleKey);
      container.removeEventListener('focusin', handleFocusIn);
      container.removeEventListener('focusout', handleFocusOut);
      document.removeEventListener('keydown', handleEscape);
      mark(null);
      letGo();
    };
  }, [api, containerRef, enabled]);
}
