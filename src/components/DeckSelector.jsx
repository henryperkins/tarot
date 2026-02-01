import { useRef, useState, useEffect, useCallback } from 'react';
import { Check, CaretRight } from '@phosphor-icons/react';
import { CarouselDots } from './CarouselDots';
import rwsPreview from '../../selectorimages/rider.jpeg';
import thothPreview from '../../selectorimages/Thoth.jpeg';
import marseillePreview from '../../selectorimages/marseille.jpeg';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useSmallScreen } from '../hooks/useSmallScreen';
import { MobileInfoSection } from './MobileInfoSection';
import { DECK_CATALOG, DECK_ORDER } from '../../shared/vision/deckCatalog.js';

const DECK_VISUALS = {
  'rws-1909': {
    preview: {
      src: rwsPreview,
      alt: 'Rider-Waite-Smith deck featuring The Magician card'
    },
    accent: '#e5c48e',
    border: 'rgba(220, 188, 141, 0.35)',
    borderActive: 'rgba(229, 196, 142, 0.9)',
    glow: 'rgba(229, 196, 142, 0.45)',
    background: 'linear-gradient(150deg, rgba(255, 209, 159, 0.12), var(--panel-dark-1)), radial-gradient(circle at 20% 18%, rgba(255, 225, 180, 0.12), transparent 52%), radial-gradient(circle at 80% -10%, rgba(63, 118, 192, 0.18), transparent 48)'
  },
  'thoth-a1': {
    preview: {
      src: thothPreview,
      alt: 'Thoth deck featuring The Magus card with Art Deco styling'
    },
    accent: '#44e0d2',
    border: 'rgba(83, 216, 206, 0.25)',
    borderActive: 'rgba(83, 216, 206, 0.75)',
    glow: 'rgba(83, 216, 206, 0.35)',
    background: 'linear-gradient(165deg, var(--panel-dark-2), var(--panel-dark-1)), radial-gradient(circle at 12% 18%, rgba(68, 224, 210, 0.22), transparent 48%), radial-gradient(circle at 90% 0%, rgba(193, 36, 139, 0.18), transparent 50)',
    note: 'Uses Thoth card names (e.g., "The Magus", "Adjustment").'
  },
  'marseille-classic': {
    preview: {
      src: marseillePreview,
      alt: 'Tarot de Marseille deck featuring Le Bateleur card'
    },
    accent: '#d8a300',
    border: 'rgba(192, 146, 64, 0.28)',
    borderActive: 'rgba(216, 163, 0, 0.82)',
    glow: 'rgba(216, 163, 0, 0.35)',
    background: 'linear-gradient(170deg, var(--panel-dark-2), var(--panel-dark-1)), radial-gradient(circle at 12% 22%, rgba(216, 163, 0, 0.16), transparent 46%), radial-gradient(circle at 85% -8%, rgba(47, 86, 178, 0.18), transparent 48)',
    note: 'Uses Marseille numbering with French titles.'
  }
};

export const DECK_OPTIONS = DECK_ORDER.map((deckId) => {
  const deck = DECK_CATALOG[deckId];
  const visuals = DECK_VISUALS[deckId];
  return {
    id: deck.id,
    label: deck.label,
    subtitle: deck.subtitleDisplay || deck.subtitle,
    description: deck.description,
    mobileDescription: deck.mobileDescription,
    palette: deck.palette?.ui || [],
    ...visuals
  };
});

function DeckPreviewImage({ preview, deckLabel, priority = 'auto' }) {
  if (!preview?.src) {
    return null;
  }

  const isHighPriority = priority === 'high';
  const loading = isHighPriority ? 'eager' : 'lazy';

  return (
    <div className="relative overflow-hidden rounded-[14px] bg-main mb-1">
      <img
        src={preview.src}
        width={preview.width || 640}
        height={preview.height || 360}
        sizes="(max-width: 640px) 88vw, (max-width: 1024px) 46vw, 340px"
        alt={preview.alt || `${deckLabel} deck preview`}
        className="w-full h-auto object-cover"
        loading={loading}
        decoding="async"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 rounded-[14px] border border-[color:var(--border-warm-light)] shadow-[0_0_0_1px_var(--border-warm-subtle)]"
        aria-hidden="true"
      />
    </div>
  );
}

function PaletteBadge({ label, swatch, textColor }) {
  return (
    <span
      className="deck-palette-badge"
      style={{
        backgroundColor: swatch,
        color: textColor,
        boxShadow: `0 10px 20px -14px rgba(0,0,0,0.8), 0 0 0 1px var(--border-warm-subtle), 0 0 0 1px ${swatch}33`
      }}
    >
      {label}
    </span>
  );
}

export function DeckSelector({ selectedDeck, onDeckChange }) {
  const deckRefs = useRef({});
  const carouselRef = useRef(null);
  const deckIds = DECK_OPTIONS.map(d => d.id);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(true);
  const prefersReducedMotion = useReducedMotion();
  const isSmallScreen = useSmallScreen();

  // Update edge fade visibility based on scroll position
  const updateEdgeFades = useCallback((el) => {
    if (!el) return;
    const scrollLeft = el.scrollLeft;
    const scrollWidth = el.scrollWidth;
    const clientWidth = el.clientWidth;

    setShowLeftFade(scrollLeft > 10);
    setShowRightFade(scrollLeft < scrollWidth - clientWidth - 10);
  }, []);

  // Track scroll position for pagination dots using actual element positions
  useEffect(() => {
    const el = carouselRef.current;
    if (!el || deckIds.length <= 1) return undefined;

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
  }, [deckIds.length, updateEdgeFades]);

  const scrollToIndex = (index) => {
    const el = carouselRef.current;
    if (!el) return;
    const clamped = Math.min(deckIds.length - 1, Math.max(0, index));
    setActiveIndex(clamped);

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

  const handleKeyDown = (event, deckId) => {
    const deckIds = DECK_OPTIONS.map(d => d.id);
    const currentIndex = deckIds.indexOf(deckId);

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onDeckChange(deckId);
      return;
    }

    let nextIndex = -1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      nextIndex = (currentIndex + 1) % deckIds.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      nextIndex = (currentIndex - 1 + deckIds.length) % deckIds.length;
    } else if (event.key === 'Home') {
      event.preventDefault();
      nextIndex = 0;
    } else if (event.key === 'End') {
      event.preventDefault();
      nextIndex = deckIds.length - 1;
    }

    if (nextIndex !== -1) {
      const nextDeckId = deckIds[nextIndex];
      const nextElement = deckRefs.current[nextDeckId];
      if (nextElement && typeof nextElement.focus === 'function') {
        nextElement.focus();
        nextElement.scrollIntoView({
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
          block: 'nearest',
          inline: 'center'
        });
      }
      // Note: Selection only happens on Enter/Space (handled above), not on arrow navigation
      // This follows the roving tabindex pattern where arrows move focus, not selection
    }
  };

  return (
    <div className="panel-mystic deck-selector-panel animate-fade-in">
      <div className="relative z-10 space-y-5">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[0.68rem] uppercase tracking-[0.22em] text-gold-soft">Choose Your Deck</p>
            <p className="text-xs text-muted max-w-2xl">
              Select the deck art for today&apos;s reading. Match it to your physical deck if you&apos;re contributing photos to the vision study.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-gold-soft/50 bg-surface/60 px-3 py-1 text-[0.7rem] text-accent backdrop-blur">
            <span className="w-1.5 h-1.5 rounded-full bg-gold-soft animate-pulse" aria-hidden="true" />
            <span>Curated editions</span>
          </div>
        </header>

        {/* Carousel wrapper with edge fade indicators */}
        <div className="relative">
          {/* Left edge fade - indicates scrolled content behind */}
          <div
            className={`
              absolute left-0 top-0 bottom-3 w-8 z-10
              pointer-events-none
              bg-gradient-to-r from-[color:var(--panel-dark-1)]/90 to-transparent
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
              bg-gradient-to-l from-[color:var(--panel-dark-1)]/90 via-[color:var(--panel-dark-1)]/60 to-transparent
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
            aria-label="Choose your deck style"
            className="deck-selector-grid flex gap-3 overflow-x-auto snap-x snap-mandatory pb-3 sm:overflow-visible sm:snap-none sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-4"
          >
          {DECK_OPTIONS.map((deck, index) => {
            const isSelected = selectedDeck === deck.id;
            const isFirstDeck = index === 0;
            const isTabbable = isSelected || (!selectedDeck && isFirstDeck);

            return (
              <button
                key={deck.id}
                ref={el => { deckRefs.current[deck.id] = el; }}
                type="button"
                role="radio"
                aria-checked={isSelected}
                tabIndex={isTabbable ? 0 : -1}
                onClick={() => onDeckChange(deck.id)}
                onKeyDown={(e) => handleKeyDown(e, deck.id)}
                className={`deck-card relative flex h-full flex-col gap-3 rounded-2xl px-4 py-4 sm:px-5 sm:py-5 text-left transition-all cursor-pointer select-none shrink-0 basis-[82%] xs:basis-[70%] snap-center sm:basis-auto sm:shrink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--deck-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-main ${isSelected ? 'deck-card--active' : ''}`}
                style={{
                  '--deck-accent': deck.accent,
                  '--deck-border': isSelected ? deck.borderActive : deck.border,
                  '--deck-background': deck.background,
                  '--deck-glow': deck.glow,
                  '--deck-ring': deck.accent
                }}
              >
                {isSelected && (
                  <>
                    <div className="absolute top-3 right-3 z-20">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center border border-[color:var(--border-warm-light)]"
                        style={{
                          backgroundColor: 'var(--deck-accent)',
                          boxShadow: '0 12px 26px -18px var(--deck-glow, var(--primary-30))'
                        }}
                      >
                        <Check className="w-4 h-4 text-main" strokeWidth={3} aria-hidden="true" />
                      </div>
                    </div>
                    <div
                      className="absolute left-3 top-3 z-20 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                      style={{
                        backgroundColor: 'var(--surface-92)',
                        color: deck.accent,
                        border: '1px solid var(--border-warm-light)',
                        boxShadow: '0 12px 28px -20px rgba(0,0,0,0.7)'
                      }}
                    >
                      <Check className="h-3.5 w-3.5" weight="bold" aria-hidden="true" />
                      <span>Selected</span>
                    </div>
                  </>
                )}

                <DeckPreviewImage
                  preview={deck.preview}
                  deckLabel={deck.label}
                  priority={index === 0 ? 'high' : 'low'}
                />

                <div className="pr-1">
                  <div className="font-serif text-accent text-base leading-tight">
                    {deck.label}
                  </div>
                  <div className="text-[0.7rem] uppercase tracking-[0.18em] text-gold-soft/90 mb-2">
                    {deck.subtitle}
                  </div>
                  <p className={`text-xs text-muted leading-snug ${isSmallScreen ? 'mb-2 line-clamp-2' : 'mb-3'}`}>
                    {deck.mobileDescription || deck.description}
                  </p>

                  {!isSmallScreen && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {deck.palette.map((tone) => (
                        <PaletteBadge key={`${deck.id}-${tone.label}`} {...tone} />
                      ))}
                    </div>
                  )}

                  {isSmallScreen && (
                    <div className="mt-1">
                      <MobileInfoSection title="See color palette">
                        <div className="flex flex-wrap gap-1.5">
                          {deck.palette.map((tone) => (
                            <PaletteBadge key={`${deck.id}-${tone.label}`} {...tone} />
                          ))}
                        </div>
                        {deck.note && (
                          <p className="text-[0.68rem] text-accent/85 italic mt-2">
                            {deck.note}
                          </p>
                        )}
                      </MobileInfoSection>
                    </div>
                  )}

                  {deck.note && !isSmallScreen && (
                    <p className="text-[0.68rem] text-accent/85 italic mt-2">
                      {deck.note}
                    </p>
                  )}
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
            totalItems={deckIds.length}
            onSelectItem={scrollToIndex}
            labels={DECK_OPTIONS.map(d => d.label)}
            ariaLabel="Deck selection"
            variant="compact"
          />
        </div>

        <div className="deck-panel-footnote">
          <p className="text-xs leading-relaxed text-muted">
            <strong className="text-accent">For research participants:</strong> Choose the matching deck to help the vision model recognize suits and illustrations across art styles.
          </p>
        </div>
      </div>
    </div>
  );
}
