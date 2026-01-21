/**
 * JournalEntryCard.jsx (Decomposed)
 * 
 * Main orchestrator for journal entry card display.
 * Composes headers, sections, and action components.
 * 
 * This is a redesigned version of the original 1345-line component,
 * now decomposed into ~150 lines using extracted hooks and sub-components.
 */
import { memo, useEffect, useId, useRef, useState } from 'react';
import { useSmallScreen } from '../../../hooks/useSmallScreen';
import { InlineStatus } from '../../InlineStatus.jsx';
import { useInlineStatus } from '../../../hooks/useInlineStatus';
import { useSubscription } from '../../../contexts/SubscriptionContext';
import { AMBER_CARD_CLASS, AMBER_CARD_MOBILE_CLASS } from '../../../lib/journal/constants';

// Hooks
import { useEntryMetadata, useActionMenu, useEntryActions } from './hooks';

// Components
import { CompactHeader, ComfortableHeader } from './EntryHeader';
import { ActionMenu } from './EntryActions';
import {
  QuestionSection,
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
  compact = false,
  cardClass
}) {
  // Initialize expanded state - never expand if compact mode is on
  const [isExpanded, setIsExpanded] = useState(() => defaultExpanded && !compact);
  
  // Hooks
  const isSmallScreen = useSmallScreen(640);
  const { effectiveTier } = useSubscription();
  const { status: inlineStatus, showStatus, clearStatus } = useInlineStatus();
  const actionMenu = useActionMenu();
  
  const metadata = useEntryMetadata(entry, { effectiveTier, isSmallScreen });
  const {
    cards,
    insights,
    reflections,
    narrativeText,
    followUps,
    followUpPreview,
    hasReflections,
    hasHiddenFollowUps,
    followUpLimit,
    followUpTurnsUsed,
    accentColor
  } = metadata;

  const canAskFollowUp = isAuthenticated && followUpTurnsUsed < followUpLimit;

  const actions = useEntryActions(entry, {
    onDelete,
    onCreateShareLink,
    onDeleteShareLink,
    isAuthenticated,
    showStatus,
    clearStatus,
    canAskFollowUp,
    followUpLimit,
    followUps
  });

  // IDs for accessibility
  const entryContentId = useId();
  const narrativeId = useId();
  const cardsId = useId();
  const actionMenuId = `${entry.id || entry.ts || 'entry'}-actions-menu`;

  const wasExpandedRef = useRef(isExpanded);

  // Close the menu when a user collapses an expanded card.
  useEffect(() => {
    if (wasExpandedRef.current && !isExpanded) {
      actionMenu.close();
    }
    wasExpandedRef.current = isExpanded;
  }, [isExpanded, actionMenu]);

  // Handle toggle with compact mode awareness
  const handleToggle = () => {
    if (!compact) {
      setIsExpanded((prev) => !prev);
    }
  };

  // Determine styling
  const useCompactStyle = compact && !isExpanded;
  const baseCardClass = cardClass || (isSmallScreen ? AMBER_CARD_MOBILE_CLASS : AMBER_CARD_CLASS);
  
  const fullCardClass = useCompactStyle
    ? cn(styles.cardCompact, 'group relative overflow-hidden animate-fade-in text-[color:var(--text-main)]')
    : cn(baseCardClass, styles.cardBase, styles.cardHover, 'text-[color:var(--text-main)]');

  const accentBarClass = useCompactStyle
    ? cn(styles.accentBar, styles.accentBarCompact)
    : cn(styles.accentBar, styles.accentBarDefault);

  const contentPadding = compact ? 'px-4 py-4 sm:p-5' : 'px-4 py-4 sm:p-5';

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
    compact
  };

  // Select header variant
  const HeaderComponent = useCompactStyle ? CompactHeader : ComfortableHeader;

  return (
    <article className={cn(fullCardClass, actionMenu.isOpen ? 'z-50' : 'z-0')}>
      {/* Accent bar */}
      <span
        aria-hidden="true"
        className={accentBarClass}
        style={{ backgroundColor: accentColor }}
      />

      {/* Header */}
      <HeaderComponent {...headerProps} isExpanded={isExpanded} />

      {/* Collapsible content */}
      {isExpanded && (
        <div id={entryContentId} className={cn('relative z-10 animate-slide-down', contentPadding)}>
          <QuestionSection question={entry.question} />

          <CardsDrawnSection
            cards={cards}
            cardsId={cardsId}
            isSmallScreen={isSmallScreen}
            hasQuestion={Boolean(entry.question)}
          />

          {hasReflections && <ReflectionsSection reflections={reflections} />}

          {insights.length > 0 && <KeyThemesSection insights={insights} />}

          {entry.themes?.knowledgeGraph?.graphKeys && (
            <KnowledgeGraphSection
              cards={cards}
              graphKeys={entry.themes.knowledgeGraph.graphKeys}
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

          <NarrativeSection narrativeText={narrativeText} narrativeId={narrativeId} />
        </div>
      )}

      {/* Inline status */}
      {(inlineStatus.message || !useCompactStyle) && (
        <div className={useCompactStyle ? 'px-3 pb-2' : 'px-4 pb-3 pt-2'} aria-live="polite">
          <InlineStatus tone={inlineStatus.tone} message={inlineStatus.message} />
        </div>
      )}
    </article>
  );
});
