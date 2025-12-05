import { useRef, useState, useEffect, useCallback } from 'react';
import { Sparkle, Check, Star, CaretRight } from './icons';
import { Icon } from './Icon';
import { SPREADS } from '../data/spreads';
import { SpreadPatternThumbnail } from './SpreadPatternThumbnail';
import { CarouselDots } from './CarouselDots';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useLandscape } from '../hooks/useLandscape';
import { useSmallScreen } from '../hooks/useSmallScreen';
import { usePreferences } from '../contexts/PreferencesContext';
import { getSpreadFromDepth } from '../utils/personalization';
import oneCardArt from '../../selectorimages/onecard.png';
import oneCard640Avif from '../../selectorimages/onecard-640.avif';
import oneCard1280Avif from '../../selectorimages/onecard-1280.avif';
import oneCard640Webp from '../../selectorimages/onecard-640.webp';
import oneCard1280Webp from '../../selectorimages/onecard-1280.webp';

import threeCardArt from '../../selectorimages/3card.png';
import threeCard640Avif from '../../selectorimages/3card-640.avif';
import threeCard1280Avif from '../../selectorimages/3card-1280.avif';
import threeCard640Webp from '../../selectorimages/3card-640.webp';
import threeCard1280Webp from '../../selectorimages/3card-1280.webp';

import fiveCardArt from '../../selectorimages/5card.png';
import fiveCard640Avif from '../../selectorimages/5card-640.avif';
import fiveCard1280Avif from '../../selectorimages/5card-1280.avif';
import fiveCard640Webp from '../../selectorimages/5card-640.webp';
import fiveCard1280Webp from '../../selectorimages/5card-1280.webp';

import decisionArt from '../../selectorimages/decision.png';
import decision640Avif from '../../selectorimages/decision-640.avif';
import decision1280Avif from '../../selectorimages/decision-1280.avif';
import decision640Webp from '../../selectorimages/decision-640.webp';
import decision1280Webp from '../../selectorimages/decision-1280.webp';

import relationshipArt from '../../selectorimages/relationshipsnapshot.png';
import relationship640Avif from '../../selectorimages/relationshipsnapshot-640.avif';
import relationship1280Avif from '../../selectorimages/relationshipsnapshot-1280.avif';
import relationship640Webp from '../../selectorimages/relationshipsnapshot-640.webp';
import relationship1280Webp from '../../selectorimages/relationshipsnapshot-1280.webp';

import celticArt from '../../selectorimages/celticcross.png';
import celtic640Avif from '../../selectorimages/celticcross-640.avif';
import celtic1280Avif from '../../selectorimages/celticcross-1280.avif';
import celtic640Webp from '../../selectorimages/celticcross-640.webp';
import celtic1280Webp from '../../selectorimages/celticcross-1280.webp';

const STAR_TOTAL = 3;

const FALLBACK_SPREAD_THEME = {
  accent: '#e5c48e',
  border: 'rgba(226, 195, 149, 0.28)',
  borderActive: 'rgba(226, 195, 149, 0.8)',
  glow: 'rgba(226, 195, 149, 0.35)',
  background:
    'linear-gradient(155deg, rgba(244, 209, 140, 0.08), rgba(17, 12, 21, 0.94)), radial-gradient(circle at 16% 12%, rgba(244, 209, 140, 0.16), transparent 46%), radial-gradient(circle at 82% -6%, rgba(117, 137, 255, 0.2), transparent 48)'
};

const SPREAD_THEMES = {
  single: {
    accent: '#f3d08d',
    border: 'rgba(243, 208, 141, 0.25)',
    borderActive: 'rgba(243, 208, 141, 0.8)',
    glow: 'rgba(243, 208, 141, 0.38)',
    background:
      'linear-gradient(165deg, rgba(255, 216, 158, 0.14), rgba(12, 9, 14, 0.95)), radial-gradient(circle at 15% 14%, rgba(243, 208, 141, 0.22), transparent 44%), radial-gradient(circle at 90% -10%, rgba(255, 170, 205, 0.18), transparent 50)'
  },
  threeCard: {
    accent: '#f08fb1',
    border: 'rgba(240, 143, 177, 0.2)',
    borderActive: 'rgba(240, 143, 177, 0.78)',
    glow: 'rgba(240, 143, 177, 0.32)',
    background:
      'linear-gradient(170deg, rgba(33, 24, 42, 0.96), rgba(12, 10, 18, 0.94)), radial-gradient(circle at 18% 10%, rgba(240, 143, 177, 0.32), transparent 46%), radial-gradient(circle at 88% -8%, rgba(99, 166, 255, 0.18), transparent 52)'
  },
  fiveCard: {
    accent: '#6fe0ff',
    border: 'rgba(111, 224, 255, 0.2)',
    borderActive: 'rgba(111, 224, 255, 0.75)',
    glow: 'rgba(111, 224, 255, 0.35)',
    background:
      'linear-gradient(165deg, rgba(17, 33, 44, 0.94), rgba(10, 11, 20, 0.98)), radial-gradient(circle at 8% 18%, rgba(111, 224, 255, 0.28), transparent 48%), radial-gradient(circle at 88% -12%, rgba(122, 84, 255, 0.18), transparent 50)'
  },
  decision: {
    accent: '#f6b756',
    border: 'rgba(246, 183, 86, 0.22)',
    borderActive: 'rgba(246, 183, 86, 0.82)',
    glow: 'rgba(246, 183, 86, 0.38)',
    background:
      'linear-gradient(160deg, rgba(255, 197, 110, 0.2), rgba(13, 11, 19, 0.96)), radial-gradient(circle at 14% 12%, rgba(246, 183, 86, 0.24), transparent 46%), radial-gradient(circle at 84% -6%, rgba(120, 195, 255, 0.18), transparent 50)'
  },
  relationship: {
    accent: '#f29fb4',
    border: 'rgba(242, 159, 180, 0.24)',
    borderActive: 'rgba(242, 159, 180, 0.82)',
    glow: 'rgba(242, 159, 180, 0.34)',
    background:
      'linear-gradient(165deg, rgba(242, 159, 180, 0.18), rgba(12, 8, 17, 0.96)), radial-gradient(circle at 20% 8%, rgba(242, 159, 180, 0.34), transparent 48%), radial-gradient(circle at 92% -8%, rgba(158, 190, 255, 0.18), transparent 52)'
  },
  celtic: {
    accent: '#a992ff',
    border: 'rgba(169, 146, 255, 0.24)',
    borderActive: 'rgba(169, 146, 255, 0.82)',
    glow: 'rgba(169, 146, 255, 0.4)',
    background:
      'linear-gradient(170deg, rgba(28, 24, 54, 0.95), rgba(10, 9, 17, 0.96)), radial-gradient(circle at 20% 12%, rgba(169, 146, 255, 0.28), transparent 52%), radial-gradient(circle at 88% -10%, rgba(255, 191, 140, 0.2), transparent 54)'
  }
};

const SPREAD_ART_OVERRIDES = {
  single: {
    src: oneCardArt,
    width: 4096,
    height: 4096,
    aspectRatio: '16 / 9',
    alt: 'One-card insight spread artwork',
    sources: {
      avif: [
        { src: oneCard640Avif, width: 640 },
        { src: oneCard1280Avif, width: 1280 }
      ],
      webp: [
        { src: oneCard640Webp, width: 640 },
        { src: oneCard1280Webp, width: 1280 }
      ]
    }
  },
  threeCard: {
    src: threeCardArt,
    width: 4096,
    height: 4096,
    aspectRatio: '16 / 9',
    alt: 'Three-card story spread artwork',
    sources: {
      avif: [
        { src: threeCard640Avif, width: 640 },
        { src: threeCard1280Avif, width: 1280 }
      ],
      webp: [
        { src: threeCard640Webp, width: 640 },
        { src: threeCard1280Webp, width: 1280 }
      ]
    }
  },
  fiveCard: {
    src: fiveCardArt,
    width: 4096,
    height: 4096,
    aspectRatio: '16 / 9',
    alt: 'Five-card clarity spread artwork',
    sources: {
      avif: [
        { src: fiveCard640Avif, width: 640 },
        { src: fiveCard1280Avif, width: 1280 }
      ],
      webp: [
        { src: fiveCard640Webp, width: 640 },
        { src: fiveCard1280Webp, width: 1280 }
      ]
    }
  },
  decision: {
    src: decisionArt,
    width: 4096,
    height: 4096,
    aspectRatio: '16 / 9',
    alt: 'Decision two-path spread artwork',
    sources: {
      avif: [
        { src: decision640Avif, width: 640 },
        { src: decision1280Avif, width: 1280 }
      ],
      webp: [
        { src: decision640Webp, width: 640 },
        { src: decision1280Webp, width: 1280 }
      ]
    }
  },
  relationship: {
    src: relationshipArt,
    width: 4096,
    height: 4096,
    aspectRatio: '16 / 9',
    alt: 'Relationship snapshot spread artwork',
    sources: {
      avif: [
        { src: relationship640Avif, width: 640 },
        { src: relationship1280Avif, width: 1280 }
      ],
      webp: [
        { src: relationship640Webp, width: 640 },
        { src: relationship1280Webp, width: 1280 }
      ]
    }
  },
  celtic: {
    src: celticArt,
    width: 4096,
    height: 4096,
    aspectRatio: '16 / 9',
    alt: 'Celtic cross spread artwork',
    sources: {
      avif: [
        { src: celtic640Avif, width: 640 },
        { src: celtic1280Avif, width: 1280 }
      ],
      webp: [
        { src: celtic640Webp, width: 640 },
        { src: celtic1280Webp, width: 1280 }
      ]
    }
  }
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
  const prefersReducedMotion = useReducedMotion();
  const isLandscape = useLandscape();
  const _isSmallScreen = useSmallScreen();
  const { personalization } = usePreferences();
  const recommendedSpread = getSpreadFromDepth(personalization?.preferredSpreadDepth);
  const isExperienced = personalization?.tarotExperience === 'experienced';

  // In landscape: smaller cards to fit more on screen
  const cardBasisClass = isLandscape
    ? 'basis-[55%] xs:basis-[45%]'
    : 'basis-[82%] xs:basis-[70%]';

  const isCompactCopy = _isSmallScreen && !isLandscape;

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

      // Find the card whose center is closest to the viewport center
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
    }
  };

  const handleSpreadSelection = key => {
    const selectedIndex = spreadKeys.indexOf(key);
    if (selectedIndex !== -1) {
      scrollToIndex(selectedIndex);
    }
    if (onSelectSpread) {
      onSelectSpread(key);
    }
    if (onSpreadConfirm) {
      onSpreadConfirm(key);
    }
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
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-gold-soft/50 bg-black/30 px-3 py-1 text-xs-plus text-accent backdrop-blur">
            <Sparkle className="w-3 h-3" aria-hidden="true" />
            <span>Guided layouts</span>
          </div>
        </header>

        {/* Carousel wrapper with edge fade indicators */}
        <div className="relative">
          {/* Left edge fade - indicates scrolled content behind */}
          <div
            className={`
              absolute left-0 top-0 bottom-3 w-8 z-10
              pointer-events-none
              bg-gradient-to-r from-[rgba(13,10,20,0.9)] to-transparent
              rounded-l-2xl
              transition-opacity duration-200
              sm:hidden
              ${showLeftFade ? 'opacity-100' : 'opacity-0'}
            `}
            aria-hidden="true"
          />

          {/* Right edge fade with scroll hint arrow */}
          <div
            className={`
              absolute right-0 top-0 bottom-3 w-12 z-10
              pointer-events-none
              bg-gradient-to-l from-[rgba(13,10,20,0.9)] via-[rgba(13,10,20,0.6)] to-transparent
              rounded-r-2xl
              transition-opacity duration-200
              sm:hidden
              flex items-center justify-end pr-1
              ${showRightFade ? 'opacity-100' : 'opacity-0'}
            `}
            aria-hidden="true"
          >
            <CaretRight
              className="w-5 h-5 text-accent/70 animate-pulse drop-shadow-md"
              weight="bold"
            />
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
                className={`spread-card relative flex h-full flex-col ${isLandscape ? 'gap-2' : 'gap-3'} cursor-pointer select-none shrink-0 ${cardBasisClass} snap-center snap-always sm:basis-auto sm:shrink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--spread-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0c13] ${isActive ? 'spread-card--active' : ''}`}
                style={{
                  '--spread-accent': theme.accent || FALLBACK_SPREAD_THEME.accent,
                  '--spread-border': resolvedBorder,
                  '--spread-background': theme.background || FALLBACK_SPREAD_THEME.background,
                  '--spread-glow': theme.glow || FALLBACK_SPREAD_THEME.glow,
                  '--spread-ring': theme.accent || FALLBACK_SPREAD_THEME.accent
                }}
              >
                {isActive && (
                  <div className="absolute top-3 right-3 z-20">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center border border-white/30"
                      style={{
                        backgroundColor: 'var(--spread-accent)',
                        boxShadow: '0 12px 26px -18px var(--spread-glow, rgba(212, 184, 150, 0.4))'
                      }}
                    >
                      <Check className="w-4 h-4 text-main" weight="bold" aria-hidden="true" />
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
                    <div className="spread-card__count">
                      <span className="text-xs-plus text-muted">Card Count</span>
                      <span className="text-sm font-semibold text-accent">{spread.count}</span>
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
    </section>
  );
}
