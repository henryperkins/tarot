/**
 * JournalEntryCard.jsx (Decomposed)
 * 
 * Main orchestrator for journal entry card display.
 * Composes headers, sections, and action components.
 * 
 * This is a redesigned version of the original 1345-line component,
 * now decomposed into ~150 lines using extracted hooks and sub-components.
 */
import { memo, useCallback, useEffect, useId, useRef, useState } from 'react';
import { readingGesturesEnabled } from '../../../lib/readingGestureSettings';
import { useSmallScreen, SMALL_SCREEN_MAX } from '../../../hooks/useSmallScreen';
import { InlineStatus } from '../../InlineStatus.jsx';
import { useInlineStatus } from '../../../hooks/useInlineStatus';
import { useSubscription } from '../../../contexts/SubscriptionContext';
import { AMBER_CARD_CLASS, AMBER_CARD_MOBILE_CLASS } from '../../../lib/journal/constants';

// Hooks
import { useEntryMetadata, useActionMenu, useEntryActions } from './hooks';

// Components
import { ComfortableHeader } from './EntryHeader';
import { ActionMenu, ShareLinkComposer } from './EntryActions';
import {
  CardsDrawnSection,
  ReflectionsSection,
  KeyThemesSection,
  FollowUpSection,
  NarrativeSection,
  KnowledgeGraphSection
} from './EntrySections';

// Primitives
import { styles, cn } from './EntryCard.primitives';

export const JournalEntryCard = memo(function JournalEntryCard({
  entry,
  onCreateShareLink,
  isAuthenticated,
  shareLinks = [],
  shareLoading = false,
  shareError = '',
  onDelete,
  onDeleteShareLink,
  defaultExpanded = false,
  openRequestKey = null,
  compact = false,
  cardClass,
  gestureStudyEnabled = readingGesturesEnabled(),
  onRetryVisuals = null,
  onSaveReflection = null
}) {
  // Initialize expanded state - never expand if compact mode is on
  const [isExpanded, setIsExpanded] = useState(() => Boolean(openRequestKey) || (defaultExpanded && !compact));
  const [handledOpenRequest, setHandledOpenRequest] = useState(openRequestKey);
  if (openRequestKey && openRequestKey !== handledOpenRequest) {
    setHandledOpenRequest(openRequestKey);
    setIsExpanded(true);
  }
  
  // Hooks
  const isSmallScreen = useSmallScreen(SMALL_SCREEN_MAX);
  const { effectiveTier } = useSubscription();
  const { status: inlineStatus, showStatus, clearStatus } = useInlineStatus();
  const actionMenu = useActionMenu();
  
  const metadata = useEntryMetadata(entry, { effectiveTier, isSmallScreen });
  const {
    cards,
    insights,
    narrativeText,
    followUps,
    followUpPreview,
    hasReflections,
    hasHiddenFollowUps,
    followUpLimit,
    followUpTurnsUsed
  } = metadata;

  const canAskFollowUp = isAuthenticated && followUpTurnsUsed < followUpLimit;
  const hasCards = cards.length > 0;
  const hasNarrative = Boolean(narrativeText);

  const actions = useEntryActions(entry, {
    onDelete,
    onCreateShareLink,
    onDeleteShareLink,
    shareLinks,
    isAuthenticated,
    showStatus,
    clearStatus,
    canAskFollowUp,
    followUpLimit,
    followUps
  });

  // IDs for accessibility
  const entryIdPrefix = useId();
  const entryContentId = `${entryIdPrefix}-content`;
  const entryHeadingId = `${entryIdPrefix}-heading`;
  const narrativeId = `${entryIdPrefix}-narrative`;
  const cardsId = `${entryIdPrefix}-cards`;
  const actionMenuId = `${entryIdPrefix}-actions-menu`;

  const shareComposerId = `${entryIdPrefix}-share`;
  const shareButtonRef = useRef(null);
  const [shareComposerOpen, setShareComposerOpen] = useState(false);
  const [shareFocusReturn, setShareFocusReturn] = useState(0);

  const wasExpandedRef = useRef(isExpanded);
  // Explicit saved-visual retry for this entry only (the journal hook's action).
  const retryVisuals = useCallback(() => onRetryVisuals(entry.id), [onRetryVisuals, entry.id]);
  const saveReflection = useCallback(
    (edit) => onSaveReflection(entry.id, edit),
    [onSaveReflection, entry.id]
  );

  // Close the menu, the share composer and any action status when a user
  // collapses an expanded card: they belong to the open reading.
  useEffect(() => {
    if (wasExpandedRef.current && !isExpanded) {
      actionMenu.close();
      setShareComposerOpen(false);
      clearStatus();
    }
    wasExpandedRef.current = isExpanded;
  }, [isExpanded, actionMenu, clearStatus]);

  // Closing the composer returns focus to the share button that opened it.
  useEffect(() => {
    if (shareFocusReturn) shareButtonRef.current?.focus();
  }, [shareFocusReturn]);

  const closeShareComposer = useCallback(() => {
    setShareComposerOpen(false);
    setShareFocusReturn((count) => count + 1);
  }, []);

  const { getShareMode, handleShare, handleCreateShareLink } = actions;
  const handleShareClick = useCallback(() => {
    if (getShareMode() === 'compose') {
      if (shareComposerOpen) closeShareComposer();
      else setShareComposerOpen(true);
      return;
    }
    handleShare();
  }, [getShareMode, handleShare, shareComposerOpen, closeShareComposer]);

  // Cancelling also clears a failed attempt's error: the reader has moved on.
  const handleCancelShare = useCallback(() => {
    clearStatus();
    closeShareComposer();
  }, [clearStatus, closeShareComposer]);

  const handleComposeShare = useCallback(async (expiresInHours) => {
    const result = await handleCreateShareLink(expiresInHours);
    // A failed request keeps the composer open to try again; its status explains.
    if (result?.created) closeShareComposer();
  }, [handleCreateShareLink, closeShareComposer]);

  // Handle toggle - compact cards expand to comfortable view
  const handleToggle = () => {
    setIsExpanded((prev) => !prev);
  };

  // Determine styling
  const useCompactStyle = compact && !isExpanded;
  const baseCardClass = cardClass || (isSmallScreen ? AMBER_CARD_MOBILE_CLASS : AMBER_CARD_CLASS);

  const fullCardClass = useCompactStyle
    ? cn(styles.cardCompact, 'animate-fade-in')
    : cn(
        baseCardClass,
        styles.cardBase,
        isExpanded ? 'border-(--border-warm)' : styles.cardHover,
        compact && isExpanded && 'my-2'
      );

  const contentPadding = 'px-[min(1rem,4vw)] py-4 sm:p-5';

  // Render action menu (shared by both headers)
  const renderActionMenu = () => (
    <ActionMenu
      isOpen={actionMenu.isOpen}
      menuRef={actionMenu.menuRef}
      menuId={actionMenuId}
      placement={actionMenu.placement}
      canUseDom={actionMenu.canUseDom}
      pendingAction={actions.pendingAction}
      onClose={actionMenu.close}
      actions={{
        ...actions,
        isAuthenticated,
        onCreateShareLink,
        onDelete
      }}
      shareLinksProps={{
        shareLinks,
        shareLoading,
        shareError,
        entryId: entry.id,
        onCopyShareLink: actions.handleCopyShareLink,
        onDeleteShareLink: actions.handleDeleteShareLink
      }}
    />
  );

  // Header props shared by both variants
  const headerProps = {
    entry,
    entryContentId,
    entryHeadingId,
    onToggle: handleToggle,
    metadata,
    actionMenu,
    actions: {
      ...actions,
      isAuthenticated,
      onCreateShareLink
    },
    actionMenuId,
    renderActionMenu,
    compact,
    isSmallScreen,
    shareComposerOpen,
    shareComposerId,
    onShareClick: handleShareClick,
    shareButtonRef
  };

  return (
    <article tabIndex={-1} aria-labelledby={entryHeadingId} className={cn(fullCardClass, actionMenu.isOpen ? 'z-50' : 'z-0')}>
      {/* Header */}
      <ComfortableHeader {...headerProps} isExpanded={isExpanded} />

      {/* Inline status sits under the header, beside the actions that report to it,
          so it shows even when a long open reading runs past the screen. The live
          region stays mounted, but takes no space until it speaks. */}
      {(inlineStatus.message || !useCompactStyle) && (
        <div className={inlineStatus.message ? (useCompactStyle ? 'relative z-10 px-3 pb-2' : 'relative z-10 px-[min(1rem,4vw)] pb-1 pt-3 sm:px-5') : undefined} aria-live="polite">
          <InlineStatus tone={inlineStatus.tone} message={inlineStatus.message} />
        </div>
      )}

      {isExpanded && shareComposerOpen && (
        <ShareLinkComposer
          id={shareComposerId}
          pending={actions.pendingAction === 'share'}
          onCreate={handleComposeShare}
          onCancel={handleCancelShare}
        />
      )}

      {/* Collapsible content. The header's title already carries the question. */}
      {isExpanded && (
        <div id={entryContentId} className={cn('relative z-10 animate-slide-down', contentPadding)}>
          {hasCards && (
            <CardsDrawnSection
              cards={cards}
              cardsId={cardsId}
              isSmallScreen={isSmallScreen}
              collapsible
              defaultExpanded={!isSmallScreen && defaultExpanded}
            />
          )}

          {hasNarrative && (
            <NarrativeSection
              key={handledOpenRequest || 'default'}
              narrativeText={narrativeText}
              narrativeId={narrativeId}
              collapsible
              defaultExpanded={Boolean(handledOpenRequest) || !isSmallScreen}
              entry={entry}
              gestureStudyEnabled={gestureStudyEnabled}
              onRetryVisuals={onRetryVisuals ? retryVisuals : null}
            />
          )}

          {(hasReflections || onSaveReflection) && (
            <ReflectionsSection
              reflections={entry.reflections}
              cards={cards}
              onSave={onSaveReflection ? saveReflection : null}
            />
          )}

          {insights.length > 0 && <KeyThemesSection insights={insights} />}

          {entry.themes?.knowledgeGraph?.graphKeys && (
            <KnowledgeGraphSection
              cards={cards}
              graphKeys={entry.themes.knowledgeGraph.graphKeys}
              deckStyle={entry.deckId}
            />
          )}

          <FollowUpSection
            followUps={followUps}
            followUpPreview={followUpPreview}
            hasHiddenFollowUps={hasHiddenFollowUps}
            followUpLimit={followUpLimit}
            followUpTurnsUsed={followUpTurnsUsed}
            canAskFollowUp={canAskFollowUp}
            isAuthenticated={isAuthenticated}
            effectiveTier={effectiveTier}
            onOpenFollowUp={actions.handleOpenFollowUp}
          />
        </div>
      )}
    </article>
  );
});
