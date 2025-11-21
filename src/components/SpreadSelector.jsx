import React, { useEffect, useRef, useState } from 'react';
import { Sparkle, CaretLeft, CaretRight, Check, Lightning, BookOpen, Eye, Path, Heart, Compass } from '@phosphor-icons/react';
import { SPREADS } from '../data/spreads';
import { usePreferences } from '../contexts/PreferencesContext';

const TAG_ICONS = {
  'Quick': Lightning,
  'Story': BookOpen,
  'Clarity': Eye,
  'Decision': Path,
  'Relationship': Heart,
  'Deep dive': Compass
};

export function SpreadSelector({
  selectedSpread,
  setSelectedSpread,
  onSpreadConfirm,
  knockTimesRef,
  // The following props are kept to reset parent state, although logic might move inside component over time
  // or be coordinated via context. For now, relying on parent passing setters is acceptable during this phase.
  setReading,
  setRevealedCards,
  setPersonalReading,
  setJournalStatus,
  setAnalyzingText,
  setIsGenerating,
  setDealIndex,
  setReflections,
  setHasKnocked,
  setHasCut,
  setCutIndex
}) {
  const [expandedSpread, setExpandedSpread] = useState(null);
  const carouselRef = useRef(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const { deckSize: activeDeckSize } = usePreferences();

  const updateScrollHints = () => {
    const el = carouselRef.current;
    if (!el) return;
    const tolerance = 4;
    setCanScrollPrev(el.scrollLeft > tolerance);
    setCanScrollNext(el.scrollLeft + el.clientWidth < el.scrollWidth - tolerance);
  };

  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;
    updateScrollHints();

    const handleScroll = () => updateScrollHints();
    el.addEventListener('scroll', handleScroll, { passive: true });
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleScroll);
    }
    return () => {
      el.removeEventListener('scroll', handleScroll);
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleScroll);
      }
    };
  }, []);

  useEffect(() => {
    updateScrollHints();
  }, [selectedSpread]);

  const handleSpreadSelection = key => {
    setSelectedSpread(key);
    // These resets are important for UX continuity when switching spreads
    if (setReading) setReading(null);
    if (setRevealedCards) setRevealedCards(new Set());
    if (setPersonalReading) setPersonalReading(null);
    if (setJournalStatus) setJournalStatus(null);
    if (setAnalyzingText) setAnalyzingText('');
    if (setIsGenerating) setIsGenerating(false);
    if (setDealIndex) setDealIndex(0);
    if (setReflections) setReflections({});
    if (setHasKnocked) setHasKnocked(false);
    if (setHasCut) setHasCut(false);
    if (setCutIndex) setCutIndex(Math.floor(activeDeckSize / 2));

    if (knockTimesRef && knockTimesRef.current) {
      knockTimesRef.current = [];
    }

    setExpandedSpread(null);
    if (onSpreadConfirm) onSpreadConfirm(key);
  };

  const handleCardKeyDown = (event, key) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleSpreadSelection(key);
    }
  };

  const handleDetailsToggle = (event, key) => {
    event.stopPropagation();
    event.preventDefault();
    setExpandedSpread(prev => (prev === key ? null : key));
  };

  return (
    <div className="modern-surface p-4 sm:p-6 mb-6 sm:mb-8 animate-fade-in">
      <h2 className="text-lg sm:text-xl font-serif text-accent mb-3 flex items-center gap-2">
        <Sparkle className="w-4 h-4 sm:w-5 sm:h-5" />
        Choose Your Spread
      </h2>
      <div className="relative">
        <div
          ref={carouselRef}
          role="radiogroup"
          aria-label="Choose your spread"
          className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 sm:overflow-visible sm:snap-none sm:grid sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 sm:gap-3"
        >
          {Object.entries(SPREADS).map(([key, spread]) => {
            const isActive = selectedSpread === key;
            const isExpanded = expandedSpread === key;
            return (
              <article
                key={key}
                role="radio"
                tabIndex={0}
                aria-checked={isActive}
                onClick={() => handleSpreadSelection(key)}
                onKeyDown={event => handleCardKeyDown(event, key)}
                className={`relative flex flex-col justify-between rounded-2xl border-2 px-3 py-3 sm:px-4 cursor-pointer select-none transition basis-[78%] shrink-0 snap-center sm:basis-auto ${isActive
                  ? 'bg-primary/15 border-primary shadow-lg shadow-primary/20'
                  : 'bg-surface-muted/70 border-secondary/30 hover:border-primary/50 hover:bg-surface-muted/90'
                  } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-main`}
              >
                {/* Selected indicator */}
                {isActive && (
                  <div className="absolute top-3 right-3">
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-4 h-4 text-surface" strokeWidth={3} />
                    </div>
                  </div>
                )}

                <div className="pr-16">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-serif font-semibold text-base text-main">{spread.name}</div>
                    {spread.tag && TAG_ICONS[spread.tag] && (
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-accent/60 text-accent" title={spread.tag} aria-label={spread.tag}>
                        {React.createElement(TAG_ICONS[spread.tag], { className: 'w-3.5 h-3.5', 'aria-hidden': 'true' })}
                      </span>
                    )}
                  </div>
                  <p className="text-[clamp(0.85rem,2.4vw,0.95rem)] leading-snug text-muted mt-1">
                    {spread.count} card{spread.count > 1 ? 's' : ''}
                  </p>
                </div>
                <p className="hidden sm:block text-sm opacity-90 mt-3 leading-snug text-muted">
                  {spread.mobileDescription || spread.description || 'Guided snapshot for your focus.'}
                </p>
                <div className="sm:hidden mt-3">
                  {isExpanded && (
                    <p className="text-main/90 text-[0.9rem] leading-snug mb-2 animate-slide-up">
                      {spread.description || spread.mobileDescription || 'Guided snapshot for your focus.'}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={event => handleDetailsToggle(event, key)}
                    aria-expanded={isExpanded}
                    className="text-accent text-sm underline underline-offset-4"
                  >
                    {isExpanded ? 'Hide details' : 'More about this spread'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {/* Mobile scroll affordances */}
        <div className="sm:hidden pointer-events-none">
          {canScrollPrev && (
            <>
              <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-main via-main/80 to-transparent"></div>
              <button
                type="button"
                onClick={() => {
                  carouselRef.current?.scrollBy({ left: -carouselRef.current.clientWidth * 0.8, behavior: 'smooth' });
                }}
                className="pointer-events-auto absolute top-1/2 -translate-y-1/2 left-2 inline-flex items-center justify-center rounded-full bg-main/90 border border-accent/20 text-muted w-9 h-9 shadow-lg shadow-main/60"
                aria-label="See previous spreads"
              >
                <CaretLeft className="w-4 h-4" />
              </button>
            </>
          )}
          {canScrollNext && (
            <>
              <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-main via-main/80 to-transparent"></div>
              <button
                type="button"
                onClick={() => {
                  carouselRef.current?.scrollBy({ left: carouselRef.current.clientWidth * 0.8, behavior: 'smooth' });
                }}
                className="pointer-events-auto absolute top-1/2 -translate-y-1/2 right-2 inline-flex items-center justify-center rounded-full bg-main/90 border border-accent/20 text-muted w-9 h-9 shadow-lg shadow-main/60"
                aria-label="See more spreads"
              >
                <CaretRight className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
      <p className="sm:hidden text-center text-xs text-muted mt-3">Swipe or tap arrows to explore more spreads.</p>
    </div>
  );
}
