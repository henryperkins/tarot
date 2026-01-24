import { useReducer, useMemo, useId, useState } from 'react';
import { CaretDown } from '@phosphor-icons/react';

const RATING_FIELDS = [
  {
    key: 'overallAccuracy',
    label: 'Accuracy',
    helper: 'Did it match the cards?'
  },
  {
    key: 'narrativeCoherence',
    label: 'Coherence',
    helper: 'Did it flow naturally?'
  },
  {
    key: 'practicalValue',
    label: 'Actionability',
    helper: 'Can you use this?'
  }
];

const SCALE = [1, 2, 3, 4, 5];
const SCALE_LABELS = ['Poor', 'Fair', 'Good', 'Great', 'Excellent'];

// Use reducer for cleaner state management
const initialState = {
  ratings: {
    overallAccuracy: 0,
    narrativeCoherence: 0,
    practicalValue: 0
  },
  notes: '',
  status: 'idle', // 'idle' | 'submitting' | 'success' | 'error'
  error: null
};

function feedbackReducer(state, action) {
  switch (action.type) {
    case 'SET_RATING':
      return {
        ...state,
        ratings: { ...state.ratings, [action.key]: action.value }
      };
    case 'SET_NOTES':
      return { ...state, notes: action.value };
    case 'SUBMIT_START':
      return { ...state, status: 'submitting', error: null };
    case 'SUBMIT_SUCCESS':
      return { ...state, status: 'success' };
    case 'SUBMIT_ERROR':
      return { ...state, status: 'error', error: action.error };
    default:
      return state;
  }
}

export function FeedbackPanel({
  requestId,
  spreadKey,
  spreadName,
  deckStyle,
  provider,
  userQuestion,
  cards,
  visionSummary
}) {
  const [state, dispatch] = useReducer(feedbackReducer, initialState);
  const { ratings, notes, status, error } = state;
  const statusId = useId();
  const errorId = useId();
  const panelId = useId();
  const [isCollapsed, setIsCollapsed] = useState(true);

  const hasSubmitted = status === 'success';
  const isSubmitting = status === 'submitting';

  const canSubmit = useMemo(
    () =>
      requestId &&
      Object.values(ratings).every((value) => Number(value) >= 1) &&
      !isSubmitting,
    [ratings, requestId, isSubmitting]
  );

  if (!requestId) return null;

  const handleRating = (key, value) => {
    dispatch({ type: 'SET_RATING', key, value });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;

    dispatch({ type: 'SUBMIT_START' });

    try {
      const payload = {
        requestId,
        spreadKey,
        spreadName,
        deckStyle,
        provider,
        userQuestion,
        ratings,
        notes: notes.trim() || null,
        cards,
        visionSummary
      };
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error('Unable to save feedback.');
      }
      dispatch({ type: 'SUBMIT_SUCCESS' });
    } catch (err) {
      dispatch({ type: 'SUBMIT_ERROR', error: err.message || 'Unable to save feedback.' });
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="modern-surface border border-secondary/30 w-full px-3 py-3 xs:px-4 xs:py-4 sm:px-5 sm:py-5 animate-fade-in"
      aria-describedby={error ? errorId : undefined}
    >
      <button
        type="button"
        onClick={() => setIsCollapsed((prev) => !prev)}
        aria-expanded={!isCollapsed}
        aria-controls={panelId}
        className="w-full flex items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 hover:border-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      >
        <div className="min-w-0 text-left">
          <p className="text-sm font-semibold text-main">How did this reading land?</p>
          <p className="text-xs text-muted">
            Share quick ratings to tune quality.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasSubmitted && (
            <span
              className="text-xs font-semibold text-secondary px-2 py-1 rounded-full bg-secondary/10"
              role="status"
              aria-live="polite"
            >
              Thank you
            </span>
          )}
          <span className={`w-8 h-8 rounded-full border flex items-center justify-center transition-transform ${isCollapsed ? '' : 'rotate-180'}`} aria-hidden="true">
            <CaretDown className="w-4 h-4 text-muted" weight="bold" />
          </span>
        </div>
      </button>

      {!isCollapsed && (
        <div id={panelId} className="mt-3 xs:mt-4 space-y-3 xs:space-y-4">
          {RATING_FIELDS.map((field) => {
            const groupId = `rating-group-${field.key}`;
            return (
              <fieldset key={field.key} className="border-none p-0 m-0">
                <legend id={groupId} className="text-xs text-main/90 mb-2">
                  <span className="font-medium">{field.label}</span>
                  <span className="text-muted"> · {field.helper}</span>
                </legend>
                <div
                  role="radiogroup"
                  aria-labelledby={groupId}
                  className="flex flex-wrap gap-1.5 xs:gap-2"
                >
                  {SCALE.map((value, index) => {
                    const isSelected = ratings[field.key] === value;
                    return (
                      <button
                        type="button"
                        key={`${field.key}-${value}`}
                        role="radio"
                        aria-checked={isSelected}
                        aria-label={`${value} out of 5, ${SCALE_LABELS[index]}`}
                        onClick={() => handleRating(field.key, value)}
                        disabled={hasSubmitted}
                        className={`min-h-touch min-w-touch px-2.5 xs:px-3 py-2 rounded-full border text-sm font-medium transition-colors touch-manipulation
                          focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/70 focus-visible:ring-offset-2
                          ${isSelected
                            ? 'border-secondary/70 bg-secondary/20 text-secondary'
                            : 'border-accent/30 bg-surface-muted/70 text-muted hover:border-accent/60 hover:bg-surface-muted active:bg-surface-muted/90'
                          }
                          ${hasSubmitted ? 'cursor-not-allowed opacity-60' : ''}
                        `}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}

          <div className="mt-2">
            <label htmlFor="feedback-notes" className="block text-xs text-muted mb-1">
              Additional notes (optional)
            </label>
            <textarea
              id="feedback-notes"
              value={notes}
              onChange={(event) => dispatch({ type: 'SET_NOTES', value: event.target.value })}
              rows={3}
              maxLength={750}
              disabled={hasSubmitted}
              className="w-full rounded-lg border border-accent/20 bg-surface/70 p-3 text-sm text-main placeholder:text-muted/60 focus:border-secondary/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/70 disabled:opacity-60 disabled:cursor-not-allowed"
              placeholder="What resonated or felt off?"
            />
            <p className="mt-1 text-xs text-muted/70 text-right">
              {notes.length} / 750
            </p>
          </div>

          {/* Status announcements for screen readers */}
          <div
            id={statusId}
            role="status"
            aria-live="polite"
            className="sr-only"
          >
            {isSubmitting && 'Submitting feedback...'}
            {hasSubmitted && 'Feedback submitted successfully.'}
          </div>

          {error && (
            <p id={errorId} className="text-xs text-error" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-4 pt-2">
            <button
              type="submit"
              disabled={!canSubmit || hasSubmitted}
              className="min-h-touch px-5 py-2.5 rounded-full border border-secondary/40 bg-secondary/20 text-sm font-medium text-secondary transition-colors touch-manipulation
                hover:bg-secondary/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/70 focus-visible:ring-offset-2
                disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-secondary/20"
            >
              {isSubmitting ? 'Sending…' : hasSubmitted ? 'Feedback saved' : 'Submit feedback'}
            </button>

            {/* Vision metrics - only shown when available, with clearer labels */}
            {(visionSummary?.avgConfidence > 0 || typeof visionSummary?.avgSymbolMatch === 'number') && (
              <div className="text-xs text-muted/80 text-right" aria-label="Reading quality metrics">
                {visionSummary?.avgConfidence > 0 && (
                  <p title="How confident the system was in identifying the cards">
                    Recognition: {(visionSummary.avgConfidence * 100).toFixed(0)}%
                  </p>
                )}
                {typeof visionSummary?.avgSymbolMatch === 'number' && visionSummary.avgSymbolMatch > 0 && (
                  <p title="How well the symbols matched the interpretation">
                    Symbol accuracy: {(visionSummary.avgSymbolMatch * 100).toFixed(0)}%
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </form>
  );
}
