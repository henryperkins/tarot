import { useMemo, useState } from 'react';

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
  const [ratings, setRatings] = useState({
    overallAccuracy: 0,
    narrativeCoherence: 0,
    practicalValue: 0
  });
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const canSubmit = useMemo(
    () =>
      requestId &&
      Object.values(ratings).every((value) => Number(value) >= 1) &&
      status !== 'submitting',
    [ratings, requestId, status]
  );

  if (!requestId) return null;

  const handleRating = (key, value) => {
    setRatings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    setStatus('submitting');
    setError(null);
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
      setHasSubmitted(true);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setError(err.message || 'Unable to save feedback.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="modern-surface border border-secondary/30 w-full px-4 py-4 sm:px-5 sm:py-5 animate-fade-in">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-main">How did this reading land?</p>
          <p className="text-xs text-muted">
            Private ratings help tune quality.
          </p>
        </div>
        {hasSubmitted && (
          <span className="text-xs font-semibold text-secondary">Thank you ✦</span>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {RATING_FIELDS.map((field) => (
          <div key={field.key}>
            <p className="text-xs text-main/90 mb-1.5">
              <span className="font-medium">{field.label}</span>
              <span className="text-muted"> · {field.helper}</span>
            </p>
            <div className="inline-flex flex-wrap gap-2">
              {SCALE.map((value) => (
                <button
                  type="button"
                  key={`${field.key}-${value}`}
                  onClick={() => handleRating(field.key, value)}
                  className={`px-3 py-1.5 rounded-full border transition text-xs ${ratings[field.key] === value
                      ? 'border-secondary/70 bg-secondary/20 text-secondary'
                      : 'border-accent/30 bg-surface-muted/70 text-muted hover:border-accent/60'
                    }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <label className="block mt-4">
        <span className="text-xs text-muted">Additional notes (optional)</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          maxLength={750}
          className="mt-1 w-full rounded-lg border border-accent/20 bg-surface/70 p-2 text-sm text-main focus:border-secondary/60 focus:outline-none"
          placeholder="What resonated or felt off?"
        />
      </label>

      {error && (
        <p className="mt-2 text-xs text-error" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between">
        <button
          type="submit"
          disabled={!canSubmit || hasSubmitted}
          className="px-4 py-2 rounded-full border border-secondary/40 bg-secondary/20 text-sm text-secondary transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {status === 'submitting' ? 'Sending…' : hasSubmitted ? 'Feedback saved' : 'Submit feedback'}
        </button>
        <div className="text-[11px] text-muted text-right">
          {visionSummary?.avgConfidence && (
            <p>
              Vision avg confidence:
              {' '}
              {(visionSummary.avgConfidence * 100).toFixed(1)}%
            </p>
          )}
          {typeof visionSummary?.avgSymbolMatch === 'number' && (
            <p>
              Symbol match rate:
              {' '}
              {(visionSummary.avgSymbolMatch * 100).toFixed(1)}%
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
