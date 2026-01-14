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
import { getSpreadArt } from '../utils/spreadArt';

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
  accent: '#e5c48e',
  borderAlpha: 0.28,
  borderActiveAlpha: 0.8,
  glowAlpha: 0.35,
  background:
    'linear-gradient(155deg, rgba(244, 209, 140, 0.08), rgba(17, 12, 21, 0.94)), radial-gradient(circle at 16% 12%, rgba(244, 209, 140, 0.16), transparent 46%), radial-gradient(circle at 82% -6%, rgba(117, 137, 255, 0.2), transparent 48)'
});

const SPREAD_THEMES = {
  single: createSpreadTheme({
    accent: '#f3d08d',
    borderAlpha: 0.25,
    borderActiveAlpha: 0.8,
    glowAlpha: 0.38,
    background:
      'linear-gradient(165deg, rgba(255, 216, 158, 0.14), rgba(12, 9, 14, 0.95)), radial-gradient(circle at 15% 14%, rgba(243, 208, 141, 0.22), transparent 44%), radial-gradient(circle at 90% -10%, rgba(255, 170, 205, 0.18), transparent 50)'
  }),
  threeCard: createSpreadTheme({
    accent: '#f08fb1',
    borderAlpha: 0.2,
    borderActiveAlpha: 0.78,
    glowAlpha: 0.32,
    background:
      'linear-gradient(170deg, rgba(33, 24, 42, 0.96), rgba(12, 10, 18, 0.94)), radial-gradient(circle at 18% 10%, rgba(240, 143, 177, 0.32), transparent 46%), radial-gradient(circle at 88% -8%, rgba(99, 166, 255, 0.18), transparent 52)'
  }),
  fiveCard: createSpreadTheme({
    accent: '#6fe0ff',
    borderAlpha: 0.2,
    borderActiveAlpha: 0.75,
    glowAlpha: 0.35,
    background:
      'linear-gradient(165deg, rgba(17, 33, 44, 0.94), rgba(10, 11, 20, 0.98)), radial-gradient(circle at 8% 18%, rgba(111, 224, 255, 0.28), transparent 48%), radial-gradient(circle at 88% -12%, rgba(122, 84, 255, 0.18), transparent 50)'
  }),
  decision: createSpreadTheme({
    accent: '#f6b756',
    borderAlpha: 0.22,
    borderActiveAlpha: 0.82,
    glowAlpha: 0.38,
    background:
      'linear-gradient(160deg, rgba(255, 197, 110, 0.2), rgba(13, 11, 19, 0.96)), radial-gradient(circle at 14% 12%, rgba(246, 183, 86, 0.24), transparent 46%), radial-gradient(circle at 84% -6%, rgba(120, 195, 255, 0.18), transparent 50)'
  }),
  relationship: createSpreadTheme({
    accent: '#f29fb4',
    borderAlpha: 0.24,
    borderActiveAlpha: 0.82,
    glowAlpha: 0.34,
    background:
      'linear-gradient(165deg, rgba(242, 159, 180, 0.18), rgba(12, 8, 17, 0.96)), radial-gradient(circle at 20% 8%, rgba(242, 159, 180, 0.34), transparent 48%), radial-gradient(circle at 92% -8%, rgba(158, 190, 255, 0.18), transparent 52)'
  }),
  celtic: createSpreadTheme({
    accent: '#a992ff',
    borderAlpha: 0.24,
    borderActiveAlpha: 0.82,
    glowAlpha: 0.4,
    background:
      'linear-gradient(170deg, rgba(28, 24, 54, 0.95), rgba(10, 9, 17, 0.96)), radial-gradient(circle at 20% 12%, rgba(169, 146, 255, 0.28), transparent 52%), radial-gradient(circle at 88% -10%, rgba(255, 191, 140, 0.2), transparent 54)'
  })
};

const SPREAD_ART_OVERRIDES = {
  single: getSpreadArt('single', {
    alt: 'One-card insight spread artwork'
  }),
  threeCard: getSpreadArt('threeCard', {
    alt: 'Three-card story spread artwork'
  }),
  fiveCard: getSpreadArt('fiveCard', {
    alt: 'Five-card clarity spread artwork'
  }),
  decision: getSpreadArt('decision', {
    alt: 'Decision two-path spread artwork'
  }),
  relationship: getSpreadArt('relationship', {
    alt: 'Relationship snapshot spread artwork'
  }),
  celtic: getSpreadArt('celtic', {
    alt: 'Celtic cross spread artwork'
  })
};

export function SpreadSelector({
  selectedSpread,
  onSelectSpread,
  onSpreadConfirm
}) {
  const spreadRefs = useRef({});
  const carouselRef = useRef(null);
  const spreadKeys = Object.keys(SPREADS);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(true);
  const [lockedSpreadKey, setLockedSpreadKey] = useState(null);
  const [previewKey, setPreviewKey] = useState(null);
  const prefersReducedMotion = useReducedMotion();
  const isLandscape = useLandscape();
  const isSmallScreen = useSmallScreen();
  const { personalization } = usePreferences();
  const { subscription } = useSubscription();
  const canUseSpread = subscription?.canUseSpread ?? (() => true);
  const recommendedSpread = getSpreadFromDepth(personalization?.preferredSpreadDepth);
  const isExperienced = personalization?.tarotExperience === 'experienced';

  // Get preview spread info for CTA bar
  const previewSpread = previewKey ? SPREADS[previewKey] : null;
  const previewPositions = previewSpread?.positions || [];

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

    // Set preview state - don't confirm yet
    setPreviewKey(key);

    // Update parent's selection state (for visual feedback)
    if (onSelectSpread) {
      onSelectSpread(key);
    }
  };

  const handleConfirmPreview = () => {
    if (previewKey && onSpreadConfirm) {
      onSpreadConfirm(previewKey);
    }
    setPreviewKey(null);
  };

  const handleCancelPreview = () => {
    setPreviewKey(null);
    if (onSelectSpread) {
      onSelectSpread(null);
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
            ? 'text-primary drop-shadow-[0_0_10px_rgba(244,223,175,0.35)]'
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
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-gold-soft/50 bg-surface/60 px-3 py-1 text-xs-plus text-accent backdrop-blur">
            <Sparkle className="w-3 h-3" aria-hidden="true" />
            <span>Guided layouts</span>
          </div>
        </header>

        {/* Carousel wrapper with edge fade indicators and navigation */}
        <div className="relative">
          {/* Left edge fade with navigation arrow */}
          <div
            className={`
              absolute left-0 top-0 bottom-3 w-12 z-10
              bg-gradient-to-r from-[rgba(13,10,20,0.9)] via-[rgba(13,10,20,0.6)] to-transparent
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
              className="min-w-[44px] min-h-[44px] rounded-full bg-surface/80 border border-secondary/40 text-main hover:border-secondary/60 hover:bg-surface transition touch-manipulation flex items-center justify-center shadow-lg"
              aria-label="Previous spread"
            >
              <CaretRight className="w-5 h-5 rotate-180" weight="bold" />
            </button>
          </div>

          {/* Right edge fade with navigation arrow */}
          <div
            className={`
              absolute right-0 top-0 bottom-3 w-12 z-10
              bg-gradient-to-l from-[rgba(13,10,20,0.9)] via-[rgba(13,10,20,0.6)] to-transparent
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
              className="min-w-[44px] min-h-[44px] rounded-full bg-surface/80 border border-secondary/40 text-main hover:border-secondary/60 hover:bg-surface transition touch-manipulation flex items-center justify-center shadow-lg"
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
            const isFirstSpread = index === 0;
            const isTabbable = isActive || (!selectedSpread && isFirstSpread);
            const stars = spread.complexity?.stars ?? 0;
            const complexityLabel = spread.complexity?.label || 'Beginner';
            const theme = SPREAD_THEMES[key] || FALLBACK_SPREAD_THEME;
            const resolvedBorder = isActive
              ? (theme.borderActive || FALLBACK_SPREAD_THEME.borderActive)
              : (theme.border || FALLBACK_SPREAD_THEME.border);
            const previewArt = SPREAD_ART_OVERRIDES[key] || spread.preview;

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
                className={`spread-card relative flex h-full flex-col ${isLandscape ? 'gap-2' : 'gap-3'} cursor-pointer select-none shrink-0 ${cardBasisClass} snap-center snap-always sm:basis-auto sm:shrink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--spread-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-main ${isActive ? 'spread-card--active' : ''}`}
                style={{
                  '--spread-accent': theme.accent || FALLBACK_SPREAD_THEME.accent,
                  '--spread-border': resolvedBorder,
                  '--spread-background': theme.background || FALLBACK_SPREAD_THEME.background,
                  '--spread-glow': theme.glow || FALLBACK_SPREAD_THEME.glow,
                  '--spread-ring': theme.accent || FALLBACK_SPREAD_THEME.accent
                }}
              >
                {isActive && (
                  <>
                    <div className="absolute top-3 right-3 z-20">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center border border-[color:var(--border-warm-light)]"
                        style={{
                          backgroundColor: 'var(--spread-accent)',
                          boxShadow: '0 12px 26px -18px var(--spread-glow, rgba(212, 184, 150, 0.4))'
                        }}
                      >
                        <Check className="w-4 h-4 text-main" weight="bold" aria-hidden="true" />
                      </div>
                    </div>
                    <div
                      className="absolute left-3 top-3 z-20 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                      style={{
                        backgroundColor: 'rgba(13, 10, 20, 0.92)',
                        color: 'var(--spread-accent, #e5c48e)',
                        border: '1px solid rgba(255,255,255,0.15)',
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
                      className="w-7 h-7 rounded-full flex items-center justify-center border border-amber-400/40 bg-amber-500/20 backdrop-blur-sm"
                      style={{
                        boxShadow: '0 8px 20px -12px rgba(251, 191, 36, 0.4)'
                      }}
                      aria-label="Premium spread - requires subscription"
                    >
                      <Lock className="w-3.5 h-3.5 text-amber-300" weight="fill" aria-hidden="true" />
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
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-200">
                        <Lock className="w-3 h-3" weight="fill" aria-hidden="true" />
                        Requires Plus
                      </span>
                    )}
                    {key === recommendedSpread && (
                      <span className="text-xs uppercase tracking-[0.16em] text-amber-200 bg-amber-500/15 border border-amber-300/40 px-2 py-0.5 rounded-full">
                        Recommended
                      </span>
                    )}
                  </div>
                  <div className="text-xs uppercase tracking-[0.18em] text-gold-soft/90 mb-2">
                    {spread.tag || 'Guided spread'}
                    <span className="text-gold-soft/60 ml-2">· {spread.count} cards</span>
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

      {/* Preview CTA bar - shows when a spread is being previewed */}
      {previewKey && previewSpread && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-surface/95 backdrop-blur-md border-t border-secondary/30 shadow-2xl shadow-black/50 safe-area-pb">
          <div className="max-w-3xl mx-auto px-4 py-3 sm:py-4">
            <div className="flex flex-col gap-3">
              {/* Spread info */}
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted uppercase tracking-wider mb-0.5">Previewing</p>
                  <h3 className="text-base sm:text-lg font-serif text-accent truncate">
                    {previewSpread.name}
                    <span className="ml-2 text-sm text-muted font-normal">
                      · {previewSpread.count} cards
                    </span>
                  </h3>
                </div>
              </div>

              {/* Position chips preview */}
              <div className="flex flex-wrap gap-1.5 max-h-[4.5rem] overflow-y-auto scrollbar-thin">
                {previewPositions.slice(0, 6).map((pos, i) => {
                  // Extract short label (before the em-dash)
                  const shortLabel = pos.split('—')[0].trim();
                  return (
                    <span
                      key={`preview-pos-${i}`}
                      className="inline-flex items-center gap-1 text-[0.65rem] sm:text-xs text-muted bg-surface/80 border border-secondary/30 rounded-full px-2 py-0.5 whitespace-nowrap"
                    >
                      <span className="w-4 h-4 rounded-full bg-primary/20 text-primary font-semibold flex items-center justify-center text-[0.55rem]">
                        {i + 1}
                      </span>
                      <span className="max-w-[12ch] truncate">{shortLabel}</span>
                    </span>
                  );
                })}
                {previewPositions.length > 6 && (
                  <span className="text-xs text-muted">
                    +{previewPositions.length - 6} more
                  </span>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCancelPreview}
                  className="flex-1 sm:flex-none min-h-[44px] px-4 py-2 rounded-full border border-secondary/40 text-sm text-muted hover:text-main hover:border-secondary/60 transition touch-manipulation"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPreview}
                  className="flex-1 sm:flex-none min-h-[44px] px-6 py-2 rounded-full bg-primary text-surface font-semibold text-sm hover:bg-primary/90 transition touch-manipulation shadow-lg shadow-primary/30"
                >
                  Use This Spread
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
