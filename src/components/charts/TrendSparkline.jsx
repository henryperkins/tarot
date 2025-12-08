import { memo, useMemo } from 'react';
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import { TrendUp, TrendDown, Minus } from '@phosphor-icons/react';

/**
 * Calculate trend direction from data points
 */
function calculateTrend(data) {
  if (!data || data.length < 2) return 'stable';

  const recent = data.slice(-2);
  const [prev, current] = recent;

  if (current.count > prev.count) return 'up';
  if (current.count < prev.count) return 'down';
  return 'stable';
}

/**
 * Simple tooltip for sparkline
 */
function SparklineTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;

  const data = payload[0]?.payload;
  return (
    <div className="rounded-md border border-amber-300/25 bg-[#0b0c1d]/95 px-2 py-1 text-xs shadow-md">
      <span className="text-amber-100">{data?.label}</span>
      <span className="ml-1 text-amber-50 font-medium">{data?.count}×</span>
    </div>
  );
}

/**
 * Trend indicator icon
 */
function TrendIcon({ trend, className = '' }) {
  const iconClass = `h-3 w-3 ${className}`;

  switch (trend) {
    case 'up':
      return <TrendUp className={`${iconClass} text-emerald-400`} />;
    case 'down':
      return <TrendDown className={`${iconClass} text-rose-400`} />;
    default:
      return <Minus className={`${iconClass} text-amber-200/60`} />;
  }
}

/**
 * TrendSparkline - Mini line chart for card appearance trends
 *
 * @param {Object} props
 * @param {Array<{year_month: string, count: number}>} props.data - Trend data points
 * @param {string} [props.cardName] - Card name for labeling
 * @param {number} [props.width=60] - Chart width
 * @param {number} [props.height=24] - Chart height
 * @param {boolean} [props.showIcon=true] - Show trend direction icon
 * @param {boolean} [props.interactive=true] - Enable tooltip on hover
 */
export const TrendSparkline = memo(function TrendSparkline({
  data = [],
  cardName,
  width = 60,
  height = 24,
  showIcon = true,
  interactive = true
}) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    return data
      .slice()
      .sort((a, b) => (a.year_month || '').localeCompare(b.year_month || ''))
      .map(item => ({
        label: item.year_month || '',
        count: item.count || 0
      }));
  }, [data]);

  const trend = useMemo(() => calculateTrend(chartData), [chartData]);

  if (chartData.length === 0) {
    return showIcon ? <TrendIcon trend="stable" /> : null;
  }

  // If only one data point, just show the icon
  if (chartData.length === 1) {
    return showIcon ? <TrendIcon trend="stable" /> : null;
  }

  const strokeColor = trend === 'up'
    ? 'rgba(52, 211, 153, 0.8)'
    : trend === 'down'
      ? 'rgba(251, 113, 133, 0.7)'
      : 'rgba(251, 191, 36, 0.6)';

  return (
    <div
      className="inline-flex items-center gap-1"
      title={cardName ? `${cardName} trend over 6 months` : 'Trend over 6 months'}
    >
      <div style={{ width, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
            {interactive && (
              <Tooltip
                content={<SparklineTooltip />}
                cursor={false}
              />
            )}
            <Line
              type="monotone"
              dataKey="count"
              stroke={strokeColor}
              strokeWidth={1.5}
              dot={false}
              activeDot={interactive ? { r: 2, fill: strokeColor } : false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {showIcon && <TrendIcon trend={trend} />}
    </div>
  );
});

/**
 * TrendArrow - Simple arrow indicator without sparkline
 */
export const TrendArrow = memo(function TrendArrow({ data = [] }) {
  const trend = useMemo(() => {
    if (!data || data.length < 2) return 'stable';

    const sorted = [...data].sort((a, b) =>
      (a.year_month || '').localeCompare(b.year_month || '')
    );

    const recent = sorted.slice(-2);
    if (recent.length < 2) return 'stable';

    const [prev, current] = recent;
    if (current.count > prev.count) return 'up';
    if (current.count < prev.count) return 'down';
    return 'stable';
  }, [data]);

  return <TrendIcon trend={trend} />;
});

export default TrendSparkline;
