import { useRef, useEffect, useLayoutEffect, useCallback } from 'react';

/**
 * useAutoGrow - Auto-resize textarea based on content
 *
 * Creates a ref for a textarea that automatically grows/shrinks
 * based on its content, within specified row bounds.
 *
 * @param {string} value - The current textarea value (triggers resize on change)
 * @param {number} minRows - Minimum number of rows (default: 1)
 * @param {number} maxRows - Maximum rows before scrolling; Infinity expands all content
 * @param {boolean} active - Whether the field is currently shown (default: true)
 * @returns {React.RefObject} - Ref to attach to the textarea element
 *
 * @example
 * const textareaRef = useAutoGrow(value, 1, 4);
 * <textarea ref={textareaRef} value={value} onChange={...} />
 */
export function useAutoGrow(value, minRows = 1, maxRows = 4, active = true) {
  const ref = useRef(null);

  const fit = useCallback(() => {
    const el = ref.current;
    if (!active || !el || !el.getClientRects().length) return;

    // Measuring a long editor briefly shrinks it. Keep its scrolling parent
    // in place so typing halfway through a draft does not jump the sheet.
    let scroller = el.parentElement;
    while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) {
      scroller = scroller.parentElement;
    }
    const scrollTop = scroller?.scrollTop;

    el.style.height = 'auto';

    const style = getComputedStyle(el);
    const lineHeight = parseFloat(style.lineHeight) || 24;
    const paddingY = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
    const borderY = (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0);
    const minHeight = lineHeight * minRows + paddingY + borderY;
    const maxHeight = lineHeight * maxRows + paddingY + borderY;
    const contentHeight = el.scrollHeight + borderY;
    const newHeight = Math.min(Math.max(contentHeight, minHeight), maxHeight);
    el.style.height = `${style.boxSizing === 'border-box' ? newHeight : newHeight - paddingY - borderY}px`;
    el.style.overflowY = contentHeight > maxHeight ? 'auto' : 'hidden';
    if (scroller) scroller.scrollTop = scrollTop;
  }, [active, minRows, maxRows]);

  useLayoutEffect(fit, [value, fit]);

  useEffect(() => {
    const el = ref.current;
    if (!active || !el) return undefined;
    let frame = 0;
    let previousSize = '';
    const scheduleFit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(([entry]) => {
      const style = getComputedStyle(el);
      const size = `${entry.contentRect.width}:${style.fontSize}:${style.lineHeight}`;
      // A height change from fitting the draft must not schedule another fit.
      if (size === previousSize) return;
      previousSize = size;
      scheduleFit();
    });
    observer?.observe(el);
    document.fonts?.addEventListener('loadingdone', scheduleFit);

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      document.fonts?.removeEventListener('loadingdone', scheduleFit);
    };
  }, [active, fit]);

  return ref;
}
