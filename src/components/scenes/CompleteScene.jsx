import { ArrowCounterClockwise, ChatCircle } from '@phosphor-icons/react';
import { MediaGallery } from '../MediaGallery';
import { FeedbackPanel } from '../FeedbackPanel';
import FollowUpModal from '../FollowUpModal';
import { renderNarrativeStage } from './renderNarrativeStage';

const USAGE_BADGE_CLASSES = {
  used: 'border-[color:rgb(var(--status-success-rgb)/0.45)] bg-[color:rgb(var(--status-success-rgb)/0.12)] text-[color:rgb(var(--status-success-rgb)/0.95)]',
  requestedNotUsed: 'border-[color:rgb(var(--status-warning-rgb)/0.45)] bg-[color:rgb(var(--status-warning-rgb)/0.12)] text-[color:rgb(var(--status-warning-rgb)/0.95)]',
  skipped: 'border-[color:rgb(var(--status-warning-rgb)/0.45)] bg-[color:rgb(var(--status-warning-rgb)/0.12)] text-[color:rgb(var(--status-warning-rgb)/0.95)]',
  notRequested: 'border-secondary/35 bg-surface-muted/40 text-muted-high'
};

function toReadableLabel(value) {
  return String(value).replaceAll('_', ' ');
}

function getUsageState(entry) {
  if (!entry || typeof entry !== 'object') return 'notRequested';
  if (entry.used) return 'used';
  if (entry.requested && entry.skippedReason) return 'skipped';
  if (entry.requested) return 'requestedNotUsed';
  return 'notRequested';
}

function formatUsageSummary(sourceUsage) {
  if (!sourceUsage || typeof sourceUsage !== 'object') {
    return { rows: [], summary: { used: 0, requestedNotUsed: 0 } };
  }

  const rows = [];

  const pushRow = (label, entry, detail = '') => {
    const state = getUsageState(entry);
    const badgeText = state === 'used'
      ? 'Used'
      : state === 'requestedNotUsed'
        ? 'Requested not used'
        : state === 'skipped'
          ? 'Skipped'
          : 'Not requested';
    const fallbackDetail = state === 'skipped' && entry?.skippedReason
      ? `Reason: ${toReadableLabel(entry.skippedReason)}`
      : '';
    rows.push({
      label,
      state,
      badgeText,
      detail: detail || fallbackDetail
    });
  };

  pushRow('Spread & cards', sourceUsage.spreadCards);
  pushRow('Vision uploads', sourceUsage.vision);

  if (sourceUsage.userContext && typeof sourceUsage.userContext === 'object') {
    const contextParts = [];
    if (sourceUsage.userContext.questionProvided) contextParts.push('question');
    if (sourceUsage.userContext.reflectionsProvided) contextParts.push('reflections');
    if (sourceUsage.userContext.focusAreasProvided) contextParts.push('focus areas');
    const contextDetail = contextParts.length > 0
      ? contextParts.join(', ')
      : '';
    pushRow('User context', sourceUsage.userContext, contextDetail);
  }

  if (sourceUsage.graphRAG && typeof sourceUsage.graphRAG === 'object') {
    const mode = sourceUsage.graphRAG.mode ? String(sourceUsage.graphRAG.mode) : 'none';
    const passagesUsed = Number.isFinite(sourceUsage.graphRAG.passagesUsedInPrompt)
      ? sourceUsage.graphRAG.passagesUsedInPrompt
      : 0;
    const passagesProvided = Number.isFinite(sourceUsage.graphRAG.passagesProvided)
      ? sourceUsage.graphRAG.passagesProvided
      : 0;
    const graphDetail = sourceUsage.graphRAG.used
      ? `${mode} mode, ${passagesUsed}/${passagesProvided} passages`
      : '';
    pushRow('Traditional wisdom', sourceUsage.graphRAG, graphDetail);
  }

  pushRow('Ephemeris', sourceUsage.ephemeris);
  pushRow('Forecast', sourceUsage.forecast);

  const used = rows.filter((row) => row.state === 'used').length;
  const requestedNotUsed = rows.filter((row) => row.state === 'requestedNotUsed' || row.state === 'skipped').length;

  return {
    rows,
    summary: {
      used,
      requestedNotUsed
    }
  };
}

export function CompleteScene({
  sceneData = {},
  children
}) {
  const {
    narrativePanel,
    personalReading,
    isPersonalReadingError,
    narrativePhase,
    isHandset,
    userQuestion,
    isShuffling,
    shuffle,
    readingMeta,
    selectedSpread,
    spreadName,
    deckStyleId,
    lastCardsForFeedback,
    feedbackVisionSummary,
    canUseMediaGallery,
    mediaItems,
    mediaLoading,
    mediaError,
    onRefreshMedia,
    onDeleteMedia,
    followUpOpen,
    setFollowUpOpen,
    followUpAutoFocus
  } = sceneData;
  const sourceUsage = formatUsageSummary(readingMeta?.sourceUsage);
  const sourceUsageRows = sourceUsage.rows;
  const stageContent = renderNarrativeStage({
    narrativePanel,
    children,
    showChildren: Boolean(narrativePanel && personalReading)
  });

  return (
    <section
      className="scene-stage scene-stage--complete relative px-3 xs:px-4 sm:px-6 py-6 sm:py-8"
      data-scene="complete"
    >
      <div className="scene-stage__panel scene-stage__panel--complete relative z-[2] max-w-5xl mx-auto p-4 sm:p-6">
        {stageContent}

        {personalReading && !isPersonalReadingError && narrativePhase === 'complete' && !isHandset && (
          <div className="w-full max-w-2xl mx-auto mt-6">
            <div className="panel-mystic rounded-2xl border border-[color:var(--border-warm-light)] p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-main">Continue the conversation</p>
                  <p className="text-xs text-muted">Open a private chat window to explore this reading.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFollowUpOpen?.(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-accent/15 border border-accent/40 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/25 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                >
                  <ChatCircle className="w-4 h-4" weight="fill" aria-hidden="true" />
                  <span>Open chat</span>
                </button>
              </div>
            </div>
            <FollowUpModal
              isOpen={Boolean(followUpOpen)}
              onClose={() => setFollowUpOpen?.(false)}
              autoFocusInput={followUpAutoFocus}
            />
          </div>
        )}

        {personalReading && sourceUsageRows.length > 0 && (
          <div className="w-full max-w-2xl mx-auto mt-6">
            <div className="panel-mystic rounded-2xl border border-[color:var(--border-warm-light)] p-4 sm:p-5">
              <p className="text-sm font-semibold text-main">Reading Inputs Used</p>
              <p className="text-xs text-muted mt-1">Which sources shaped this interpretation.</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-[color:rgb(var(--status-success-rgb)/0.4)] bg-[color:rgb(var(--status-success-rgb)/0.12)] px-2.5 py-1 text-2xs font-semibold uppercase tracking-[0.08em] text-[color:rgb(var(--status-success-rgb)/0.95)]">
                  {sourceUsage.summary.used} used
                </span>
                <span className="inline-flex items-center rounded-full border border-[color:rgb(var(--status-warning-rgb)/0.4)] bg-[color:rgb(var(--status-warning-rgb)/0.12)] px-2.5 py-1 text-2xs font-semibold uppercase tracking-[0.08em] text-[color:rgb(var(--status-warning-rgb)/0.95)]">
                  {sourceUsage.summary.requestedNotUsed} requested not used
                </span>
              </div>
              <ul className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {sourceUsageRows.map((row) => (
                  <li
                    key={row.label}
                    className="rounded-xl border border-[color:var(--border-warm-light)] bg-surface/45 px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs-plus font-semibold text-main leading-snug">{row.label}</p>
                      <span className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-semibold uppercase tracking-[0.06em] ${USAGE_BADGE_CLASSES[row.state]}`}>
                        {row.badgeText}
                      </span>
                    </div>
                    {row.detail && (
                      <p className="mt-1.5 text-2xs sm:text-xs text-muted leading-relaxed">
                        {row.detail}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {personalReading && canUseMediaGallery && (
          <div className="w-full max-w-5xl mx-auto mt-6 sm:mt-8">
            <MediaGallery
              items={mediaItems}
              loading={mediaLoading}
              error={mediaError}
              onRefresh={onRefreshMedia}
              onDelete={onDeleteMedia}
            />
          </div>
        )}

        <div className="hidden sm:block text-center mt-6 sm:mt-8">
          <button
            onClick={shuffle}
            disabled={isShuffling}
            aria-label={isShuffling ? 'Shuffling a new reading' : 'Start a new reading and reset this spread'}
            className="bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-surface font-semibold px-6 sm:px-8 py-3 sm:py-4 rounded-lg shadow-lg transition-all inline-flex items-center gap-2 sm:gap-3 text-base sm:text-lg"
          >
            <ArrowCounterClockwise className={`w-4 h-4 sm:w-5 sm:h-5 ${isShuffling ? 'motion-safe:animate-spin' : ''}`} />
            <span className="hidden xs:inline">{isShuffling ? 'Shuffling the cards...' : 'Draw new reading'}</span>
            <span className="xs:hidden">{isShuffling ? 'Shuffling...' : 'Reset spread'}</span>
          </button>
        </div>

        {personalReading && (
          <div className="w-full max-w-2xl mx-auto mt-6 sm:mt-8">
            <FeedbackPanel
              requestId={readingMeta?.requestId}
              spreadKey={readingMeta?.spreadKey || selectedSpread}
              spreadName={readingMeta?.spreadName || spreadName}
              deckStyle={readingMeta?.deckStyle || deckStyleId}
              provider={readingMeta?.provider}
              userQuestion={readingMeta?.userQuestion || userQuestion}
              cards={lastCardsForFeedback}
              visionSummary={feedbackVisionSummary}
            />
          </div>
        )}
      </div>
    </section>
  );
}
