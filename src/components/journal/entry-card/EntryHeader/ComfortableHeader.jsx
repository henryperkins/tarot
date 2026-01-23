/**
 * ComfortableHeader.jsx
 * Full expanded header view for journal entry card with pills and metadata.
 */
import { memo } from 'react';
import { CaretUp, CaretDown, DotsThreeVertical } from '@phosphor-icons/react';
import { JournalShareIcon, JournalCommentAddIcon, JournalCardIcon } from '../../../JournalIcons';
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
  const isCompactView = compact && !isExpanded;

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

  const timestampLabel = relativeTimeLabel || formattedTimestamp;
  const timestampTitle = relativeTimeLabel ? formattedTimestamp : undefined;

  const headerPadding = isCompactView
    ? 'px-3.5 py-3 sm:px-4 sm:py-3.5'
    : 'px-4 py-4 sm:px-5 sm:py-5';

  return (
    <div className={cn(
      'relative z-10',
      headerPadding,
      isExpanded && 'border-b border-[color:var(--border-warm-subtle)]'
    )}>
      <div className="flex items-start gap-3">
        {/* Main clickable area */}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isExpanded}
          aria-controls={entryContentId}
          title={isExpanded ? 'Collapse entry' : 'Expand entry'}
          className={cn(
            'group flex min-w-0 flex-1 rounded-2xl px-1 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-45)]',
            isCompactView ? 'flex-row items-start gap-3' : 'flex-col gap-3'
          )}
        >
          <div className="flex items-center gap-3">
            {/* Expand/collapse icon */}
            <span className={cn(
              'mt-0.5 flex items-center justify-center rounded-2xl border border-[color:var(--border-warm-light)] bg-[color:var(--panel-dark-2)] text-[color:var(--text-muted)] shadow-[0_14px_28px_-18px_rgba(0,0,0,0.7)] transition group-hover:border-[color:var(--border-warm)]',
              isCompactView ? 'h-8 w-8 rounded-xl shadow-[0_10px_18px_-12px_rgba(0,0,0,0.6)]' : 'h-10 w-10'
            )}>
              {isExpanded ? (
                <CaretUp className={cn(isCompactView ? 'h-4 w-4' : 'h-5 w-5')} aria-hidden="true" />
              ) : (
                <CaretDown className={cn(isCompactView ? 'h-4 w-4' : 'h-5 w-5')} aria-hidden="true" />
              )}
            </span>

            <div className="min-w-0 flex-1">
              {isCompactView ? (
                <>
                  <h3 className="min-w-0 text-[13px] sm:text-[14px] font-semibold text-[color:var(--brand-primary)] truncate">
                    {entry.spread || entry.spreadName || 'Reading'}
                  </h3>
                  {timestampLabel && (
                    <p className="mt-1 text-[11px] text-[color:var(--text-muted)] truncate">
                      {timestampLabel}
                    </p>
                  )}
                </>
              ) : (
                <>
                  {/* Meta row */}
                  <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-[color:var(--text-muted)]">
                    {timestampLabel && (
                      <span
                        className="inline-flex items-center rounded-full border border-[color:var(--border-warm-light)] bg-[color:var(--border-warm-subtle)] px-2 py-0.5 normal-case tracking-normal"
                        title={timestampTitle}
                      >
                        {timestampLabel}
                      </span>
                    )}
                    {deckLabel && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-warm-subtle)] px-2 py-0.5">
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
                </>
              )}
            </div>
          </div>

          {!isCompactView && (
            <>
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
                    const name = card.name || 'Card';
                    const reversed = REVERSED_PATTERN.test(card?.orientation || '') || card?.isReversed;
                    return (
                      <span
                        key={`${card.name || 'card'}-${idx}`}
                        className={cn(styles.cardChip, 'flex-nowrap')}
                      >
                        <JournalCardIcon className="h-3 w-3 text-[color:var(--text-muted)]" aria-hidden="true" />
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
            </>
          )}

        </button>

        {/* Action buttons */}
        <div className={cn('relative flex-shrink-0 self-start', !isCompactView && 'pt-1')}>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShare}
              disabled={pendingAction === 'share'}
              title={shareActionLabel}
              className={cn(
                isCompactView ? styles.iconButtonCompact : styles.iconButton,
                pendingAction === 'share' && 'cursor-wait opacity-60'
              )}
            >
              <JournalShareIcon className="h-5 w-5" aria-hidden="true" />
              <span className="sr-only">{shareActionLabel}</span>
            </button>

            <button
              type="button"
              ref={actionMenuButtonRef}
              onClick={(event) => {
                event.stopPropagation();
                toggleMenu();
              }}
              className={cn(isCompactView ? styles.iconButtonCompact : styles.iconButton)}
              aria-haspopup="menu"
              aria-controls={actionMenuId}
              aria-expanded={actionMenu.isOpen}
              title="Entry actions"
            >
              <DotsThreeVertical className="h-5 w-5" aria-hidden="true" />
              <span className="sr-only">Open entry actions</span>
            </button>
          </div>

          {renderActionMenu()}
        </div>
      </div>
    </div>
  );
});
