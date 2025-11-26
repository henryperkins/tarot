import { useState, useRef, useEffect, useCallback } from 'react';
import { GridFour, Question, Sparkle, Eye } from '@phosphor-icons/react';

const STEP_ICONS = {
  'spread': GridFour,
  'intention': Question,
  'ritual': Sparkle,
  'reading': Eye
};

// Short labels for mobile (max ~6 chars for space efficiency)
const STEP_SHORT_LABELS = {
  'spread': 'Spread',
  'intention': 'Intent',
  'ritual': 'Ritual',
  'reading': 'Read'
};

export function StepProgress({ steps = [], activeStep, onSelect, condensed = false }) {
  const [activeTooltip, setActiveTooltip] = useState(null);
  const tooltipTimeoutRef = useRef(null);
  const buttonRefs = useRef({});
  const isTouchActiveRef = useRef(false);

  // Clear tooltip timeout on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);

  const showTooltip = useCallback((stepId) => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    setActiveTooltip(stepId);
  }, []);

  const hideTooltip = useCallback(() => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    setActiveTooltip(null);
  }, []);

  const hideTooltipWithDelay = useCallback((delay = 1500) => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    tooltipTimeoutRef.current = setTimeout(() => {
      setActiveTooltip(null);
      isTouchActiveRef.current = false;
    }, delay);
  }, []);

  // Handle touch start - show tooltip and mark touch as active
  const handleTouchStart = useCallback((stepId) => {
    isTouchActiveRef.current = true;
    showTooltip(stepId);
  }, [showTooltip]);

  // Handle touch end - hide tooltip after delay
  const handleTouchEnd = useCallback(() => {
    hideTooltipWithDelay(1500);
  }, [hideTooltipWithDelay]);

  // Mouse handlers that respect touch state to avoid race conditions
  const handleMouseEnter = useCallback((stepId) => {
    // Ignore mouse events during active touch interaction
    if (isTouchActiveRef.current) return;
    showTooltip(stepId);
  }, [showTooltip]);

  const handleMouseLeave = useCallback(() => {
    // Ignore mouse events during active touch interaction
    if (isTouchActiveRef.current) return;
    hideTooltip();
  }, [hideTooltip]);

  // Handle click outside to close tooltip
  useEffect(() => {
    if (!activeTooltip) return;

    const handleClickOutside = (event) => {
      const activeButton = buttonRefs.current[activeTooltip];
      if (activeButton && !activeButton.contains(event.target)) {
        hideTooltip();
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        hideTooltip();
      }
    };

    document.addEventListener('pointerdown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [activeTooltip, hideTooltip]);

  return (
    <nav aria-label="Tarot reading progress" className="w-full animate-fade-in">
      <ol
        className={`flex ${condensed ? 'gap-1 xs:gap-1.5 py-1' : 'gap-1.5 xs:gap-2 sm:gap-3 pb-1'} overflow-x-auto snap-x snap-mandatory`}
        role="list"
      >
        {steps.map((step, index) => {
          const isActive = step.id === activeStep;
          const StepIcon = STEP_ICONS[step.id];
          const shortLabel = STEP_SHORT_LABELS[step.id] || step.label;
          const isTooltipVisible = activeTooltip === step.id;
          
          // Calculate tooltip position adjustment for edge items
          const isFirstStep = index === 0;
          const isLastStep = index === steps.length - 1;

          return (
            <li key={step.id} className="flex-1 snap-start relative min-w-0">
              <button
                ref={(el) => { buttonRefs.current[step.id] = el; }}
                type="button"
                className={`
                  w-full rounded-xl border transition-all font-semibold
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80
                  focus-visible:ring-offset-2 focus-visible:ring-offset-main
                  touch-manipulation active:scale-[0.97]
                  min-h-[44px]
                  ${condensed
                    ? 'px-1.5 xs:px-2 sm:px-3 py-2 text-[0.7rem] xs:text-[0.75rem]'
                    : 'px-2 xs:px-3 sm:px-4 py-2 xs:py-2.5 text-[0.72rem] xs:text-[0.78rem] sm:text-sm'
                  }
                  ${isActive
                    ? 'bg-primary/20 border-primary/80 text-main shadow-md shadow-primary/35'
                    : 'bg-surface border-secondary/40 text-muted hover:bg-surface-muted hover:border-secondary/60 active:bg-surface-muted'
                  }
                `}
                onClick={() => onSelect?.(step.id)}
                onMouseEnter={() => handleMouseEnter(step.id)}
                onMouseLeave={handleMouseLeave}
                onFocus={() => showTooltip(step.id)}
                onBlur={() => hideTooltip()}
                onTouchStart={() => handleTouchStart(step.id)}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={() => { isTouchActiveRef.current = false; hideTooltip(); }}
                aria-current={isActive ? 'step' : undefined}
                aria-label={`Step ${index + 1}: ${step.label}`}
                aria-describedby={isTooltipVisible ? `step-tooltip-${step.id}` : undefined}
              >
                <div className="flex items-center justify-center gap-1 xs:gap-1.5 sm:gap-2">
                  {StepIcon && (
                    <StepIcon
                      className={`shrink-0 ${condensed ? 'w-3.5 h-3.5 xs:w-4 xs:h-4' : 'w-3.5 h-3.5 xs:w-4 xs:h-4 sm:w-5 sm:h-5'}`}
                      aria-hidden="true"
                    />
                  )}
                  {/* Mobile: show short label, Desktop: show full label */}
                  <span className={`
                    font-semibold truncate
                    ${condensed
                      ? 'text-[0.65rem] xs:text-[0.7rem] text-secondary'
                      : 'text-[0.68rem] xs:text-[0.72rem] sm:text-[0.82rem]'
                    }
                    ${isActive ? 'text-main' : 'text-muted-high'}
                  `}>
                    <span className="sm:hidden">{shortLabel}</span>
                    <span className="hidden sm:inline">{step.label}</span>
                  </span>
                </div>
              </button>

              {/* Touch-friendly tooltip - positioned to avoid off-screen on edges */}
              <div
                id={`step-tooltip-${step.id}`}
                role="tooltip"
                className={`
                  absolute bottom-full mb-2
                  px-2.5 xs:px-3 py-1.5 bg-main border border-secondary/40 rounded-lg
                  shadow-lg whitespace-nowrap z-50
                  transition-all duration-200
                  ${isFirstStep 
                    ? 'left-0' 
                    : isLastStep 
                    ? 'right-0' 
                    : 'left-1/2 -translate-x-1/2'
                  }
                  ${isTooltipVisible
                    ? 'opacity-100 visible translate-y-0'
                    : 'opacity-0 invisible translate-y-1 pointer-events-none'
                  }
                `}
              >
                <div className="text-[0.7rem] xs:text-xs font-serif text-accent">{step.label}</div>
                <div className="text-[0.6rem] xs:text-[0.65rem] text-muted mt-0.5">Step {index + 1} of {steps.length}</div>
                {/* Arrow - positioned based on tooltip alignment */}
                <div
                  className={`absolute top-full -mt-1 border-4 border-transparent border-t-main ${
                    isFirstStep 
                      ? 'left-4' 
                      : isLastStep 
                      ? 'right-4' 
                      : 'left-1/2 -translate-x-1/2'
                  }`}
                  style={{ filter: 'drop-shadow(0 1px 0 rgba(0,0,0,0.1))' }}
                  aria-hidden="true"
                />
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
