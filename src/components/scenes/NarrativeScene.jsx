import { useNavigate } from 'react-router-dom';
import { Sparkle, BookmarkSimple, ChatCircle } from '@phosphor-icons/react';
import { StreamingNarrative } from '../StreamingNarrative';
import { NarrationProgress } from '../NarrationProgress';
import { NarrationStatus, NarrationError } from '../NarrationStatus';
import { NarrativeGuidancePanel } from '../NarrativeGuidancePanel';
import { JournalNudge } from '../nudges';

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
  const navigate = useNavigate();
  const hasNarrativeContent = Boolean(personalReading);

  return (
    <section
      className={`scene-stage scene-stage--narrative relative px-3 xs:px-4 sm:px-6 py-6 sm:py-8 ${className}`}
      data-scene="narrative"
    >
      <div className="scene-stage__panel scene-stage__panel--narrative relative z-[2] max-w-5xl mx-auto p-4 sm:p-6">
        {showTitle ? <h2 className="text-xl sm:text-2xl font-serif text-accent text-center mb-4">{title}</h2> : null}

        {hasNarrativeContent ? (
          <div className={`bg-surface/95 backdrop-blur-xl rounded-2xl border border-secondary/40 shadow-2xl shadow-secondary/40 max-w-full sm:max-w-5xl mx-auto ${isLandscape ? 'p-3' : 'px-3 xxs:px-4 py-4 xs:px-5 sm:p-6 md:p-8'}`}>
            <div className="space-y-3 sm:space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <h3 className="text-base xxs:text-lg xs:text-xl sm:text-2xl font-serif text-accent flex items-center gap-2 leading-tight">
                  <Sparkle className="w-5 h-5 sm:w-6 sm:h-6 text-secondary" />
                  Your Personalized Narrative
                </h3>
                {focusToggleAvailable && (
                  <button
                    type="button"
                    aria-pressed={isNarrativeFocus}
                    onClick={() => setIsNarrativeFocus(prev => !prev)}
                    className="inline-flex items-center gap-2 rounded-full border border-secondary/50 px-3 xxs:px-4 py-1.5 text-xs-plus sm:text-sm font-semibold text-muted hover:text-main hover:border-secondary/70 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/60 sm:ml-auto"
                  >
                    {isNarrativeFocus ? 'Show insight panels' : 'Focus on narrative'}
                  </button>
                )}
              </div>
              {userQuestion && (
                <div className="bg-surface/85 rounded-lg px-3 xxs:px-4 py-3 border border-secondary/40">
                  <p className="text-accent/85 text-xs sm:text-sm italic">Anchor: {userQuestion}</p>
                </div>
              )}
              <NarrativeGuidancePanel
                toneLabel={toneLabel}
                frameLabel={frameLabel}
                isHandset={isHandset}
                isNewbie={isNewbie}
                compact
                className="max-w-3xl mx-auto"
              />
            </div>
            <StreamingNarrative
              className={`max-w-3xl mx-auto mt-4 sm:mt-5 ${hasHeroStoryArt ? 'glass-panel' : ''}`}
              text={narrativeText}
              useMarkdown={Boolean(personalReading?.hasMarkdown)}
              isStreamingEnabled={shouldStreamNarrative}
              autoNarrate={canAutoNarrate}
              onNarrationStart={handleNarrationWrapper}
              onDone={notifyCompletion}
              displayName={displayName}
              highlightPhrases={narrativeHighlightPhrases}
              emotionalTone={emotionalTone}
              onHighlightPhrase={handleNarrativeHighlight}
              onSectionEnter={notifySectionEnter}
              wordBoundary={activeWordBoundary}
              withAtmosphere
              atmosphereClassName={narrativeAtmosphereClassName}
            />
            {isHandset && onOpenFollowUp && personalReading && !isPersonalReadingError && narrativePhase === 'complete' && (
              <div className="max-w-3xl mx-auto mt-4">
                <div className="rounded-2xl border border-secondary/35 bg-surface/85 px-4 py-3 text-center shadow-lg shadow-secondary/25">
                  <p className="text-sm font-semibold text-main">Continue with a follow-up chat</p>
                  <p className="text-xs text-muted mt-1">Ask deeper questions and explore what resonates.</p>
                  <button
                    type="button"
                    onClick={onOpenFollowUp}
                    className="mt-3 inline-flex items-center gap-2 rounded-full bg-accent/20 border border-accent/40 px-4 py-2 text-xs font-semibold text-accent hover:bg-accent/30 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                  >
                    <ChatCircle className="w-4 h-4" weight="fill" aria-hidden="true" />
                    <span>Open follow-up chat</span>
                  </button>
                </div>
              </div>
            )}
            <div className="flex flex-col items-center justify-center gap-2 sm:gap-3 mt-3 sm:mt-4">
              {/* Narration status indicator */}
              {reading && personalReading && !isPersonalReadingError && ttsState?.status !== 'idle' && ttsState?.status !== 'completed' && (
                <NarrationStatus ttsState={ttsState} showLabel showMessage={ttsState?.status === 'error'} />
              )}

              {reading && personalReading && !isPersonalReadingError && (
                <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                  <button type="button" onClick={handleNarrationWrapper} className="px-3 sm:px-4 py-2 rounded-lg border border-secondary/40 bg-surface/85 hover:bg-surface/80 disabled:opacity-40 disabled:cursor-not-allowed transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-main text-xs sm:text-sm" disabled={!fullReadingText || ttsState?.status === 'loading'}>
                    <span className="hidden xs:inline">{ttsState?.status === 'loading' ? 'Preparing narration...' : ttsState?.status === 'playing' ? 'Pause narration' : ttsState?.status === 'paused' ? 'Resume narration' : 'Read this aloud'}</span>
                    <span className="xs:hidden">{ttsState?.status === 'loading' ? 'Loading...' : ttsState?.status === 'playing' ? 'Pause' : ttsState?.status === 'paused' ? 'Resume' : 'Play'}</span>
                  </button>
                  {(voiceOn && fullReadingText && (ttsState?.status === 'playing' || ttsState?.status === 'paused' || ttsState?.status === 'loading')) && (
                    <button type="button" onClick={handleNarrationStop} className="px-2 sm:px-3 py-2 rounded-lg border border-secondary/40 bg-surface/70 hover:bg-surface/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-main transition disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm">Stop</button>
                  )}
                  {!isHandset && narrativePhase === 'complete' && (
                    <button
                      type="button"
                      onClick={saveReading}
                      disabled={isSaving}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent/20 border border-accent/40 text-accent text-xs sm:text-sm font-semibold hover:bg-accent/30 transition touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <BookmarkSimple className="w-3.5 h-3.5" weight="fill" />
                      <span>{isSaving ? 'Saving...' : 'Save to Journal'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate('/journal', { state: { fromReading: true } })}
                    className="px-3 sm:px-4 py-2 rounded-lg bg-primary/15 border border-primary/40 text-primary text-xs sm:text-sm hover:bg-primary/25 hover:text-primary transition"
                  >
                    View Journal
                  </button>
                </div>
              )}

              {/* Progress bar for Azure TTS */}
              {reading && personalReading && !isPersonalReadingError && ttsProvider === 'azure' && (ttsState?.status === 'playing' || ttsState?.status === 'paused') && (
                <NarrationProgress ttsState={ttsState} className="w-full max-w-md" />
              )}

              {/* Error details with upgrade action for tier limits */}
              {ttsState?.status === 'error' && ttsState?.errorCode === 'TIER_LIMIT' && (
                <NarrationError
                  ttsState={ttsState}
                  onUpgrade={() => navigate('/settings', { state: { section: 'subscription' } })}
                  className="max-w-sm"
                />
              )}
              {showVoicePrompt && (
                <div className="text-xs text-muted bg-surface/70 border border-accent/30 rounded-lg px-3 py-2 text-center space-y-2" aria-live="polite">
                  <p>Voice narration is disabled. Turn it on?</p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button type="button" onClick={handleVoicePromptWrapper} className="px-3 py-1.5 rounded-full bg-primary/15 border border-primary/40 text-primary hover:bg-primary/30 text-xs">Enable voice & play</button>
                    <button type="button" onClick={() => setShowVoicePrompt(false)} className="px-3 py-1.5 rounded-full border border-accent/50 text-muted hover:text-main text-xs">Maybe later</button>
                  </div>
                </div>
              )}
              {journalStatus && (
                <div role="status" aria-live="polite" className="flex flex-wrap items-center justify-center gap-2 text-xs text-center max-w-sm">
                  <span className={`${journalStatus.type === 'success' ? 'text-success' : 'text-error'}`}>
                    {journalStatus.message}
                  </span>
                  {journalStatus.action?.entryId && (
                    <button
                      type="button"
                      onClick={() => navigate('/journal', {
                        state: {
                          highlightEntryId: journalStatus.action.entryId,
                          fromReading: true
                        }
                      })}
                      className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-2xs font-semibold text-accent hover:bg-accent/20 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                    >
                      {journalStatus.action.label || 'View entry'}
                    </button>
                  )}
                </div>
              )}

              {/* JournalNudge - contextual prompt for first-time users after narrative */}
              {shouldShowJournalNudge && personalReading && !personalReading.isError && !journalStatus && (
                <div className="mt-4 max-w-md mx-auto">
                  <JournalNudge
                    onSave={() => {
                      saveReading();
                      markJournalNudgeSeen();
                    }}
                    onDismiss={markJournalNudgeSeen}
                  />
                </div>
              )}
            </div>
          </div>
        ) : children}
      </div>
    </section>
  );
}
