import { memo, useState, useCallback } from 'react';
import { Flask, CaretRight, Spinner, TrendUp, TrendDown, Equals, Warning, ArrowClockwise } from '@phosphor-icons/react';

/**
 * ExperimentResults - A/B test comparison view
 *
 * @param {Object} props
 * @param {Array} props.experiments - Array of active experiments
 * @param {string} props.apiKey - Admin API key for fetching detailed results
 * @param {Function} [props.onLogout] - Callback when session expires (401)
 * @param {Function} [props.showToast] - Toast notification function
 */
export const ExperimentResults = memo(function ExperimentResults({
  experiments = [],
  apiKey,
  onLogout,
  showToast
}) {
  const [expandedId, setExpandedId] = useState(null);
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState({});
  const [errors, setErrors] = useState({});

  const fetchResults = useCallback(async (experimentId, forceRefresh = false) => {
    if (results[experimentId] && !forceRefresh) {
      // Already fetched, just toggle
      setExpandedId(expandedId === experimentId ? null : experimentId);
      return;
    }

    setLoading(prev => ({ ...prev, [experimentId]: true }));
    setErrors(prev => ({ ...prev, [experimentId]: null }));

    try {
      const response = await fetch('/api/admin/quality-stats', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'experiment-results',
          experimentId
        })
      });

      // Handle expired/invalid API key
      if (response.status === 401) {
        if (onLogout) onLogout();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch results');
      }

      setResults(prev => ({ ...prev, [experimentId]: data }));
      setExpandedId(experimentId);
    } catch (err) {
      const errorMsg = err.message || 'Failed to load experiment results';
      console.error('Failed to fetch experiment results:', err);
      setErrors(prev => ({ ...prev, [experimentId]: errorMsg }));
      setExpandedId(experimentId); // Keep expanded to show error
      if (showToast) {
        showToast({
          title: 'Failed to load results',
          description: errorMsg,
          type: 'error'
        });
      }
    } finally {
      setLoading(prev => ({ ...prev, [experimentId]: false }));
    }
  }, [apiKey, expandedId, results, onLogout, showToast]);

  if (!experiments || experiments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted">
        <Flask className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">No active experiments</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {experiments.map((exp) => {
        const isExpanded = expandedId === exp.experiment_id;
        const isLoading = loading[exp.experiment_id];
        const expResults = results[exp.experiment_id];
        const expError = errors[exp.experiment_id];

        return (
          <div
            key={exp.experiment_id}
            className="rounded-xl border border-secondary/30 bg-surface overflow-hidden"
          >
            {/* Experiment header */}
            <button
              onClick={() => fetchResults(exp.experiment_id)}
              className="w-full flex items-center justify-between p-4 hover:bg-secondary/10 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <Flask className="h-5 w-5 text-accent" weight="duotone" />
                <div>
                  <p className="font-medium text-main">{exp.name}</p>
                  <p className="text-xs text-muted">
                    {exp.readings_in_experiment?.toLocaleString() || 0} readings
                    &middot; {exp.traffic_percentage}% traffic
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  exp.status === 'running'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : exp.status === 'paused'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-secondary/30 text-muted'
                }`}>
                  {exp.status}
                </span>
                {isLoading ? (
                  <Spinner className="h-4 w-4 text-muted animate-spin" />
                ) : (
                  <CaretRight
                    className={`h-4 w-4 text-muted transition-transform ${
                      isExpanded ? 'rotate-90' : ''
                    }`}
                  />
                )}
              </div>
            </button>

            {/* Expanded results */}
            {isExpanded && (
              <div className="border-t border-secondary/20 p-4">
                {expError ? (
                  <div className="flex flex-col items-center justify-center py-4 text-center">
                    <Warning className="h-6 w-6 text-error mb-2" weight="duotone" />
                    <p className="text-sm text-error mb-2">{expError}</p>
                    <button
                      onClick={() => fetchResults(exp.experiment_id, true)}
                      disabled={isLoading}
                      className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 transition-colors disabled:opacity-50"
                    >
                      <ArrowClockwise className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                      Retry
                    </button>
                  </div>
                ) : expResults?.results && expResults.results.length > 0 ? (
                  <VariantComparison
                    results={expResults.results}
                    control={exp.control_variant}
                  />
                ) : (
                  <p className="text-sm text-muted text-center py-4">
                    No results available yet
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

/**
 * VariantComparison - Compare variant performance
 */
function VariantComparison({ results, control }) {
  if (!results || results.length === 0) return null;

  // Find control stats for comparison - prefer exact match, then fallback to null variant
  const controlData = results.find(r => r.variant_id === control) ||
                      results.find(r => r.variant_id === null);
  const controlScore = controlData?.avg_overall;

  return (
    <div className="space-y-3">
      {results.map((variant) => {
        const isControl = variant.variant_id === control || variant.variant_id === null;
        // Check for null/undefined explicitly - 0 is a valid score
        const delta = (variant.avg_overall !== null && variant.avg_overall !== undefined &&
                       controlScore !== null && controlScore !== undefined)
          ? variant.avg_overall - controlScore
          : null;

        return (
          <div
            key={variant.variant_id || 'control'}
            className={`rounded-lg p-3 ${
              isControl ? 'bg-secondary/20' : 'bg-secondary/10'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-main">
                  {variant.variant_id || control || 'control'}
                </span>
                {isControl && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-accent/20 text-accent">
                    control
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-muted">Score</p>
                  <p className={`font-semibold ${
                    variant.avg_overall >= 4
                      ? 'text-emerald-400'
                      : variant.avg_overall >= 3
                        ? 'text-amber-400'
                        : 'text-error'
                  }`}>
                    {variant.avg_overall?.toFixed(2) || '--'}
                  </p>
                </div>
                {!isControl && delta !== null && (
                  <div className="text-right">
                    <p className="text-xs text-muted">vs Control</p>
                    <div className="flex items-center gap-1">
                      {delta > 0.15 ? (
                        <TrendUp className="h-3.5 w-3.5 text-emerald-400" />
                      ) : delta < -0.15 ? (
                        <TrendDown className="h-3.5 w-3.5 text-error" />
                      ) : (
                        <Equals className="h-3.5 w-3.5 text-muted" />
                      )}
                      <span className={
                        delta > 0.15
                          ? 'text-emerald-400'
                          : delta < -0.15
                            ? 'text-error'
                            : 'text-muted'
                      }>
                        {delta >= 0 ? '+' : ''}{delta.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
                <div className="text-right">
                  <p className="text-xs text-muted">Readings</p>
                  <p className="text-muted">
                    {variant.total_readings?.toLocaleString() || 0}
                  </p>
                </div>
              </div>
            </div>

            {/* Statistical hint */}
            {!isControl && delta !== null && variant.total_readings >= 50 && (
              <div className="mt-2 pt-2 border-t border-secondary/20">
                <p className="text-xs text-muted">
                  {Math.abs(delta) >= 0.3 ? (
                    <span className={delta > 0 ? 'text-emerald-400' : 'text-error'}>
                      Significant difference detected (|Δ| ≥ 0.3)
                    </span>
                  ) : Math.abs(delta) >= 0.15 ? (
                    <span className="text-amber-300">
                      Moderate difference (0.15 ≤ |Δ| &lt; 0.3) - may need more data
                    </span>
                  ) : (
                    <span>
                      Small difference (|Δ| &lt; 0.15) - variants performing similarly
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default ExperimentResults;
