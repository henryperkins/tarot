import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

// An item's position along the scroller's own scroll axis, whatever lies between.
function itemLeft(scroller, item) {
  return item.getBoundingClientRect().left - scroller.getBoundingClientRect().left + scroller.scrollLeft;
}

/**
 * Shared behaviour of the handset choice carousels (spreads and decks). From
 * the `sm` breakpoint the same markup is a grid that no longer overflows, so
 * the scrolling parts simply have nothing to do there.
 *
 * - Tracks which item is in view (for the dots) and whether more items sit
 *   past either edge (for the fades and Previous/Next).
 * - Centres the chosen item when the choice comes from elsewhere: the default
 *   on first load, a restored reading, a saved deck when the drawer opens, or
 *   a carousel that first gains a width (a drawer kept mounted while hidden).
 *   An item the reader taps centres itself smoothly instead.
 * - Runs the radio group's keyboard model: arrows, Home and End move focus
 *   without choosing; Enter or Space chooses. The tab stop follows focus
 *   inside the group and returns to the chosen item when focus leaves.
 * - Keeps the Previous/Next buttons level with each item's artwork (the
 *   `--choice-arrow-y` custom property on the frame), so they cover art and
 *   never text.
 *
 * The scroller's direct children are the items, in `keys` order. `keys` must
 * keep its identity between renders (a module-level constant).
 */
export function useChoiceCarousel({ keys, selectedKey, onChoose, prefersReducedMotion, artworkSelector }) {
  const carouselRef = useRef(null);
  const frameRef = useRef(null);
  // key -> the focusable radio inside each item.
  const itemRefs = useRef({});
  // A tap or key press centres its own item; selections made elsewhere jump.
  const chosenHereRef = useRef(null);
  const onChooseRef = useRef(onChoose);
  const centerChosenRef = useRef(() => {});
  const [activeIndex, setActiveIndex] = useState(0);
  const [edges, setEdges] = useState({ start: false, end: true });
  const [focusedKey, setFocusedKey] = useState(null);

  useLayoutEffect(() => {
    onChooseRef.current = onChoose;
  });

  const updateEdges = useCallback(el => {
    const threshold = Math.max(10, el.clientWidth * 0.05);
    const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
    setEdges(current => {
      const next = { start: el.scrollLeft > threshold, end: maxScrollLeft - el.scrollLeft > threshold };
      return current.start === next.start && current.end === next.end ? current : next;
    });
  }, []);

  const alignArrows = useCallback(() => {
    const frame = frameRef.current;
    const art = carouselRef.current?.children[0]?.querySelector(artworkSelector);
    if (!frame || !art) return;
    const artRect = art.getBoundingClientRect();
    frame.style.setProperty('--choice-arrow-y', `${artRect.top - frame.getBoundingClientRect().top + artRect.height / 2}px`);
  }, [artworkSelector]);

  // Kept current so the observer below always centres today's choice.
  useLayoutEffect(() => {
    centerChosenRef.current = () => {
      const el = carouselRef.current;
      if (!el || el.scrollWidth <= el.clientWidth) return;
      const item = el.children[keys.indexOf(selectedKey)];
      if (!item) return;
      const left = itemLeft(el, item);
      if (left >= el.scrollLeft - 1 && left + item.offsetWidth <= el.scrollLeft + el.clientWidth + 1) return;
      el.scrollTo({ left: Math.max(0, left + item.offsetWidth / 2 - el.clientWidth / 2), behavior: 'instant' });
    };
  });

  useLayoutEffect(() => {
    alignArrows();
  }, [alignArrows]);

  useEffect(() => {
    const el = carouselRef.current;
    if (!el || keys.length <= 1) return undefined;

    const measure = () => {
      const items = Array.from(el.children);
      if (!items.length) return;
      alignArrows();
      const viewportCenter = el.scrollLeft + el.clientWidth / 2;
      let closestIndex = 0;
      let closestDistance = Infinity;
      items.forEach((item, index) => {
        const distance = Math.abs(viewportCenter - (itemLeft(el, item) + item.offsetWidth / 2));
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });
      setActiveIndex(closestIndex);
      updateEdges(el);
    };

    measure();
    el.addEventListener('scroll', measure, { passive: true });
    let lastWidth = el.clientWidth;
    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
      if (lastWidth === 0 && el.clientWidth > 0) centerChosenRef.current();
      lastWidth = el.clientWidth;
      measure();
    }) : null;
    resizeObserver?.observe(el);
    return () => {
      el.removeEventListener('scroll', measure);
      resizeObserver?.disconnect();
    };
  }, [keys, alignArrows, updateEdges]);

  useLayoutEffect(() => {
    const chosenHere = chosenHereRef.current === selectedKey;
    chosenHereRef.current = null;
    if (!chosenHere) centerChosenRef.current();
  }, [selectedKey]);

  const scrollToIndex = useCallback(index => {
    const clamped = Math.min(keys.length - 1, Math.max(0, index));
    setActiveIndex(clamped);
    const el = carouselRef.current;
    const item = el?.children[clamped];
    if (!item) return;
    el.scrollTo({
      left: Math.max(0, itemLeft(el, item) + item.offsetWidth / 2 - el.clientWidth / 2),
      behavior: prefersReducedMotion ? 'auto' : 'smooth'
    });
    updateEdges(el);
  }, [keys, prefersReducedMotion, updateEdges]);

  /** After the reader's own tap or key press has been accepted. */
  const markChosenHere = useCallback(key => {
    if (key !== selectedKey) chosenHereRef.current = key;
    const index = keys.indexOf(key);
    if (index !== -1) scrollToIndex(index);
  }, [keys, selectedKey, scrollToIndex]);

  /** Previous (-1) or Next (+1), when more items sit past that edge. */
  const step = useCallback(direction => {
    if (direction < 0 ? !edges.start : !edges.end) return;
    scrollToIndex(activeIndex + direction);
  }, [activeIndex, edges, scrollToIndex]);

  const onItemKeyDown = (event, key) => {
    // Modified keys belong to browser navigation and assistive shortcuts.
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onChooseRef.current?.(key);
      return;
    }
    const currentIndex = keys.indexOf(key);
    const nextIndex = {
      ArrowRight: (currentIndex + 1) % keys.length,
      ArrowDown: (currentIndex + 1) % keys.length,
      ArrowLeft: (currentIndex - 1 + keys.length) % keys.length,
      ArrowUp: (currentIndex - 1 + keys.length) % keys.length,
      Home: 0,
      End: keys.length - 1
    }[event.key];
    if (nextIndex === undefined) return;
    event.preventDefault();
    const nextKey = keys[nextIndex];
    const nextElement = itemRefs.current[nextKey];
    if (!nextElement) return;
    setFocusedKey(nextKey);
    nextElement.focus();
    nextElement.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'center'
    });
  };

  const onGroupBlur = event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setFocusedKey(null);
  };

  return {
    carouselRef,
    frameRef,
    itemRefs,
    activeIndex,
    showStartFade: edges.start,
    showEndFade: edges.end,
    scrollToIndex,
    markChosenHere,
    step,
    onItemKeyDown,
    onItemFocus: setFocusedKey,
    onGroupBlur,
    tabStopKey: focusedKey || (keys.includes(selectedKey) ? selectedKey : keys[0])
  };
}
