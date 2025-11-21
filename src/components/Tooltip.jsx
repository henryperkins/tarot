import React, { useEffect, useId, useRef, useState } from 'react';
import { Info } from '@phosphor-icons/react';

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
  size = 'sm',
  triggerClassName = '',
  ariaLabel = 'More information',
  asChild = false,
  enableClick = true
}) {
  const [isVisible, setIsVisible] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const tooltipRef = useRef(null);
  const tooltipId = useId();
  const touchHideTimeoutRef = useRef(null);

  const clearTouchHideTimeout = () => {
    if (touchHideTimeoutRef.current) {
      clearTimeout(touchHideTimeoutRef.current);
      touchHideTimeoutRef.current = null;
    }
  };

  const showTooltip = () => {
    clearTouchHideTimeout();
    setIsVisible(true);
  };

  const hideTooltip = () => {
    clearTouchHideTimeout();
    setIsVisible(false);
  };

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

  useEffect(() => () => clearTouchHideTimeout(), []);

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
    top: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-surface-muted',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-surface-muted',
    left: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-surface-muted',
    right: 'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-surface-muted'
  };

  const handleToggle = event => {
    event.preventDefault();
    event.stopPropagation();
    setIsVisible(previous => !previous);
  };

  const handleMouseEnter = () => {
    showTooltip();
  };

  const handlePointerEnter = () => {
    showTooltip();
  };

  const handlePointerLeave = () => {
    if (
      typeof document !== 'undefined' &&
      triggerRef.current &&
      triggerRef.current === document.activeElement
    ) {
      return;
    }
    hideTooltip();
  };

  const handleFocus = () => {
    showTooltip();
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
        hideTooltip();
      }
    });
  };

  const handleTouchStart = event => {
    if (event.touches.length > 1) return;
    showTooltip();
  };

  const handleTouchEnd = () => {
    clearTouchHideTimeout();
    touchHideTimeoutRef.current = setTimeout(() => {
      hideTooltip();
    }, 1600);
  };

  const handleTouchCancel = () => {
    hideTooltip();
  };

  const triggerBaseClass =
    'inline-flex items-center justify-center text-accent/60 hover:text-accent transition-colors focus:outline-none focus:ring-2 focus:ring-accent/50 rounded-full';

  const rootBaseClass = asChild ? 'relative block' : 'relative inline-flex items-center';

  const triggerProps = {
    ref: triggerRef,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handlePointerLeave,
    onPointerEnter: handlePointerEnter,
    onPointerLeave: handlePointerLeave,
    onFocus: handleFocus,
    onBlur: handleBlur,
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: handleTouchCancel,
    'aria-haspopup': true,
    'aria-expanded': isVisible,
    'aria-controls': isVisible ? tooltipId : undefined
  };

  if (enableClick) {
    triggerProps.onClick = handleToggle;
  }

  const shouldShow = isVisible && content;

  return (
    <div ref={rootRef} className={rootBaseClass}>
      {asChild ? (
        <div
          {...triggerProps}
          role={enableClick ? "button" : undefined}
          className={triggerClassName || 'inline-flex'}
        >
          {children}
        </div>
      ) : (
        <button
          type="button"
          {...triggerProps}
          aria-label={ariaLabel}
          className={`${triggerBaseClass} ${triggerClassName}`.trim()}
        >
          {children || <Info className={sizeClasses[size]} />}
        </button>
      )}

      {/* Tooltip Content */}
      {shouldShow && (
        <div
          role="tooltip"
          id={tooltipId}
          ref={tooltipRef}
          className={`absolute z-50 ${positionClasses[position]} max-w-xs`}
        >
          <div className="relative bg-surface-muted text-main text-xs rounded-lg px-3 py-2 shadow-xl border border-primary/20 whitespace-normal">
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
