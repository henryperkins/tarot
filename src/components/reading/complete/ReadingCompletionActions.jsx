import { useEffect, useRef } from 'react';
import { MOBILE_FOLLOWUP_DIALOG_ID } from '../../mobileActionBarConstants';

const actionClass = 'min-h-[52px] min-w-touch flex-[1_1_8rem] wrap-anywhere rounded-xl px-4 py-3 text-sm font-semibold focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-secondary disabled:opacity-60';

export function ReadingCompletionActions({ saveController, onViewJournalEntry, onOpenFollowUp, followUpOpen = false }) {
  const { saveReading, saveState = { status: 'idle' }, isSaving = false } = saveController || {};
  const saved = saveState.status === 'saved';
  const rootRef = useRef(null);
  const retryRef = useRef(null);
  const attemptedSave = useRef(false);
  useEffect(() => {
    if (saveState.status === 'idle' || saveState.status === 'saved') attemptedSave.current = false;
    if (saveState.status !== 'error' || isSaving || !attemptedSave.current) return undefined;
    // Let coordinated chrome finish releasing an expanded error into flow.
    // Reveal the failed attempt without taking focus from another task/dialog.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        const root = rootRef.current;
        if (!root?.getClientRects().length || root.closest('[hidden], [inert]')) return;
        if (document.activeElement !== document.body && !root.contains(document.activeElement)) return;
        retryRef.current?.focus({ preventScroll: true });
        root.scrollIntoView({ block: 'center', behavior: 'instant' });
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [saveState.status, saveState.error, isSaving]);
  return (
    <div ref={rootRef} className="w-full space-y-2" data-reading-completion>
      <div className="flex flex-wrap items-center gap-2">
        {saved ? <>
          <span role="status" className="sr-only">Saved</span>
          <button type="button" onClick={() => onViewJournalEntry?.(saveState.entryId)} className={`${actionClass} bg-accent text-surface`}>
            {saveState.entryId ? 'View saved entry' : 'View journal'}
          </button>
        </> : <button ref={retryRef} type="button" onClick={() => { attemptedSave.current = true; saveReading?.(); }} disabled={isSaving} className={`${actionClass} bg-accent text-surface`}>
          {isSaving ? 'Saving…' : 'Save to journal'}
        </button>}
        {onOpenFollowUp ? <button type="button" onClick={onOpenFollowUp} aria-haspopup="dialog" aria-controls={MOBILE_FOLLOWUP_DIALOG_ID} aria-expanded={followUpOpen}
          className={`${actionClass} border border-accent/40 bg-surface-muted text-main`}>
          Ask about this reading
        </button> : null}
      </div>
      {saveState.status === 'error' ? <p role="alert" className="text-sm text-error">{saveState.error} Try saving again.</p> : null}
    </div>
  );
}
