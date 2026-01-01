import { memo } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis } from 'recharts';

/**
 * TrendSparkline - Tiny area chart for card frequency trends.
 *
 * @param {Object} props
 * @param {Array} props.data - Array of { year_month: string, count: number }
 * @param {string} props.color - Stroke/fill color (css variable or hex)
 * @param {number} props.height - Chart height in px
 */
const TrendSparkline = memo(function TrendSparkline({
  data = [],
  color = 'var(--brand-primary)',
  height = 32
}) {
  if (!data || data.length < 2) return null;

  // Sort by date just in case
  const sortedData = [...data].sort((a, b) => a.year_month.localeCompare(b.year_month));

  return (
    <div style={{ height, width: '100%', minWidth: 60 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={sortedData}>
          <defs>
            <linearGradient id="sparkGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="year_month" hide />
          <YAxis hide domain={[0, 'dataMax + 1']} />
          <Area
            type="monotone"
            dataKey="count"
            stroke={color}
            fill="url(#sparkGradient)"
            strokeWidth={1.5}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
});

export default TrendSparkline;
