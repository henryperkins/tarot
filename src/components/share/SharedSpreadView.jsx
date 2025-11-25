import { useMemo, useRef } from 'react';
import { SPREADS } from '../../data/spreads';
import { MAJOR_ARCANA } from '../../data/majorArcana';
import { MINOR_ARCANA } from '../../data/minorArcana';

const FALLBACK_IMAGE = '/images/cards/RWS1909_-_00_Fool.jpeg';

/**
 * Lazy singleton for card lookup to avoid running on every import
 */
let _cardLookup = null;
function getCardLookup() {
  if (!_cardLookup) {
    _cardLookup = [...MAJOR_ARCANA, ...MINOR_ARCANA].reduce((acc, card) => {
      acc[card.name] = card;
      return acc;
    }, {});
  }
  return _cardLookup;
}

function getOrientationMeaning(card) {
  const lookup = getCardLookup();
  const reference = lookup[card.name] || lookup[card.canonicalName] || card;
  const upright = reference?.upright || card?.upright || '';
  const reversed = reference?.reversed || card?.reversed || '';
  const orientation = card?.orientation || '';
  const isReversed = orientation.toLowerCase().includes('reversed');
  return isReversed ? reversed || upright : upright || reversed;
}

function getCardImage(card) {
  if (!card) return FALLBACK_IMAGE;
  if (card.image) return card.image;
  const lookup = getCardLookup();
  const lookupOrder = [card.name, card.canonicalName, card.card];
  for (const key of lookupOrder) {
    const match = key && lookup[key];
    if (match?.image) return match.image;
  }
  return FALLBACK_IMAGE;
}

function deriveSpreadPositions(entry) {
  if (!entry) return [];
  const spreadDefinition = entry.spreadKey ? SPREADS[entry.spreadKey] : null;
  if (spreadDefinition?.positions) {
    return spreadDefinition.positions;
  }
  return Array.isArray(entry.cards)
    ? entry.cards.map((_, index) => `Position ${index + 1}`)
    : [];
}

function mapNotes(notes) {
  // Sort once, then group by position
  const sorted = [...notes].sort((a, b) => a.createdAt - b.createdAt);
  return sorted.reduce((acc, note) => {
    const key = note.cardPosition || 'general';
    (acc[key] ??= []).push(note);
    return acc;
  }, {});
}

function NoteAvatars({ notes }) {
  if (!notes?.length) return null;

  // Get the most recent 3 notes (by createdAt descending)
  const sorted = [...notes].sort((a, b) => b.createdAt - a.createdAt);
  const latest = sorted.slice(0, 3);
  const remaining = notes.length - latest.length;

  return (
    <div
      className="flex items-center gap-1"
      aria-label={`${notes.length} note${notes.length === 1 ? '' : 's'} on this card`}
    >
      {latest.map((note) => {
        // Use initials or fallback to "??" for consistency across platforms
        const initials = note.authorName?.trim()?.slice(0, 2)?.toUpperCase() || '??';
        return (
          <span
            key={note.id}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary/30 text-[0.65rem] font-semibold text-secondary"
            title={note.authorName || 'Anonymous'}
            aria-hidden="true"
          >
            {initials}
          </span>
        );
      })}
      {remaining > 0 && (
        <span className="text-xs text-secondary/80" aria-hidden="true">
          +{remaining}
        </span>
      )}
    </div>
  );
}

export function SharedSpreadView({ entry, notes = [], selectedPosition, onSelectPosition }) {
  const positions = useMemo(() => deriveSpreadPositions(entry), [entry]);
  const noteMap = useMemo(() => mapNotes(notes), [notes]);
  // Track which images have failed to prevent infinite error loops
  const failedImagesRef = useRef(new Set());

  // Improved grid logic with better responsive handling
  const gridClass = useMemo(() => {
    if (!entry) return 'grid grid-cols-1';

    const cardCount = entry.cards?.length ?? 0;

    if (entry.spreadKey === 'celtic') return 'cc-grid';
    if (cardCount === 0) return 'grid grid-cols-1';
    if (cardCount === 1) return 'grid grid-cols-1 max-w-sm mx-auto';
    if (cardCount === 2) return 'grid grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto';
    if (cardCount === 3) return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
    if (cardCount <= 4) return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';
    return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
  }, [entry]);

  if (!entry) {
    return null;
  }

  const generalNotes = noteMap.general || [];

  const handleImageError = (event, cardName) => {
    const img = event.currentTarget;
    // Prevent infinite loop - only set fallback once per image
    if (!failedImagesRef.current.has(cardName)) {
      failedImagesRef.current.add(cardName);
      img.src = FALLBACK_IMAGE;
    }
  };

  return (
    <div className="space-y-6">
      <div className={`${gridClass} gap-4`} role="list" aria-label="Cards in this spread">
        {entry.cards?.map((card, index) => {
          const positionLabel = card.position || positions[index] || `Card ${index + 1}`;
          const positionNotes = noteMap[positionLabel] || [];
          const active = selectedPosition === positionLabel;
          const orientation = card.orientation || 'Upright';
          const isReversed = orientation.toLowerCase().includes('reversed');
          const meaning = getOrientationMeaning(card) || 'Meaning unavailable';

          return (
            <button
              key={`${card.name}-${index}`}
              type="button"
              role="listitem"
              onClick={() => onSelectPosition?.(positionLabel)}
              aria-pressed={active}
              aria-label={`${positionLabel}: ${card.name}, ${orientation}. ${positionNotes.length} note${positionNotes.length === 1 ? '' : 's'}. Click to target for note.`}
              className={`group w-full rounded-2xl border bg-surface/70 p-4 text-left shadow-lg transition-all duration-200
                focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/60 focus-visible:ring-offset-2
                active:scale-[0.98] touch-manipulation
                ${active
                  ? 'border-secondary/70 ring-1 ring-secondary/30'
                  : 'border-secondary/20 hover:border-secondary/40 hover:shadow-xl'
                }
                ${entry.spreadKey === 'celtic' ? 'modern-surface' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-[0.2em] text-secondary">{positionLabel}</p>
                {positionNotes.length > 0 && (
                  <span className="rounded-full bg-secondary/10 px-2 py-0.5 text-xs text-secondary">
                    {positionNotes.length} note{positionNotes.length === 1 ? '' : 's'}
                  </span>
                )}
              </div>

              <div className="mt-3 flex flex-col items-center text-center">
                {/* Card image container with proper aspect ratio */}
                <div className="aspect-[2/3.5] w-full max-w-[200px] overflow-hidden rounded-xl border border-primary/30 bg-surface-muted/50">
                  <img
                    src={getCardImage(card)}
                    alt={`${card.name}, ${orientation}`}
                    className={`w-full h-full object-contain ${isReversed ? 'rotate-180' : ''}`}
                    loading="lazy"
                    onError={(e) => handleImageError(e, card.name)}
                  />
                </div>
                <p className="mt-3 font-serif text-lg text-main">{card.name}</p>
                <span className="text-xs uppercase tracking-[0.2em] text-secondary/70">{orientation}</span>
                <p className="mt-2 text-sm text-muted line-clamp-3">{meaning}</p>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <NoteAvatars notes={positionNotes} />
                {active && (
                  <span className="rounded-full border border-secondary/60 px-2.5 py-1 text-xs text-secondary">
                    Targeting note
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* General notes section */}
      {generalNotes.length > 0 && (
        <section
          className="rounded-2xl border border-secondary/20 bg-surface/70 p-4 shadow-inner"
          aria-labelledby="general-notes-heading"
        >
          <h3 id="general-notes-heading" className="text-xs uppercase tracking-[0.3em] text-secondary">
            Whole spread reflections
          </h3>
          <div
            className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {generalNotes.map((note) => (
              <article key={note.id} className="rounded-xl border border-accent/20 bg-surface-muted/70 p-3">
                <header className="flex items-center justify-between gap-2 text-xs text-secondary/90">
                  <span className="font-semibold truncate">{note.authorName || 'Anonymous'}</span>
                  <time
                    dateTime={new Date(note.createdAt).toISOString()}
                    className="text-secondary/70 shrink-0"
                  >
                    {new Date(note.createdAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </time>
                </header>
                <p className="mt-2 text-sm text-main/90 whitespace-pre-wrap break-words">{note.body}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
