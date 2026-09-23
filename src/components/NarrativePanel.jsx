import PropTypes from 'prop-types';
import { NarrativeQuestionAnchor } from './reading/narrative/NarrativeQuestionAnchor';
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
    isReadingStreaming,
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
    onRetryNarrative,
    onUpgradeTier
  } = callbacks;

  if (personalReading?.isError) {
    return (
      <div className={panelClassName}>
        <h3 tabIndex={-1} data-reading-focus-target className="text-lg sm:text-2xl font-serif text-accent">
          Your reading could not be completed
        </h3>
        <p role="alert" className="mt-4 text-main leading-relaxed [overflow-wrap:anywhere]">
          {narrativeText || 'The connection was interrupted. Please try again.'}
        </p>
        <p className="mt-3 text-sm text-muted">Your cards and question are still here. You can retry this reading.</p>
        <NarrativeQuestionAnchor question={question} compact={isHandset} />
        {onRetryNarrative && !isHandset && (
          <button
            type="button"
            onClick={onRetryNarrative}
            className="mt-5 inline-flex min-h-touch items-center justify-center rounded-full border border-secondary/50 px-5 py-2 text-sm font-semibold text-main hover:bg-secondary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/60"
          >
            Retry narrative
          </button>
        )}
      </div>
    );
  }

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
          isReadingStreaming={isReadingStreaming}
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
    isReadingStreaming: PropTypes.bool,
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
    onRetryNarrative: PropTypes.func,
    onUpgradeTier: PropTypes.func
  })
};
