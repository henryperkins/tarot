import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { COACH_STORAGE_SYNC_EVENT, HISTORY_STORAGE_KEY, loadCoachHistory } from '../lib/coachStorage';

const DEFAULT_LIMIT = 5;

const readQuestions = (userId, limit) => loadCoachHistory(limit, userId)
  .map(entry => entry.question.trim())
  .filter(Boolean);

/**
 * The reader's saved intentions on this device, newest first (the list the
 * Journal shows), refreshed when they are saved, deleted or changed in
 * another tab.
 */
export function useSavedIntentions(limit = DEFAULT_LIMIT) {
  const { user } = useAuth();
  const userId = user?.id || null;
  const [state, setState] = useState(() => ({ userId, questions: readQuestions(userId, limit) }));

  // A different reader on this device has their own list.
  if (state.userId !== userId) {
    setState({ userId, questions: readQuestions(userId, limit) });
  }

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const refresh = () => setState({ userId, questions: readQuestions(userId, limit) });
    const isRelevant = key => !key || (typeof key === 'string' && key.startsWith(HISTORY_STORAGE_KEY));
    const handleStorage = event => { if (isRelevant(event.key)) refresh(); };
    const handleSync = event => { if (isRelevant(event?.detail?.key)) refresh(); };
    window.addEventListener('storage', handleStorage);
    window.addEventListener(COACH_STORAGE_SYNC_EVENT, handleSync);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(COACH_STORAGE_SYNC_EVENT, handleSync);
    };
  }, [userId, limit]);

  return state.questions;
}
