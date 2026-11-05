import { useCallback, useId } from 'react';
import { CarouselDots } from './CarouselDots';
import { CarouselEdges, ChosenMarks } from './ChoiceCarousel';
import { useChoiceCarousel } from '../hooks/useChoiceCarousel';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { isVisionResearchEnabled } from '../hooks/useFeatureFlags';
import { useAuth } from '../contexts/AuthContext';
import { DECK_OPTIONS } from './deckOptions';
import { LABEL_CLASS } from '../styles/labelClasses';

const DECK_IDS = DECK_OPTIONS.map(deck => deck.id);
const DECK_LABELS = DECK_OPTIONS.map(deck => deck.label);

// The preview sits inside a deck radio that its title already names, so the
// image itself is decorative. `priority`: 'high' (eager, fetched first),
// 'eager', or 'lazy'.
function DeckPreviewImage({ preview, priority = 'lazy' }) {
  const fallbackSrc = preview?.src;
  const attachImage = useCallback((image) => {
    // WebKit starts eager src requests while React builds detached nodes.
    // Attach the fallback after <picture> has its sources to avoid fetching both.
    if (image && fallbackSrc) image.src = fallbackSrc;
  }, [fallbackSrc]);

  if (!preview?.src) {
    return null;
  }

  const isHighPriority = priority === 'high';
  const loading = priority === 'lazy' ? 'lazy' : 'eager';
  const sizes = '(min-width: 1024px) 280px, (min-width: 640px) 42vw, 60vw';

  return (
    <div className="deck-card__preview relative aspect-982/799 overflow-hidden rounded-[14px] bg-main mb-1">
      <picture className="block h-full w-full">
        {(preview.sources || []).map(source => (
          <source key={source.type} type={source.type} srcSet={source.srcSet} sizes={sizes} />
        ))}
        <img
          ref={attachImage}
          width={preview.width}
          height={preview.height}
          sizes={sizes}
          alt=""
          className="block w-full h-full object-cover"
          loading={loading}
          fetchPriority={isHighPriority ? 'high' : 'auto'}
          decoding="async"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      </picture>
      <div
        className="pointer-events-none absolute inset-0 rounded-[14px] border border-(--border-warm-light) shadow-[0_0_0_1px_var(--border-warm-subtle)]"
        aria-hidden="true"
      />
    </div>
  );
}

/**
 * @param {'panel' | 'drawer'} [variant='panel'] - The handset preparation drawer
 *   already introduces the deck choice in its title and Deck tab, so 'drawer'
 *   leaves out the panel header and starts with the decks themselves.
 * @param {boolean} [hasDrawnCards=false] - Cards are on the table: a new deck
 *   applies to the next draw, and the copy says so.
 */
export function DeckSelector({ selectedDeck, onDeckChange, variant = 'panel', hasDrawnCards = false }) {
  const idBase = useId();
  const prefersReducedMotion = useReducedMotion();
  const { isAuthenticated } = useAuth();
  const showHeader = variant !== 'drawer';
  // The photo study runs only in research builds and needs an account, as the
  // reading's vision panel does (ReadingDisplay); everyone else never sees it.
  const showResearchNote = isVisionResearchEnabled() && isAuthenticated;
  const nextDrawNote = 'Your next draw uses the deck you choose. The cards on the table keep theirs.';

  const {
    carouselRef,
    frameRef,
    itemRefs,
    activeIndex,
    showStartFade,
    showEndFade,
    scrollToIndex,
    markChosenHere,
    step,
    onItemKeyDown,
    onItemFocus,
    onGroupBlur,
    tabStopKey
  } = useChoiceCarousel({
    keys: DECK_IDS,
    selectedKey: selectedDeck,
    onChoose: deckId => chooseDeck(deckId),
    prefersReducedMotion,
    artworkSelector: '.deck-card__preview'
  });

  const chooseDeck = (deckId) => {
    markChosenHere(deckId);
    onDeckChange(deckId);
  };

  return (
    <div className="panel-mystic deck-selector-panel animate-fade-in">
      <div className="relative z-10 space-y-5">
        {showHeader ? (
          <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <h2 className={`${LABEL_CLASS} text-accent`}>Choose Your Deck</h2>
              <p className="text-base leading-relaxed text-muted max-w-[65ch] text-pretty">
                {hasDrawnCards ? nextDrawNote : 'The deck sets the card art and the card names in your reading.'}
              </p>
            </div>
            <div className="hidden sm:flex shrink-0 items-center gap-2 rounded-full border border-gold-soft/50 bg-surface/60 px-3 py-1 text-xs font-medium text-accent backdrop-blur">
              <span className="w-1.5 h-1.5 rounded-full bg-gold-soft" aria-hidden="true" />
              <span>Curated editions</span>
            </div>
          </header>
        ) : hasDrawnCards && (
          <p className="text-sm leading-relaxed text-muted text-pretty">{nextDrawNote}</p>
        )}

        {/* Carousel wrapper with edge fades and Previous/Next */}
        <div ref={frameRef} className="relative">
          <CarouselEdges
            showStart={showStartFade}
            showEnd={showEndFade}
            onStep={step}
            previousLabel="Previous deck"
            nextLabel="Next deck"
          />

          <div
            ref={carouselRef}
            role="radiogroup"
            aria-label="Choose your deck style"
            onBlur={onGroupBlur}
            className="deck-selector-grid flex gap-3 overflow-x-auto snap-x snap-mandatory pb-3 sm:overflow-visible sm:snap-none sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-4"
          >
          {DECK_OPTIONS.map(deck => {
            const isSelected = selectedDeck === deck.id;
            // The radio is named by the deck title; the edition, description
            // and note follow as its description.
            const ids = {
              title: `${idBase}-${deck.id}-title`,
              subtitle: `${idBase}-${deck.id}-subtitle`,
              description: `${idBase}-${deck.id}-description`,
              note: `${idBase}-${deck.id}-note`
            };
            const describedBy = [ids.subtitle, ids.description, deck.note && ids.note].filter(Boolean).join(' ');

            return (
              <div
                key={deck.id}
                // Carousel cards stretch to the tallest; the grid sizes its rows.
                className={`deck-card relative flex sm:h-full flex-col gap-3 rounded-2xl px-4 py-4 sm:px-5 sm:py-5 transition-all shrink-0 basis-[82%] xs:basis-[70%] snap-center sm:basis-auto sm:shrink ${isSelected ? 'deck-card--active' : ''}`}
                style={{
                  '--deck-accent': deck.accent,
                  '--deck-border': isSelected ? deck.borderActive : deck.border,
                  '--deck-background': deck.background,
                  '--deck-glow': deck.glow
                }}
              >
                <button
                  ref={el => { itemRefs.current[deck.id] = el; }}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-labelledby={ids.title}
                  aria-describedby={describedBy}
                  tabIndex={deck.id === tabStopKey ? 0 : -1}
                  onClick={() => chooseDeck(deck.id)}
                  onFocus={() => onItemFocus(deck.id)}
                  onKeyDown={event => onItemKeyDown(event, deck.id)}
                  className="flex w-full flex-1 flex-col gap-3 rounded-xl text-left cursor-pointer select-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-(--focus-ring-color) focus-visible:ring-offset-2 focus-visible:ring-offset-main"
                >
                  {isSelected && <ChosenMarks glow="var(--deck-glow, var(--primary-30))" />}

                  {/* The wide grid shows all three decks above the fold, so none
                      waits for lazy loading; the chosen one, often the largest
                      paint, goes first. The drawer centres the chosen deck and
                      lets the others load as they come into view. */}
                  <DeckPreviewImage
                    preview={deck.preview}
                    priority={isSelected ? 'high' : showHeader ? 'eager' : 'lazy'}
                  />

                  <div className="min-w-0 pr-1 wrap-anywhere">
                    <div id={ids.title} className="deck-card__title font-serif text-accent text-lg font-semibold leading-tight text-balance">
                      {deck.label}
                    </div>
                    <div id={ids.subtitle} className="mt-1 mb-2 text-xs font-medium uppercase tracking-widest leading-normal text-muted">
                      {deck.subtitle}
                    </div>
                    <p id={ids.description} className="deck-card__description text-sm text-muted leading-normal text-pretty">
                      {deck.mobileDescription || deck.description}
                    </p>

                    {deck.note && (
                      <p id={ids.note} className="text-xs leading-relaxed text-muted italic mt-2 text-pretty">
                        {deck.note}
                      </p>
                    )}
                  </div>
                </button>
              </div>
            );
          })}
          </div>
        </div>

        {/* Mobile pagination dots */}
        <div className="sm:hidden">
          <CarouselDots
            activeIndex={activeIndex}
            totalItems={DECK_IDS.length}
            onSelectItem={scrollToIndex}
            labels={DECK_LABELS}
            ariaLabel="Browse decks"
            variant="compact"
          />
        </div>

        {showResearchNote && (
          <div className="deck-panel-footnote">
            <p className="max-w-[65ch] text-sm leading-relaxed text-muted text-pretty">
              <strong className="text-accent">For research participants:</strong> Choose the matching deck to help the vision model recognize suits and illustrations across art styles.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
