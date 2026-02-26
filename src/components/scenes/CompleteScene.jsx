import { ArrowCounterClockwise, ChatCircle } from '@phosphor-icons/react';
import { MediaGallery } from '../MediaGallery';
import { FeedbackPanel } from '../FeedbackPanel';
import FollowUpModal from '../FollowUpModal';
import { NarrativeStagePanel } from './NarrativeStagePanel';

function formatUsageSummary(sourceUsage) {
  if (!sourceUsage || typeof sourceUsage !== 'object') {
    return [];
  }

  const rows = [];

  const pushRow = (label, value) => {
    if (!value) return;
    rows.push({ label, value });
  };

  const formatRequested = (entry) => {
    if (!entry || typeof entry !== 'object') return 'Not requested';
    if (entry.used) return 'Used';
    if (entry.requested && entry.skippedReason) return `Skipped (${entry.skippedReason.replaceAll('_', ' ')})`;
    if (entry.requested) return 'Requested but not used';
    return 'Not requested';
  };

  pushRow('Spread & cards', formatRequested(sourceUsage.spreadCards));
  pushRow('Vision uploads', formatRequested(sourceUsage.vision));

  if (sourceUsage.userContext && typeof sourceUsage.userContext === 'object') {
    const contextParts = [];
    if (sourceUsage.userContext.questionProvided) contextParts.push('question');
    if (sourceUsage.userContext.reflectionsProvided) contextParts.push('reflections');
    if (sourceUsage.userContext.focusAreasProvided) contextParts.push('focus areas');
    const contextDetail = contextParts.length > 0 ? ` (${contextParts.join(', ')})` : '';
    pushRow('User context', `${formatRequested(sourceUsage.userContext)}${contextDetail}`);
  }

  if (sourceUsage.graphRAG && typeof sourceUsage.graphRAG === 'object') {
    const mode = sourceUsage.graphRAG.mode ? String(sourceUsage.graphRAG.mode) : 'none';
    const passagesUsed = Number.isFinite(sourceUsage.graphRAG.passagesUsedInPrompt)
      ? sourceUsage.graphRAG.passagesUsedInPrompt
      : 0;
    const passagesProvided = Number.isFinite(sourceUsage.graphRAG.passagesProvided)
      ? sourceUsage.graphRAG.passagesProvided
      : 0;
    const graphLabel = sourceUsage.graphRAG.used
      ? `Used (${mode}, ${passagesUsed}/${passagesProvided} passages)`
      : formatRequested(sourceUsage.graphRAG);
    pushRow('Traditional wisdom', graphLabel);
  }

  pushRow('Ephemeris', formatRequested(sourceUsage.ephemeris));
  pushRow('Forecast', formatRequested(sourceUsage.forecast));

  return rows;
}

export function CompleteScene({
  sceneData = {},
  children
}) {
  const {
    narrativePanelProps,
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
  const personalReading = narrativePanelProps?.personalReading;
  const isPersonalReadingError = Boolean(narrativePanelProps?.isPersonalReadingError);
  const narrativePhase = narrativePanelProps?.narrativePhase;
  const isHandset = Boolean(narrativePanelProps?.isHandset);
  const userQuestion = narrativePanelProps?.userQuestion;
  const sourceUsageRows = formatUsageSummary(readingMeta?.sourceUsage);

  return (
    <section
      className="scene-stage scene-stage--complete relative px-3 xs:px-4 sm:px-6 py-6 sm:py-8"
      data-scene="complete"
    >
      <div className="scene-stage__panel scene-stage__panel--complete relative z-[2] max-w-5xl mx-auto p-4 sm:p-6">
        <NarrativeStagePanel narrativePanelProps={narrativePanelProps}>
          {personalReading ? children : null}
        </NarrativeStagePanel>

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
              <dl className="mt-3 space-y-2">
                {sourceUsageRows.map((row) => (
                  <div key={row.label} className="flex items-start justify-between gap-4">
                    <dt className="text-xs sm:text-sm text-muted">{row.label}</dt>
                    <dd className="text-xs sm:text-sm text-main text-right">{row.value}</dd>
                  </div>
                ))}
              </dl>
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
