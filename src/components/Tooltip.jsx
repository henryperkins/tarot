import React, { useEffect, useId, useRef, useState } from 'react';
import { Info } from 'lucide-react';

/**
 * Accessible tooltip component with keyboard, mouse, and touch support.
 *
 * @param {Object} props
 * @param {string} props.content - Tooltip text content
 * @param {React.ReactNode} [props.children] - Optional custom trigger element
 * @param {string} [props.position='top'] - Tooltip position: 'top' | 'bottom' | 'left' | 'right'
 * @param {string} [props.size='sm'] - Icon size: 'sm' | 'md' | 'lg'
 */
export function Tooltip({
  content,
  children,
  position = 'top',
  size = 'sm'
}) {
  const [isVisible, setIsVisible] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const tooltipRef = useRef(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!isVisible || typeof window === 'undefined') {
      return undefined;
    }

    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        setIsVisible(false);
      }
    };

    const handlePointerDown = event => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setIsVisible(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isVisible]);

  const sizeClasses = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-slate-800',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-slate-800',
    left: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-slate-800',
    right: 'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-slate-800'
  };

  const handleToggle = event => {
    event.preventDefault();
    setIsVisible(previous => !previous);
  };

  const handleMouseEnter = () => {
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    if (
      typeof document !== 'undefined' &&
      triggerRef.current &&
      triggerRef.current === document.activeElement
    ) {
      return;
    }
    setIsVisible(false);
  };

  const handleFocus = () => {
    setIsVisible(true);
  };

  const handleBlur = () => {
    const schedule =
      typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
        ? window.requestAnimationFrame
        : callback => {
            setTimeout(callback, 0);
          };

    schedule(() => {
      if (typeof document === 'undefined' || !rootRef.current) return;
      if (!rootRef.current.contains(document.activeElement)) {
        setIsVisible(false);
      }
    });
  };

  return (
    <div ref={rootRef} className="relative inline-flex items-center">
      <button
        type="button"
        ref={triggerRef}
        onClick={handleToggle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        aria-label="More information"
        aria-haspopup="true"
        aria-expanded={isVisible}
        aria-controls={isVisible ? tooltipId : undefined}
        className="inline-flex items-center justify-center text-amber-400/60 hover:text-amber-400 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/50 rounded-full"
      >
        {children || <Info className={sizeClasses[size]} />}
      </button>

      {/* Tooltip Content */}
      {isVisible && (
        <div
          role="tooltip"
          id={tooltipId}
          ref={tooltipRef}
          className={`absolute z-50 ${positionClasses[position]} max-w-xs`}
        >
          <div className="relative bg-slate-800 text-amber-50 text-xs rounded-lg px-3 py-2 shadow-xl border border-amber-500/20 whitespace-normal">
            {content}
            {/* Arrow */}
            <div
              className={`absolute w-0 h-0 border-4 ${arrowClasses[position]}`}
              aria-hidden="true"
            />
          </div>
        </div>
      )}
    </div>
  );
}
