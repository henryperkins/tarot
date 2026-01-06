import { memo, useMemo, useState, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { Rows } from '@phosphor-icons/react';

const SPREAD_LABELS = {
  single: 'Single',
  threeCard: 'Three Card',
  fiveCard: 'Five Card',
  decision: 'Decision',
  relationship: 'Relationship',
  celtic: 'Celtic Cross'
};

/**
 * Custom tooltip for spread breakdown chart
 */
function SpreadTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;

  const data = payload[0]?.payload;
  return (
    <div className="rounded-lg border border-secondary/30 bg-surface/95 px-3 py-2 shadow-lg backdrop-blur-sm">
      <p className="text-xs font-medium text-main mb-1">{data?.label}</p>
      <div className="space-y-0.5">
        <p className="text-sm">
          <span className="text-muted">Avg Score: </span>
          <span className="font-semibold text-accent">{data?.avgOverall?.toFixed(2) || '--'}</span>
        </p>
        <p className="text-xs text-muted">
          {data?.readings?.toLocaleString()} readings
        </p>
        {data?.safetyFlags > 0 && (
          <p className="text-xs text-error">
            {data.safetyFlags} safety flags
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * SpreadBreakdown - Bar chart showing quality by spread type
 *
 * @param {Object} props
 * @param {Array} props.stats - Raw stats array from API
 * @param {number} [props.height] - Chart height
 */
export const SpreadBreakdown = memo(function SpreadBreakdown({
  stats = [],
  height = 200
}) {
  const [activeIndex, setActiveIndex] = useState(null);

  const handleMouseEnter = useCallback((_, index) => {
    setActiveIndex(index);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setActiveIndex(null);
  }, []);

  // Group stats by spread_key
  const spreadData = useMemo(() => {
    if (!stats || stats.length === 0) return [];

    const grouped = stats.reduce((acc, s) => {
      const key = s.spread_key || 'unknown';
      if (!acc[key]) {
        acc[key] = {
          key,
          readings: 0,
          overallSum: 0,
          overallCount: 0,
          safetyFlags: 0
        };
      }

      const weight = s.reading_count || 0;
      acc[key].readings += weight;
      acc[key].safetyFlags += s.safety_flag_count || 0;

      // Only include in weighted average if there are actual readings
      if (s.avg_overall !== null && weight > 0) {
        acc[key].overallSum += s.avg_overall * weight;
        acc[key].overallCount += weight;
      }

      return acc;
    }, {});

    return Object.values(grouped)
      .map(d => ({
        key: d.key,
        label: SPREAD_LABELS[d.key] || d.key,
        readings: d.readings,
        avgOverall: d.overallCount > 0 ? d.overallSum / d.overallCount : null,
        safetyFlags: d.safetyFlags
      }))
      .filter(d => d.avgOverall !== null)
      .sort((a, b) => b.readings - a.readings);
  }, [stats]);

  if (spreadData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted">
        <Rows className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">No spread data available</p>
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={spreadData}
          margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
          barCategoryGap="20%"
        >
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
            interval={0}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis
            domain={[0, 5]}
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
            width={24}
            tickCount={6}
          />
          <Tooltip
            content={<SpreadTooltip />}
            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
          />
          <Bar
            dataKey="avgOverall"
            radius={[4, 4, 0, 0]}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {spreadData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={
                  activeIndex === index
                    ? entry.avgOverall >= 4
                      ? 'rgba(52, 211, 153, 0.85)'
                      : entry.avgOverall >= 3
                        ? 'rgba(251, 191, 36, 0.85)'
                        : 'rgba(239, 68, 68, 0.85)'
                    : entry.avgOverall >= 4
                      ? 'rgba(52, 211, 153, 0.5)'
                      : entry.avgOverall >= 3
                        ? 'rgba(251, 191, 36, 0.5)'
                        : 'rgba(239, 68, 68, 0.5)'
                }
                className="transition-colors duration-150"
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});

export default SpreadBreakdown;
