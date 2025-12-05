import { useState, useEffect } from 'react';
import { Trash, ClockCounterClockwise, ArrowRight, Sparkle, CaretLeft, CaretRight } from '@phosphor-icons/react';
import {
  loadCoachHistory,
  deleteCoachHistoryItem,
  COACH_STORAGE_SYNC_EVENT,
  HISTORY_STORAGE_KEY
} from '../lib/coachStorage';
import { useNavigate } from 'react-router-dom';

const NOTE_VARIANTS = [
  {
    background: 'linear-gradient(140deg, #f5efdf 0%, #e7dcc5 100%)',
    tape: '#d9ccad',
    rotation: '-rotate-[2.1deg]',
    lift: '-translate-y-[2px]'
  },
  {
    background: 'linear-gradient(140deg, #f3ead6 0%, #e4d5bb 100%)',
    tape: '#d5c4a3',
    rotation: 'rotate-[1.4deg]',
    lift: 'translate-y-[1px]'
  },
  {
    background: 'linear-gradient(140deg, #f2e8d2 0%, #deceb2 100%)',
    tape: '#d1c19e',
    rotation: '-rotate-[0.8deg]',
    lift: 'translate-y-[3px]'
  }
];
const PAGE_SIZE = 6;

export function SavedIntentionsList() {
  const [intentions, setIntentions] = useState(() => loadCoachHistory());
  const [page, setPage] = useState(0);
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

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(intentions.length / PAGE_SIZE) - 1);
    setPage((prev) => Math.min(prev, maxPage));
  }, [intentions]);

  const handleDelete = (id) => {
    const result = deleteCoachHistoryItem(id);
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
      <div className="mb-1 flex items-center justify-between text-accent">
        <div className="flex items-center gap-2">
          <ClockCounterClockwise className="w-5 h-5" />
          <h2 className="text-xl font-serif">Saved Intentions</h2>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-1 text-[0.78rem] text-muted">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
              disabled={page === 0}
              className="flex items-center gap-1 rounded-full px-2 py-1 transition-colors duration-150 disabled:opacity-40 hover:text-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(245,239,223,0.9)]"
              aria-label="Previous intentions page"
            >
              <CaretLeft className="h-4 w-4" />
              Prev
            </button>
            <span className="px-2 text-[0.78rem] font-semibold text-charcoal/70">
              {page + 1} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(prev + 1, totalPages - 1))}
              disabled={page === totalPages - 1}
              className="flex items-center gap-1 rounded-full px-2 py-1 transition-colors duration-150 disabled:opacity-40 hover:text-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(245,239,223,0.9)]"
              aria-label="Next intentions page"
            >
              Next
              <CaretRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      <p className="text-xs text-muted mb-3 flex items-center gap-1">
        <Sparkle className="w-4 h-4" aria-hidden="true" /> From Guided Intention Coach
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visibleIntentions.map((item, index) => {
          const variant = NOTE_VARIANTS[(page * PAGE_SIZE + index) % NOTE_VARIANTS.length];

          return (
            <button
              key={item.id}
              type="button"
              className={`group relative w-full overflow-hidden rounded-[18px] px-4 pb-7 pt-9 text-left shadow-[0_16px_30px_rgba(0,0,0,0.28)] ring-1 ring-[rgba(0,0,0,0.06)] transition-all duration-200 ease-out hover:-translate-y-[10px] hover:shadow-[0_24px_40px_rgba(0,0,0,0.38)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(177,150,114,0.82)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(245,239,223,0.9)] ${variant.rotation} ${variant.lift || ''}`}
              style={{ background: variant.background }}
              onClick={() => handleUseIntention(item.question)}
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-2 z-20 h-2 w-16 -translate-x-1/2 rotate-[1deg] rounded-sm opacity-80 shadow-[0_6px_12px_rgba(0,0,0,0.25)] mix-blend-screen"
                style={{ background: variant.tape }}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_18%_16%,rgba(255,255,255,0.22),transparent_30%),radial-gradient(circle_at_82%_6%,rgba(255,255,255,0.18),transparent_24%),repeating-linear-gradient(0deg,rgba(0,0,0,0.045),rgba(0,0,0,0.045)_1px,transparent_3px,transparent_8px)] opacity-60 mix-blend-multiply"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-10 bg-gradient-to-t from-[rgba(0,0,0,0.08)] via-transparent to-transparent opacity-70 mix-blend-multiply"
              />

              <div className="relative z-10 space-y-2">
                <div className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.18em] text-slate-mid font-semibold drop-shadow-sm">
                  <Sparkle className="w-3.5 h-3.5 text-primary/80" aria-hidden="true" /> Guided coach
                </div>

                <p className="pr-8 text-[0.98rem] font-semibold leading-[1.65] text-charcoal/90 line-clamp-3">
                  {item.question}
                </p>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[0.72rem] font-semibold text-slate-mid">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1 text-[0.78rem] font-semibold text-charcoal/70 opacity-0 transition-opacity group-hover:opacity-100">
                    Use this <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(item.id);
                }}
                className="absolute top-3 right-3 z-30 rounded-full bg-black/0 p-1.5 text-charcoal/60 transition-all duration-150 hover:bg-black/5 hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(255,247,209,0.9)]"
                title="Delete intention"
                aria-label="Delete intention"
              >
                <Trash className="w-4 h-4" />
              </button>
            </button>
          );
        })}
      </div>
    </div>
  );
}
