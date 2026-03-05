import PropTypes from 'prop-types';
import {
  NarrativePanelHeader,
  NarrativeBody,
  NarrationControls,
  NarrativeStatusStack
} from './reading/narrative';

export function NarrativePanel({
  panelModel = {},
  callbacks = {}
}) {
  const {
    panelClassName,
    focusToggleAvailable,
    isNarrativeFocus,
    question,
    isHandset,
    narrativeText,
    personalReading,
    shouldStreamNarrative,
    canAutoNarrate,
    displayName,
    narrativeHighlightPhrases,
    emotionalTone,
    activeWordBoundary,
    narrativeAtmosphereClassName,
    hasHeroStoryArt,
    statusModel,
    controlsModel,
    ttsState,
    journalStatus
  } = panelModel;
  const {
    onToggleNarrativeFocus,
    onNarrationStart,
    onStopNarration,
    onNarrativeComplete,
    onHighlightPhrase,
    onSectionEnter,
    onEnableVoice,
    onDismissVoicePrompt,
    onViewJournalEntry,
    onSaveFromNudge,
    onDismissNudge,
    onOpenJournal,
    onSaveReading,
    onUpgradeTier
  } = callbacks;

  return (
    <div className={panelClassName}>
      <div className="space-y-3 sm:space-y-4">
        <NarrativePanelHeader
          focusToggleAvailable={focusToggleAvailable}
          isNarrativeFocus={isNarrativeFocus}
          onToggleNarrativeFocus={onToggleNarrativeFocus}
        />

        <NarrativeBody
          question={question}
          isHandset={isHandset}
          narrativeText={narrativeText}
          personalReading={personalReading}
          shouldStreamNarrative={shouldStreamNarrative}
          canAutoNarrate={canAutoNarrate}
          onNarrationStart={onNarrationStart}
          onNarrativeComplete={onNarrativeComplete}
          displayName={displayName}
          narrativeHighlightPhrases={narrativeHighlightPhrases}
          emotionalTone={emotionalTone}
          onHighlightPhrase={onHighlightPhrase}
          onSectionEnter={onSectionEnter}
          activeWordBoundary={activeWordBoundary}
          narrativeAtmosphereClassName={narrativeAtmosphereClassName}
          hasHeroStoryArt={hasHeroStoryArt}
        />
      </div>

      <div className="mt-4 max-w-3xl mx-auto space-y-4">
        <NarrativeStatusStack
          statusModel={statusModel}
          ttsState={ttsState}
          journalStatus={journalStatus}
          onUpgradeTier={onUpgradeTier}
          onEnableVoice={onEnableVoice}
          onDismissVoicePrompt={onDismissVoicePrompt}
          onViewEntry={onViewJournalEntry}
          onSaveFromNudge={onSaveFromNudge}
          onDismissNudge={onDismissNudge}
          controls={(
            <NarrationControls
              controlsModel={controlsModel}
              onNarrate={onNarrationStart}
              onStopNarration={onStopNarration}
              onSaveReading={onSaveReading}
              onOpenJournal={onOpenJournal}
            />
          )}
        />
      </div>
    </div>
  );
}

NarrativePanel.propTypes = {
  panelModel: PropTypes.shape({
    panelClassName: PropTypes.string,
    focusToggleAvailable: PropTypes.bool,
    isNarrativeFocus: PropTypes.bool,
    question: PropTypes.string,
    isHandset: PropTypes.bool,
    narrativeText: PropTypes.string,
    personalReading: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
    shouldStreamNarrative: PropTypes.bool,
    canAutoNarrate: PropTypes.bool,
    displayName: PropTypes.string,
    narrativeHighlightPhrases: PropTypes.array,
    emotionalTone: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
    activeWordBoundary: PropTypes.object,
    narrativeAtmosphereClassName: PropTypes.string,
    hasHeroStoryArt: PropTypes.bool,
    statusModel: PropTypes.object,
    controlsModel: PropTypes.object,
    ttsState: PropTypes.object,
    journalStatus: PropTypes.object
  }),
  callbacks: PropTypes.shape({
    onToggleNarrativeFocus: PropTypes.func,
    onNarrationStart: PropTypes.func,
    onStopNarration: PropTypes.func,
    onNarrativeComplete: PropTypes.func,
    onHighlightPhrase: PropTypes.func,
    onSectionEnter: PropTypes.func,
    onEnableVoice: PropTypes.func,
    onDismissVoicePrompt: PropTypes.func,
    onViewJournalEntry: PropTypes.func,
    onSaveFromNudge: PropTypes.func,
    onDismissNudge: PropTypes.func,
    onOpenJournal: PropTypes.func,
    onSaveReading: PropTypes.func,
    onUpgradeTier: PropTypes.func
  })
};
