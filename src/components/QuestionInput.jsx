import React, { useId, useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { EXAMPLE_QUESTIONS } from '../data/exampleQuestions';

export function QuestionInput({
  userQuestion,
  setUserQuestion,
  placeholderIndex,
  onFocus,
  onBlur,
  onPlaceholderRefresh,
  onLaunchCoach
}) {
  const helperId = useId();
  const optionalId = useId();
  const [savedNotice, setSavedNotice] = useState(false);

  const handleRefreshExamples = () => {
    onPlaceholderRefresh?.();
  };

  const handleSaveIntention = () => {
    if (!userQuestion.trim()) return;
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 1800);
  };

  const handleLaunchCoach = () => {
    if (typeof onLaunchCoach === 'function') {
      onLaunchCoach();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-amber-200 font-serif text-sm sm:text-base">
          <label htmlFor="question-input">
            Step 2 · Your question or intention <span className="text-amber-300/80 text-xs font-normal">(optional)</span>
          </label>
        </div>
        {typeof onLaunchCoach === 'function' && (
          <button
            type="button"
            onClick={handleLaunchCoach}
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/50 px-3 py-1.5 text-xs text-emerald-100 transition hover:bg-emerald-500/10"
            title="Shortcut: Shift+G"
            aria-label="Open guided coach (Shift+G)"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Guided coach
          </button>
        )}
        <span id={optionalId} className="sr-only">
          Optional field
        </span>
      </div>
      <div className="relative">
        <input
          id="question-input"
          type="text"
          value={userQuestion}
          onChange={event => setUserQuestion(event.target.value)}
          placeholder={EXAMPLE_QUESTIONS[placeholderIndex]}
          className="w-full bg-slate-950/80 border border-emerald-400/40 rounded-lg px-4 py-3 pr-12 text-amber-100 placeholder-emerald-200/35 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/70 transition-all"
          onFocus={onFocus}
          onBlur={onBlur}
          aria-describedby={`${optionalId} ${helperId}`.trim()}
        />
        <button
          type="button"
          onClick={handleRefreshExamples}
          className="absolute inset-y-0 right-3 flex items-center justify-center text-emerald-200/70 hover:text-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 rounded-full"
          aria-label="Cycle example intention prompts"
        >
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
      <p id={helperId} className="text-amber-100/80 text-xs flex items-center gap-2">
        <RefreshCw className="w-3.5 h-3.5 text-emerald-300" aria-hidden="true" />
        Need inspiration? Tap the refresh icon to cycle example questions.
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="px-3 py-1.5 rounded-lg border border-emerald-400/40 text-xs text-emerald-100 hover:bg-emerald-500/10 transition disabled:opacity-50"
          onClick={handleSaveIntention}
          disabled={!userQuestion.trim()}
        >
          Save intention
        </button>
        {savedNotice && <span className="text-emerald-300 text-xs">Saved ✓</span>}
      </div>
    </div>
  );
}
