import { memo, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { ChartLine } from '@phosphor-icons/react';

/**
 * Custom tooltip for the score trends chart
 */
function ScoreTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  const data = payload[0]?.payload;
  return (
    <div className="rounded-lg border border-secondary/30 bg-surface/95 px-3 py-2 shadow-lg backdrop-blur-sm">
      <p className="text-xs font-medium text-muted mb-1">{data?.dateLabel || label}</p>
      <div className="space-y-0.5">
        <p className="text-sm">
          <span className="text-muted">Overall: </span>
          <span className="font-semibold text-accent">{data?.overall?.toFixed(2) || '--'}</span>
        </p>
        {data?.personalization !== null && (
          <p className="text-xs text-muted">
            Personalization: {data.personalization?.toFixed(2)}
          </p>
        )}
        {data?.coherence !== null && (
          <p className="text-xs text-muted">
            Coherence: {data.coherence?.toFixed(2)}
          </p>
        )}
        {data?.tone !== null && (
          <p className="text-xs text-muted">
            Tone: {data.tone?.toFixed(2)}
          </p>
        )}
        {data?.safety !== null && (
          <p className="text-xs text-muted">
            Safety: {data.safety?.toFixed(2)}
          </p>
        )}
        <p className="text-xs text-muted pt-1 border-t border-secondary/20 mt-1">
          {data?.readings?.toLocaleString()} readings
        </p>
      </div>
    </div>
  );
}

/**
 * Weighted average helper
 * @param {Array<{value: number, weight: number}>} items - Values with weights
 */
function weightedAverage(items) {
  const valid = items.filter(i => i.value !== null && i.value !== undefined && i.weight > 0);
  if (valid.length === 0) return null;
  const totalWeight = valid.reduce((sum, i) => sum + i.weight, 0);
  if (totalWeight === 0) return null;
  return valid.reduce((sum, i) => sum + i.value * i.weight, 0) / totalWeight;
}

/**
 * Format date for display (e.g., "Jan 5")
 */
function formatDate(dateStr) {
  try {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

/**
 * ScoreTrendsChart - Time-series of quality scores
 *
 * @param {Object} props
 * @param {Array} props.stats - Raw stats array from API
 * @param {number} [props.height] - Chart height
 */
export const ScoreTrendsChart = memo(function ScoreTrendsChart({
  stats = [],
  height = 240
}) {
  // Transform stats: group by period_key, aggregate across dimensions with reading_count weighting
  const trendData = useMemo(() => {
    if (!stats || stats.length === 0) return [];

    const grouped = stats.reduce((acc, s) => {
      const key = s.period_key;
      if (!key) return acc;

      const weight = s.reading_count || 0;

      if (!acc[key]) {
        acc[key] = {
          date: key,
          readings: 0,
          overall: [],
          personalization: [],
          coherence: [],
          tone: [],
          safety: []
        };
      }

      acc[key].readings += weight;

      // Store values with their weights for proper aggregation
      if (s.avg_overall !== null) acc[key].overall.push({ value: s.avg_overall, weight });
      if (s.avg_personalization !== null) acc[key].personalization.push({ value: s.avg_personalization, weight });
      if (s.avg_tarot_coherence !== null) acc[key].coherence.push({ value: s.avg_tarot_coherence, weight });
      if (s.avg_tone !== null) acc[key].tone.push({ value: s.avg_tone, weight });
      if (s.avg_safety !== null) acc[key].safety.push({ value: s.avg_safety, weight });

      return acc;
    }, {});

    return Object.values(grouped)
      .map(d => ({
        date: d.date,
        dateLabel: formatDate(d.date),
        readings: d.readings,
        overall: weightedAverage(d.overall),
        personalization: weightedAverage(d.personalization),
        coherence: weightedAverage(d.coherence),
        tone: weightedAverage(d.tone),
        safety: weightedAverage(d.safety)
      }))
      .filter(d => d.overall !== null)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [stats]);

  if (trendData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted">
        <ChartLine className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">No score data available</p>
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={trendData}
          margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
        >
          <defs>
            <linearGradient id="overallGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent, var(--brand-primary))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--accent, var(--brand-primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="dateLabel"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 5]}
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
            width={24}
            tickCount={6}
          />
          <Tooltip content={<ScoreTooltip />} />
          <Area
            type="monotone"
            dataKey="overall"
            stroke="var(--accent, var(--brand-primary))"
            strokeWidth={2}
            fill="url(#overallGradient)"
            dot={trendData.length <= 14}
            activeDot={{ r: 4, fill: 'var(--accent, var(--brand-primary))' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
});

export default ScoreTrendsChart;
