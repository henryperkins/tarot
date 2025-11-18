import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { SPREADS } from '../data/spreads';
import { usePreferences } from '../contexts/PreferencesContext';

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
      <h2 className="text-lg sm:text-xl font-serif text-amber-200 mb-3 flex items-center gap-2">
        <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
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
                className={`relative flex flex-col justify-between rounded-2xl border px-3 py-3 sm:px-4 cursor-pointer select-none transition basis-[78%] shrink-0 snap-center sm:basis-auto ${isActive
                    ? 'bg-emerald-500/12 border-emerald-300/70 shadow-lg shadow-emerald-900/30'
                    : 'bg-slate-900/70 border-slate-700/60 hover:border-emerald-400/50 hover:bg-slate-900/90'
                  } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950`}
              >
                <div className="pr-16">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-serif font-semibold text-base text-amber-50">{spread.name}</div>
                    {spread.tag && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-emerald-400/60 text-[0.65rem] uppercase tracking-[0.18em] text-emerald-200">
                        {spread.tag}
                      </span>
                    )}
                  </div>
                  <p className="text-[clamp(0.85rem,2.4vw,0.95rem)] leading-snug text-amber-100/80 mt-1">
                    {spread.count} card{spread.count > 1 ? 's' : ''}
                  </p>
                </div>
                <p className="hidden sm:block text-sm opacity-90 mt-3 leading-snug text-amber-100/85">
                  {spread.mobileDescription || spread.description || 'Guided snapshot for your focus.'}
                </p>
                <div className="sm:hidden mt-3">
                  {isExpanded && (
                    <p className="text-amber-50/90 text-[0.9rem] leading-snug mb-2 animate-slide-up">
                      {spread.description || spread.mobileDescription || 'Guided snapshot for your focus.'}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={event => handleDetailsToggle(event, key)}
                    aria-expanded={isExpanded}
                    className="text-emerald-300 text-sm underline underline-offset-4"
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
              <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent"></div>
              <button
                type="button"
                onClick={() => {
                  carouselRef.current?.scrollBy({ left: -carouselRef.current.clientWidth * 0.8, behavior: 'smooth' });
                }}
                className="pointer-events-auto absolute top-1/2 -translate-y-1/2 left-2 inline-flex items-center justify-center rounded-full bg-slate-950/90 border border-slate-700/70 text-amber-100 w-9 h-9 shadow-lg shadow-slate-950/60"
                aria-label="See previous spreads"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </>
          )}
          {canScrollNext && (
            <>
              <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-slate-950 via-slate-950/80 to-transparent"></div>
              <button
                type="button"
                onClick={() => {
                  carouselRef.current?.scrollBy({ left: carouselRef.current.clientWidth * 0.8, behavior: 'smooth' });
                }}
                className="pointer-events-auto absolute top-1/2 -translate-y-1/2 right-2 inline-flex items-center justify-center rounded-full bg-slate-950/90 border border-slate-700/70 text-amber-100 w-9 h-9 shadow-lg shadow-slate-950/60"
                aria-label="See more spreads"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
      <p className="sm:hidden text-center text-xs text-emerald-300 mt-3">Swipe or tap arrows to explore more spreads.</p>
    </div>
  );
}
