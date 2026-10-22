import { ReadingCompletionActions } from './reading/complete/ReadingCompletionActions';
import { useMemo, useEffect, useRef } from 'react';
import { Gear, ArrowsClockwise } from '@phosphor-icons/react';
import { useLandscape } from '../hooks/useLandscape';
import { useKeyboardOffset } from '../hooks/useKeyboardOffset';
import { getReadingTableAction } from './readingBoardUtils';
import {
  MOBILE_SETTINGS_DIALOG_ID,
  MOBILE_FOLLOWUP_DIALOG_ID
} from './mobileActionBarConstants';

// Shared button styles - reduced height in landscape while maintaining touch target
const BTN_BASE = 'inline-flex items-center justify-center rounded-xl font-semibold transition touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-(--focus-ring-color)';
const BTN_PRIMARY = `${BTN_BASE} bg-accent text-surface shadow-lg hover:bg-primary`;
const BTN_SECONDARY = `${BTN_BASE} bg-surface-muted text-accent border border-accent/30 hover:bg-surface`;
const BTN_TERTIARY = `${BTN_BASE} bg-primary/20 text-main border border-primary/40 hover:bg-primary/30`;

/**
 * Determines which action mode the mobile bar should display
 */
function getActionMode({ isShuffling, reading, revealedCount: _revealedCount, allRevealed, needsNarrative, hasNarrative, isGenerating, isError }) {
  if (isShuffling) return 'shuffling';
  if (!reading) return 'preparation';
  if (!allRevealed) return 'revealing';
  if (needsNarrative && isGenerating) return 'generating';
  if (needsNarrative && isError) return 'error';
  if (needsNarrative) return 'ready-for-narrative';
  if (hasNarrative) return 'completed';
  return 'completed';
}

function ActionButton({
  onClick,
  disabled,
  variant = 'primary',
  children,
  ariaLabel,
  ariaControls,
  ariaExpanded,
  icon: Icon,
  className = '',
  readingTableAction = false,
  isLandscape = false
}) {
  const variantClass = {
    primary: BTN_PRIMARY,
    secondary: BTN_SECONDARY,
    tertiary: BTN_TERTIARY
  }[variant] || BTN_PRIMARY;

  const heightClass = variant === 'primary' && !isLandscape ? 'min-h-cta' : 'min-h-touch';
  const textSize = isLandscape ? 'text-xs' : 'text-sm';
  const nowrapClass = isLandscape ? 'whitespace-nowrap' : '';
  const focusOffsetClass = isLandscape ? 'focus-visible:ring-offset-2 focus-visible:ring-offset-(--bg-surface)' : '';

  return (
    <button
      type="button"
      onClick={event => {
        // The table reuses this button across deal, reveal, and narrative phases.
        if (readingTableAction && event.detail > 1) return;
        onClick?.(event);
      }}
      data-reading-primary={readingTableAction || undefined}
      onKeyDown={event => {
        if (readingTableAction && event.key === 'Enter' && event.repeat) event.preventDefault();
      }}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-controls={ariaControls}
      aria-expanded={typeof ariaExpanded === 'boolean' ? ariaExpanded : undefined}
      className={`
        ${variantClass}
        ${heightClass}
        gap-1.5
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${nowrapClass}
        ${focusOffsetClass}
        ${className}
      `}
    >
      {Icon && <Icon className={isLandscape ? 'w-3.5 h-3.5' : 'w-4 h-4'} weight="fill" aria-hidden="true" />}
      <span className={`${textSize} min-w-0 font-semibold wrap-anywhere`}>{children}</span>
    </button>
  );
}

function revealAction(group, action) {
  if (!group?.isConnected || !action || !group.contains(action) || group.scrollWidth <= group.clientWidth) return;
  const groupBounds = group.getBoundingClientRect();
  const actionBounds = action.getBoundingClientRect();
  const ringInset = 4;
  if (actionBounds.right + ringInset > groupBounds.right) {
    group.scrollLeft += Math.ceil(actionBounds.right + ringInset - groupBounds.right);
  } else if (actionBounds.left - ringInset < groupBounds.left) {
    group.scrollLeft += Math.floor(actionBounds.left - ringInset - groupBounds.left);
  }
}

function revealFocusedAction(event) {
  const group = event.currentTarget;
  const action = event.target.closest('button');
  revealAction(group, action);
  // WebKit may dispatch focus before resized text updates scrollWidth.
  requestAnimationFrame(() => {
    if (document.activeElement === action) revealAction(group, action);
  });
}

function MobileActionContents({
  isShuffling,
  reading,
  isSpreadDealt,
  spreadPositions,
  onDealSpread,
  revealedCards,
  isGenerating,
  personalReading,
  needsNarrativeGeneration,
  showFollowUp = false,
  isFollowUpOpen = false,
  stepIndicatorLabel,
  onOpenSettings,
  onOpenFollowUp,
  onShuffle,
  onDealNext,
  onGenerateNarrative,
  onSaveReading,
  saveController,
  isSaving = false,
  savedEntryId = null,
  onViewSavedEntry,
  onCancelGeneration,
  onNewReading,
  onUpgrade,
  variant = 'fixed',
  showUtilityButtons = true,
  isSettingsOpen = false,
  settingsDialogId = MOBILE_SETTINGS_DIALOG_ID
}) {
  const isLandscape = useLandscape();
  const actionGroupRef = useRef(null);
  const readingLength = reading?.length || 0;
  const revealedCount = revealedCards?.size || 0;
  const allRevealed = readingLength > 0 && revealedCount === readingLength;
  const hasNarrative = Boolean(personalReading && !personalReading.isError && !personalReading.isStreaming);
  const isError = Boolean(personalReading?.isError);
  // Preserve the ability to retry even if upstream flags temporarily clear needsNarrativeGeneration
  const needsNarrative = needsNarrativeGeneration || isError;

  const mode = useMemo(() => getActionMode({
    isShuffling,
    reading,
    revealedCount,
    allRevealed,
    needsNarrative,
    hasNarrative,
    isGenerating,
    isError
  }), [isShuffling, reading, revealedCount, allRevealed, needsNarrative, hasNarrative, isGenerating, isError]);

  useEffect(() => {
    const group = actionGroupRef.current;
    if (!isLandscape || variant === 'inline' || !group) return undefined;
    let frame;
    const reveal = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => revealAction(group, document.activeElement?.closest('button')));
    };
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(reveal) : null;
    observer?.observe(group);
    // Fonts and larger text can resize actions without resizing their scroller.
    group.querySelectorAll('button').forEach(button => observer?.observe(button));
    if (!observer) window.addEventListener('resize', reveal);
    return () => {
      observer?.disconnect();
      cancelAnimationFrame(frame);
      if (!observer) window.removeEventListener('resize', reveal);
    };
  }, [isLandscape, mode, variant]);
  const tableAction = getReadingTableAction({ isSpreadDealt, revealedCards: revealedCards || new Set(), totalCards: readingLength, positions: spreadPositions });

  // In landscape: tighter layout with smaller gaps
  const layoutClass = variant === 'inline'
    ? 'flex flex-col gap-2 w-full'
    : isLandscape
      ? 'flex flex-nowrap gap-1.5 overflow-x-auto scrollbar-none p-1'
      : 'flex flex-wrap gap-2';

  const actions = renderActions(mode, {
    variant,
    showUtilityButtons,
    stepIndicatorLabel,
    hasNarrative,
    isLandscape,
    showFollowUp,
    isFollowUpOpen,
    onOpenFollowUp,
    isSettingsOpen,
    settingsDialogId,
    onOpenSettings,
    onShuffle,
    onDealNext,
    onDealSpread,
    tableAction,
    onGenerateNarrative,
    onSaveReading,
    saveController,
    isSaving,
    savedEntryId,
    onViewSavedEntry,
    onCancelGeneration,
    onNewReading,
    onUpgrade,
    isLimitError: personalReading?.errorCode === 'reading_limit_reached'
  });

  if (variant === 'inline') return <div className={layoutClass}>{actions}</div>;

  return <div ref={actionGroupRef} className={layoutClass} onFocus={isLandscape ? revealFocusedAction : undefined}>{actions}</div>;
}

function withStepContext(label, stepIndicatorLabel) {
  if (!stepIndicatorLabel) return label;
  return `${label} — ${stepIndicatorLabel}`;
}

function renderActions(mode, options) {
  const {
    variant,
    showUtilityButtons,
    stepIndicatorLabel,
    hasNarrative,
    isLandscape,
    showFollowUp,
    isFollowUpOpen,
    onOpenFollowUp,
    isSettingsOpen,
    settingsDialogId,
    onOpenSettings,
    onShuffle,
    onDealNext,
    onDealSpread,
    tableAction,
    onGenerateNarrative,
    onSaveReading,
    saveController,
    isSaving,
    savedEntryId,
    onViewSavedEntry,
    onCancelGeneration,
    onNewReading,
    onUpgrade,
    isLimitError
  } = options;

  // Landscape keeps labels on one line and scrolls actions that do not fit.
  const widthClasses = {
    primary: variant === 'inline' ? 'w-full' : isLandscape ? 'flex-[1_0_auto] min-w-touch' : 'flex-1 min-w-[min(100%,7.5rem)]',
    prepPrimary: variant === 'inline' ? 'w-full' : isLandscape ? 'flex-[1_0_auto] min-w-touch' : 'flex-1 min-w-[min(100%,6rem)]',
    secondary: variant === 'inline' ? 'w-full' : isLandscape ? 'flex-[1_0_auto] min-w-touch' : 'flex-1 min-w-[min(100%,7.5rem)]',
    tertiary: variant === 'inline' ? 'w-full' : isLandscape ? 'flex-[1_0_auto] min-w-touch' : 'flex-1 min-w-[min(100%,6.5rem)]',
    icon: variant === 'inline' ? 'w-full' : 'flex-none min-w-touch'
  };

  // Padding classes: smaller in landscape
  const px = isLandscape ? 'px-2' : 'px-3';

  switch (mode) {
    case 'shuffling': {
      const label = isLandscape ? 'Shuffling' : 'Shuffling';
      return (
        <ActionButton
          variant="primary"
          disabled
          ariaLabel={label}
          className={`${widthClasses.primary} ${px}`}
          isLandscape={isLandscape}
        >
          <span className="flex items-center gap-1.5">
            <ArrowsClockwise className={isLandscape ? 'w-3.5 h-3.5 animate-spin' : 'w-4 h-4 animate-spin'} aria-hidden="true" />
            {label}...
          </span>
        </ActionButton>
      );
    }

    case 'preparation': {
      const drawLabel = 'Draw cards';
      return (
        <>
          {showUtilityButtons && (
            <ActionButton
              variant="secondary"
              onClick={onOpenSettings}
              ariaLabel="Open reading preparation"
              ariaControls={settingsDialogId}
              ariaExpanded={isSettingsOpen}
              icon={Gear}
              className={`${widthClasses.icon} ${px}`}
              isLandscape={isLandscape}
            >
              Prepare
            </ActionButton>
          )}
          <ActionButton
            variant="primary"
            onClick={onShuffle}
            ariaLabel={drawLabel}
            className={`${widthClasses.prepPrimary} ${px}`}
            isLandscape={isLandscape}
          >
            {drawLabel}
          </ActionButton>
        </>
      );
    }

    case 'revealing': {
      return (
          <ActionButton
            readingTableAction
            variant="primary"
            onClick={tableAction?.phase === 'deal' ? onDealSpread : onDealNext}
            ariaLabel={tableAction?.label}
            className={`${widthClasses.primary} ${px}`}
            isLandscape={isLandscape}
          >
            {tableAction?.label}
          </ActionButton>
      );
    }

    case 'generating': {
      return (
          <ActionButton
            variant="secondary"
            onClick={onCancelGeneration}
            disabled={!onCancelGeneration}
            ariaLabel="Cancel generation"
            className={`${widthClasses.primary} ${px}`}
            isLandscape={isLandscape}
          >
            Cancel generation
          </ActionButton>
      );
    }

    case 'error':
      return (
        <>
          {/* Retrying cannot clear a monthly limit; lead with the plans instead. */}
          {isLimitError && onUpgrade ? (
            <ActionButton
              variant="primary"
              onClick={onUpgrade}
              ariaLabel="See plans"
              className={`${widthClasses.primary} ${px}`}
              isLandscape={isLandscape}
            >
              See plans
            </ActionButton>
          ) : (
            <ActionButton
              variant="primary"
              onClick={onGenerateNarrative}
              icon={ArrowsClockwise}
              ariaLabel={withStepContext('Retry interpretation', stepIndicatorLabel)}
              className={`${widthClasses.primary} ${px}`}
              isLandscape={isLandscape}
            >
              Retry interpretation
            </ActionButton>
          )}
          <ActionButton
            variant="secondary"
            onClick={onNewReading}
            ariaLabel="Start a new reading (resets the current spread)"
            className={`${widthClasses.secondary} ${px}`}
            isLandscape={isLandscape}
          >
            New reading
          </ActionButton>
        </>
      );

    case 'ready-for-narrative':
      return (
          <ActionButton
            readingTableAction
            variant="primary"
            onClick={onGenerateNarrative}
            ariaLabel="Interpret cards"
            className={`${widthClasses.primary} ${px}`}
            isLandscape={isLandscape}
          >
            Interpret cards
          </ActionButton>
      );

    case 'completed':
      if (saveController && hasNarrative) return <ReadingCompletionActions saveController={saveController}
        onViewJournalEntry={onViewSavedEntry} onOpenFollowUp={showFollowUp ? onOpenFollowUp : null} followUpOpen={isFollowUpOpen} />;
      return (
        <>
          {hasNarrative && (
            <ActionButton
              variant="primary"
              onClick={savedEntryId ? onViewSavedEntry : onSaveReading}
              disabled={isSaving}
              ariaLabel={savedEntryId ? 'View saved entry' : 'Save to journal'}
            className={`${widthClasses.primary} ${px}`}
            isLandscape={isLandscape}
          >
            {savedEntryId ? 'View saved entry' : isSaving ? 'Saving…' : 'Save to journal'}
          </ActionButton>
          )}
          {showFollowUp && (
            <ActionButton
              variant="secondary"
              onClick={onOpenFollowUp}
              ariaLabel="Ask about this reading"
              ariaControls={MOBILE_FOLLOWUP_DIALOG_ID}
              ariaExpanded={isFollowUpOpen}
              className={`${widthClasses.secondary} ${px} min-h-cta`}
              isLandscape={isLandscape}
            >
              Ask about this reading
            </ActionButton>
          )}
        </>
      );

    default:
      return null;
  }
}

export function MobileActionBar({ isOverlayActive = false, embedded = false, ...props }) {
  const barRef = useRef(null);
  const readingHasText = Boolean(props.personalReading?.raw && !props.personalReading?.isError);
  const viewportOffset = useKeyboardOffset();
  const effectiveOffset = embedded ? 0 : Math.max(0, viewportOffset);

  // Smooth animation for keyboard avoidance with cubic-bezier easing.
  // Embedded mode delegates positioning and keyboard handling to AppBottomRegion.
  const barStyle = useMemo(() => (embedded ? {} : {
    bottom: 0,
    transform: effectiveOffset > 0 ? `translateY(-${effectiveOffset}px)` : 'none',
    transition: 'transform 280ms var(--ease-out), opacity var(--duration-fast) var(--ease-out)',
    willChange: effectiveOffset > 0 ? 'transform' : 'auto'
  }), [effectiveOffset, embedded]);

  useEffect(() => {
    if (embedded || typeof document === 'undefined') return undefined;
    return () => {
      document.documentElement.style.setProperty('--mobile-action-bar-height', '0px');
    };
  }, [embedded]);

  useEffect(() => {
    if (embedded) return undefined;
    if (typeof window === 'undefined' || !barRef.current) return undefined;
    const bar = barRef.current;
    const viewport = window.visualViewport;
    let active = true;
    let frame = null;

    const updateHeight = () => {
      if (!active) return;
      const height = bar.offsetHeight;
      const viewportHeight = viewport?.height || window.innerHeight;
      // Enlarged controls can cover the entire readable strip below the sticky
      // card companion. Keep every action accessible in page flow in that case.
      const inFlow = readingHasText && height > viewportHeight / 4;
      if (inFlow) {
        if (bar.dataset.readingFlow !== 'true') bar.dataset.readingFlow = 'true';
      } else if (bar.hasAttribute('data-reading-flow')) delete bar.dataset.readingFlow;
      const reservation = `${inFlow ? 0 : height}px`;
      const rootStyle = document.documentElement.style;
      if (rootStyle.getPropertyValue('--mobile-action-bar-height') !== reservation) {
        rootStyle.setProperty('--mobile-action-bar-height', reservation);
      }
    };
    const scheduleHeight = () => {
      if (!active || frame !== null) return;
      // Switching the observed dock into page flow changes its own border box.
      // Apply that layout change outside ResizeObserver's delivery cycle.
      frame = window.requestAnimationFrame(() => { frame = null; updateHeight(); });
    };

    updateHeight();

    let observer;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(scheduleHeight);
      // Safe-area changes can resize only the padding, leaving the content box
      // unchanged. Reserve the full dock height after those changes as well.
      observer.observe(bar, { box: 'border-box' });
    }
    window.addEventListener('resize', scheduleHeight);
    viewport?.addEventListener('resize', scheduleHeight);

    return () => {
      active = false;
      if (frame !== null) window.cancelAnimationFrame(frame);
      if (observer) {
        observer.disconnect();
      }
      window.removeEventListener('resize', scheduleHeight);
      viewport?.removeEventListener('resize', scheduleHeight);
    };
  }, [readingHasText, embedded]);

  if (embedded) {
    return (
      <div
        className={`app-bottom-action-contents ${isOverlayActive ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        hidden={props.isGenerating && !props.personalReading}
        aria-hidden={isOverlayActive}
        inert={isOverlayActive}
      >
        <MobileActionContents {...props} />
      </div>
    );
  }

  return (
    <nav
      ref={barRef}
      className={`mobile-action-bar reading-dock ${isOverlayActive ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      hidden={props.isGenerating && !props.personalReading}
      aria-label="Primary mobile actions"
      tabIndex={-1}
      style={barStyle}
      aria-hidden={isOverlayActive}
      inert={isOverlayActive}
      data-overlay-active={isOverlayActive ? 'true' : undefined}
    >
      <MobileActionContents {...props} />
    </nav>
  );
}

export function MobileActionGroup({ showUtilityButtons = false, ...props }) {
  return (
    <div className="mobile-action-group" aria-label="Inline mobile actions">
      <MobileActionContents variant="inline" showUtilityButtons={showUtilityButtons} {...props} />
    </div>
  );
}
