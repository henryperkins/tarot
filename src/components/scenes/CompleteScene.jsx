import {
  ContinueConversationSection,
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
    personalReading,
    isNarrativeFocus,
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
    mediaTotal,
    mediaLoading,
    mediaError,
    onRefreshMedia,
    onDeleteMedia,
    followUpOpen,
    setFollowUpOpen,
    followUpAutoFocus
  } = completionModel;
  const narrativePanel = narrativeModel?.narrativePanel || null;
  const narrativeCompanion = narrativeModel?.secondaryContent || null;
  const shouldRenderNarrativeCompanion = Boolean(narrativePanel && personalReading && narrativeCompanion);
  const secondaryContent = (
    <>
      {shouldRenderNarrativeCompanion ? <div className="mt-6 sm:mt-8">{narrativeCompanion}</div> : null}

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

      <ContinueConversationSection
        personalReading={personalReading}
        isPersonalReadingError={isPersonalReadingError}
        narrativePhase={narrativePhase}
        isHandset={isHandset}
        followUpOpen={followUpOpen}
        setFollowUpOpen={setFollowUpOpen}
        followUpAutoFocus={followUpAutoFocus}
      />

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

      <NewReadingSection
        isShuffling={isShuffling}
        shuffle={shuffle}
      />
    </>
  );

  return (
    <NarrativeStageLayout
      scene="complete"
      panelVariant="complete"
      narrativePanel={narrativePanel}
      secondaryContent={secondaryContent}
      wrapSecondaryWithTopSpacing={false}
    />
  );
}
