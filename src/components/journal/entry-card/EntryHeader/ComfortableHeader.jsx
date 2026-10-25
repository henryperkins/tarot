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
  entryHeadingId,
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
    timestampIso,
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

  const questionTitle = typeof entry.question === 'string' ? entry.question.trim() : '';
  const spreadTitle = entry.spread || entry.spreadName || 'Tarot Reading';
  const actionContext = questionTitle || spreadTitle;
  const timestamp = timestampIso
    ? <time dateTime={timestampIso} title={relativeTimeLabel || undefined}>{formattedTimestamp}</time>
    : formattedTimestamp;

  const headerPadding = isCompactView
    ? 'px-[min(0.875rem,4vw)] py-3 sm:px-4 sm:py-3.5'
    : 'px-[min(1rem,4vw)] py-4 sm:px-5 sm:py-5';

  return (
    <div className={cn(
      'relative z-10',
      headerPadding,
      isExpanded && 'border-b border-(--border-warm-subtle)'
    )}>
      <div className="flex flex-wrap items-start gap-3">
        {/* Main clickable area */}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isExpanded}
          aria-controls={entryContentId}
          data-journal-entry-toggle
          title={isExpanded ? 'Collapse entry' : 'Expand entry'}
          className={cn(
            'group flex min-w-0 flex-[1_1_14rem] rounded-2xl px-1 py-1 text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-(--focus-ring-color)',
            isCompactView ? 'flex-row items-start gap-3' : 'flex-col gap-3'
          )}
        >
          <div className="flex w-full min-w-0 flex-wrap items-center gap-3">
            {/* Expand/collapse icon */}
            <span className={cn(
              'mt-0.5 flex shrink-0 items-center justify-center rounded-2xl border border-(--border-warm-light) bg-(--panel-dark-2) text-(--text-muted) shadow-[0_14px_28px_-18px_rgba(0,0,0,0.7)] transition group-hover:border-(--border-warm)',
              isCompactView ? 'h-8 w-8 rounded-xl shadow-[0_10px_18px_-12px_rgba(0,0,0,0.6)]' : 'h-10 w-10'
            )}>
              {isExpanded ? (
                <CaretUp className={cn(isCompactView ? 'h-4 w-4' : 'h-5 w-5')} aria-hidden="true" />
              ) : (
                <CaretDown className={cn(isCompactView ? 'h-4 w-4' : 'h-5 w-5')} aria-hidden="true" />
              )}
            </span>

            <div className="min-w-0 flex-[1_1_10rem]">
              {isCompactView ? (
                <>
                  <h3 id={entryHeadingId} className="min-w-0 wrap-break-word text-sm font-semibold text-accent">
                    {questionTitle || spreadTitle}
                  </h3>
                  {questionTitle && <p className="mt-1 text-sm text-muted wrap-anywhere">{spreadTitle}</p>}
                  {formattedTimestamp && (
                    <p className="mt-1 wrap-break-word text-2xs text-muted">
                      {timestamp}
                    </p>
                  )}
                </>
              ) : (
                <>
                  {/* Meta row */}
                  <div className="flex flex-wrap items-center gap-2 text-2xs uppercase tracking-label-wide text-(--text-muted)">
                    {formattedTimestamp && (
                      <span
                        className="inline-flex items-center rounded-full border border-(--border-warm-light) bg-(--border-warm-subtle) px-2 py-0.5 normal-case tracking-normal"
                      >
                        {timestamp}
                      </span>
                    )}
                    {deckLabel && (
                      <span className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-full border border-(--border-warm-subtle) px-2 py-0.5">
                        Deck
                        <span className="min-w-0 wrap-break-word normal-case text-(--text-main)">
                          {deckLabel}
                        </span>
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 id={entryHeadingId} className="mt-1 min-w-0 wrap-break-word font-serif text-lg sm:text-xl text-(--brand-primary) tracking-[0.04em] leading-normal">
                    {questionTitle || spreadTitle}
                  </h3>
                  {questionTitle && <p className="mt-1 text-sm text-muted wrap-anywhere">{spreadTitle}</p>}
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
                    {cards.length} {cards.length === 1 ? 'card' : 'cards'}
                  </span>
                )}
                {hasReflections && (
                  <span className={cn(styles.pill, 'whitespace-nowrap')}>
                    <JournalCommentAddIcon className="h-3 w-3 text-(--brand-primary)" aria-hidden="true" />
                    {reflections.length}
                  </span>
                )}
              </div>

              {/* Card preview chips */}
              {cardPreview.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-2xs text-(--text-muted)">
                  {cardPreview.map((card, idx) => {
                    const name = card.displayName || card.name || 'Card';
                    const reversed = REVERSED_PATTERN.test(card?.orientation || '') || card?.isReversed;
                    return (
                      <span
                        key={`${card.name || 'card'}-${idx}`}
                        className={cn(styles.cardChip, 'min-w-0 flex-wrap')}
                      >
                        <JournalCardIcon className="h-3 w-3 shrink-0 text-(--text-muted)" aria-hidden="true" />
                        <span className="min-w-0 flex-auto wrap-break-word text-2xs text-(--text-main)">
                          {name}
                        </span>
                        {reversed && (
                          <span className={styles.reversedBadge}>Rev</span>
                        )}
                      </span>
                    );
                  })}
                  {cards.length > cardPreview.length && (
                    <span className="text-2xs text-(--text-muted)">
                      +{cards.length - cardPreview.length} more
                    </span>
                  )}
                </div>
              )}
            </>
          )}

        </button>

        {/* Action buttons */}
        <div className={cn('relative max-w-full self-start', !isCompactView && 'pt-1')}>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleShare}
              disabled={pendingAction === 'share'}
              title={shareActionLabel}
              aria-label={`${shareActionLabel} for ${actionContext}`}
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
              aria-label={`Open entry actions for ${actionContext}`}
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
