import { useState, useCallback, memo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { CalendarBlank } from '@phosphor-icons/react';

/**
 * Custom tooltip for the cadence chart
 */
function CadenceTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  const data = payload[0]?.payload;
  return (
    <div className="rounded-lg border border-amber-300/30 bg-[#0b0c1d]/95 px-3 py-2 shadow-lg backdrop-blur-sm">
      <p className="text-xs font-medium text-amber-100">{data?.label || label}</p>
      <p className="text-sm font-semibold text-amber-50">
        {data?.count} reading{data?.count === 1 ? '' : 's'}
      </p>
    </div>
  );
}

/**
 * CadenceChart - Shows 6 months of reading activity
 *
 * @param {Object} props
 * @param {Array<{label: string, count: number}>} props.data - Monthly cadence data
 * @param {number} [props.height=80] - Chart height
 * @param {Function} [props.onBarClick] - Callback when a bar is clicked
 */
export const CadenceChart = memo(function CadenceChart({
  data = [],
  height = 80,
  onBarClick
}) {
  const [activeIndex, setActiveIndex] = useState(null);

  const handleMouseEnter = useCallback((_, index) => {
    setActiveIndex(index);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setActiveIndex(null);
  }, []);

  const handleClick = useCallback((entry, index) => {
    if (onBarClick) {
      onBarClick(entry, index);
    }
  }, [onBarClick]);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center py-4 text-sm text-amber-100/60">
        <CalendarBlank className="mr-2 h-4 w-4" />
        Log readings to see your practice rhythm
      </div>
    );
  }

  // Extract short month labels (e.g., "Dec 2024" -> "Dec")
  const chartData = data.map((item, index) => ({
    ...item,
    shortLabel: item.label?.split(' ')[0] || `M${index + 1}`,
    index
  }));

  const maxCount = Math.max(...chartData.map(d => d.count), 1);

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 4, right: 4, left: 4, bottom: 4 }}
          barCategoryGap="20%"
        >
          <XAxis
            dataKey="shortLabel"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'rgba(251, 191, 36, 0.6)', fontSize: 10 }}
            interval={0}
          />
          <YAxis hide domain={[0, maxCount + 1]} />
          <Tooltip
            content={<CadenceTooltip />}
            cursor={{ fill: 'rgba(251, 191, 36, 0.08)' }}
          />
          <Bar
            dataKey="count"
            radius={[4, 4, 0, 0]}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
            style={{ cursor: onBarClick ? 'pointer' : 'default' }}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={
                  activeIndex === index
                    ? 'rgba(251, 191, 36, 0.85)'
                    : 'rgba(251, 191, 36, 0.5)'
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

export default CadenceChart;
