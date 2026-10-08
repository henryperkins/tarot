import PropTypes from 'prop-types';
import { NarrativeQuestionAnchor } from './reading/narrative/NarrativeQuestionAnchor';
import {
  NarrativePanelHeader,
  NarrativeBody,
  NarrationControls,
  NarrativeStatusStack
} from './reading/narrative';
import { NarrativeCardFocusProvider } from './reading/narrative/NarrativeCardFocus';
import { SpreadCompanion, CardTouchPlate } from './reading/narrative/SpreadCompanion';
import { railColumns } from './reading/narrative/spreadCompanionLayout';

// Set the card into the paragraph that opens its passage.
function renderCardPlate(paragraphProps) {
  const intro = paragraphProps?.['data-card-intro'];
  if (intro === undefined || intro === '') return null;
  return <CardTouchPlate cardIndex={Number(intro)} />;
}

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
    journalStatus,
    spreadCards = [],
    cardLinkCatalog = null,
    isMobileStableMode = false
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
    onUpgradeTier,
    onSelectCard
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
        <NarrativeQuestionAnchor question={question} compact={isHandset} className="mt-4" />
        {onRetryNarrative && !isHandset && (
          <button
            type="button"
            onClick={onRetryNarrative}
            className="mt-5 inline-flex min-h-touch items-center justify-center rounded-full border border-secondary/50 px-5 py-2 text-sm font-semibold text-main hover:bg-secondary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/60"
          >
            Retry interpretation
          </button>
        )}
      </div>
    );
  }

  const hasSpread = spreadCards.length > 0;
  const cardLinks = personalReading?.hasMarkdown ? cardLinkCatalog : null;
  const layoutClassName = [
    'narrative-panel__layout',
    hasSpread ? 'narrative-panel__layout--with-spread' : null,
    hasSpread && railColumns(spreadCards.length) > 1 ? 'narrative-panel__layout--wide-rail' : null
  ].filter(Boolean).join(' ');

  return (
    <NarrativeCardFocusProvider cards={spreadCards} onSelectCard={onSelectCard} stable={isMobileStableMode}>
      <div className={panelClassName}>
        <div className={layoutClassName}>
          {hasSpread ? <SpreadCompanion variant="rail" /> : null}
          {/* One reading column keeps the title, question, notice, and prose on a shared edge. */}
          <div className="narrative-panel__column mx-auto max-w-prose min-w-0 space-y-5 sm:space-y-6">
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
              cardLinks={cardLinks}
              renderParagraphLead={cardLinks ? renderCardPlate : null}
              spreadCompanion={hasSpread ? <SpreadCompanion variant="row" /> : null}
            />
          </div>

          <div className="narrative-panel__after mt-4 max-w-3xl mx-auto space-y-4 min-w-0">
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
      </div>
    </NarrativeCardFocusProvider>
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
