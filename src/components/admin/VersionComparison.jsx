import { memo, useMemo } from 'react';
import { GitBranch, TrendUp, TrendDown, Minus } from '@phosphor-icons/react';

/**
 * VersionComparison - Table showing performance by reading prompt version
 *
 * @param {Object} props
 * @param {Array} props.stats - Raw stats array from API
 */
export const VersionComparison = memo(function VersionComparison({ stats = [] }) {
  // Group stats by reading_prompt_version
  const versionData = useMemo(() => {
    if (!stats || stats.length === 0) return [];

    const grouped = stats.reduce((acc, s) => {
      const version = s.reading_prompt_version || 'unknown';
      if (!acc[version]) {
        acc[version] = {
          version,
          readings: 0,
          overallSum: 0,
          overallCount: 0,
          safetyFlags: 0,
          deltaSum: 0,
          deltaCount: 0
        };
      }

      const weight = s.reading_count || 0;
      acc[version].readings += weight;
      acc[version].safetyFlags += s.safety_flag_count || 0;

      // Only include in weighted average if there are actual readings
      if (s.avg_overall !== null && weight > 0) {
        acc[version].overallSum += s.avg_overall * weight;
        acc[version].overallCount += weight;
      }

      // Weight delta by reading_count to avoid low-volume slices skewing the result
      if (s.delta_overall !== null && weight > 0) {
        acc[version].deltaSum += s.delta_overall * weight;
        acc[version].deltaCount += weight;
      }

      return acc;
    }, {});

    return Object.values(grouped)
      .map(d => ({
        version: d.version,
        readings: d.readings,
        avgOverall: d.overallCount > 0 ? d.overallSum / d.overallCount : null,
        safetyFlagRate: d.readings > 0 ? d.safetyFlags / d.readings : 0,
        avgDelta: d.deltaCount > 0 ? d.deltaSum / d.deltaCount : null
      }))
      .filter(d => d.avgOverall !== null)
      .sort((a, b) => b.readings - a.readings);
  }, [stats]);

  if (versionData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted">
        <GitBranch className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">No version data available</p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile card view */}
      <div className="space-y-3 sm:hidden">
        {versionData.map((row, index) => {
          const isRegression = row.avgDelta !== null && row.avgDelta < -0.3;
          const isImprovement = row.avgDelta !== null && row.avgDelta > 0.3;

          return (
            <div
              key={row.version}
              className={`rounded-lg border border-secondary/20 p-3 ${
                isRegression ? 'bg-error/5' : isImprovement ? 'bg-emerald-500/5' : 'bg-secondary/5'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-muted" />
                  <span className="font-mono text-sm text-main">{row.version}</span>
                  {index === 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-accent">
                      primary
                    </span>
                  )}
                </div>
                <span className={`text-lg font-semibold ${
                  row.avgOverall >= 4
                    ? 'text-emerald-400'
                    : row.avgOverall >= 3
                      ? 'text-amber-400'
                      : 'text-error'
                }`}>
                  {row.avgOverall.toFixed(2)}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                <span>{row.readings.toLocaleString()} readings</span>
                {row.avgDelta !== null && (
                  <span className={`flex items-center gap-1 ${
                    row.avgDelta > 0.1
                      ? 'text-emerald-400'
                      : row.avgDelta < -0.1
                        ? 'text-error'
                        : 'text-muted'
                  }`}>
                    {row.avgDelta > 0.1 ? (
                      <TrendUp className="h-3 w-3" />
                    ) : row.avgDelta < -0.1 ? (
                      <TrendDown className="h-3 w-3" />
                    ) : (
                      <Minus className="h-3 w-3" />
                    )}
                    {row.avgDelta >= 0 ? '+' : ''}{row.avgDelta.toFixed(2)}
                  </span>
                )}
                <span className={
                  row.safetyFlagRate > 0.05
                    ? 'text-error'
                    : row.safetyFlagRate > 0.02
                      ? 'text-amber-400'
                      : ''
                }>
                  {(row.safetyFlagRate * 100).toFixed(2)}% safety
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table view */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-secondary/20">
              <th className="text-left py-2 px-3 text-xs font-medium text-muted">Version</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-muted">Readings</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-muted">Avg Score</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-muted">Delta</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-muted">Safety Rate</th>
            </tr>
          </thead>
          <tbody>
            {versionData.map((row, index) => {
              const isRegression = row.avgDelta !== null && row.avgDelta < -0.3;
              const isImprovement = row.avgDelta !== null && row.avgDelta > 0.3;

              return (
                <tr
                  key={row.version}
                  className={`border-b border-secondary/10 ${
                    isRegression ? 'bg-error/5' : isImprovement ? 'bg-emerald-500/5' : ''
                  }`}
                >
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4 text-muted" />
                      <span className="font-mono text-main">{row.version}</span>
                      {index === 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-accent/20 text-accent">
                          primary
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right text-muted">
                    {row.readings.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <span className={
                      row.avgOverall >= 4
                        ? 'text-emerald-400'
                        : row.avgOverall >= 3
                          ? 'text-amber-400'
                          : 'text-error'
                    }>
                      {row.avgOverall.toFixed(2)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {row.avgDelta !== null ? (
                      <div className="flex items-center justify-end gap-1">
                        {row.avgDelta > 0.1 ? (
                          <TrendUp className="h-3.5 w-3.5 text-emerald-400" />
                        ) : row.avgDelta < -0.1 ? (
                          <TrendDown className="h-3.5 w-3.5 text-error" />
                        ) : (
                          <Minus className="h-3.5 w-3.5 text-muted" />
                        )}
                        <span className={
                          row.avgDelta > 0.1
                            ? 'text-emerald-400'
                            : row.avgDelta < -0.1
                              ? 'text-error'
                              : 'text-muted'
                        }>
                          {row.avgDelta >= 0 ? '+' : ''}{row.avgDelta.toFixed(2)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted">--</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <span className={
                      row.safetyFlagRate > 0.05
                        ? 'text-error'
                        : row.safetyFlagRate > 0.02
                          ? 'text-amber-400'
                          : 'text-muted'
                    }>
                      {(row.safetyFlagRate * 100).toFixed(2)}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
});

export default VersionComparison;
