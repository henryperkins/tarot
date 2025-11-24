import { useRef, useState, useEffect } from 'react';
import { Check } from '@phosphor-icons/react';
import { CarouselDots } from './CarouselDots';

export const DECK_OPTIONS = [
  {
    id: 'rws-1909',
    label: 'Rider-Waite-Smith',
    subtitle: '1909 Edition',
    description: 'Classic Pamela Colman Smith watercolors with bold ink outlines and theatrical staging.',
    palette: [
      { label: 'Sunlit yellows', swatch: '#eac26d', textColor: '#1c1308' },
      { label: 'Lapis blues', swatch: '#1f3f78', textColor: '#e6ecf7' },
      { label: 'Crimson accents', swatch: '#8d1c33', textColor: '#f7e7ef' }
    ],
    previewImages: [
      '/images/cards/RWS1909_-_00_Fool.jpeg',
      '/images/cards/RWS1909_-_09_Hermit.jpeg',
      '/images/cards/RWS1909_-_19_Sun.jpeg'
    ],
    accent: '#e5c48e',
    border: 'rgba(220, 188, 141, 0.35)',
    borderActive: 'rgba(229, 196, 142, 0.9)',
    glow: 'rgba(229, 196, 142, 0.45)',
    background: 'linear-gradient(150deg, rgba(255, 209, 159, 0.12), rgba(17, 12, 21, 0.94)), radial-gradient(circle at 20% 18%, rgba(255, 225, 180, 0.12), transparent 52%), radial-gradient(circle at 80% -10%, rgba(63, 118, 192, 0.18), transparent 48)'
  },
  {
    id: 'thoth-a1',
    label: 'Thoth',
    subtitle: 'Crowley/Harris A1',
    description: 'Abstract, prismatic geometry with layered astrological sigils and Art Deco gradients.',
    palette: [
      { label: 'Electric teal', swatch: '#27cfc0', textColor: '#061412' },
      { label: 'Magenta', swatch: '#c1248b', textColor: '#fde7f4' },
      { label: 'Saffron gold', swatch: '#d9a441', textColor: '#120c05' }
    ],
    previewImages: [
      '/images/cards/thoth/thoth_major_17_the-star.png',
      '/images/cards/thoth/thoth_major_14_art.png',
      '/images/cards/thoth/thoth_major_20_the-aeon.png',
      '/images/cards/thoth/thoth_major_08_adjustment.png'
    ],
    accent: '#44e0d2',
    border: 'rgba(83, 216, 206, 0.25)',
    borderActive: 'rgba(83, 216, 206, 0.75)',
    glow: 'rgba(83, 216, 206, 0.35)',
    background: 'linear-gradient(165deg, rgba(26, 48, 63, 0.92), rgba(15, 12, 30, 0.96)), radial-gradient(circle at 12% 18%, rgba(68, 224, 210, 0.22), transparent 48%), radial-gradient(circle at 90% 0%, rgba(193, 36, 139, 0.18), transparent 50)',
    note: 'Uses Thoth card names (e.g., "The Magus", "Adjustment").'
  },
  {
    id: 'marseille-classic',
    label: 'Tarot de Marseille',
    subtitle: '18th Century Scans',
    description: 'Woodcut line work with flat primary colors and medieval heraldry.',
    palette: [
      { label: 'Carmine red', swatch: '#a32035', textColor: '#fde6ec' },
      { label: 'Cobalt blue', swatch: '#21489b', textColor: '#e7efff' },
      { label: 'Sunflower yellow', swatch: '#d8a300', textColor: '#140d02' }
    ],
    previewImages: [
      '/images/cards/marseille/major01.jpg',
      '/images/cards/marseille/major19.jpg',
      '/images/cards/marseille/major05.jpg'
    ],
    accent: '#d8a300',
    border: 'rgba(192, 146, 64, 0.28)',
    borderActive: 'rgba(216, 163, 0, 0.82)',
    glow: 'rgba(216, 163, 0, 0.35)',
    background: 'linear-gradient(170deg, rgba(34, 26, 28, 0.94), rgba(16, 18, 32, 0.96)), radial-gradient(circle at 12% 22%, rgba(216, 163, 0, 0.16), transparent 46%), radial-gradient(circle at 85% -8%, rgba(47, 86, 178, 0.18), transparent 48)',
    note: 'Uses Marseille numbering with French titles.'
  }
];

function DeckPreviewStack({ images = [], accent }) {
  const stack = images.length >= 4 ? [-12, -3, 6, 14] : [-10, 0, 10];
  const cards = images.slice(0, stack.length);

  if (cards.length === 0) {
    return null;
  }

  return (
    <div className="relative h-28 sm:h-32 md:h-36 mb-1">
      {cards.map((src, index) => (
        <img
          key={`${src}-${index}`}
          src={src}
          alt=""
          role="presentation"
          loading="lazy"
          className="deck-preview-card absolute bottom-0 h-28 sm:h-32 md:h-36 w-auto rounded-xl border border-white/70 shadow-lg object-cover"
          style={{
            transform: `translateX(${index * 16}px) rotate(${stack[index]}deg)`,
            boxShadow: `0 16px 40px -24px rgba(0,0,0,0.8), 0 8px 24px -18px ${accent || 'rgba(212, 184, 150, 0.35)'}, 0 0 0 1px rgba(255,255,255,0.08)`
          }}
        />
      ))}
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
        boxShadow: `0 10px 20px -14px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.08), 0 0 0 1px ${swatch}33`
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
    };

    handleScroll();
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [deckIds.length]);

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
      el.scrollTo({ left: Math.max(0, scrollTarget), behavior: 'smooth' });
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
        nextElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
      // Note: Selection only happens on Enter/Space (handled above), not on arrow navigation
      // This follows the roving tabindex pattern where arrows move focus, not selection
    }
  };

  return (
    <div className="deck-selector-panel animate-fade-in">
      <div className="relative z-10 space-y-5">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[0.68rem] uppercase tracking-[0.22em] text-gold-soft">Choose Your Deck</p>
            <p className="text-xs text-muted max-w-2xl">
              Select the deck art for today&apos;s reading. Match it to your physical deck if you&apos;re contributing photos to the vision study.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-gold-soft/50 bg-black/30 px-3 py-1 text-[0.7rem] text-accent backdrop-blur">
            <span className="w-1.5 h-1.5 rounded-full bg-gold-soft animate-pulse" aria-hidden="true" />
            <span>Curated editions</span>
          </div>
        </header>

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
                className={`deck-card relative flex h-full flex-col gap-3 rounded-2xl px-4 py-4 sm:px-5 sm:py-5 text-left transition-all cursor-pointer select-none shrink-0 basis-[82%] xs:basis-[70%] snap-center sm:basis-auto sm:shrink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--deck-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0c13] ${isSelected ? 'deck-card--active' : ''}`}
                style={{
                  '--deck-accent': deck.accent,
                  '--deck-border': isSelected ? deck.borderActive : deck.border,
                  '--deck-background': deck.background,
                  '--deck-glow': deck.glow,
                  '--deck-ring': deck.accent
                }}
              >
                {isSelected && (
                  <div className="absolute top-3 right-3 z-20">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center border border-white/30"
                      style={{
                        backgroundColor: 'var(--deck-accent)',
                        boxShadow: `0 12px 26px -18px var(--deck-glow, rgba(212, 184, 150, 0.4))`
                      }}
                    >
                      <Check className="w-4 h-4 text-main" strokeWidth={3} />
                    </div>
                  </div>
                )}

                <DeckPreviewStack images={deck.previewImages} accent={deck.glow} />

                <div className="pr-1">
                  <div className="font-serif text-accent text-base leading-tight">
                    {deck.label}
                  </div>
                  <div className="text-[0.7rem] uppercase tracking-[0.18em] text-gold-soft/90 mb-2">
                    {deck.subtitle}
                  </div>
                  <p className="text-xs text-muted leading-snug mb-3">
                    {deck.description}
                  </p>

                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {deck.palette.map((tone) => (
                      <PaletteBadge key={`${deck.id}-${tone.label}`} {...tone} />
                    ))}
                  </div>

                  {deck.note && (
                    <p className="text-[0.68rem] text-accent/85 italic mt-2">
                      {deck.note}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
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
