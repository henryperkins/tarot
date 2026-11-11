/**
 * ComfortableHeader.jsx
 * Renders the saved-entry header across three distinct states:
 * - Collapsed Comfortable: editorial reading card with the reading's own deck
 *   artwork (beside the entry on wide screens, beside the summary under a
 *   full-width question on phones), full serif question, metadata byline,
 *   personal reflection or reading preview, and drawn card chips.
 * - Collapsed Compact: quiet hairlined ledger row with the full question and a
 *   right-aligned timestamp column over one concise metadata line.
 * - Expanded: full question, spread and timestamp header with share and menu actions.
 *
 * The title's button stretches over the whole header so the collapsed row is one
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
    const name = card?.displayName || card?.name || 'Card';
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
  const compactDateId = useId();
  const excerptId = useId();
  const cardsSummaryId = useId();

  const {
    cards,
    cardPreview,
    entryExcerpt,
    formattedTimestamp,
    timestampIso,
    relativeTimeLabel,
    deckLabel,
    showsDeckLabel,
    spreadShortName,
    reflections,
    contextLabel,
    accentColor
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

  const noteCount = reflections?.length || 0;
  const extraCards = cards.length - cardPreview.length;

  const contextToken = contextLabel ? (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: accentColor }}
      />
      <span>{contextLabel}</span>
    </span>
  ) : null;

  const comfortableMetaParts = [
    questionTitle && spreadShortName
      ? { key: 'spread', node: <span className="font-medium text-(--text-muted-high)">{spreadShortName}</span> }
      : null,
    formattedTimestamp
      ? { key: 'time', node: <span className="font-medium tabular-nums text-(--text-muted-high)">{fullTimestamp}</span> }
      : null,
    contextToken ? { key: 'context', node: contextToken } : null,
    showsDeckLabel ? { key: 'deck', node: deckLabel } : null,
    noteCount > 0 ? { key: 'notes', node: `${noteCount} ${noteCount === 1 ? 'note' : 'notes'}` } : null
  ].filter(Boolean);

  // On wide screens the timestamp sits in its own right-aligned ledger column;
  // on phones it joins the single supporting metadata line underneath.
  const showInlineCompactDate = !isSmallScreen && Boolean(formattedTimestamp);
  const compactMetaParts = [
    contextToken ? { key: 'context', node: <span className="font-medium text-(--text-muted-high)">{contextToken}</span> } : null,
    questionTitle && spreadShortName ? { key: 'spread', node: spreadShortName } : null,
    showsDeckLabel ? { key: 'deck', node: deckLabel } : null,
    cards.length > 0
      ? { key: 'cards', node: <span className="tabular-nums text-(--text-muted)">{cards.length} {cards.length === 1 ? 'card' : 'cards'}</span> }
      : null,
    noteCount > 0
      ? { key: 'notes', node: <span className="tabular-nums text-(--text-muted)">{noteCount} {noteCount === 1 ? 'note' : 'notes'}</span> }
      : null,
    isSmallScreen && formattedTimestamp
      ? { key: 'time', node: <span className="tabular-nums text-(--text-muted)">{fullTimestamp}</span> }
      : null
  ].filter(Boolean);

  const collapsedDescribedBy = isExpanded
    ? undefined
    : isCompactView
      ? [
          showInlineCompactDate ? compactDateId : null,
          compactMetaParts.length > 0 ? sublineId : null,
          cardsSummaryId
        ].filter(Boolean).join(' ')
      : [
          comfortableMetaParts.length > 0 ? sublineId : null,
          entryExcerpt ? excerptId : null,
          cardsSummaryId
        ].filter(Boolean).join(' ');

  const Caret = isExpanded ? CaretUp : CaretDown;

  // Keep the title's keyed ancestors and nesting the same in all three layouts.
  // React can then retain the focused toggle when an entry expands or collapses.

  // Compact collapsed row: flat hairlined ledger item.
  if (isCompactView) {
    return (
      <div className="relative z-10 min-h-touch px-2 py-2.5 sm:px-3">
        <div className="flex items-start gap-3">
          <div key="title-content" className="min-w-0 flex-1">
            <div key="title-row" className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
              {/* Source Serif keeps normal leading so glyphs never clip at 200% text. */}
              <h3
                id={entryHeadingId}
                className="min-w-0 flex-[999_1_20rem] wrap-break-word text-balance font-serif text-base font-semibold leading-normal text-(--text-main)"
              >
                <button
                  type="button"
                  onClick={onToggle}
                  aria-expanded={false}
                  aria-controls={entryContentId}
                  aria-describedby={collapsedDescribedBy}
                  data-journal-entry-toggle
                  title="Expand entry"
                  className="block w-full min-w-0 text-left focus-visible:outline-hidden after:absolute after:inset-0.5 after:rounded-lg after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-(--focus-ring-color)"
                >
                  {questionTitle || spreadTitle}
                </button>
              </h3>

              {showInlineCompactDate && (
                <span id={compactDateId} className="shrink-0 text-xs tabular-nums text-(--text-muted)">
                  {fullTimestamp}
                </span>
              )}
            </div>

            {compactMetaParts.length > 0 && (
              <p
                id={sublineId}
                className="mt-0.5 text-xs leading-normal text-(--text-muted-high) wrap-anywhere"
              >
                {compactMetaParts.map((item, index) => (
                  <Fragment key={item.key}>
                    {index > 0 && <span aria-hidden="true" className="text-(--text-muted)"> · </span>}
                    {index > 0 && <span className="sr-only">, </span>}
                    {item.node}
                  </Fragment>
                ))}
              </p>
            )}
            <span id={cardsSummaryId} className="sr-only">{describeCards(cards)}</span>
          </div>

          <Caret className="mt-1 h-4 w-4 shrink-0 text-(--text-muted)" aria-hidden="true" />
        </div>
      </div>
    );
  }

  // Expanded reading header: keeps share and menu actions beside/under the title.
  if (isExpanded) {
    return (
      <div className="relative z-10 border-b border-(--border-warm-subtle) px-[min(1rem,4vw)] py-4 sm:px-5 sm:py-5">
        <div className="flex flex-wrap items-start gap-3.5 sm:gap-4">
          <div key="title-content" className="min-w-0 flex-[1_1_14rem]">
            {/* rounded-xl reads as a pill on one line and stays a soft box when large text wraps it. */}
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

            <div key="title-row">
              <h3
                id={entryHeadingId}
                className="min-w-0 wrap-break-word text-balance font-serif text-lg font-semibold leading-normal text-(--text-main)"
              >
                <button
                  type="button"
                  onClick={onToggle}
                  aria-expanded={true}
                  aria-controls={entryContentId}
                  data-journal-entry-toggle
                  title="Collapse entry"
                  className="block w-full min-w-0 text-left focus-visible:outline-hidden after:absolute after:inset-1 after:rounded-xl after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-(--focus-ring-color)"
                >
                  {questionTitle || spreadTitle}
                </button>
              </h3>
            </div>

            {questionTitle && (
              <p className="mt-1 text-sm text-(--text-muted) text-pretty wrap-anywhere">{spreadTitle}</p>
            )}
          </div>

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

          <Caret className="mt-1 h-5 w-5 shrink-0 text-(--text-muted)" aria-hidden="true" />
        </div>
      </div>
    );
  }

  // Collapsed Comfortable card: full-width editorial rhythm on phones so artwork
  // sits beside the summary without squeezing the title; left artwork column on >=640px.
  const showMobileArt = isSmallScreen && cards.length > 0;
  const showDesktopArt = !isSmallScreen && cards.length > 0;

  const comfortableDetails = (
    <>
      {comfortableMetaParts.length > 0 && (
        <p
          id={sublineId}
          className="text-xs-plus leading-normal text-(--text-muted) wrap-anywhere"
        >
          {comfortableMetaParts.map((item, index) => (
            <Fragment key={item.key}>
              {index > 0 && <span aria-hidden="true"> · </span>}
              {index > 0 && <span className="sr-only">, </span>}
              {item.node}
            </Fragment>
          ))}
        </p>
      )}
      {entryExcerpt && (
        entryExcerpt.kind === 'reflection' ? (
          <p
            id={excerptId}
            className="mt-2 border-l border-(--border-warm) pl-2.5 text-sm leading-relaxed text-(--text-muted-high) line-clamp-2 wrap-anywhere"
          >
            <span className="font-medium text-(--text-main)">Note: </span>
            {entryExcerpt.text}
          </p>
        ) : (
          <p
            id={excerptId}
            className="mt-2 text-sm leading-relaxed text-(--text-muted) line-clamp-2 wrap-anywhere"
          >
            {entryExcerpt.text}
          </p>
        )
      )}
    </>
  );

  return (
    <div className="relative z-10 px-[min(1rem,4vw)] py-4 sm:px-5 sm:py-5">
      <div className="flex items-start gap-3.5 sm:gap-4">
        {showDesktopArt && (
          <EntryArtStrip cards={cards} cardWidth={44} fixedColumn className="mt-0.5" />
        )}

        <div key="title-content" className="min-w-0 flex-1">
          {/* Pairing the chevron with the heading frees the full card width underneath on phones. */}
          <div key="title-row" className="flex items-start justify-between gap-3">
            <h3
              id={entryHeadingId}
              className="min-w-0 flex-1 wrap-break-word text-balance font-serif text-lg font-semibold leading-normal text-(--text-main)"
            >
              <button
                type="button"
                onClick={onToggle}
                aria-expanded={false}
                aria-controls={entryContentId}
                aria-describedby={collapsedDescribedBy}
                data-journal-entry-toggle
                title="Expand entry"
                className="block w-full min-w-0 text-left focus-visible:outline-hidden after:absolute after:inset-1 after:rounded-xl after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-(--focus-ring-color)"
              >
                {questionTitle || spreadTitle}
              </button>
            </h3>
            <Caret className="mt-1 h-5 w-5 shrink-0 text-(--text-muted)" aria-hidden="true" />
          </div>

          {showMobileArt ? (
            <div className="mt-2.5 flex flex-wrap items-start gap-3">
              <EntryArtStrip cards={cards} cardWidth={36} className="mt-0.5" />
              <div className="min-w-0 flex-[999_1_9.5rem]">
                {comfortableDetails}
              </div>
            </div>
          ) : (
            <div className="mt-1.5">
              {comfortableDetails}
            </div>
          )}

          {cardPreview.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {cardPreview.map((card, index) => {
                const reversed = REVERSED_PATTERN.test(card?.orientation || '') || card?.isReversed;
                return (
                  <span
                    key={`${card?.canonicalName || card?.name || 'card'}-${index}`}
                    className="inline-flex max-w-full flex-wrap items-baseline rounded-md border border-(--border-warm-subtle) bg-(--border-warm-subtle) px-2 py-0.5 text-xs leading-normal text-(--text-muted)"
                  >
                    <span className="min-w-0 font-medium text-(--text-main) wrap-anywhere">
                      {card?.displayName || card?.name || 'Card'}
                    </span>
                    {reversed && <span>, reversed</span>}
                  </span>
                );
              })}
              {extraCards > 0 && (
                <span className="px-1 text-xs font-medium tabular-nums text-(--text-muted)">
                  +{extraCards} more
                </span>
              )}
            </div>
          )}
          <span id={cardsSummaryId} className="sr-only">{describeCards(cards)}</span>
        </div>
      </div>
    </div>
  );
});
