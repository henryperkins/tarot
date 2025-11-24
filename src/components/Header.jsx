import { useState, useEffect, useRef } from 'react';
import { ArrowCounterClockwise } from '@phosphor-icons/react';
import { TableuLogo } from './TableuLogo';
import { GlobalNav } from './GlobalNav';
import { UserMenu } from './UserMenu';
import { StepProgress } from './StepProgress';

export function Header({ steps, activeStep, onStepSelect, isShuffling }) {
  const [headerState, setHeaderState] = useState(() => ({
    isCompact: false,
    isHidden: false,
  }));
  const lastScrollYRef = useRef(0);
  const scrollRafRef = useRef(null);
  const { isCompact, isHidden } = headerState;
  const shouldHideHeader = isHidden && !isShuffling;

  // Header collapse / auto-hide based on scroll
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateHeaderState = () => {
      const currentY = window.scrollY || 0;
      const isScrollingDown = currentY > lastScrollYRef.current;
      const shouldCompact = currentY > 32;
      const shouldHide = isScrollingDown && currentY > 140;

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
      if (scrollRafRef.current) return;
      scrollRafRef.current = window.requestAnimationFrame(() => {
        updateHeaderState();
        scrollRafRef.current = null;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    updateHeaderState();
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollRafRef.current) {
        window.cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
  }, []);

  return (
    <>
      {/* Main Header */}
      <header aria-labelledby="tableau-heading" className={isCompact ? 'header-condensed' : ''}>
        <div className="text-center mb-6 sm:mb-8 mystic-heading-wrap flex flex-col items-center">
          <div
            style={{
              transform: isCompact ? 'scale(0.667)' : 'scale(1)',
              transition: 'transform 200ms ease',
              transformOrigin: 'center',
            }}
          >
            <TableuLogo
              variant="full"
              size={96}
              className="mb-2 opacity-90 hover:opacity-100 transition-opacity"
              outline
              glow
              useRaster
              ariaLabel="Tableu - Tarot Reading Application"
            />
          </div>
          <h1 id="tableau-heading" className="sr-only">
            Tableu
          </h1>
          <p className="mt-1 text-muted text-xs-plus sm:text-sm md:text-base leading-relaxed max-w-2xl">
            Authentic tarot, thoughtfully interpreted.
          </p>
        </div>
      </header>

      {/* Sticky Navigation Bar */}
      <div
        className={`full-bleed sticky top-0 z-30 mb-5 bg-surface/95 backdrop-blur border-y border-accent/20 px-4 sm:px-5 md:px-6 shadow-lg shadow-primary/20 header-sticky ${isCompact ? 'header-sticky--compact' : ''} ${shouldHideHeader ? 'header-sticky--hidden' : ''}`}
      >
        <div className="header-sticky__row">
          <div className="header-sticky__nav">
            <GlobalNav condensed={isCompact} />
          </div>
          {!isCompact && (
            <div className="header-sticky__user">
              <UserMenu />
            </div>
          )}
        </div>
        <StepProgress steps={steps} activeStep={activeStep} onSelect={onStepSelect} condensed={isCompact} />
        {isShuffling && (
          <div className="mt-2 flex items-center gap-2 text-muted text-[clamp(0.85rem,2.4vw,0.95rem)] leading-snug" role="status" aria-live="polite">
            <ArrowCounterClockwise className="w-3.5 h-3.5 animate-spin text-accent" aria-hidden="true" />
            <span>Shuffling the deck...</span>
          </div>
        )}
      </div>
    </>
  );
}
