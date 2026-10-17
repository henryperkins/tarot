import { MOBILE_FOLLOWUP_DIALOG_ID } from '../../mobileActionBarConstants';

const actionClass = 'min-h-[52px] min-w-touch rounded-xl px-4 py-3 text-sm font-semibold focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-secondary disabled:opacity-60';

export function ReadingCompletionActions({ saveController, onViewJournalEntry, onOpenFollowUp, followUpOpen = false }) {
  const { saveReading, saveState = { status: 'idle' }, isSaving = false } = saveController || {};
  const saved = saveState.status === 'saved';
  return (
    <div className="w-full space-y-2" data-reading-completion>
      <div className="flex flex-wrap items-center gap-2">
        {saved ? <>
          <span role="status" className="text-sm font-semibold text-success">Saved</span>
          <button type="button" onClick={() => onViewJournalEntry?.(saveState.entryId)} className={`${actionClass} flex-1 bg-accent text-surface`}>
            {saveState.entryId ? 'View saved entry' : 'View journal'}
          </button>
        </> : <button type="button" onClick={saveReading} disabled={isSaving} className={`${actionClass} flex-1 bg-accent text-surface`}>
          {isSaving ? 'Saving…' : 'Save to journal'}
        </button>}
        {onOpenFollowUp ? <button type="button" onClick={onOpenFollowUp} aria-haspopup="dialog" aria-controls={MOBILE_FOLLOWUP_DIALOG_ID} aria-expanded={followUpOpen}
          className={`${actionClass} flex-1 border border-accent/40 bg-surface-muted text-main`}>
          Ask about this reading
        </button> : null}
      </div>
      {saveState.status === 'error' ? <p role="alert" className="text-sm text-error">{saveState.error} Try saving again.</p> : null}
    </div>
  );
}
