import { ArrowCounterClockwise, ChatCircle } from '@phosphor-icons/react';
import { MediaGallery } from '../MediaGallery';
import { FeedbackPanel } from '../FeedbackPanel';
import FollowUpModal from '../FollowUpModal';
import { NarrativePanel } from '../NarrativePanel';

export function CompleteScene({
  title = 'Reading Complete',
  showTitle = true,
  className = '',
  sceneData = {},
  children
}) {
  const {
    personalReading,
    isPersonalReadingError,
    narrativePhase,
    narrativeText,
    fullReadingText,
    shouldStreamNarrative,
    emotionalTone,
    displayName,
    reading,
    isLandscape,
    focusToggleAvailable,
    isNarrativeFocus,
    setIsNarrativeFocus,
    toneLabel,
    frameLabel,
    isNewbie,
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
    saveReading,
    isSaving,
    journalStatus,
    shouldShowJournalNudge,
    markJournalNudgeSeen,
    hasHeroStoryArt,
    onOpenFollowUp,
    isHandset,
    isShuffling,
    shuffle,
    readingMeta,
    selectedSpread,
    spreadName,
    deckStyleId,
    userQuestion,
    lastCardsForFeedback,
    feedbackVisionSummary,
    canUseMediaGallery,
    mediaItems,
    mediaLoading,
    mediaError,
    onRefreshMedia,
    onDeleteMedia,
    followUpOpen,
    setFollowUpOpen,
    followUpAutoFocus
  } = sceneData;

  return (
    <section
      className={`scene-stage scene-stage--complete relative px-3 xs:px-4 sm:px-6 py-6 sm:py-8 ${className}`}
      data-scene="complete"
    >
      <div className="scene-stage__panel scene-stage__panel--complete relative z-[2] max-w-5xl mx-auto p-4 sm:p-6">
        {showTitle ? <h2 className="text-xl sm:text-2xl font-serif text-accent text-center mb-4">{title}</h2> : null}

        {personalReading ? (
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
        ) : null}

        {personalReading && !isPersonalReadingError && narrativePhase === 'complete' && !isHandset && (
          <div className="w-full max-w-2xl mx-auto mt-6">
            <div className="panel-mystic rounded-2xl border border-[color:var(--border-warm-light)] p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-main">Continue the conversation</p>
                  <p className="text-xs text-muted">Open a private chat window to explore this reading.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFollowUpOpen?.(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-accent/15 border border-accent/40 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/25 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                >
                  <ChatCircle className="w-4 h-4" weight="fill" aria-hidden="true" />
                  <span>Open chat</span>
                </button>
              </div>
            </div>
            <FollowUpModal
              isOpen={Boolean(followUpOpen)}
              onClose={() => setFollowUpOpen?.(false)}
              autoFocusInput={followUpAutoFocus}
            />
          </div>
        )}

        {personalReading && canUseMediaGallery && (
          <div className="w-full max-w-5xl mx-auto mt-6 sm:mt-8">
            <MediaGallery
              items={mediaItems}
              loading={mediaLoading}
              error={mediaError}
              onRefresh={onRefreshMedia}
              onDelete={onDeleteMedia}
            />
          </div>
        )}

        <div className="hidden sm:block text-center mt-6 sm:mt-8">
          <button
            onClick={shuffle}
            disabled={isShuffling}
            aria-label={isShuffling ? 'Shuffling a new reading' : 'Start a new reading and reset this spread'}
            className="bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-surface font-semibold px-6 sm:px-8 py-3 sm:py-4 rounded-lg shadow-lg transition-all inline-flex items-center gap-2 sm:gap-3 text-base sm:text-lg"
          >
            <ArrowCounterClockwise className={`w-4 h-4 sm:w-5 sm:h-5 ${isShuffling ? 'motion-safe:animate-spin' : ''}`} />
            <span className="hidden xs:inline">{isShuffling ? 'Shuffling the cards...' : 'Draw new reading'}</span>
            <span className="xs:hidden">{isShuffling ? 'Shuffling...' : 'Reset spread'}</span>
          </button>
        </div>

        {personalReading && (
          <div className="w-full max-w-2xl mx-auto mt-6 sm:mt-8">
            <FeedbackPanel
              requestId={readingMeta?.requestId}
              spreadKey={readingMeta?.spreadKey || selectedSpread}
              spreadName={readingMeta?.spreadName || spreadName}
              deckStyle={readingMeta?.deckStyle || deckStyleId}
              provider={readingMeta?.provider}
              userQuestion={readingMeta?.userQuestion || userQuestion}
              cards={lastCardsForFeedback}
              visionSummary={feedbackVisionSummary}
            />
          </div>
        )}
      </div>
    </section>
  );
}
