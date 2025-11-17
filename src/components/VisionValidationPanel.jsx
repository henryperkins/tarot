import React from 'react';
import { useVisionValidation } from '../hooks/useVisionValidation';
import { VisionHeatmapOverlay } from './VisionHeatmapOverlay';

export function VisionValidationPanel({
  deckStyle = 'rws-1909',
  onResults,
  onRemoveResult,
  onClearResults,
  conflicts = [],
  results = []
}) {
  const { status, error, validateFiles } = useVisionValidation({ deckStyle });
  const uploadLimitReached = results.length >= 5;

  const handleChange = async (event) => {
    const inputEl = event.target;
    const files = inputEl?.files;
    if (!files || files.length === 0) {
      if (inputEl) inputEl.value = '';
      return;
    }

    try {
      const analyses = await validateFiles(files);
      if (analyses.length) {
        onResults?.(analyses);
      }
    } finally {
      if (inputEl) inputEl.value = '';
    }
  };

  return (
    <div className="modern-surface border border-amber-400/30 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-amber-100 font-semibold">Vision Validation (Beta)</p>
          <p className="text-xs text-amber-200/70">
            Upload up to five photos of your drawn cards so the deck can confirm what you pulled before unlocking the AI reading. Validation is required to continue.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-emerald-200">
          {results.length > 0 && (
            <button
              type="button"
              onClick={() => onClearResults?.()}
              className="px-3 py-2 rounded-md border border-amber-400/30 text-amber-100/90 hover:border-amber-300/60"
            >
              Clear uploads
            </button>
          )}
          <label className={`inline-flex items-center gap-2 ${uploadLimitReached ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer' }`}>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleChange}
              className="hidden"
              disabled={uploadLimitReached}
            />
            <span className="px-3 py-2 rounded-md border border-emerald-400/40">
              {uploadLimitReached
                ? 'Limit reached'
                : status === 'loading'
                  ? 'Analyzing…'
                  : 'Upload photos'}
            </span>
          </label>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
      {conflicts.length > 0 && (
        <div className="mt-3 rounded border border-rose-400/40 bg-rose-900/20 p-3 text-xs text-rose-50">
          <p className="font-semibold">Card mismatch detected</p>
          <p>Please confirm the following cards before generating a reading:</p>
          <ul className="mt-1 list-disc list-inside">
            {conflicts.map((conflict) => (
              <li key={conflict.label || conflict.imagePath}>
                {conflict.label || 'Uploaded image'} was recognized as <strong>{conflict.topMatch?.cardName || 'unknown'}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
      {results.length > 0 && (
        <div className="mt-4 space-y-3">
          {results.map((result) => (
            <div key={result.label} className="rounded border border-emerald-400/20 p-3">
              <div className="flex items-center justify-between text-sm text-emerald-100">
                <span>{result.label || 'Uploaded image'}</span>
                <div className="flex items-center gap-3">
                  <span>
                    Confidence:
                    {' '}
                    {typeof result.confidence === 'number'
                      ? `${(result.confidence * 100).toFixed(1)}%`
                      : 'n/a'}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveResult?.(result.label)}
                    className="text-xs text-rose-200/80 hover:text-rose-100"
                  >
                    Remove
                  </button>
                </div>
              </div>
              {Array.isArray(result.matches) && result.matches.length > 0 && (
                <ul className="mt-2 text-xs text-emerald-50/80">
                  {result.matches.map((match) => (
                    <li key={`${result.label}-${match.cardName}`}>
                      {match.cardName}
                      {' '}
                      ·
                      {' '}
                      {typeof match.score === 'number' ? `${(match.score * 100).toFixed(1)}%` : 'n/a'}
                    </li>
                  ))}
                </ul>
              )}
              {result.attention?.focusRegions?.length > 0 && (
                <div className="mt-2 text-[11px] text-emerald-100/70">
                  <p className="font-semibold">Model focus</p>
                  <p className="mb-1">Highlight patches where CLIP paid the most attention.</p>
                  <div className="flex flex-wrap gap-2">
                    {result.attention.focusRegions.slice(0, 4).map((region, idx) => (
                      <span
                        key={`${result.label}-region-${idx}`}
                        className="px-2 py-1 rounded-full border border-emerald-400/30"
                      >
                        ({region.x}, {region.y}) · {(region.intensity * 100).toFixed(0)}%
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <VisionHeatmapOverlay
                attention={result.attention}
                imageSrc={result.dataUrl || result.imagePath}
                label={result.label}
              />
              {Array.isArray(result.attention?.symbolAlignment) && result.attention.symbolAlignment.length > 0 && (
                <div className="mt-2 text-[11px] text-emerald-100/70">
                  <p className="font-semibold">Symbol alignment</p>
                  <ul className="list-disc list-inside space-y-1">
                    {result.attention.symbolAlignment.slice(0, 3).map((symbol) => (
                      <li key={`${result.label}-${symbol.object}`}>
                        {symbol.object}
                        {' '}
                        · focus {(symbol.attentionScore * 100).toFixed(0)}%
                        {' '}
                        {symbol.isModelFocused ? '✅' : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.symbolVerification && (
                <div className="mt-2 text-[11px] text-emerald-100/70">
                  <p className="font-semibold">Symbol verification</p>
                  <p>
                    Match rate:
                    {' '}
                    {typeof result.symbolVerification.matchRate === 'number'
                      ? `${(result.symbolVerification.matchRate * 100).toFixed(0)}%`
                      : 'n/a'}
                  </p>
                  {Array.isArray(result.symbolVerification.missingSymbols) && result.symbolVerification.missingSymbols.length > 0 && (
                    <p className="mt-1 text-rose-100/80">
                      Missing:
                      {' '}
                      {result.symbolVerification.missingSymbols.join(', ')}
                    </p>
                  )}
                  {Array.isArray(result.symbolVerification.unexpectedDetections) && result.symbolVerification.unexpectedDetections.length > 0 && (
                    <p className="mt-1 text-amber-100/70">
                      Extra objects:
                      {' '}
                      {result.symbolVerification.unexpectedDetections.map((det) => det.label).join(', ')}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
