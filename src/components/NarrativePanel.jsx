import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { Sparkle, BookmarkSimple } from '@phosphor-icons/react';
import { StreamingNarrative } from './StreamingNarrative';
import { NarrationProgress } from './NarrationProgress';
import { NarrationStatus, NarrationError } from './NarrationStatus';
import { NarrativeGuidancePanel } from './NarrativeGuidancePanel';
import { JournalNudge } from './nudges';

function getNarrationLabels(narrationState) {
  if (narrationState === 'loading') {
    return { full: 'Preparing narration...', compact: 'Loading...' };
  }
  if (narrationState === 'playing') {
    return { full: 'Pause narration', compact: 'Pause' };
  }
  if (narrationState === 'paused') {
    return { full: 'Resume narration', compact: 'Resume' };
  }
  return { full: 'Read this aloud', compact: 'Play' };
}

function NarrationActions({
  show,
  canNarrate,
  narrationLabel,
  narrationLabelCompact,
  handleNarrationWrapper,
  showNarrationStop,
  handleNarrationStop,
  showSaveButton,
  saveReading,
  isSaving,
  onOpenJournal
}) {
  if (!show) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
      <button
        type="button"
        onClick={handleNarrationWrapper}
        className="px-3 sm:px-4 py-2 rounded-lg border border-secondary/40 bg-surface/85 hover:bg-surface/80 disabled:opacity-40 disabled:cursor-not-allowed transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-main text-xs sm:text-sm"
        disabled={!canNarrate}
      >
        <span className="hidden xs:inline">{narrationLabel}</span>
        <span className="xs:hidden">{narrationLabelCompact}</span>
      </button>

      {showNarrationStop ? (
        <button
          type="button"
          onClick={handleNarrationStop}
          className="px-2 sm:px-3 py-2 rounded-lg border border-secondary/40 bg-surface/70 hover:bg-surface/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-main transition disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm"
        >
          Stop
        </button>
      ) : null}

      {showSaveButton ? (
        <button
          type="button"
          onClick={saveReading}
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent/20 border border-accent/40 text-accent text-xs sm:text-sm font-semibold hover:bg-accent/30 transition touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <BookmarkSimple className="w-3.5 h-3.5" weight="fill" />
          <span>{isSaving ? 'Saving...' : 'Save to Journal'}</span>
        </button>
      ) : null}

      <button
        type="button"
        onClick={onOpenJournal}
        className="px-3 sm:px-4 py-2 rounded-lg bg-primary/15 border border-primary/40 text-primary text-xs sm:text-sm hover:bg-primary/25 hover:text-primary transition"
      >
        View Journal
      </button>
    </div>
  );
}

function VoicePrompt({
  show,
  onEnableVoice,
  onDismiss
}) {
  if (!show) return null;

  return (
    <div className="text-xs text-muted bg-surface/70 border border-accent/30 rounded-lg px-3 py-2 text-center space-y-2" aria-live="polite">
      <p>Voice narration is disabled. Turn it on?</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button type="button" onClick={onEnableVoice} className="px-3 py-1.5 rounded-full bg-primary/15 border border-primary/40 text-primary hover:bg-primary/30 text-xs">Enable voice & play</button>
        <button type="button" onClick={onDismiss} className="px-3 py-1.5 rounded-full border border-accent/50 text-muted hover:text-main text-xs">Maybe later</button>
      </div>
    </div>
  );
}

function JournalStatusNotice({
  journalStatus,
  onViewEntry
}) {
  if (!journalStatus) return null;

  return (
    <div role="status" aria-live="polite" className="flex flex-wrap items-center justify-center gap-2 text-xs text-center max-w-sm">
      <span className={journalStatus.type === 'success' ? 'text-success' : 'text-error'}>
        {journalStatus.message}
      </span>
      {journalStatus.action?.entryId ? (
        <button
          type="button"
          onClick={() => onViewEntry(journalStatus.action.entryId)}
          className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-2xs font-semibold text-accent hover:bg-accent/20 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          {journalStatus.action.label || 'View entry'}
        </button>
      ) : null}
    </div>
  );
}

export function NarrativePanel({
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
  hasHeroStoryArt
}) {
  const navigate = useNavigate();

  const hasNarrativeContext = Boolean(reading && personalReading && !isPersonalReadingError);
  const narrationState = ttsState?.status || 'idle';
  const isNarrationLoading = narrationState === 'loading';
  const isNarrationPlaying = narrationState === 'playing';
  const isNarrationPaused = narrationState === 'paused';
  const isNarrationActive = isNarrationLoading || isNarrationPlaying || isNarrationPaused;

  const canNarrate = Boolean(fullReadingText) && !isNarrationLoading;
  const showNarrationStatus = hasNarrativeContext && narrationState !== 'idle' && narrationState !== 'completed';
  const showNarrationStop = Boolean(voiceOn && fullReadingText && isNarrationActive);
  const showSaveButton = hasNarrativeContext && !isHandset && narrativePhase === 'complete';
  const showNarrationProgress = hasNarrativeContext && ttsProvider === 'azure' && (isNarrationPlaying || isNarrationPaused);
  const showNarrationTierLimit = ttsState?.status === 'error' && ttsState?.errorCode === 'TIER_LIMIT';
  const showJournalNudge = Boolean(shouldShowJournalNudge && personalReading && !personalReading.isError && !journalStatus);

  const { full: narrationLabel, compact: narrationLabelCompact } = getNarrationLabels(narrationState);

  const openJournal = () => navigate('/journal', { state: { fromReading: true } });
  const openJournalEntry = (entryId) => {
    navigate('/journal', {
      state: {
        highlightEntryId: entryId,
        fromReading: true
      }
    });
  };
  const guidancePanel = (
    <NarrativeGuidancePanel
      toneLabel={toneLabel}
      frameLabel={frameLabel}
      isHandset={isHandset}
      isNewbie={isNewbie}
      defaultOpen={isHandset ? false : undefined}
      compact
      className="max-w-3xl mx-auto"
    />
  );
  const desktopAnchor = !isHandset && userQuestion ? (
    <div className="bg-surface/85 rounded-lg px-3 xxs:px-4 py-3 border border-secondary/40">
      <p className="text-accent/85 text-xs sm:text-sm italic">Anchor: {userQuestion}</p>
    </div>
  ) : null;
  const mobileAnchor = isHandset && userQuestion ? (
    <div className="max-w-3xl mx-auto mt-3 rounded-lg border border-secondary/35 bg-surface/65 px-3 py-2">
      <p className="text-2xs uppercase tracking-[0.12em] text-muted/80">Anchor</p>
      <p className="text-xs text-accent/85 mt-1 leading-relaxed">{userQuestion}</p>
    </div>
  ) : null;

  return (
    <div className={`bg-surface/95 backdrop-blur-xl rounded-2xl border border-secondary/40 shadow-2xl shadow-secondary/40 max-w-full sm:max-w-5xl mx-auto min-h-[6rem] xxs:min-h-[7.5rem] md:min-h-[10rem] ${isLandscape ? 'p-3' : 'px-3 xxs:px-4 py-4 xs:px-5 sm:p-6 md:p-8'}`}>
      <div className="space-y-3 sm:space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <h3 className="text-base xxs:text-lg xs:text-xl sm:text-2xl font-serif text-accent flex items-center gap-2 leading-tight">
            <Sparkle className="w-5 h-5 sm:w-6 sm:h-6 text-secondary" />
            Your Personalized Narrative
          </h3>
          {focusToggleAvailable ? (
            <button
              type="button"
              aria-pressed={isNarrativeFocus}
              onClick={() => setIsNarrativeFocus((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-full border border-secondary/50 px-3 xxs:px-4 py-1.5 text-xs-plus sm:text-sm font-semibold text-muted hover:text-main hover:border-secondary/70 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/60 sm:ml-auto"
            >
              {isNarrativeFocus ? 'Show insight panels' : 'Focus on narrative'}
            </button>
          ) : null}
        </div>

        {desktopAnchor}

        {!isHandset ? guidancePanel : null}
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
      {mobileAnchor}
      {isHandset ? <div className="mt-3">{guidancePanel}</div> : null}

      <div className="mt-4 max-w-3xl mx-auto space-y-4">
        {showNarrationStatus ? (
          <NarrationStatus ttsState={ttsState} showLabel showMessage={ttsState?.status === 'error'} />
        ) : null}

        <NarrationActions
          show={hasNarrativeContext}
          canNarrate={canNarrate}
          narrationLabel={narrationLabel}
          narrationLabelCompact={narrationLabelCompact}
          handleNarrationWrapper={handleNarrationWrapper}
          showNarrationStop={showNarrationStop}
          handleNarrationStop={handleNarrationStop}
          showSaveButton={showSaveButton}
          saveReading={saveReading}
          isSaving={isSaving}
          onOpenJournal={openJournal}
        />

        {showNarrationProgress ? (
          <NarrationProgress ttsState={ttsState} className="w-full max-w-md" />
        ) : null}

        {showNarrationTierLimit ? (
          <NarrationError
            ttsState={ttsState}
            onUpgrade={() => navigate('/settings', { state: { section: 'subscription' } })}
            className="max-w-sm"
          />
        ) : null}

        <VoicePrompt
          show={showVoicePrompt}
          onEnableVoice={handleVoicePromptWrapper}
          onDismiss={() => setShowVoicePrompt(false)}
        />

        <JournalStatusNotice journalStatus={journalStatus} onViewEntry={openJournalEntry} />

        {showJournalNudge ? (
          <div className="mt-4 max-w-md mx-auto">
            <JournalNudge
              onSave={() => {
                saveReading();
                markJournalNudgeSeen();
              }}
              onDismiss={markJournalNudgeSeen}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

NarrativePanel.propTypes = {
  personalReading: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
  isPersonalReadingError: PropTypes.bool,
  narrativePhase: PropTypes.string,
  narrativeText: PropTypes.string,
  fullReadingText: PropTypes.string,
  shouldStreamNarrative: PropTypes.bool,
  emotionalTone: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
  displayName: PropTypes.string,
  userQuestion: PropTypes.string,
  reading: PropTypes.array,
  isHandset: PropTypes.bool,
  isLandscape: PropTypes.bool,
  focusToggleAvailable: PropTypes.bool,
  isNarrativeFocus: PropTypes.bool,
  setIsNarrativeFocus: PropTypes.func,
  toneLabel: PropTypes.string,
  frameLabel: PropTypes.string,
  isNewbie: PropTypes.bool,
  canAutoNarrate: PropTypes.bool,
  handleNarrationWrapper: PropTypes.func,
  handleNarrationStop: PropTypes.func,
  notifyCompletion: PropTypes.func,
  narrativeHighlightPhrases: PropTypes.array,
  narrativeAtmosphereClassName: PropTypes.string,
  handleNarrativeHighlight: PropTypes.func,
  notifySectionEnter: PropTypes.func,
  activeWordBoundary: PropTypes.object,
  voiceOn: PropTypes.bool,
  ttsState: PropTypes.object,
  ttsProvider: PropTypes.string,
  showVoicePrompt: PropTypes.bool,
  setShowVoicePrompt: PropTypes.func,
  handleVoicePromptWrapper: PropTypes.func,
  saveReading: PropTypes.func,
  isSaving: PropTypes.bool,
  journalStatus: PropTypes.object,
  shouldShowJournalNudge: PropTypes.bool,
  markJournalNudgeSeen: PropTypes.func,
  hasHeroStoryArt: PropTypes.bool
};
