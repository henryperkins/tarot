import { useEffect, useId, useRef, useState } from 'react';
import { Info } from '@phosphor-icons/react';

// Viewport padding for collision detection
const VIEWPORT_PADDING = 8;

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
  enableClick = true,
  autoHideMs = 3000,
  showCloseButton = false,
  closeLabel = 'Close'
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [adjustedPosition, setAdjustedPosition] = useState(null);
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

  // Viewport collision detection - adjust tooltip position if it would overflow
  useEffect(() => {
    if (!isVisible || !tooltipRef.current || typeof window === 'undefined') {
      return;
    }

    // Use requestAnimationFrame to ensure tooltip is rendered before measuring
    // All setState calls happen inside rAF callback to avoid cascading renders
    const rafId = requestAnimationFrame(() => {
      const tooltip = tooltipRef.current;
      if (!tooltip) {
        setAdjustedPosition(null);
        return;
      }

      const rect = tooltip.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let newPosition = position;
      let horizontalOffset = 0;

      // Check vertical overflow for top/bottom positions
      if (position === 'top' && rect.top < VIEWPORT_PADDING) {
        newPosition = 'bottom';
      } else if (position === 'bottom' && rect.bottom > viewportHeight - VIEWPORT_PADDING) {
        newPosition = 'top';
      }

      // Check horizontal overflow for left/right positions
      if (position === 'left' && rect.left < VIEWPORT_PADDING) {
        newPosition = 'right';
      } else if (position === 'right' && rect.right > viewportWidth - VIEWPORT_PADDING) {
        newPosition = 'left';
      }

      // For top/bottom positions, check horizontal overflow and adjust
      if (position === 'top' || position === 'bottom' || newPosition === 'top' || newPosition === 'bottom') {
        if (rect.left < VIEWPORT_PADDING) {
          horizontalOffset = VIEWPORT_PADDING - rect.left;
        } else if (rect.right > viewportWidth - VIEWPORT_PADDING) {
          horizontalOffset = viewportWidth - VIEWPORT_PADDING - rect.right;
        }
      }

      // Only update if there's a change
      if (newPosition !== position || horizontalOffset !== 0) {
        setAdjustedPosition({ position: newPosition, horizontalOffset });
      } else {
        setAdjustedPosition(null);
      }
    });

    return () => cancelAnimationFrame(rafId);
  }, [isVisible, position]);

  // Icon sizes (visual appearance inside the touch target)
  const iconSizeClasses = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  /**
   * Touch target sizes - minimum 44x44px for WCAG 2.5.8 compliance.
   *
   * Note: 'sm' and 'md' have identical touch targets (44x44px) intentionally.
   * The size prop controls the visual icon size, not the touch target.
   * All sizes meet WCAG 2.5.8 minimum requirements:
   * - sm/md: 44x44px (minimum compliant)
   * - lg: 48x48px (comfortable for primary actions)
   */
  const touchTargetClasses = {
    sm: 'min-w-touch min-h-touch w-11 h-11',
    md: 'min-w-touch min-h-touch w-11 h-11',
    lg: 'min-w-[48px] min-h-cta w-12 h-12'
  };

  // If the caller supplies custom children (e.g., a pill or chip), do not force a
  // fixed square size (w-11 h-11) which can truncate the effective hit target.
  // Keep the minimum touch size, but allow the trigger to expand naturally.
  const resolvedTouchTargetClass = children
    ? 'min-w-touch min-h-touch'
    : touchTargetClasses[size];

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
    if (typeof autoHideMs === 'number') {
      touchHideTimeoutRef.current = setTimeout(() => {
        hideTooltip();
      }, autoHideMs);
    }
  };

  const handleTouchCancel = () => {
    hideTooltip();
  };

  // Base trigger class with proper touch target and visual centering
  const triggerBaseClass =
    'inline-flex items-center justify-center text-accent/60 hover:text-accent transition-colors focus:outline-none focus:ring-2 focus:ring-accent/50 rounded-full touch-manipulation';

  const rootBaseClass = asChild ? 'relative block' : 'relative inline-flex items-center';

  // ARIA pattern for tooltips:
  // - Use aria-describedby to associate trigger with tooltip content
  // - aria-expanded indicates toggle state for interactive triggers
  // - Don't use aria-haspopup (that's for menus/dialogs, not tooltips)
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
    onClick: enableClick ? handleToggle : undefined,
    'aria-describedby': isVisible ? tooltipId : undefined,
    'aria-expanded': enableClick ? isVisible : undefined
  };

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
          className={`${triggerBaseClass} ${resolvedTouchTargetClass} ${triggerClassName}`.trim()}
        >
          {children || <Info className={iconSizeClasses[size]} />}
        </button>
      )}

      {/* Tooltip Content */}
      {shouldShow && (() => {
        const effectivePosition = adjustedPosition?.position || position;
        const horizontalOffset = adjustedPosition?.horizontalOffset || 0;

        return (
          <div
            role="tooltip"
            id={tooltipId}
            ref={tooltipRef}
            className={`absolute z-50 ${positionClasses[effectivePosition]} max-w-xs`}
            style={horizontalOffset ? { transform: `translateX(calc(-50% + ${horizontalOffset}px))` } : undefined}
          >
            <div className="relative bg-surface-muted text-main text-xs rounded-lg px-3 py-2 shadow-xl border border-primary/20 whitespace-pre-line">
              {showCloseButton && (
                <button
                  type="button"
                  onClick={hideTooltip}
                  className="absolute top-1 right-1 text-muted hover:text-main focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/60 rounded"
                  aria-label={closeLabel}
                >
                  ×
                </button>
              )}
              {content}
              {/* Arrow */}
              <div
                className={`absolute w-0 h-0 border-4 ${arrowClasses[effectivePosition]}`}
                style={horizontalOffset ? { transform: `translateX(calc(-50% - ${horizontalOffset}px))` } : undefined}
                aria-hidden="true"
              />
            </div>
          </div>
        );
      })()}
    </div>
  );
}
