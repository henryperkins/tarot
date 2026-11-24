import { useState, useRef, useEffect, useCallback, useId } from 'react';
import { GridFour, Question, Sparkle, Eye } from '@phosphor-icons/react';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useSmallScreen, TABLET_SCREEN_MAX } from '../hooks/useSmallScreen';

const STEP_ICONS = {
  'spread': GridFour,
  'intention': Question,
  'ritual': Sparkle,
  'reading': Eye
};

// Short labels for mobile (max ~10 chars for space efficiency)
const STEP_SHORT_LABELS = {
  'spread': 'Spread',
  'intention': 'Intent',
  'ritual': 'Ritual',
  'reading': 'Reading'
};

// Steps that are optional (shown with indicator)
const OPTIONAL_STEPS = new Set(['ritual']);

const NOTHING_FRESH = { current: null, completed: [] };

/**
 * Canvas reading progress: four plain-text steps along one hairline, the
 * reading thread. The thread is lit as far as the reading has reached, and the
 * step in view carries the candlelight and a short live note. A skipped ritual
 * keeps its numeral with a Skipped note.
 *
 * Each note sits over its step's button but outside it, so the button keeps a
 * stable accessible name and takes the note as its description.
 */
function CanvasStepProgress({ steps, activeStep, reachedStep, onSelect, completedIds, skippedIds, statuses, detailStep, detailOpen, detailId }) {
  const noteId = useId();
  const prefersReducedMotion = useReducedMotion();
  const completed = new Set(completedIds);
  const skipped = new Set(skippedIds);
  const states = steps.map(step => (
    step.id === activeStep ? 'current'
      : completed.has(step.id) ? 'completed'
        : skipped.has(step.id) ? 'skipped' : 'upcoming'
  ));
  // The thread stays lit through the furthest step reached, so revisiting an
  // earlier step moves the candlelight without dimming the way back.
  const reachedIndex = Math.max(
    steps.findIndex(step => step.id === activeStep),
    steps.findIndex(step => step.id === reachedStep),
    states.lastIndexOf('completed')
  );

  // A step that has just been completed draws its check, and the step that has
  // just become current lets its light settle. Nothing plays on first render.
  const stateKey = states.join(' ');
  const [seen, setSeen] = useState({ key: stateKey, states });
  const [fresh, setFresh] = useState(NOTHING_FRESH);
  if (seen.key !== stateKey) {
    setSeen({ key: stateKey, states });
    const changed = steps.filter((step, index) => states[index] !== seen.states[index]);
    setFresh(prefersReducedMotion ? NOTHING_FRESH : {
      current: changed.find(step => step.id === activeStep)?.id ?? null,
      completed: changed.filter(step => step.id !== activeStep && completed.has(step.id)).map(step => step.id)
    });
  }
  useEffect(() => {
    if (fresh === NOTHING_FRESH) return undefined;
    const timer = setTimeout(() => setFresh(NOTHING_FRESH), 1200);
    return () => clearTimeout(timer);
  }, [fresh]);

  return (
    <nav aria-label="Tarot reading progress" className="step-progress-canvas">
      <ol className="step-progress-canvas__list">
        {steps.map((step, index) => {
          const state = states[index];
          const isCurrent = state === 'current';
          const shortLabel = STEP_SHORT_LABELS[step.id] || step.label;
          const stateNote = state === 'completed' ? ', completed' : state === 'skipped' ? ', skipped' : '';
          const status = isCurrent ? statuses[step.id] : null;
          const statusText = typeof status === 'string' ? status : status?.text;
          const hasDetail = step.id === detailStep;
          const freshness = step.id === fresh.current ? 'current' : fresh.completed.includes(step.id) ? 'completed' : undefined;
          return (
            <li
              key={step.id}
              className="step-progress-canvas__item"
              data-step={step.id}
              data-step-state={state}
              data-thread={index <= reachedIndex ? 'lit' : 'unlit'}
              data-fresh={freshness}
            >
              <button
                type="button"
                onClick={() => onSelect?.(step.id)}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`Step ${index + 1}: ${step.label}${stateNote}`}
                aria-describedby={statusText ? `${noteId}-${step.id}` : undefined}
                aria-expanded={hasDetail ? Boolean(detailOpen) : undefined}
                aria-controls={hasDetail && detailOpen ? detailId : undefined}
                className={`step-progress-canvas__button ${isCurrent ? 'is-current' : ''} ${state === 'completed' ? 'is-completed' : ''}`}
              >
                <span className="step-progress-canvas__label">
                  <span className="step-progress-canvas__marker" aria-hidden="true">
                    {isCurrent ? <span className="step-progress-canvas__dot" />
                      : state === 'completed'
                        ? <svg className="step-progress-canvas__check" viewBox="0 0 16 16" focusable="false"><path d="M3 8.5 6.5 12 13 4.5" pathLength="1" /></svg>
                        : <span className="step-progress-canvas__number">{index + 1}</span>}
                  </span>
                  {/* The space keeps "3 Ritual" two words for label-in-name checks. */}
                  {' '}
                  <span>{shortLabel}</span>
                </span>
              </button>
              {/* The skipped state is already part of the button's name. */}
              {state === 'skipped'
                ? <span className="step-progress-canvas__note step-progress-canvas__note--skipped" aria-hidden="true">Skipped</span>
                : statusText
                  ? <span id={`${noteId}-${step.id}`} className="step-progress-canvas__note">
                    {statusText}{status.more ? <span className="step-progress-canvas__note-more">{status.more}</span> : null}
                  </span>
                  : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function StepProgress({ steps = [], activeStep, onSelect, condensed = false, readingView = false, quiet = false, completedIds = [], skippedIds = [], canvas = false, reachedStep = null, statuses = {}, detailStep = null, detailOpen = false, detailId }) {
  const [activeTooltip, setActiveTooltip] = useState(null);
  const tooltipTimeoutRef = useRef(null);
  const buttonRefs = useRef({});
  const isTouchActiveRef = useRef(false);
  const prefersReducedMotion = useReducedMotion();
  const isSmallScreen = useSmallScreen(TABLET_SCREEN_MAX);
  const showTooltips = !isSmallScreen;
  const shouldAnimateProgress = !isSmallScreen && !prefersReducedMotion;

  // Micro-celebration when advancing steps.
  const [celebrateStepId, setCelebrateStepId] = useState(null);
  const prevActiveStepRef = useRef(activeStep);

  useEffect(() => {
    const prev = prevActiveStepRef.current;
    prevActiveStepRef.current = activeStep;

    if (prefersReducedMotion) return;
    if (!activeStep) return;
    if (!prev || prev === activeStep) return;

    // Defer setState to avoid synchronous call in effect (satisfies react-hooks/set-state-in-effect)
    const showTimeout = setTimeout(() => setCelebrateStepId(activeStep), 0);
    const hideTimeout = setTimeout(() => setCelebrateStepId(null), 350);
    return () => {
      clearTimeout(showTimeout);
      clearTimeout(hideTimeout);
    };
  }, [activeStep, prefersReducedMotion]);

  // Clear tooltip timeout on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);

  const showTooltip = useCallback((stepId) => {
    if (!showTooltips) return;
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    setActiveTooltip(stepId);
  }, [showTooltips]);

  const hideTooltip = useCallback(() => {
    if (!showTooltips) return;
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    setActiveTooltip(null);
  }, [showTooltips]);

  const hideTooltipWithDelay = useCallback((delay = 1500) => {
    if (!showTooltips) return;
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    tooltipTimeoutRef.current = setTimeout(() => {
      setActiveTooltip(null);
      isTouchActiveRef.current = false;
    }, delay);
  }, [showTooltips]);

  // Handle touch start - show tooltip and mark touch as active
  const handleTouchStart = useCallback((stepId) => {
    if (!showTooltips) return;
    isTouchActiveRef.current = true;
    showTooltip(stepId);
  }, [showTooltips, showTooltip]);

  // Handle touch end - hide tooltip after delay
  const handleTouchEnd = useCallback(() => {
    if (!showTooltips) return;
    hideTooltipWithDelay(1500);
  }, [showTooltips, hideTooltipWithDelay]);

  // Mouse handlers that respect touch state to avoid race conditions
  const handleMouseEnter = useCallback((stepId) => {
    // Ignore mouse events during active touch interaction
    if (isTouchActiveRef.current) return;
    if (!showTooltips) return;
    showTooltip(stepId);
  }, [showTooltips, showTooltip]);

  const handleMouseLeave = useCallback(() => {
    // Ignore mouse events during active touch interaction
    if (isTouchActiveRef.current) return;
    if (!showTooltips) return;
    hideTooltip();
  }, [showTooltips, hideTooltip]);

  // Handle click outside to close tooltip
  useEffect(() => {
    if (!activeTooltip) return;
    if (!showTooltips) return;

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
  }, [activeTooltip, hideTooltip, showTooltips]);

  useEffect(() => {
    if (showTooltips) return;
    if (typeof window === 'undefined') return undefined;
    const frameId = window.requestAnimationFrame(() => setActiveTooltip(null));
    return () => window.cancelAnimationFrame(frameId);
  }, [showTooltips]);

  if (canvas) {
    return (
      <CanvasStepProgress
        steps={steps}
        activeStep={activeStep}
        reachedStep={reachedStep}
        onSelect={onSelect}
        completedIds={completedIds}
        skippedIds={skippedIds}
        statuses={statuses}
        detailStep={detailStep}
        detailOpen={detailOpen}
        detailId={detailId}
      />
    );
  }

  if (readingView || quiet) return <nav aria-label="Tarot reading progress"><ol>
    {steps.map((step, index) => <li key={step.id}><button type="button" onClick={() => onSelect?.(step.id)}
      aria-current={step.id === activeStep ? 'step' : undefined} aria-label={`Step ${index + 1}: ${step.label}`}>
      {STEP_SHORT_LABELS[step.id] || step.label}
    </button></li>)}
  </ol></nav>;

  return (
    <nav
      aria-label="Tarot reading progress"
      className={`w-full ${shouldAnimateProgress ? 'animate-fade-in' : ''}`}
    >
      <ol
        className={`flex ${condensed ? 'gap-1 xs:gap-1.5 py-1' : 'gap-1.5 xs:gap-2 sm:gap-3 pb-1'} overflow-x-auto overscroll-x-contain snap-x snap-mandatory`}
        role="list"
      >
        {steps.map((step, index) => {
          const isActive = step.id === activeStep;
          const isCelebrating = step.id === celebrateStepId;
          const StepIcon = STEP_ICONS[step.id];
          const shortLabel = STEP_SHORT_LABELS[step.id] || step.label;
          const isTooltipVisible = activeTooltip === step.id;

          // Calculate tooltip position adjustment for edge items
          const isFirstStep = index === 0;
          const isLastStep = index === steps.length - 1;

          return (
            <li key={step.id} className="flex-1 snap-start relative min-w-max">
              <button
                ref={(el) => { buttonRefs.current[step.id] = el; }}
                type="button"
                className={`
                  w-full rounded-xl border transition-all font-semibold
                  focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--focus-ring-color)
                  touch-manipulation active:scale-[0.97]
                  min-h-touch
                  ${isCelebrating ? 'motion-safe:animate-pop-in' : ''}
                  ${condensed
                    ? 'px-1.5 xs:px-2 sm:px-3 py-2 text-xs-plus'
                    : 'px-2 xs:px-3 sm:px-4 py-2 xs:py-2.5 text-xs-plus sm:text-sm'
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
                aria-describedby={showTooltips && isTooltipVisible ? `step-tooltip-${step.id}` : undefined}
              >
                <div className="flex items-center justify-center gap-0.5 xs:gap-1 sm:gap-2">
                  {StepIcon && (
                    <StepIcon
                      className={`hidden sm:block shrink-0 ${condensed ? 'w-4 h-4' : 'w-5 h-5'}`}
                      aria-hidden="true"
                    />
                  )}
                  {/* Compact labels through tablet widths; enlarged text can scroll. */}
                  <span className={`
                    font-semibold whitespace-nowrap
                    ${condensed
                      ? 'text-xs xs:text-xs-plus'
                      : 'text-xs xs:text-xs-plus sm:text-sm'
                    }
                    ${isActive ? 'text-main' : 'text-muted-high'}
                  `}>
                    <span className="lg:hidden">
                      {shortLabel}
                      {OPTIONAL_STEPS.has(step.id) && (
                        <span aria-hidden="true" className="text-muted/70 ml-0.5">*</span>
                      )}
                    </span>
                    <span className="hidden lg:inline">{step.label}</span>
                  </span>
                </div>
              </button>

              {/* Touch-friendly tooltip - positioned to avoid off-screen on edges */}
              <div
                id={`step-tooltip-${step.id}`}
                role="tooltip"
                className={`
                  ${showTooltips ? '' : 'hidden'}
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
                <div className="text-2xs xs:text-xs font-serif text-accent">{step.label}</div>
                <div className="text-2xs xs:text-xs text-muted mt-0.5">Step {index + 1} of {steps.length}</div>
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
