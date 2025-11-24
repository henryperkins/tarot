import { useRef } from 'react';
import { Check } from '@phosphor-icons/react';

export const DECK_OPTIONS = [
  {
    id: 'rws-1909',
    label: 'Rider-Waite-Smith',
    subtitle: '1909 Edition',
    description: 'Classic Pamela Colman Smith watercolors with bold ink outlines and theatrical staging.',
    visualCues: ['Sunlit yellows', 'Lapis blues', 'Crimson accents'],
    texture: 'Hand-painted inks on watercolor paper'
  },
  {
    id: 'thoth-a1',
    label: 'Thoth',
    subtitle: 'Crowley/Harris A1',
    description: 'Abstract, prismatic geometry with layered astrological sigils and Art Deco gradients.',
    visualCues: ['Electric teal', 'Magenta', 'Saffron gold'],
    texture: 'Oil and watercolor washes with airbrushed gradients',
    note: 'Uses Thoth card names (e.g., \u201cThe Magus\u201d, \u201cAdjustment\u201d)'
  },
  {
    id: 'marseille-classic',
    label: 'Tarot de Marseille',
    subtitle: '18th Century Scans',
    description: 'Woodcut line work with flat primary colors and medieval heraldry.',
    visualCues: ['Carmine red', 'Cobalt blue', 'Sunflower yellow'],
    texture: 'Bold, block-printed textures with minimal shading'
  }
];

export function DeckSelector({ selectedDeck, onDeckChange }) {
  const deckRefs = useRef({});

  const handleKeyDown = (event, deckId) => {
    const deckIds = DECK_OPTIONS.map(d => d.id);
    const currentIndex = deckIds.indexOf(deckId);

    // Handle selection
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onDeckChange(deckId);
      return;
    }

    // Handle arrow key navigation
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

    // Focus the next deck if we navigated
    if (nextIndex !== -1) {
      const nextDeckId = deckIds[nextIndex];
      const nextElement = deckRefs.current[nextDeckId];
      if (nextElement && typeof nextElement.focus === 'function') {
        nextElement.focus();
      }
    }
  };

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="mb-3">
        <h3 className="text-sm font-serif text-accent mb-1">
          Choose your deck style
        </h3>
        <p className="text-xs text-muted">
          Pick the art style you want to experience. If you&apos;re also in vision research, select the deck you&apos;re photographing so the AI can learn.
        </p>
      </div>

      <div role="radiogroup" aria-label="Choose your deck style" className="grid gap-3 sm:grid-cols-3">
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
              className={`
                relative text-left p-4 rounded-xl border-2 transition-all
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-main
                ${isSelected
                  ? 'border-secondary bg-secondary/10'
                  : 'border-accent/20 bg-surface-muted/40 hover:border-accent/40 hover:bg-surface-muted/60'
                }
              `}
            >
              {/* Selected indicator */}
              {isSelected && (
                <div className="absolute top-3 right-3">
                  <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center">
                    <Check className="w-4 h-4 text-surface" strokeWidth={3} />
                  </div>
                </div>
              )}

            {/* Deck info */}
            <div className="pr-8">
              <div className="font-serif text-accent text-base mb-0.5">
                {deck.label}
              </div>
              <div className="text-[0.7rem] text-secondary/80 uppercase tracking-wider mb-2">
                {deck.subtitle}
              </div>
              <p className="text-xs text-muted leading-snug mb-2">
                {deck.description}
              </p>

              {/* Visual cues */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {deck.visualCues.map((cue) => (
                  <span
                    key={cue}
                    className="text-[0.65rem] px-2 py-0.5 rounded-full bg-surface-muted/60 text-accent/80 border border-accent/20"
                  >
                    {cue}
                  </span>
                ))}
              </div>

              {/* Note if present */}
              {deck.note && (
                <p className="text-[0.65rem] text-accent/70 italic mt-2">
                  {deck.note}
                </p>
              )}
            </div>
            </button>
          );
        })}
      </div>

      {/* Helper text */}
      <div className="mt-3 text-xs text-muted bg-surface-muted/60 border border-accent/20 rounded-lg px-3 py-2">
        <p>
          <strong className="text-accent">For research participants:</strong> Choosing the matching deck helps the vision AI recognize cards accurately across art styles.
        </p>
      </div>
    </div>
  );
}
