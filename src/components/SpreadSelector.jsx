import { useRef, useState, useEffect, useCallback } from 'react';
import { Sparkle, Check, Star, CaretRight, Lock } from './icons';
import { Icon } from './Icon';
import { SPREADS } from '../data/spreads';
import { SpreadPatternThumbnail } from './SpreadPatternThumbnail';
import { CarouselDots } from './CarouselDots';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useLandscape } from '../hooks/useLandscape';
import { useSmallScreen } from '../hooks/useSmallScreen';
import { usePreferences } from '../contexts/PreferencesContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { UpgradeNudge } from './UpgradeNudge';
import { getSpreadFromDepth } from '../utils/personalization';
import { getSpreadArt, preloadAllSpreadArt } from '../utils/spreadArt';

const STAR_TOTAL = 3;

function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return null;
  const normalized = hex.trim().replace('#', '');
  if (!/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalized)) return null;
  if (normalized.length === 3) {
    const r = parseInt(normalized[0] + normalized[0], 16);
    const g = parseInt(normalized[1] + normalized[1], 16);
    const b = parseInt(normalized[2] + normalized[2], 16);
    return { r, g, b };
  }
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return { r, g, b };
}

function toRgba(color, alpha) {
  const rgb = hexToRgb(color);
  if (rgb) return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  if (!color || typeof color !== 'string') return `rgba(0, 0, 0, ${alpha})`;
  const percent = Math.round(alpha * 100);
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}

function createSpreadTheme({
  accent,
  background,
  borderAlpha = 0.22,
  borderActiveAlpha = 0.8,
  glowAlpha = 0.35
}) {
  return {
    accent,
    border: toRgba(accent, borderAlpha),
    borderActive: toRgba(accent, borderActiveAlpha),
    glow: toRgba(accent, glowAlpha),
    background
  };
}

const FALLBACK_SPREAD_THEME = createSpreadTheme({
  accent: 'var(--brand-primary)',
  borderAlpha: 0.28,
  borderActiveAlpha: 0.8,
  glowAlpha: 0.35,
  background:
    'linear-gradient(155deg, rgba(244, 209, 140, 0.08), var(--panel-dark-1)), radial-gradient(circle at 16% 12%, rgba(244, 209, 140, 0.16), transparent 46%), radial-gradient(circle at 82% -6%, rgba(117, 137, 255, 0.2), transparent 48)'
});

const SPREAD_THEMES = {
  single: createSpreadTheme({
    accent: 'var(--brand-accent)',
    borderAlpha: 0.25,
    borderActiveAlpha: 0.8,
    glowAlpha: 0.38,
    background:
      'linear-gradient(165deg, rgba(255, 216, 158, 0.14), var(--panel-dark-1)), radial-gradient(circle at 15% 14%, rgba(243, 208, 141, 0.22), transparent 44%), radial-gradient(circle at 90% -10%, rgba(255, 170, 205, 0.18), transparent 50)'
  }),
  threeCard: createSpreadTheme({
    accent: 'var(--color-cups)',
    borderAlpha: 0.2,
    borderActiveAlpha: 0.78,
    glowAlpha: 0.32,
    background:
      'linear-gradient(170deg, var(--panel-dark-2), var(--panel-dark-1)), radial-gradient(circle at 18% 10%, rgba(240, 143, 177, 0.32), transparent 46%), radial-gradient(circle at 88% -8%, rgba(99, 166, 255, 0.18), transparent 52)'
  }),
  fiveCard: createSpreadTheme({
    accent: 'color-mix(in srgb, var(--color-cups) 72%, var(--brand-accent) 28%)',
    borderAlpha: 0.2,
    borderActiveAlpha: 0.75,
    glowAlpha: 0.35,
    background:
      'linear-gradient(165deg, var(--panel-dark-2), var(--panel-dark-1)), radial-gradient(circle at 8% 18%, rgba(111, 224, 255, 0.28), transparent 48%), radial-gradient(circle at 88% -12%, rgba(122, 84, 255, 0.18), transparent 50)'
  }),
  decision: createSpreadTheme({
    accent: 'var(--status-warning)',
    borderAlpha: 0.22,
    borderActiveAlpha: 0.82,
    glowAlpha: 0.38,
    background:
      'linear-gradient(160deg, rgba(255, 197, 110, 0.2), var(--panel-dark-1)), radial-gradient(circle at 14% 12%, rgba(246, 183, 86, 0.24), transparent 46%), radial-gradient(circle at 84% -6%, rgba(120, 195, 255, 0.18), transparent 50)'
  }),
  relationship: createSpreadTheme({
    accent: 'color-mix(in srgb, var(--brand-primary) 62%, var(--color-cups) 38%)',
    borderAlpha: 0.24,
    borderActiveAlpha: 0.82,
    glowAlpha: 0.34,
    background:
      'linear-gradient(165deg, rgba(242, 159, 180, 0.18), var(--panel-dark-1)), radial-gradient(circle at 20% 8%, rgba(242, 159, 180, 0.34), transparent 48%), radial-gradient(circle at 92% -8%, rgba(158, 190, 255, 0.18), transparent 52)'
  }),
  celtic: createSpreadTheme({
    accent: 'color-mix(in srgb, var(--brand-secondary) 58%, var(--color-cups) 42%)',
    borderAlpha: 0.24,
    borderActiveAlpha: 0.82,
    glowAlpha: 0.4,
    background:
      'linear-gradient(170deg, var(--panel-dark-2), var(--panel-dark-1)), radial-gradient(circle at 20% 12%, rgba(169, 146, 255, 0.28), transparent 52%), radial-gradient(circle at 88% -10%, rgba(255, 191, 140, 0.2), transparent 54)'
  })
};

// Alt text for spread art images
const SPREAD_ART_ALTS = {
  single: 'One-card insight spread artwork',
  threeCard: 'Three-card story spread artwork',
  fiveCard: 'Five-card clarity spread artwork',
  decision: 'Decision two-path spread artwork',
  relationship: 'Relationship snapshot spread artwork',
  celtic: 'Celtic cross spread artwork'
};

export function SpreadSelector({
  selectedSpread,
  onSelectSpread,
  onSpreadConfirm
}) {
  const spreadRefs = useRef({});
  const carouselRef = useRef(null);
  
  // Track loaded spread art (lazy loaded after mount)
  const [spreadArt, setSpreadArt] = useState({});
  const spreadKeys = Object.keys(SPREADS);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(true);
  const [lockedSpreadKey, setLockedSpreadKey] = useState(null);
  const prefersReducedMotion = useReducedMotion();
  const isLandscape = useLandscape();
  const isSmallScreen = useSmallScreen();
  const { personalization } = usePreferences();
  const { subscription } = useSubscription();
  const canUseSpread = subscription?.canUseSpread ?? (() => true);
  const recommendedSpread = getSpreadFromDepth(personalization?.preferredSpreadDepth);
  const isExperienced = personalization?.tarotExperience === 'experienced';

  // Lazy load spread art after component mounts (non-blocking)
  useEffect(() => {
    let cancelled = false;
    preloadAllSpreadArt().then(() => {
      if (cancelled) return;
      // Rebuild art objects now that cache is populated
      const art = {};
      for (const key of spreadKeys) {
        art[key] = getSpreadArt(key, { alt: SPREAD_ART_ALTS[key] });
      }
      setSpreadArt(art);
    });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // In landscape: smaller cards to fit more on screen
  const cardBasisClass = isLandscape
    ? 'basis-[55%] xs:basis-[45%]'
    : 'basis-[82%] xs:basis-[70%]';

  const isCompactCopy = isSmallScreen && !isLandscape;

  // Update edge fade visibility based on scroll position
  const updateEdgeFades = useCallback((el) => {
    if (!el) return;
    const scrollLeft = el.scrollLeft;
    const scrollWidth = el.scrollWidth;
    const clientWidth = el.clientWidth;

    const threshold = Math.max(10, clientWidth * 0.05);
    const maxScrollLeft = Math.max(0, scrollWidth - clientWidth);

    setShowLeftFade(scrollLeft > threshold);
    setShowRightFade(maxScrollLeft - scrollLeft > threshold);
  }, []);

  // Track scroll position for pagination dots using actual element positions
  useEffect(() => {
    const el = carouselRef.current;
    if (!el || spreadKeys.length <= 1) return undefined;

    const handleScroll = () => {
      const cards = Array.from(el.children);
      if (cards.length === 0) return;

      const viewportCenter = el.scrollLeft + el.clientWidth / 2;
      let closestIndex = 0;
      let closestDistance = Infinity;

      cards.forEach((card, idx) => {
        const cardCenter = card.offsetLeft + card.offsetWidth / 2;
        const distance = Math.abs(viewportCenter - cardCenter);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = idx;
        }
      });

      setActiveIndex(closestIndex);
      updateEdgeFades(el);
    };

    // Initialize on mount
    handleScroll();
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [spreadKeys.length, updateEdgeFades]);

  const scrollToIndex = (index) => {
    const clamped = Math.min(spreadKeys.length - 1, Math.max(0, index));
    setActiveIndex(clamped);
    const el = carouselRef.current;
    if (!el) return;

    // Scroll to center the target card in the viewport
    const cards = Array.from(el.children);
    const targetCard = cards[clamped];
    if (targetCard) {
      const cardCenter = targetCard.offsetLeft + targetCard.offsetWidth / 2;
      const scrollTarget = cardCenter - el.clientWidth / 2;
      el.scrollTo({
        left: Math.max(0, scrollTarget),
        behavior: prefersReducedMotion ? 'auto' : 'smooth'
      });
      updateEdgeFades(el);
    }
  };

  const handleSpreadSelection = key => {
    // Check if spread is locked (requires subscription)
    if (!canUseSpread(key)) {
      setLockedSpreadKey(key);
      return;
    }

    const selectedIndex = spreadKeys.indexOf(key);
    if (selectedIndex !== -1) {
      scrollToIndex(selectedIndex);
    }

    // Update parent's selection state (for visual feedback)
    if (onSelectSpread) {
      onSelectSpread(key);
    }
    if (onSpreadConfirm) {
      onSpreadConfirm(key);
    }
  };

  const handleUpgradeDismiss = () => {
    setLockedSpreadKey(null);
  };

  const handleCardKeyDown = (event, key) => {
    const spreadKeys = Object.keys(SPREADS);
    const currentIndex = spreadKeys.indexOf(key);

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleSpreadSelection(key);
      return;
    }

    let nextIndex = -1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      nextIndex = (currentIndex + 1) % spreadKeys.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      nextIndex = (currentIndex - 1 + spreadKeys.length) % spreadKeys.length;
    } else if (event.key === 'Home') {
      event.preventDefault();
      nextIndex = 0;
    } else if (event.key === 'End') {
      event.preventDefault();
      nextIndex = spreadKeys.length - 1;
    }

    if (nextIndex !== -1) {
      const nextKey = spreadKeys[nextIndex];
      const nextElement = spreadRefs.current[nextKey];
      if (nextElement && typeof nextElement.focus === 'function') {
        nextElement.focus();
        nextElement.scrollIntoView({
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
          block: 'nearest',
          inline: 'center'
        });
      }
    }
  };

  const renderStars = stars => (
    <div className="flex items-center gap-0.5 text-primary">
      {Array.from({ length: STAR_TOTAL }).map((_, index) => (
        <Icon
          key={`${index}-star`}
          icon={Star}
          size="sm"
          weight={index < stars ? 'fill' : 'regular'}
          className={index < stars
            ? 'text-primary drop-shadow-[0_0_10px_var(--primary-30)]'
            : 'text-secondary/60'}
          decorative
        />
      ))}
    </div>
  );

  const handleArrowNav = direction => {
    const nextIndex = direction === 'next' ? activeIndex + 1 : activeIndex - 1;
    scrollToIndex(nextIndex);
  };

  return (
    <section className="panel-mystic spread-selector-panel animate-fade-in mb-6 sm:mb-8">
      <div className="relative z-10 space-y-5">
        <header className={`flex flex-col ${isLandscape ? 'gap-1' : 'gap-2'} sm:flex-row sm:items-center sm:justify-between`}>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-gold-soft">Spread Selection</p>
            {!isLandscape && (
              <p className="text-xs text-muted max-w-2xl">
                Choose how your reading unfolds.
              </p>
            )}
          </div>
        </header>

        {/* Carousel wrapper with edge fade indicators and navigation */}
        <div className="relative">
          {/* Left edge fade with navigation arrow */}
          <div
            className={`
              absolute left-0 top-0 bottom-3 w-12 z-10
              bg-gradient-to-r from-[color:var(--panel-dark-1)]/90 via-[color:var(--panel-dark-1)]/60 to-transparent
              rounded-l-2xl
              transition-opacity duration-200
              sm:hidden
              flex items-center justify-start pl-1
              ${showLeftFade ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
            `}
          >
            <button
              type="button"
              onClick={() => handleArrowNav('prev')}
              className="min-w-touch min-h-touch rounded-full bg-surface/80 border border-secondary/55 text-main hover:border-secondary/75 hover:bg-surface transition touch-manipulation flex items-center justify-center shadow-lg"
              aria-label="Previous spread"
            >
              <CaretRight className="w-5 h-5 rotate-180" weight="bold" />
            </button>
          </div>

          {/* Right edge fade with navigation arrow */}
          <div
            className={`
              absolute right-0 top-0 bottom-3 w-12 z-10
              bg-gradient-to-l from-[color:var(--panel-dark-1)]/90 via-[color:var(--panel-dark-1)]/60 to-transparent
              rounded-r-2xl
              transition-opacity duration-200
              sm:hidden
              flex items-center justify-end pr-1
              ${showRightFade ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
            `}
          >
            <button
              type="button"
              onClick={() => handleArrowNav('next')}
              className="min-w-touch min-h-touch rounded-full bg-surface/80 border border-secondary/55 text-main hover:border-secondary/75 hover:bg-surface transition touch-manipulation flex items-center justify-center shadow-lg"
              aria-label="Next spread"
            >
              <CaretRight className="w-5 h-5" weight="bold" />
            </button>
          </div>

          <div
            ref={carouselRef}
            role="radiogroup"
            aria-label="Spread selection"
            className={`spread-selector-grid flex ${isLandscape ? 'gap-2 pb-2' : 'gap-3 pb-3'} overflow-x-auto snap-x snap-mandatory scroll-smooth sm:overflow-visible sm:snap-none sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 sm:gap-4`}
            style={{ scrollPaddingLeft: '1rem', scrollPaddingRight: '1rem' }}
          >
          {Object.entries(SPREADS).map(([key, spread], index) => {
            const isActive = selectedSpread === key;
            const baseDescription = spread.description || 'Guided snapshot for your focus.';
            const maxCards = typeof spread.maxCards === 'number' ? spread.maxCards : null;
            const baseCount = typeof spread.drawCount === 'number' ? spread.drawCount : spread.count;
            const cardLabel = maxCards && maxCards > baseCount
              ? `${baseCount} cards + clarifiers`
              : `${baseCount} cards`;
            const isFirstSpread = index === 0;
            const isTabbable = isActive || (!selectedSpread && isFirstSpread);
            const stars = spread.complexity?.stars ?? 0;
            const complexityLabel = spread.complexity?.label || 'Beginner';
            const theme = SPREAD_THEMES[key] || FALLBACK_SPREAD_THEME;
            const resolvedBorder = isActive
              ? (theme.borderActive || FALLBACK_SPREAD_THEME.borderActive)
              : (theme.border || FALLBACK_SPREAD_THEME.border);
            const previewArt = spreadArt[key] || spread.preview;

            return (
              <button
                key={key}
                ref={el => { spreadRefs.current[key] = el; }}
                type="button"
                role="radio"
                tabIndex={isTabbable ? 0 : -1}
                aria-checked={isActive}
                onClick={() => handleSpreadSelection(key)}
                onKeyDown={event => handleCardKeyDown(event, key)}
                className={`spread-card relative flex h-full flex-col ${isLandscape ? 'gap-2' : 'gap-3'} cursor-pointer select-none shrink-0 ${cardBasisClass} snap-center snap-always sm:basis-auto sm:shrink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)] focus-visible:ring-offset-2 focus-visible:ring-offset-main ${isActive ? 'spread-card--active' : ''}`}
                style={{
                  '--spread-accent': theme.accent || FALLBACK_SPREAD_THEME.accent,
                  '--spread-border': resolvedBorder,
                  '--spread-background': theme.background || FALLBACK_SPREAD_THEME.background,
                  '--spread-glow': theme.glow || FALLBACK_SPREAD_THEME.glow
                }}
              >
                {isActive && (
                  <>
                    <div className="absolute top-3 right-3 z-20">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center border border-[color:var(--border-warm-light)]"
                        style={{
                          backgroundColor: 'var(--spread-accent)',
                          boxShadow: '0 12px 26px -18px var(--spread-glow, var(--primary-30))'
                        }}
                      >
                        <Check className="w-4 h-4 text-main" weight="bold" aria-hidden="true" />
                      </div>
                    </div>
                    <div
                      className="absolute left-3 top-3 z-20 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
                      style={{
                        backgroundColor: 'var(--surface-92)',
                        color: 'var(--spread-accent, var(--brand-primary))',
                        border: '1px solid var(--border-warm-light)',
                        boxShadow: '0 12px 28px -20px rgba(0,0,0,0.7)'
                      }}
                    >
                    <Sparkle className="h-3.5 w-3.5" weight="fill" aria-hidden="true" />
                    <span>Selected</span>
                  </div>
                </>
              )}
              {/* Lock indicator for premium-only spreads */}
                {!isActive && !canUseSpread(key) && (
                  <div className="absolute top-3 right-3 z-20">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center border border-accent/40 bg-accent/15 backdrop-blur-sm"
                      style={{
                        boxShadow: '0 8px 20px -12px var(--accent-45)'
                      }}
                      aria-label="Premium spread - requires subscription"
                    >
                      <Lock className="w-3.5 h-3.5 text-accent" weight="fill" aria-hidden="true" />
                    </div>
                  </div>
                )}

                <SpreadPatternThumbnail
                  spreadKey={key}
                  preview={previewArt}
                  spreadName={spread.name}
                  className="spread-card__preview w-full"
                />

                <div className="spread-card__body">
                  <div className="spread-card__title font-serif font-semibold text-accent text-base leading-tight flex flex-wrap items-center gap-2">
                    <span className="spread-card__title-text">{spread.name}</span>
                    {!canUseSpread(key) && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-accent">
                        <Lock className="w-3 h-3" weight="fill" aria-hidden="true" />
                        Requires Plus
                      </span>
                    )}
                    {key === recommendedSpread && (
                      <span className="text-xs uppercase tracking-[0.16em] text-accent bg-accent/15 border border-accent/40 px-2 py-0.5 rounded-full">
                        Recommended
                      </span>
                    )}
                  </div>
                  <div className="text-xs uppercase tracking-[0.18em] text-gold-soft/90 mb-2">
                    {spread.tag || 'Guided spread'}
                    <span className="text-gold-soft/60 ml-2">· {cardLabel}</span>
                  </div>

                  {!isLandscape && !isExperienced && (
                    <p className={`spread-card__description text-xs-plus text-muted leading-snug ${isCompactCopy ? 'mb-2 line-clamp-2' : 'mb-3'}`}>
                      {isCompactCopy ? (spread.mobileDescription || baseDescription) : baseDescription}
                    </p>
                  )}

                  <div className="spread-card__meta">
                    <div className="spread-card__complexity">
                      <span className="text-xs uppercase tracking-[0.18em] text-gold-soft/80">Complexity</span>
                      {renderStars(stars)}
                      <span className="text-sm text-muted capitalize">{complexityLabel}</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
          </div>
        </div>

        {/* Mobile pagination dots */}
        <div className="sm:hidden">
          <CarouselDots
            activeIndex={activeIndex}
            totalItems={spreadKeys.length}
            onSelectItem={scrollToIndex}
            labels={spreadKeys.map(key => SPREADS[key]?.name || key)}
            ariaLabel="Spread selection"
            variant="compact"
          />
        </div>

      </div>

      {/* Upgrade modal for locked spreads */}
      {lockedSpreadKey && (
        <UpgradeNudge
          feature={`${SPREADS[lockedSpreadKey]?.name || 'Advanced Spread'} layout`}
          requiredTier="plus"
          variant="modal"
          dismissible={true}
          onDismiss={handleUpgradeDismiss}
        />
      )}

    </section>
  );
}
