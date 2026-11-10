import { useId } from 'react';
import { MoonPhaseIndicator } from '../MoonPhaseIndicator';
import { getSpreadInfo } from '../../data/spreads';
import { DECK_OPTIONS } from '../deckOptions';
import { LABEL_CLASS } from '../../styles/labelClasses';

// "3 cards", "1 card", or "3 cards + clarifiers", as the spread cards say it.
function getCardCountLabel(spread) {
  const baseCount = typeof spread?.drawCount === 'number' ? spread.drawCount : spread?.count;
  if (typeof baseCount !== 'number') return null;
  const noun = baseCount === 1 ? 'card' : 'cards';
  return typeof spread.maxCards === 'number' && spread.maxCards > baseCount
    ? `${baseCount} ${noun} + clarifiers`
    : `${baseCount} ${noun}`;
}

// Setup stays lightweight until the reader starts a draw.
export function ReadingStart({
  displayName,
  readingMeta,
  isHandset,
  isLandscape,
  shuffle,
  isShuffling = false,
  statusLabel = '',
  spreadKey,
  deckStyleId
}) {
  const summaryId = useId();

  // Handsets keep the draw action in the dock; this line names the reading.
  if (isHandset) {
    return (
      <div className={`hidden sm:block ${isLandscape ? 'mb-2' : 'mb-4 sm:mb-5'}`}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs-plus sm:text-sm uppercase tracking-widest text-accent">
            {displayName ? `Reading for ${displayName}` : 'Reading'}
          </p>
          <MoonPhaseIndicator ephemeris={readingMeta?.ephemeris} variant="icon" />
        </div>
      </div>
    );
  }

  // Wider screens: where the reading stands, what will be drawn, and the draw.
  const spread = spreadKey ? getSpreadInfo(spreadKey) : null;
  const deck = DECK_OPTIONS.find(option => option.id === deckStyleId);
  const summary = [spread?.name, getCardCountLabel(spread), deck?.label].filter(Boolean).join(' · ');

  return (
    <div className="setup-draw-row__inner">
      <div className="min-w-0 flex-1">
        {statusLabel && <p className={`${LABEL_CLASS} text-accent`}>{statusLabel}</p>}
        {summary && (
          <p id={summaryId} className="mt-1 text-sm text-muted-high text-pretty">{summary}</p>
        )}
      </div>
      <MoonPhaseIndicator ephemeris={readingMeta?.ephemeris} variant="compact" />
      <button
        type="button"
        onClick={shuffle}
        disabled={isShuffling}
        aria-describedby={summary ? summaryId : undefined}
        className="setup-draw-row__action min-h-cta shrink-0 bg-accent hover:bg-primary disabled:opacity-50 disabled:cursor-not-allowed text-surface font-semibold px-8 py-3 rounded-xl transition-colors inline-flex items-center justify-center text-base focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-(--focus-ring-color) focus-visible:ring-offset-2 focus-visible:ring-offset-main"
      >
        {isShuffling ? 'Shuffling the cards...' : 'Draw cards'}
      </button>
    </div>
  );
}
