import React, { useId, useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { EXAMPLE_QUESTIONS } from '../data/exampleQuestions';
import { recordCoachQuestion } from '../lib/coachStorage';

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
  const [saveError, setSaveError] = useState('');

  const handleRefreshExamples = () => {
    onPlaceholderRefresh?.();
  };

  const handleSaveIntention = () => {
    const trimmed = userQuestion.trim();
    if (!trimmed) return;
    const result = recordCoachQuestion(trimmed);
    if (result.success) {
      setSavedNotice(true);
      setSaveError('');
      setTimeout(() => setSavedNotice(false), 1800);
    } else {
      setSavedNotice(false);
      setSaveError(result.error || 'Unable to save this question. Check browser storage settings.');
      setTimeout(() => setSaveError(''), 3000);
    }
  };

  const handleLaunchCoach = () => {
    if (typeof onLaunchCoach === 'function') {
      onLaunchCoach();
    }
  };

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-accent font-serif text-sm sm:text-base">
          <label htmlFor="question-input">
            Step 2 · Your question or intention <span className="text-muted text-xs font-normal">(optional)</span>
          </label>
        </div>
        {typeof onLaunchCoach === 'function' && (
          <button
            type="button"
            onClick={handleLaunchCoach}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/50 px-3 py-1.5 text-xs text-main transition hover:bg-primary/10"
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
          className="w-full bg-surface border border-primary/40 rounded-lg px-4 py-3 pr-12 text-main placeholder-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/70 transition-all"
          onFocus={onFocus}
          onBlur={onBlur}
          aria-describedby={`${optionalId} ${helperId}`.trim()}
        />
        <button
          type="button"
          onClick={handleRefreshExamples}
          className="absolute inset-y-0 right-3 flex items-center justify-center text-muted hover:text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded-full"
          aria-label="Cycle example intention prompts"
        >
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
      <p id={helperId} className="text-muted text-xs flex items-center gap-2">
        <RefreshCw className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
        Need inspiration? Tap the refresh icon to cycle example questions.
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="px-3 py-1.5 rounded-lg border border-primary/40 text-xs text-main hover:bg-primary/10 transition disabled:opacity-50"
          onClick={handleSaveIntention}
          disabled={!userQuestion.trim()}
        >
          Save intention
        </button>
        {savedNotice && <span className="text-primary text-xs">Saved ✓</span>}
        {saveError && <span className="text-error text-xs">{saveError}</span>}
      </div>
    </div>
  );
}
