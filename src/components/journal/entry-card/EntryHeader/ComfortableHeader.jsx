/**
 * ComfortableHeader.jsx
 * Full expanded header view for journal entry card with pills and metadata.
 */
import { memo } from 'react';
import { CaretUp, CaretDown, DotsThreeVertical } from '@phosphor-icons/react';
import { JournalShareIcon, JournalCommentAddIcon, JournalPlusCircleIcon } from '../../../JournalIcons';
import { REVERSED_PATTERN } from '../../../../lib/journalInsights';
import { styles, cn } from '../EntryCard.primitives';

export const ComfortableHeader = memo(function ComfortableHeader({
  entry,
  isExpanded,
  entryContentId,
  onToggle,
  metadata,
  actionMenu,
  actions,
  actionMenuId,
  renderActionMenu,
  compact = false
}) {
  const {
    cards,
    cardPreview,
    formattedTimestamp,
    relativeTimeLabel,
    deckLabel,
    hasReflections,
    reflections,
    contextLabel
  } = metadata;

  const {
    pendingAction,
    handleShare
  } = actions;

  const {
    toggle: toggleMenu,
    buttonRef: actionMenuButtonRef
  } = actionMenu;

  const shareActionLabel = actions.isAuthenticated && actions.onCreateShareLink
    ? 'Create share link'
    : 'Copy summary';

  const headerPadding = compact
    ? 'px-3.5 py-3 sm:px-4 sm:py-3.5'
    : 'px-4 py-4 sm:px-5 sm:py-5';

  return (
    <div className={cn(
      'relative z-10',
      headerPadding,
      isExpanded && 'border-b border-[color:rgba(255,255,255,0.08)]'
    )}>
      <div className="flex items-start gap-3">
        {/* Main clickable area */}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isExpanded}
          aria-controls={entryContentId}
          title={isExpanded ? 'Collapse entry' : 'Expand entry'}
          className="group flex min-w-0 flex-1 flex-col gap-3 rounded-2xl px-1 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:rgba(232,218,195,0.45)]"
        >
          <div className="flex items-center gap-3">
            {/* Expand/collapse icon */}
            <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:rgba(255,255,255,0.16)] bg-[color:rgba(12,12,20,0.6)] text-[color:var(--text-muted)] shadow-[0_14px_28px_-18px_rgba(0,0,0,0.7)] transition group-hover:border-[color:rgba(255,255,255,0.24)]">
              {isExpanded ? (
                <CaretUp className="h-4 w-4" aria-hidden="true" />
              ) : (
                <CaretDown className="h-4 w-4" aria-hidden="true" />
              )}
            </span>

            <div className="min-w-0 flex-1">
              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-[color:var(--text-muted)]">
                <span className="inline-flex items-center rounded-full border border-[color:rgba(255,255,255,0.12)] bg-[color:rgba(255,255,255,0.05)] px-2 py-0.5 normal-case tracking-normal">
                  {formattedTimestamp}
                </span>
                {relativeTimeLabel && (
                  <span className="inline-flex items-center rounded-full border border-[color:rgba(255,255,255,0.08)] px-2 py-0.5 normal-case tracking-normal">
                    {relativeTimeLabel}
                  </span>
                )}
                {deckLabel && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[color:rgba(255,255,255,0.08)] px-2 py-0.5">
                    Deck
                    <span className="normal-case text-[color:var(--text-main)]">
                      {deckLabel}
                    </span>
                  </span>
                )}
              </div>

              {/* Title */}
              <h3 className="mt-1 min-w-0 font-[Cormorant_Garamond] text-lg sm:text-xl text-[color:var(--brand-primary)] tracking-[0.04em] leading-snug line-clamp-2">
                {entry.spread || entry.spreadName || 'Tarot Reading'}
              </h3>
            </div>
          </div>

          {/* Meta pills */}
          <div className="flex flex-wrap items-center gap-2">
            {contextLabel && (
              <span className={cn(styles.pill, 'whitespace-nowrap')}>
                {contextLabel}
              </span>
            )}
            {cards.length > 0 && (
              <span className={cn(styles.pill, 'whitespace-nowrap')}>
                {cards.length} cards
              </span>
            )}
            {hasReflections && (
              <span className={cn(styles.pill, 'whitespace-nowrap')}>
                <JournalCommentAddIcon className="h-3 w-3 text-[color:var(--brand-primary)]" aria-hidden="true" />
                {reflections.length}
              </span>
            )}
          </div>

          {/* Card preview chips */}
          {cardPreview.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[color:var(--text-muted)]">
              {cardPreview.map((card, idx) => {
                const name = (card.name || 'Card').replace(/^The\s+/i, '');
                const reversed = REVERSED_PATTERN.test(card?.orientation || '') || card?.isReversed;
                return (
                  <span
                    key={`${card.name || 'card'}-${idx}`}
                    className={cn(styles.cardChip, 'flex-nowrap')}
                  >
                    <JournalPlusCircleIcon className="h-3 w-3 text-[color:var(--text-muted)]" aria-hidden="true" />
                    <span className="min-w-0 max-w-[140px] truncate text-[11px] text-[color:var(--text-main)]">
                      {name}
                    </span>
                    {reversed && (
                      <span className={styles.reversedBadge}>Rev</span>
                    )}
                  </span>
                );
              })}
              {cards.length > cardPreview.length && (
                <span className="text-[11px] text-[color:var(--text-muted)]">
                  +{cards.length - cardPreview.length} more
                </span>
              )}
            </div>
          )}

          {/* Question preview */}
          {entry.question && (
            <div className="rounded-2xl border border-[color:rgba(255,255,255,0.12)] bg-[color:rgba(8,9,16,0.55)] px-3 py-2">
              <p className="text-sm text-[color:var(--text-muted)] italic line-clamp-2">
                &ldquo;{entry.question}&rdquo;
              </p>
            </div>
          )}
        </button>

        {/* Action buttons */}
        <div className="relative flex-shrink-0 self-start pt-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShare}
              disabled={pendingAction === 'share'}
              title={shareActionLabel}
              className={cn(
                styles.iconButton,
                pendingAction === 'share' && 'cursor-wait opacity-60'
              )}
            >
              <JournalShareIcon className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">{shareActionLabel}</span>
            </button>

            <button
              type="button"
              ref={actionMenuButtonRef}
              onClick={(event) => {
                event.stopPropagation();
                toggleMenu();
              }}
              className={styles.iconButton}
              aria-haspopup="menu"
              aria-controls={actionMenuId}
              aria-expanded={actionMenu.isOpen}
              title="Entry actions"
            >
              <DotsThreeVertical className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Open entry actions</span>
            </button>
          </div>

          {renderActionMenu()}
        </div>
      </div>
    </div>
  );
});
