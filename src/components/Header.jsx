import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowCounterClockwise } from '@phosphor-icons/react';
import { GlobalNav } from './GlobalNav';
import { UserMenu } from './UserMenu';
import { StepProgress } from './StepProgress';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { usePreferences } from '../contexts/PreferencesContext';

// Scroll thresholds - using viewport-relative values for mobile
const COMPACT_THRESHOLD = 32;
const HIDE_THRESHOLD_MIN = 180; // Minimum for small screens
const HIDE_THRESHOLD_RATIO = 0.2; // 20% of viewport height

export function Header({ steps, activeStep, onStepSelect, isShuffling }) {
  const prefersReducedMotion = useReducedMotion();
  const { personalization } = usePreferences();
  const displayName = personalization?.displayName?.trim();
  const [headerState, setHeaderState] = useState(() => ({
    isCompact: false,
    isHidden: false,
  }));
  const lastScrollYRef = useRef(0);
  const scrollRafRef = useRef(null);
  const isCleanedUpRef = useRef(false);
  const { isCompact, isHidden } = headerState;
  // Disable auto-hide for reduced motion users to prevent unexpected movement
  const shouldHideHeader = isHidden && !isShuffling && !prefersReducedMotion;

  // Calculate viewport-aware hide threshold
  const getHideThreshold = useCallback(() => {
    if (typeof window === 'undefined') return HIDE_THRESHOLD_MIN;
    // Use the larger of: minimum threshold OR 20% of viewport height
    const viewportThreshold = Math.round(window.innerHeight * HIDE_THRESHOLD_RATIO);
    return Math.max(HIDE_THRESHOLD_MIN, viewportThreshold);
  }, []);

  // Header collapse / auto-hide based on scroll
  useEffect(() => {
    if (typeof window === 'undefined') return;

    isCleanedUpRef.current = false;

    const updateHeaderState = () => {
      if (isCleanedUpRef.current) return;

      const currentY = window.scrollY || 0;
      const isScrollingDown = currentY > lastScrollYRef.current;
      const hideThreshold = getHideThreshold();

      const shouldCompact = currentY > COMPACT_THRESHOLD;
      // Only hide when scrolling down AND past threshold
      // Reveal immediately when scrolling up
      const shouldHide = isScrollingDown && currentY > hideThreshold;

      setHeaderState((prev) => {
        if (prev.isCompact === shouldCompact && prev.isHidden === shouldHide) {
          return prev;
        }
        return {
          isCompact: shouldCompact,
          isHidden: shouldHide,
        };
      });
      lastScrollYRef.current = currentY;
    };

    const handleScroll = () => {
      if (scrollRafRef.current || isCleanedUpRef.current) return;
      scrollRafRef.current = window.requestAnimationFrame(() => {
        if (!isCleanedUpRef.current) {
          updateHeaderState();
        }
        scrollRafRef.current = null;
      });
    };

    // Reset scroll tracking on resize/orientation change
    const handleResize = () => {
      lastScrollYRef.current = window.scrollY || 0;
      // Force re-evaluation after resize
      updateHeaderState();
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });
    updateHeaderState();

    return () => {
      isCleanedUpRef.current = true;
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      if (scrollRafRef.current) {
        window.cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
  }, [getHideThreshold]);

  // Logo height based on compact state and screen size
  // Mobile (< 640px) uses smaller logo to reduce header height
  const logoHeight = isCompact ? 40 : 56; // Reduced from 48/72

  return (
    <>
      {/* Main Header */}
      <header aria-labelledby="tableau-heading" className={isCompact ? 'header-condensed' : ''}>
        <div className="text-center mb-3 sm:mb-6 md:mb-8 mystic-heading-wrap flex flex-col items-center">
          <div
            className="transition-all duration-200 ease-out"
            style={{
              // Use margin adjustment for smooth visual transition instead of scale
              marginTop: isCompact ? '-8px' : '0',
              marginBottom: isCompact ? '-8px' : '0',
            }}
          >
            <img
              src="/images/tableu-logo-new.png"
              alt="Tableu - Tarot Reading Application"
              className="mb-2 opacity-90 hover:opacity-100 transition-opacity"
              style={{ height: logoHeight, width: 'auto' }}
            />
          </div>
          <h1 id="tableau-heading" className="sr-only">
            Tableu
          </h1>
          <p
            className={`
              mt-1 text-muted leading-relaxed max-w-2xl
              transition-all duration-200
              hidden sm:block
              ${isCompact
                ? 'text-xs opacity-0 h-0 overflow-hidden'
                : 'text-xs-plus sm:text-sm md:text-base opacity-100'
              }
            `}
            aria-hidden={isCompact}
          >
            Authentic tarot, thoughtfully interpreted.
          </p>
        </div>
      </header>

      {/* Sticky Navigation Bar */}
      <div
        className={`
          full-bleed sticky top-0 z-30 mb-5
          bg-surface/95 backdrop-blur
          border-y border-accent/20
          px-4 sm:px-5 md:px-6
          pr-[max(1rem,env(safe-area-inset-right))]
          pl-[max(1rem,env(safe-area-inset-left))]
          shadow-lg shadow-primary/20
          header-sticky
          ${isCompact ? 'header-sticky--compact' : ''}
          ${shouldHideHeader ? 'header-sticky--hidden' : ''}
        `}
      >
        <div className="header-sticky__row">
          <div className="header-sticky__nav">
            <GlobalNav condensed={isCompact} />
          </div>
          {/* Keep account access available in compact mode with a condensed trigger */}
          <div className="header-sticky__user">
            <UserMenu condensed={isCompact} />
          </div>
        </div>
        <div className="mt-2 sm:mt-1">
          {displayName && (
            <p className="text-[0.75rem] sm:text-xs text-muted mb-1">
              Welcome back, {displayName}.
            </p>
          )}
          <StepProgress
            steps={steps}
            activeStep={activeStep}
            onSelect={onStepSelect}
            condensed={isCompact}
          />
        </div>
        {isShuffling && (
          <div
            className="mt-2 pb-1 flex items-center gap-2 text-muted text-[clamp(0.85rem,2.4vw,0.95rem)] leading-snug"
            role="status"
            aria-live="polite"
          >
            <ArrowCounterClockwise className="w-4 h-4 animate-spin text-accent" aria-hidden="true" />
            <span>Shuffling the deck...</span>
          </div>
        )}
      </div>
    </>
  );
}
