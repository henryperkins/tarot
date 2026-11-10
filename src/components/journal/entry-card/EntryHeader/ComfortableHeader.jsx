/**
 * ComfortableHeader.jsx
 * The entry header. Collapsed, it is one quiet row a reader can scan: the
 * reading's own cards, its question, then spread and date. Open, it names the
 * full spread and time and carries the entry's share and menu actions.
 *
 * The title's button stretches over the whole header, so the row is one
 * target; the open header's actions sit above that layer.
 */
import { Fragment, memo, useId } from 'react';
import { CaretUp, CaretDown, DotsThreeVertical } from '@phosphor-icons/react';
import { JournalShareIcon } from '../../../JournalIcons';
import { REVERSED_PATTERN } from '../../../../lib/journalInsights';
import { EntryArtStrip } from './EntryArtStrip';
import { styles, cn } from '../EntryCard.primitives';

function describeCards(cards) {
  if (!Array.isArray(cards) || cards.length === 0) return '';
  const names = cards.map((card) => {
    const name = card?.name || 'Card';
    const reversed = REVERSED_PATTERN.test(card?.orientation || '') || card?.isReversed;
    return reversed ? `${name}, reversed` : name;
  });
  return `Cards: ${names.join('; ')}.`;
}

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
  compact = false,
  isSmallScreen = false,
  shareComposerOpen = false,
  shareComposerId,
  onShareClick,
  shareButtonRef
}) {
  const isCompactView = compact && !isExpanded;
  const sublineId = useId();
  const secondaryId = useId();
  const cardsSummaryId = useId();

  const {
    cards,
    cardPreview,
    formattedTimestamp,
    timestampIso,
    relativeTimeLabel,
    deckLabel,
    showsDeckLabel,
    spreadShortName,
    reflections,
    contextLabel
  } = metadata;

  const { pendingAction } = actions;
  const { toggle: toggleMenu, buttonRef: actionMenuButtonRef } = actionMenu;

  // A reading that already has a live link copies it rather than minting another;
  // a new link is created only after the share composer confirms it.
  const shareMode = actions.isAuthenticated && actions.onCreateShareLink
    ? (actions.reusableShareLink ? 'existing' : 'compose')
    : 'summary';
  const shareActionLabel = shareMode === 'existing'
    ? 'Copy share link'
    : shareMode === 'compose' ? 'Create share link' : 'Copy summary';

  const questionTitle = typeof entry.question === 'string' ? entry.question.trim() : '';
  const spreadTitle = entry.spread || entry.spreadName || 'Tarot Reading';
  const actionContext = questionTitle || spreadTitle;
  const fullTimestamp = timestampIso
    ? <time dateTime={timestampIso} title={relativeTimeLabel || undefined}>{formattedTimestamp}</time>
    : formattedTimestamp;

  // Collapsed: primary line is spread + exact date and time; secondary line
  // is context, a deck other than the default, and whether notes exist.
  // Tiers separate by size, colour and weight together: the primary line is
  // 14px at full strength, the secondary 12px medium one colour step down,
  // and the card names sit in the quietest colour with the names lifted out.
  // No line truncates: Compact wraps the primary and clamps the rest to two
  // lines, so every fact stays on the row at any width or text size.
  const noteCount = reflections?.length || 0;
  const primaryParts = [
    questionTitle ? spreadShortName : null,
    formattedTimestamp ? fullTimestamp : null
  ].filter(Boolean);
  const secondaryParts = [
    contextLabel,
    showsDeckLabel ? deckLabel : null,
    noteCount > 0 ? `${noteCount} ${noteCount === 1 ? 'note' : 'notes'}` : null
  ].filter(Boolean);
  const extraCards = cards.length - cardPreview.length;
  const collapsedDescribedBy = isExpanded
    ? undefined
    : [
        primaryParts.length > 0 ? sublineId : null,
        secondaryParts.length > 0 ? secondaryId : null,
        cardsSummaryId
      ]
        .filter(Boolean)
        .join(' ');

  const headerPadding = isCompactView
    ? 'px-[min(0.875rem,4vw)] py-3 sm:px-4 sm:py-3.5'
    : isExpanded
      ? 'px-[min(1rem,4vw)] py-4 sm:px-5 sm:py-5'
      : 'px-[min(1rem,4vw)] py-3.5 sm:px-5 sm:py-4';

  // The question carries the DESIGN Title role (serif semibold), so it reads
  // as the entry's heading below "Saved readings" (Headline). Compact keeps
  // the weight and steps the size down one notch instead.
  // Source Serif keeps normal leading: tighter clips its glyphs at large text sizes.
  const titleClass = isCompactView
    ? 'font-serif text-base font-semibold leading-normal'
    : 'font-serif text-lg font-semibold leading-normal';

  const Caret = isExpanded ? CaretUp : CaretDown;

  return (
    <div className={cn('relative z-10', headerPadding, isExpanded && 'border-b border-(--border-warm-subtle)')}>
      {/* Open, the title keeps at least 14rem beside the actions: on phones, and
          with enlarged text, the actions wrap under it instead of squeezing it. */}
      <div className={cn('flex items-start gap-3 sm:gap-4', isExpanded && 'flex-wrap')}>
        {/* The art stack is decorative (the lines below name the cards), so on
            phones it steps aside: the question keeps the full row width
            instead of wrapping in a column a third of the screen wide. The
            Compact list drops the art at every width for the same reason. */}
        {!isExpanded && !isCompactView && !isSmallScreen && (
          <EntryArtStrip cards={cards} cardWidth={34} className="mt-0.5" />
        )}

        <div className={cn('min-w-0', isExpanded ? 'flex-[1_1_14rem]' : 'flex-1')}>
          {isExpanded && (
            // rounded-xl reads as a pill on one line and stays a soft box when large text wraps it.
            <div className="mb-1 flex flex-wrap items-center gap-2 text-2xs uppercase tracking-label-wide text-(--text-muted)">
              {formattedTimestamp && (
                <span className="inline-flex items-center rounded-xl border border-(--border-warm-light) bg-(--border-warm-subtle) px-2 py-0.5 text-xs normal-case tracking-normal">
                  {fullTimestamp}
                </span>
              )}
              {deckLabel && (
                <span className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-xl border border-(--border-warm-subtle) px-2 py-0.5">
                  Deck
                  <span className="min-w-0 wrap-break-word text-xs normal-case tracking-normal text-(--text-main)">
                    {deckLabel}
                  </span>
                </span>
              )}
            </div>
          )}

          <h3 id={entryHeadingId} className={cn('min-w-0 wrap-break-word text-balance text-(--text-main)', titleClass)}>
            {/* Stretched over the whole header; the open header's actions sit above it. */}
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={isExpanded}
              aria-controls={entryContentId}
              aria-describedby={collapsedDescribedBy}
              data-journal-entry-toggle
              title={isExpanded ? 'Collapse entry' : 'Expand entry'}
              className="block w-full min-w-0 text-left focus-visible:outline-hidden after:absolute after:inset-1 after:rounded-[20px] after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-(--focus-ring-color)"
            >
              {questionTitle || spreadTitle}
            </button>
          </h3>

          {isExpanded ? (
            questionTitle && <p className="mt-1 text-sm text-(--text-muted) text-pretty wrap-anywhere">{spreadTitle}</p>
          ) : (
            <>
              {primaryParts.length > 0 && (
                <p
                  id={sublineId}
                  className={cn(
                    'mt-1 text-pretty',
                    isCompactView
                      ? 'text-sm font-medium text-(--text-muted-high) wrap-anywhere'
                      : 'text-sm text-(--text-muted-high) wrap-anywhere'
                  )}
                >
                  {primaryParts.map((part, index) => (
                    <Fragment key={index}>
                      {index > 0 && <span aria-hidden="true"> · </span>}
                      {index > 0 && <span className="sr-only">, </span>}
                      {part}
                    </Fragment>
                  ))}
                </p>
              )}
              {secondaryParts.length > 0 && (
                <p
                  id={secondaryId}
                  className={cn(
                    'font-medium leading-normal text-(--text-muted-high)',
                    isCompactView ? 'mt-0.5 line-clamp-2 text-xs' : 'mt-0.5 text-xs wrap-anywhere'
                  )}
                >
                  {secondaryParts.map((part, index) => (
                    <Fragment key={index}>
                      {index > 0 && <span aria-hidden="true"> · </span>}
                      {index > 0 && <span className="sr-only">, </span>}
                      {part}
                    </Fragment>
                  ))}
                </p>
              )}
              {cardPreview.length > 0 && (
                <p className={cn('text-xs leading-normal text-(--text-muted)', isCompactView ? 'mt-0.5 line-clamp-2' : 'mt-0.5 wrap-anywhere')}>
                  {cardPreview.map((card, index) => {
                    const reversed = REVERSED_PATTERN.test(card?.orientation || '') || card?.isReversed;
                    return (
                      <Fragment key={`${card?.canonicalName || card?.name || 'card'}-${index}`}>
                        {index > 0 && <span aria-hidden="true"> · </span>}
                        {index > 0 && <span className="sr-only">, </span>}
                        <span className="font-medium text-(--text-main)">{card?.displayName || card?.name || 'Card'}</span>
                        {reversed && <span>, reversed</span>}
                      </Fragment>
                    );
                  })}
                  {extraCards > 0 && (
                    <>
                      <span aria-hidden="true"> · </span>
                      <span className="sr-only">, </span>
                      <span className="font-medium tabular-nums">+{extraCards} more</span>
                    </>
                  )}
                </p>
              )}
              <span id={cardsSummaryId} className="sr-only">{describeCards(cards)}</span>
            </>
          )}
        </div>

        {isExpanded && (
          <div className="relative z-20 ml-auto flex shrink-0 flex-wrap items-center gap-2">
            <button
              ref={shareButtonRef}
              type="button"
              onClick={onShareClick}
              disabled={pendingAction === 'share'}
              title={shareActionLabel}
              aria-label={`${shareActionLabel} for ${actionContext}`}
              aria-expanded={shareMode === 'compose' ? shareComposerOpen : undefined}
              aria-controls={shareMode === 'compose' && shareComposerOpen ? shareComposerId : undefined}
              className={cn(styles.iconButton, pendingAction === 'share' && 'cursor-wait opacity-60')}
            >
              <JournalShareIcon className="h-5 w-5" aria-hidden="true" />
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
              aria-label={`Open entry actions for ${actionContext}`}
            >
              <DotsThreeVertical className="h-5 w-5" aria-hidden="true" />
            </button>

            {renderActionMenu()}
          </div>
        )}

        <Caret className={cn('shrink-0 text-(--text-muted)', isCompactView ? 'mt-0.5 h-4 w-4' : 'mt-1 h-5 w-5')} aria-hidden="true" />
      </div>
    </div>
  );
});
