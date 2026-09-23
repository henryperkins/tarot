import { NarrationProgress } from '../../NarrationProgress';
import { NarrationStatus, NarrationError } from '../../NarrationStatus';
import { JournalNudge } from '../../nudges';

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
        <button type="button" onClick={onEnableVoice} className="px-3 py-1.5 rounded-full bg-primary/15 border border-primary/40 text-primary hover:bg-primary/30 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)]">Enable voice & play</button>
        <button type="button" onClick={onDismiss} className="px-3 py-1.5 rounded-full border border-accent/50 text-muted hover:text-main text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)]">Maybe later</button>
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
          onClick={() => onViewEntry?.(journalStatus.action.entryId)}
          className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-2xs font-semibold text-accent hover:bg-accent/20 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          {journalStatus.action.label || 'View entry'}
        </button>
      ) : null}
    </div>
  );
}

export function NarrativeStatusStack({
  statusModel = {},
  ttsState,
  journalStatus,
  onUpgradeTier,
  onEnableVoice,
  onDismissVoicePrompt,
  onViewEntry,
  onSaveFromNudge,
  onDismissNudge,
  controls = null
}) {
  const {
    showNarrationStatus = false,
    showNarrationProgress = false,
    showNarrationTierLimit = false,
    showVoicePrompt = false,
    showJournalStatus = false,
    showJournalNudge = false
  } = statusModel;

  return (
    <>
      {showNarrationStatus ? (
        <NarrationStatus ttsState={ttsState} showLabel showMessage={ttsState?.status === 'error'} />
      ) : null}

      {controls}

      {showNarrationProgress ? (
        <NarrationProgress ttsState={ttsState} className="w-full max-w-md" />
      ) : null}

      {showNarrationTierLimit ? (
        <NarrationError
          ttsState={ttsState}
          onUpgrade={onUpgradeTier}
          className="max-w-sm"
        />
      ) : null}

      <VoicePrompt
        show={showVoicePrompt}
        onEnableVoice={onEnableVoice}
        onDismiss={onDismissVoicePrompt}
      />

      <JournalStatusNotice
        journalStatus={showJournalStatus ? journalStatus : null}
        onViewEntry={onViewEntry}
      />

      {showJournalNudge ? (
        <div className="mt-4 max-w-md mx-auto">
          <JournalNudge
            onSave={onSaveFromNudge}
            onDismiss={onDismissNudge}
          />
        </div>
      ) : null}
    </>
  );
}
