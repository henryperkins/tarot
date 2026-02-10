import { NarrativePanel } from '../NarrativePanel';

export function NarrativeScene({
  // Layout
  title = 'Narrative',
  children,
  showTitle = true,
  className = '',
  // Reading data
  personalReading,
  isPersonalReadingError,
  narrativePhase,
  narrativeText,
  fullReadingText,
  shouldStreamNarrative,
  emotionalTone,
  displayName,
  userQuestion,
  reading,
  isHandset,
  isLandscape,
  // Focus toggle
  focusToggleAvailable,
  isNarrativeFocus,
  setIsNarrativeFocus,
  // Guidance panel
  toneLabel,
  frameLabel,
  isNewbie,
  // Narration / TTS
  canAutoNarrate,
  handleNarrationWrapper,
  handleNarrationStop,
  notifyCompletion,
  narrativeHighlightPhrases,
  narrativeAtmosphereClassName,
  handleNarrativeHighlight,
  notifySectionEnter,
  activeWordBoundary,
  voiceOn,
  ttsState,
  ttsProvider,
  showVoicePrompt,
  setShowVoicePrompt,
  handleVoicePromptWrapper,
  // Journal
  saveReading,
  isSaving,
  journalStatus,
  shouldShowJournalNudge,
  markJournalNudgeSeen,
  // Visual
  hasHeroStoryArt,
  // Follow-up
  onOpenFollowUp
}) {
  const hasNarrativeContent = Boolean(personalReading);
<<<<<<< Updated upstream
  const contentClassName = 'relative z-[2] max-w-5xl mx-auto';
=======
  const contentClassName = 'scene-stage__panel scene-stage__panel--narrative relative z-[2] max-w-5xl mx-auto p-4 sm:p-6';
>>>>>>> Stashed changes

  return (
    <section
      className={`scene-stage scene-stage--narrative relative px-3 xs:px-4 sm:px-6 py-6 sm:py-8 ${className}`}
      data-scene="narrative"
    >
      <div className={contentClassName}>
        {showTitle ? <h2 className="text-xl sm:text-2xl font-serif text-accent text-center mb-4">{title}</h2> : null}

        {hasNarrativeContent ? (
          <>
            <NarrativePanel
              personalReading={personalReading}
              isPersonalReadingError={isPersonalReadingError}
              narrativePhase={narrativePhase}
              narrativeText={narrativeText}
              fullReadingText={fullReadingText}
              shouldStreamNarrative={shouldStreamNarrative}
              emotionalTone={emotionalTone}
              displayName={displayName}
              userQuestion={userQuestion}
              reading={reading}
              isHandset={isHandset}
              isLandscape={isLandscape}
              focusToggleAvailable={focusToggleAvailable}
              isNarrativeFocus={isNarrativeFocus}
              setIsNarrativeFocus={setIsNarrativeFocus}
              toneLabel={toneLabel}
              frameLabel={frameLabel}
              isNewbie={isNewbie}
              canAutoNarrate={canAutoNarrate}
              handleNarrationWrapper={handleNarrationWrapper}
              handleNarrationStop={handleNarrationStop}
              notifyCompletion={notifyCompletion}
              narrativeHighlightPhrases={narrativeHighlightPhrases}
              narrativeAtmosphereClassName={narrativeAtmosphereClassName}
              handleNarrativeHighlight={handleNarrativeHighlight}
              notifySectionEnter={notifySectionEnter}
              activeWordBoundary={activeWordBoundary}
              voiceOn={voiceOn}
              ttsState={ttsState}
              ttsProvider={ttsProvider}
              showVoicePrompt={showVoicePrompt}
              setShowVoicePrompt={setShowVoicePrompt}
              handleVoicePromptWrapper={handleVoicePromptWrapper}
              saveReading={saveReading}
              isSaving={isSaving}
              journalStatus={journalStatus}
              shouldShowJournalNudge={shouldShowJournalNudge}
              markJournalNudgeSeen={markJournalNudgeSeen}
              hasHeroStoryArt={hasHeroStoryArt}
              onOpenFollowUp={onOpenFollowUp}
            />

            {children ? (
              <div className="mt-6 sm:mt-8">
                {children}
              </div>
            ) : null}
          </>
        ) : children}
      </div>
    </section>
  );
}
