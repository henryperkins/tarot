import { useState, useEffect } from 'react';
import { Trash, ClockCounterClockwise, ArrowRight, Sparkle } from '@phosphor-icons/react';
import {
  loadCoachHistory,
  deleteCoachHistoryItem,
  COACH_STORAGE_SYNC_EVENT,
  HISTORY_STORAGE_KEY
} from '../lib/coachStorage';
import { useNavigate } from 'react-router-dom';

export function SavedIntentionsList() {
  const [intentions, setIntentions] = useState(() => loadCoachHistory());
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const relevantKeys = new Set([HISTORY_STORAGE_KEY]);
    const refreshHistory = () => setIntentions(loadCoachHistory());

    const handleStorage = (event) => {
      if (!event.key || relevantKeys.has(event.key)) {
        refreshHistory();
      }
    };

    const handleCoachSync = (event) => {
      const detailKey = event?.detail?.key;
      if (!detailKey || relevantKeys.has(detailKey)) {
        refreshHistory();
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(COACH_STORAGE_SYNC_EVENT, handleCoachSync);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(COACH_STORAGE_SYNC_EVENT, handleCoachSync);
    };
  }, []);

  const handleDelete = (id) => {
    const result = deleteCoachHistoryItem(id);
    if (result.success) {
      setIntentions(result.history);
    }
  };

  const handleUseIntention = (question) => {
    navigate('/', { state: { initialQuestion: question } });
  };

  if (intentions.length === 0) {
    return null; // Don't show section if empty
  }

  return (
    <div className="mb-8 animate-fade-in">
      <div className="flex items-center gap-2 mb-1 text-accent">
        <ClockCounterClockwise className="w-5 h-5" />
        <h2 className="text-xl font-serif">Saved Intentions</h2>
      </div>
      <p className="text-xs text-muted mb-3 flex items-center gap-1">
        <Sparkle className="w-4 h-4" aria-hidden="true" /> From Guided Intention Coach
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {intentions.map((item) => (
          <button
            key={item.id}
            type="button"
            className="group relative p-4 bg-surface/50 border border-primary/20 rounded-lg hover:border-primary/40 transition-all hover:bg-surface text-left w-full"
            onClick={() => handleUseIntention(item.question)}
          >
            <div className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.12em] text-secondary/80 mb-2">
              <Sparkle className="w-3.5 h-3.5" aria-hidden="true" /> Guided coach
            </div>

            <p className="text-main pr-8 font-medium line-clamp-3">
              {item.question}
            </p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-muted">
                {new Date(item.createdAt).toLocaleDateString()}
              </span>
              <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                Use this <ArrowRight className="w-3 h-3" />
              </span>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(item.id);
              }}
              className="absolute top-3 right-3 p-1.5 text-muted hover:text-error hover:bg-error/10 rounded-full transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
              title="Delete intention"
              aria-label="Delete intention"
            >
              <Trash className="w-4 h-4" />
            </button>
          </button>
        ))}
      </div>
    </div>
  );
}
