import { useState, useEffect } from 'react';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import {
  loadCoachHistory,
  deleteCoachHistoryItem,
  COACH_STORAGE_SYNC_EVENT,
  HISTORY_STORAGE_KEY
} from '../lib/coachStorage';
import { useNavigate } from 'react-router-dom';
import { CoachSuggestion } from './CoachSuggestion';
import { JournalPlusCircleIcon, JournalRefreshIcon } from './JournalIcons';
import { useAuth } from '../contexts/AuthContext';

const PAGE_SIZE = 6;

export function SavedIntentionsList() {
  const { user } = useAuth();
  const userId = user?.id || null;
  const [prevUserId, setPrevUserId] = useState(userId);
  const [intentions, setIntentions] = useState(() => loadCoachHistory(undefined, userId));
  const [pageIndex, setPageIndex] = useState(0);
  const navigate = useNavigate();

  // Reset state when userId changes (React's render-time update pattern)
  if (prevUserId !== userId) {
    setPrevUserId(userId);
    setIntentions(loadCoachHistory(undefined, userId));
    setPageIndex(0);
  }

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const isRelevantKey = (key) => {
      if (!key) return true;
      if (typeof key !== 'string') return false;
      return key.startsWith(HISTORY_STORAGE_KEY);
    };
    const refreshHistory = () => setIntentions(loadCoachHistory(undefined, userId));

    const handleStorage = (event) => {
      if (isRelevantKey(event.key)) {
        refreshHistory();
      }
    };

    const handleCoachSync = (event) => {
      const detailKey = event?.detail?.key;
      if (isRelevantKey(detailKey)) {
        refreshHistory();
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(COACH_STORAGE_SYNC_EVENT, handleCoachSync);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(COACH_STORAGE_SYNC_EVENT, handleCoachSync);
    };
  }, [userId]);

  // Compute the effective page, clamped to valid range
  const maxPage = Math.max(0, Math.ceil(intentions.length / PAGE_SIZE) - 1);
  const page = Math.min(pageIndex, maxPage);

  const handleDelete = (id) => {
    const result = deleteCoachHistoryItem(id, userId);
    if (result.success) {
      setIntentions(result.history);
    }
  };

  const handleUseIntention = (question) => {
    navigate('/', { state: { initialQuestion: question } });
  };

  const totalPages = Math.max(1, Math.ceil(intentions.length / PAGE_SIZE));
  const visibleIntentions = intentions.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  if (intentions.length === 0) {
    return null; // Don't show section if empty
  }

  return (
    <div className="mb-8 animate-fade-in">
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <JournalRefreshIcon className="w-5 h-5 text-amber-200/75" aria-hidden="true" />
          <h2 className="text-xl font-serif text-amber-50">Saved Intentions</h2>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-1 text-[0.78rem] text-amber-100/70">
            <button
              type="button"
              onClick={() => setPageIndex((prev) => Math.max(prev - 1, 0))}
              disabled={page === 0}
              className="flex items-center gap-1 rounded-full px-2 py-1 transition-colors duration-150 disabled:opacity-40 hover:text-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50 focus-visible:ring-offset-2 focus-visible:ring-offset-main"
              aria-label="Previous intentions page"
            >
              <CaretLeft className="h-4 w-4" />
              Prev
            </button>
            <span className="px-2 text-[0.78rem] font-semibold text-amber-100/75">
              {page + 1} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPageIndex((prev) => Math.min(prev + 1, totalPages - 1))}
              disabled={page === totalPages - 1}
              className="flex items-center gap-1 rounded-full px-2 py-1 transition-colors duration-150 disabled:opacity-40 hover:text-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50 focus-visible:ring-offset-2 focus-visible:ring-offset-main"
              aria-label="Next intentions page"
            >
              Next
              <CaretRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      <p className="text-xs text-amber-100/70 mb-3 flex items-center gap-1">
        <JournalPlusCircleIcon className="w-4 h-4 text-amber-200/70" aria-hidden="true" /> From Guided Intention Coach
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visibleIntentions.map((item) => (
          <CoachSuggestion
            key={item.id}
            recommendation={item}
            variant="note"
            showTitle={false}
            onApply={() => handleUseIntention(item.question)}
            onDismiss={() => handleDelete(item.id)}
          />
        ))}
      </div>
    </div>
  );
}
