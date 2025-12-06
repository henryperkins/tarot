import { useRef, useEffect } from 'react';

/**
 * useAutoGrow - Auto-resize textarea based on content
 *
 * Creates a ref for a textarea that automatically grows/shrinks
 * based on its content, within specified row bounds.
 *
 * @param {string} value - The current textarea value (triggers resize on change)
 * @param {number} minRows - Minimum number of rows (default: 1)
 * @param {number} maxRows - Maximum number of rows before scrolling (default: 4)
 * @returns {React.RefObject} - Ref to attach to the textarea element
 *
 * @example
 * const textareaRef = useAutoGrow(value, 1, 4);
 * <textarea ref={textareaRef} value={value} onChange={...} />
 */
export function useAutoGrow(value, minRows = 1, maxRows = 4) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Reset height to auto to measure true scrollHeight
    el.style.height = 'auto';

    const style = getComputedStyle(el);
    const lineHeight = parseInt(style.lineHeight, 10) || 24;
    const paddingTop = parseInt(style.paddingTop, 10) || 0;
    const paddingBottom = parseInt(style.paddingBottom, 10) || 0;
    const paddingY = paddingTop + paddingBottom;

    const minHeight = lineHeight * minRows + paddingY;
    const maxHeight = lineHeight * maxRows + paddingY;

    // Clamp scrollHeight within bounds
    const newHeight = Math.min(Math.max(el.scrollHeight, minHeight), maxHeight);
    el.style.height = `${newHeight}px`;

    // Enable scrolling only when at max height
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [value, minRows, maxRows]);

  return ref;
}
