import { CaretDown } from '@phosphor-icons/react';
import {
  ReadingInputUsageSection,
  ReadingMediaSection,
  ReadingFeedbackSection,
  NewReadingSection
} from '../reading/complete';
import { NarrativeStageLayout } from '../reading/NarrativeStageLayout';
import { getSceneModel } from './sceneModelUtils';

export function CompleteScene({
  sceneModels = {},
  isComplete = true
}) {
  const narrativeModel = getSceneModel(sceneModels, 'narrativeModel');
  const completionModel = getSceneModel(sceneModels, 'completionModel');
  const {
    personalReading,
    isNarrativeFocus,
    isPersonalReadingError,
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
    onDeleteMedia
  } = completionModel;
  const narrativePanel = narrativeModel?.narrativePanel || null;
  const narrativeCompanion = narrativeModel?.secondaryContent || null;
  const shouldRenderNarrativeCompanion = Boolean(narrativePanel && personalReading && narrativeCompanion);
  const showSupport = Boolean(isComplete && personalReading && !isPersonalReadingError && !isNarrativeFocus);
  const withCompanion = narrativeModel.hasSpreadCompanion && !isPersonalReadingError;
  // Keep the same subtree through streaming and completion. Hidden support must
  // not interrupt delivery or discard disclosure state when extra panels hide.
  const secondaryContent = (
    <div className={`reading-support-layout${withCompanion ? ' reading-support-layout--with-companion' : ''}`}>
      <div className="reading-support-layout__main">
        <details className="reading-support" hidden={!showSupport} inert={!showSupport || undefined}>
          <summary>Explore this reading<CaretDown className="reading-disclosure__icon" aria-hidden="true" /></summary>
          {shouldRenderNarrativeCompanion ? <div className="mt-6 sm:mt-8">{narrativeCompanion}</div> : null}

          {/* Reading Inputs sits under Spread Insights: both describe how the reading was built. */}
          <ReadingInputUsageSection
            key={readingMeta?.requestId || readingMeta?.readingId}
            personalReading={personalReading}
            isPersonalReadingError={isPersonalReadingError}
            provider={readingMeta?.provider}
            sourceUsage={readingMeta?.sourceUsage}
          />

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

        </details>
        {isComplete ? <NewReadingSection isShuffling={isShuffling} shuffle={shuffle} /> : null}
      </div>
    </div>
  );

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
