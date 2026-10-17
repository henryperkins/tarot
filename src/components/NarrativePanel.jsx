import PropTypes from 'prop-types';
import { NarrativeQuestionAnchor } from './reading/narrative/NarrativeQuestionAnchor';
import { NarrativeStatusStack } from './reading/narrative';
import { NarrativeGestureGate, GatedSpreadCompanion as SpreadCompanion } from './reading/narrative/NarrativeGestureGate';
import { NarrativePersonalContext } from './reading/narrative/NarrativePersonalContext';
import { ReadingDocument } from './reading/narrative/ReadingDocument';
import '../styles/reading-screen.css';

export function NarrativePanel({ panelModel = {}, callbacks = {} }) {
  const { panelClassName, question, isHandset, narrativeText, personalReading,
    statusModel, ttsState, journalStatus, spreadCards = [], isMobileStableMode = false,
    gestureStudyEnabled = false, gestureSidecar = null, gestureSource = null,
    manualInspectionStatus, personalContext = null, originalContext = null } = panelModel;
  const { onEnableVoice, onDismissVoicePrompt, onViewJournalEntry, onSaveFromNudge,
    onDismissNudge, onRetryNarrative, onUpgradeTier, onSelectCard } = callbacks;

  if (personalReading?.isError) {
    return <div className={panelClassName}>
      <h3 tabIndex={-1} data-reading-focus-target className="text-lg sm:text-2xl font-serif text-accent">
        Your reading could not be completed
      </h3>
      <p role="alert" className="mt-4 text-main leading-relaxed [overflow-wrap:anywhere]">
        {narrativeText || 'The connection was interrupted. Please try again.'}
      </p>
      <p className="mt-3 text-sm text-muted">Your cards and question are still here. You can retry this reading.</p>
      <NarrativeQuestionAnchor question={question} compact={isHandset} className="mt-4" />
      {originalContext ? <NarrativePersonalContext
        key={`${gestureSource?.runId}:${gestureSource?.sourceRevision}`} {...originalContext} /> : null}
      {onRetryNarrative && !isHandset && <button type="button" onClick={onRetryNarrative}
        className="mt-5 inline-flex min-h-touch items-center justify-center rounded-full border border-secondary/50 px-5 py-2 text-sm font-semibold text-main hover:bg-secondary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/60">
        Retry interpretation
      </button>}
    </div>;
  }

  const hasSpread = gestureStudyEnabled && spreadCards.length > 0;
  return <NarrativeGestureGate
    cards={spreadCards} onSelectCard={onSelectCard} stable={isMobileStableMode}
    gestureStudyEnabled={gestureStudyEnabled} gestureSidecar={gestureSidecar} gestureSource={gestureSource}
    manualInspectionStatus={manualInspectionStatus} personalContext={personalContext || { question }}
    originalContext={originalContext}>
    <div className={`reading-screen${hasSpread ? ' reading-screen--with-companion' : ''}`}>
      {hasSpread ? <div className="reading-screen__companion"><SpreadCompanion variant="rail" /></div> : null}
      <div className="reading-screen__main">
        {hasSpread ? <div className="reading-screen__mobile-companion"><SpreadCompanion variant="row" /></div> : null}
        <ReadingDocument model={panelModel} callbacks={callbacks} />
        <div className="reading-screen__status">
          <NarrativeStatusStack statusModel={{ ...statusModel, showJournalNudge: false }}
            ttsState={ttsState} journalStatus={journalStatus} onUpgradeTier={onUpgradeTier}
            onEnableVoice={onEnableVoice} onDismissVoicePrompt={onDismissVoicePrompt}
            onViewEntry={onViewJournalEntry} onSaveFromNudge={onSaveFromNudge} onDismissNudge={onDismissNudge} />
        </div>
      </div>
    </div>
  </NarrativeGestureGate>;
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
    journalStatus: PropTypes.object,
    spreadCards: PropTypes.arrayOf(PropTypes.shape({
      index: PropTypes.number.isRequired,
      name: PropTypes.string,
      canonicalName: PropTypes.string,
      image: PropTypes.string,
      frame: PropTypes.string,
      isReversed: PropTypes.bool,
      positionLabel: PropTypes.string,
      shortLabel: PropTypes.string
    })),
    cardLinkCatalog: PropTypes.object,
    isMobileStableMode: PropTypes.bool
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
    onUpgradeTier: PropTypes.func,
    onSelectCard: PropTypes.func
  })
};
