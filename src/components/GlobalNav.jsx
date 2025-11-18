import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sparkles, BookOpen } from 'lucide-react';

export function GlobalNav() {
  const location = useLocation();
  const navigate = useNavigate();

  const isJournal = location.pathname.startsWith('/journal');
  const isReading = !isJournal;

  const baseButtonClasses =
    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs-plus font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950';
  const activeClasses = 'bg-amber-500 text-slate-950 shadow shadow-amber-900/30';
  const inactiveClasses =
    'bg-slate-900/70 text-amber-100/80 hover:bg-slate-900/90';

  return (
    <nav aria-label="Primary" className="flex justify-center mb-3 animate-fade-in">
      <div className="inline-flex items-center gap-2 rounded-full bg-slate-950/80 border border-slate-800/70 px-2 py-1">
        <button
          type="button"
          onClick={() => navigate('/')}
          className={`${baseButtonClasses} ${isReading ? activeClasses : inactiveClasses}`}
          aria-current={isReading ? 'page' : undefined}
        >
          <Sparkles className="w-4 h-4" aria-hidden="true" />
          <span>Reading</span>
        </button>
        <button
          type="button"
          onClick={() => navigate('/journal')}
          className={`${baseButtonClasses} ${isJournal ? activeClasses : inactiveClasses}`}
          aria-current={isJournal ? 'page' : undefined}
        >
          <BookOpen className="w-4 h-4" aria-hidden="true" />
          <span>Journal</span>
        </button>
      </div>
    </nav>
  );
}
