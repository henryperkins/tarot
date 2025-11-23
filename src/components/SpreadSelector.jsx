import { useEffect, useRef, useState } from 'react';
import { Sparkle, CaretLeft, CaretRight, Check, Lightning, BookOpen, Eye, Path, Heart, Compass } from './icons';
import { Icon, ICON_SIZES } from './Icon';
import { SPREADS } from '../data/spreads';
import { usePreferences } from '../contexts/PreferencesContext';
import { SpreadPatternThumbnail } from './SpreadPatternThumbnail';

const TAG_ICONS = {
  'Quick': Lightning,
  'Story': BookOpen,
  'Clarity': Eye,
  'Decision': Path,
  'Relationship': Heart,
  'Deep dive': Compass
};

const RECOMMENDED_SPREADS = new Set(['single', 'threeCard']);

function getComplexity(count) {
  if (count <= 1) return { label: 'Quick draw', tone: 'bg-primary/15 border-primary/60 text-main' };
  if (count <= 3) return { label: 'Beginner friendly', tone: 'bg-secondary/15 border-secondary/70 text-main' };
  if (count <= 5) return { label: 'Guided depth', tone: 'bg-secondary/20 border-secondary/70 text-main' };
  return { label: 'Deep dive', tone: 'bg-primary/20 border-primary/70 text-main' };
}

export function SpreadSelector({
  selectedSpread,
  onSelectSpread,
  onSpreadConfirm
}) {
  const [expandedSpread, setExpandedSpread] = useState(null);
  const carouselRef = useRef(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
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
    if (onSelectSpread) {
      onSelectSpread(key);
    }
    setExpandedSpread(null);
    if (onSpreadConfirm) {
      onSpreadConfirm(key);
    }
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
        <Icon icon={Sparkle} size={ICON_SIZES.md} className="sm:w-5 sm:h-5" decorative />
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
            const baseDescription = spread.mobileDescription || spread.description || 'Guided snapshot for your focus.';
            const desktopDescription = baseDescription.length > 120 ? `${baseDescription.slice(0, 117)}…` : baseDescription;
            const complexity = getComplexity(spread.count);
            const isRecommended = RECOMMENDED_SPREADS.has(key);
            return (
              <article
                key={key}
                role="radio"
                tabIndex={0}
                aria-checked={isActive}
                onClick={() => handleSpreadSelection(key)}
                onKeyDown={event => handleCardKeyDown(event, key)}
                className={`relative flex flex-col justify-between rounded-2xl border-2 px-3 py-3 sm:px-4 cursor-pointer select-none transition basis-[78%] shrink-0 snap-center sm:basis-auto ${isActive
                  ? 'bg-primary/20 border-primary shadow-lg shadow-primary/20'
                  : 'bg-surface-muted border-secondary/50 hover:border-primary/50 hover:bg-surface-muted/90'
                } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/90 focus-visible:ring-offset-2 focus-visible:ring-offset-main`}
              >
                {/* Selected indicator */}
                {isActive && (
                  <div className="absolute top-3 right-3">
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-4 h-4 text-surface" weight="bold" aria-hidden="true" />
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 pr-16">
                    <div className="font-serif font-semibold text-base text-main leading-snug">{spread.name}</div>
                    {spread.tag && TAG_ICONS[spread.tag] && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-accent/60 px-2 py-1 text-[0.7rem] text-accent bg-surface/60" title={spread.tag} aria-label={spread.tag}>
                        <Icon icon={TAG_ICONS[spread.tag]} size={ICON_SIZES.sm} decorative />
                        <span className="hidden sm:inline">{spread.tag}</span>
                      </span>
                    )}
                  </div>

                  {/* Visual pattern thumbnail */}
                  <div className="hidden sm:block w-full h-20 rounded-lg border border-secondary/30 bg-surface/40 p-2 overflow-hidden">
                    <SpreadPatternThumbnail spreadKey={key} className="w-full h-full opacity-80" />
                  </div>
                  <div className="space-y-2">
                    {(isRecommended || complexity) && (
                      <div className="flex flex-wrap items-center gap-2">
                        {isRecommended && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-primary/70 bg-primary/20 px-2.5 py-1 text-[0.72rem] font-semibold text-main shadow-sm shadow-primary/20">
                            <Icon icon={Sparkle} size={ICON_SIZES.sm} decorative />
                            <span>Recommended</span>
                          </span>
                        )}
                        {complexity && (
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[0.72rem] font-semibold ${complexity.tone}`}>
                            {complexity.label}
                          </span>
                        )}
                      </div>
                    )}
                    <p className="text-[clamp(0.85rem,2.4vw,0.95rem)] leading-snug text-muted">
                      {spread.count} card{spread.count > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <p className="hidden sm:block text-sm opacity-90 leading-snug text-muted">
                  {desktopDescription}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5" aria-hidden="true">
                  {Array.from({ length: Math.min(spread.count, 10) }).map((_, positionIndex) => (
                    <span
                      key={positionIndex}
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border text-[0.7rem] font-semibold ${
                        isActive ? 'border-primary/70 bg-primary/15 text-main' : 'border-secondary/50 bg-surface text-muted'
                      }`}
                    >
                      {positionIndex + 1}
                    </span>
                  ))}
                  {spread.count > 10 && (
                    <span className="inline-flex items-center justify-center px-3 h-8 rounded-lg border border-secondary/50 bg-surface text-[0.7rem] text-muted">
                      +{spread.count - 10} more
                    </span>
                  )}
                </div>
                <span className="sr-only">Layout preview showing {spread.count} card positions</span>
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
                <Icon icon={CaretLeft} size={ICON_SIZES.md} decorative />
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
                <Icon icon={CaretRight} size={ICON_SIZES.md} decorative />
              </button>
            </>
          )}
        </div>
      </div>
      <p className="sm:hidden text-center text-xs text-muted mt-3">Swipe or tap arrows to explore more spreads.</p>
    </div>
  );
}
