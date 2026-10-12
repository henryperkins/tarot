import { ReadingCompletionActions } from '../reading/complete/ReadingCompletionActions';
import {
  ReadingInputUsageSection,
  ReadingMediaSection,
  ReadingFeedbackSection,
  NewReadingSection
} from '../reading/complete';
import { NarrativeStageLayout } from '../reading/NarrativeStageLayout';
import { getSceneModel } from './sceneModelUtils';

export function CompleteScene({
  sceneModels = {}
}) {
  const narrativeModel = getSceneModel(sceneModels, 'narrativeModel');
  const completionModel = getSceneModel(sceneModels, 'completionModel');
  const {
    saveController,
    onViewJournalEntry,
    personalReading,
    isNarrativeFocus,
    isPersonalReadingError,
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
    mediaTotal,
    mediaLoading,
    mediaError,
    onRefreshMedia,
    onDeleteMedia,
    followUpOpen,
    setFollowUpOpen,
  } = completionModel;
  const narrativePanel = narrativeModel?.narrativePanel || null;
  const narrativeCompanion = narrativeModel?.secondaryContent || null;
  const shouldRenderNarrativeCompanion = Boolean(narrativePanel && personalReading && narrativeCompanion);
  const isComplete = Boolean(personalReading && !personalReading.isStreaming);
  const secondaryContent = isComplete ? (
    <>
      {!isHandset && personalReading && !isPersonalReadingError ? <div className="mx-auto mt-6 max-w-prose">
        <ReadingCompletionActions saveController={saveController} onViewJournalEntry={onViewJournalEntry}
          onOpenFollowUp={event => setFollowUpOpen?.(true, event)} followUpOpen={followUpOpen} />
      </div> : null}
      {!isNarrativeFocus && !isPersonalReadingError ? (
        <details className="reading-explore mx-auto mt-6 max-w-prose text-main">
          <summary className="min-h-touch cursor-pointer rounded-lg py-3 text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary">Explore this reading</summary>
          <div className="space-y-4 pt-3">
      {shouldRenderNarrativeCompanion ? <div className="space-y-4">{narrativeCompanion}</div> : null}

      {/* Reading Inputs sits under Spread Insights: both describe how the reading was built. */}
      {!isNarrativeFocus && (
        <ReadingInputUsageSection
          key={readingMeta?.requestId || readingMeta?.readingId}
          personalReading={personalReading}
          isPersonalReadingError={isPersonalReadingError}
          provider={readingMeta?.provider}
          sourceUsage={readingMeta?.sourceUsage}
        />
      )}

      <ReadingMediaSection
        personalReading={personalReading}
        isPersonalReadingError={isPersonalReadingError}
        canUseMediaGallery={canUseMediaGallery}
        mediaItems={mediaItems}
        mediaTotal={mediaTotal}
        mediaLoading={mediaLoading}
        mediaError={mediaError}
        onRefreshMedia={onRefreshMedia}
        onDeleteMedia={onDeleteMedia}
      />

          </div>
        </details>
      ) : null}

      <ReadingFeedbackSection
        personalReading={personalReading}
        readingMeta={readingMeta}
        selectedSpread={selectedSpread}
        spreadName={spreadName}
        deckStyleId={deckStyleId}
        userQuestion={userQuestion}
        lastCardsForFeedback={lastCardsForFeedback}
        feedbackVisionSummary={feedbackVisionSummary}
      />

      <NewReadingSection
        isShuffling={isShuffling}
        shuffle={shuffle}
      />
    </>
  ) : null;

  return (
    <NarrativeStageLayout
      scene={isComplete ? 'complete' : 'narrative'}
      panelVariant={isComplete ? 'complete' : 'narrative'}
      narrativePanel={narrativePanel}
      secondaryContent={secondaryContent}
      wrapSecondaryWithTopSpacing={false}
    />
  );
}
