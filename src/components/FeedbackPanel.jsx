import React, { useMemo, useState } from 'react';

const RATING_FIELDS = [
  {
    key: 'overallAccuracy',
    label: 'How accurate was the interpretation?',
    helper: 'Did the narrative match what you pulled?'
  },
  {
    key: 'narrativeCoherence',
    label: 'How coherent was the story arc?',
    helper: 'Did the reading flow and feel grounded?'
  },
  {
    key: 'practicalValue',
    label: 'How actionable was the guidance?',
    helper: 'Will you take something tangible away?'
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
    <form onSubmit={handleSubmit} className="modern-surface border border-emerald-400/30 w-full px-4 py-4 sm:px-5 sm:py-5 animate-fade-in">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-amber-100">How did this reading land?</p>
          <p className="text-xs text-amber-100/70">
            Your ratings stay private and help tune accuracy + narrative quality.
          </p>
        </div>
        {hasSubmitted && (
          <span className="text-xs font-semibold text-emerald-300">Thank you ✦</span>
        )}
      </div>

      <div className="mt-4 space-y-4">
        {RATING_FIELDS.map((field) => (
          <div key={field.key}>
            <p className="text-sm text-amber-50/90 font-medium">{field.label}</p>
            <p className="text-xs text-amber-100/60 mb-1">{field.helper}</p>
            <div className="inline-flex flex-wrap gap-2">
              {SCALE.map((value) => (
                <button
                  type="button"
                  key={`${field.key}-${value}`}
                  onClick={() => handleRating(field.key, value)}
                  className={`px-3 py-1.5 rounded-full border transition text-xs ${ratings[field.key] === value
                      ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-100'
                      : 'border-amber-300/30 bg-slate-900/70 text-amber-100/70 hover:border-amber-200/60'
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
        <span className="text-xs text-amber-100/70">Anything else you want to share?</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          maxLength={750}
          className="mt-1 w-full rounded-lg border border-amber-400/20 bg-slate-950/70 p-2 text-sm text-amber-50 focus:border-emerald-400/60 focus:outline-none"
          placeholder="Optional. This helps us understand what resonated."
        />
      </label>

      {error && (
        <p className="mt-2 text-xs text-rose-300" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between">
        <button
          type="submit"
          disabled={!canSubmit || hasSubmitted}
          className="px-4 py-2 rounded-full border border-emerald-400/40 bg-emerald-500/20 text-sm text-emerald-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {status === 'submitting' ? 'Sending…' : hasSubmitted ? 'Feedback saved' : 'Submit feedback'}
        </button>
        <div className="text-[11px] text-amber-100/60 text-right">
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
