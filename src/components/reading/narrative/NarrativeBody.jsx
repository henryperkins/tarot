import { StreamingNarrative } from '../../StreamingNarrative';
import { NarrativeSafetyNotice } from '../../NarrativeSafetyNotice';
import { NarrativeQuestionAnchor } from './NarrativeQuestionAnchor';

export function NarrativeBody({
  question,
  isHandset,
  narrativeText,
  personalReading,
  shouldStreamNarrative,
  isReadingStreaming,
  canAutoNarrate,
  onNarrationStart,
  onNarrativeComplete,
  displayName,
  narrativeHighlightPhrases,
  emotionalTone,
  onHighlightPhrase,
  onSectionEnter,
  activeWordBoundary,
  narrativeAtmosphereClassName,
  hasHeroStoryArt
}) {
  const streamClassName = `mt-6 sm:mt-8 ${hasHeroStoryArt ? 'glass-panel' : ''}`;

  return (
    <div>
      <NarrativeQuestionAnchor question={question} compact={isHandset} />

      <NarrativeSafetyNotice className={question ? 'mt-4' : ''} compact={isHandset} />

      <StreamingNarrative
        className={streamClassName}
        text={narrativeText}
        useMarkdown={Boolean(personalReading?.hasMarkdown)}
        headingBaseLevel={3}
        isStreamingEnabled={shouldStreamNarrative}
        isReadingStreaming={isReadingStreaming}
        autoNarrate={canAutoNarrate}
        onNarrationStart={onNarrationStart}
        onDone={onNarrativeComplete}
        displayName={displayName}
        highlightPhrases={narrativeHighlightPhrases}
        emotionalTone={emotionalTone}
        onHighlightPhrase={onHighlightPhrase}
        onSectionEnter={onSectionEnter}
        wordBoundary={activeWordBoundary}
        withAtmosphere
        atmosphereClassName={narrativeAtmosphereClassName}
      />
    </div>
  );
}
