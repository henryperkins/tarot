import { useEffect, useRef, useState } from 'react';
import { Check } from '@phosphor-icons/react';
import { recordCoachQuestion } from '../lib/coachStorage';
import { useAuth } from '../contexts/AuthContext';

const IDLE = { tone: null, message: '' };

/**
 * SaveIntentionButton - saves the current question to Saved Intentions (shown
 * in the Journal and the guided coach), on both the phone card and the
 * desktop panel.
 */
export function SaveIntentionButton({ question }) {
  const { user } = useAuth();
  const userId = user?.id || null;
  const [status, setStatus] = useState(IDLE);
  const timeoutRef = useRef(null);
  const trimmed = (question || '').trim();

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const handleSave = () => {
    if (!trimmed) return;
    const result = recordCoachQuestion(trimmed, undefined, userId);
    clearTimeout(timeoutRef.current);
    if (result.success) {
      setStatus({ tone: 'success', message: 'Saved to intentions' });
      timeoutRef.current = setTimeout(() => setStatus(IDLE), 1800);
    } else {
      // Errors stay long enough to read and act on.
      setStatus({
        tone: 'error',
        message: result.error || 'Unable to save this question. Check browser storage settings.'
      });
      timeoutRef.current = setTimeout(() => setStatus(IDLE), 6000);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 xs:gap-3">
      <button
        type="button"
        className="px-3 py-1.5 min-h-touch rounded-lg border border-primary/40 text-xs text-main hover:bg-primary/10 active:bg-primary/15 transition disabled:opacity-50 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        onClick={handleSave}
        disabled={!trimmed}
      >
        Save intention
      </button>
      <span role="status" aria-live="polite" className="text-xs min-h-[1.25rem]">
        {status.tone === 'success' && (
          <span className="inline-flex items-center gap-1 text-primary">
            <Check className="h-3.5 w-3.5" weight="bold" aria-hidden="true" />
            {status.message}
          </span>
        )}
        {status.tone === 'error' && <span className="text-error">{status.message}</span>}
      </span>
    </div>
  );
}

export default SaveIntentionButton;
