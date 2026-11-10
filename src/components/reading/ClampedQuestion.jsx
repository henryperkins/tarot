import { useId, useLayoutEffect, useRef, useState } from 'react';

const TOGGLE_CLASS = 'mt-1 inline-flex min-h-touch items-center rounded-sm text-sm font-medium text-accent underline underline-offset-4 decoration-current transition-colors hover:text-main touch-manipulation focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring-color)';

/**
 * The question frames the cards; it must not push them off the screen. Long
 * questions show four lines and offer the rest. Clamping is visual only, so
 * assistive technology still receives the whole question.
 */
export function ClampedQuestion({ text, className = '' }) {
  const textRef = useRef(null);
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);

  useLayoutEffect(() => {
    const element = textRef.current;
    if (!element || expanded) return undefined;
    const measure = () => setClamped(element.scrollHeight > element.clientHeight + 1);
    measure();
    if (typeof ResizeObserver !== 'function') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text, expanded]);

  return (
    <>
      <p ref={textRef} id={id} dir="auto" className={`${className} ${expanded ? '' : 'line-clamp-4'}`.trim()}>{text}</p>
      {(clamped || expanded) && (
        <button
          type="button"
          className={TOGGLE_CLASS}
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded(value => !value)}
        >
          {expanded ? 'Show less' : 'Show full question'}
        </button>
      )}
    </>
  );
}
