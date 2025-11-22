import { useState, useEffect } from 'react';
import { Trash, ClockCounterClockwise, ArrowRight } from '@phosphor-icons/react';
import { loadCoachHistory, deleteCoachHistoryItem } from '../lib/coachStorage';
import { useNavigate } from 'react-router-dom';

export function SavedIntentionsList() {
  const [intentions, setIntentions] = useState(() => loadCoachHistory());
  const navigate = useNavigate();

  useEffect(() => {
    // Listen for storage changes (in case added from another tab/component)
    const handleStorage = (e) => {
      if (e.key === 'tarot_coach_history') {
        setIntentions(loadCoachHistory());
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
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
      <div className="flex items-center gap-2 mb-4 text-accent">
        <ClockCounterClockwise className="w-5 h-5" />
        <h2 className="text-xl font-serif">Saved Intentions</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {intentions.map((item) => (
          <div
            key={item.id}
            className="group relative p-4 bg-surface/50 border border-primary/20 rounded-lg hover:border-primary/40 transition-all cursor-pointer hover:bg-surface"
            onClick={() => handleUseIntention(item.question)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleUseIntention(item.question);
              }
            }}
          >
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
          </div>
        ))}
      </div>
    </div>
  );
}
