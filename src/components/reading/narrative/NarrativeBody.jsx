import { StreamingNarrative } from '../../StreamingNarrative';
import { NarrativeSafetyNotice } from '../../NarrativeSafetyNotice';
import { NarrativeQuestionAnchor } from './NarrativeQuestionAnchor';

export function NarrativeBody({
  question,
  isHandset,
  narrativeText,
  personalReading,
  shouldStreamNarrative,
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
  const desktopAnchor = !isHandset ? <NarrativeQuestionAnchor question={question} /> : null;
  const mobileAnchor = isHandset ? <NarrativeQuestionAnchor question={question} compact /> : null;
  const streamClassName = `max-w-3xl mx-auto mt-4 sm:mt-5 ${hasHeroStoryArt ? 'glass-panel' : ''}`;

  return (
    <>
      {desktopAnchor}

      <NarrativeSafetyNotice className="max-w-3xl mx-auto mt-4" compact={isHandset} />

      <StreamingNarrative
        className={streamClassName}
        text={narrativeText}
        useMarkdown={Boolean(personalReading?.hasMarkdown)}
        isStreamingEnabled={shouldStreamNarrative}
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

      {mobileAnchor}
    </>
  );
}
