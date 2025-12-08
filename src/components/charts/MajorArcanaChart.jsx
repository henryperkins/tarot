import { memo, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { Star } from '@phosphor-icons/react';

/**
 * Custom tooltip for Major Arcana chart
 */
function MajorArcanaTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;

  const data = payload[0]?.payload;
  return (
    <div className="rounded-lg border border-amber-300/30 bg-[#0b0c1d]/95 px-3 py-2 shadow-lg backdrop-blur-sm">
      <p className="text-sm font-medium text-amber-50">{data?.name}</p>
      <p className="text-xs text-amber-100/80">
        {data?.count} appearance{data?.count === 1 ? '' : 's'}
      </p>
    </div>
  );
}

/**
 * Shorten card names for display
 */
function shortenCardName(name) {
  if (!name) return '';
  // Remove "The " prefix for brevity
  return name.replace(/^The\s+/i, '');
}

/**
 * MajorArcanaChart - Horizontal bar chart showing Major Arcana distribution
 *
 * @param {Object} props
 * @param {Object} props.frequency - Map of card names to counts {name: count}
 * @param {number} [props.limit=5] - Maximum number of cards to show
 * @param {number} [props.height=160] - Chart height
 * @param {Function} [props.onCardClick] - Callback when a card bar is clicked
 */
export const MajorArcanaChart = memo(function MajorArcanaChart({
  frequency = {},
  limit = 5,
  height = 160,
  onCardClick
}) {
  const chartData = useMemo(() => {
    if (!frequency || typeof frequency !== 'object') return [];

    return Object.entries(frequency)
      .map(([name, count]) => ({
        name,
        shortName: shortenCardName(name),
        count: count || 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }, [frequency, limit]);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center py-6 text-sm text-amber-100/60">
        <Star className="mr-2 h-4 w-4" />
        Draw Major Arcana cards to see your archetypes
      </div>
    );
  }

  const maxCount = Math.max(...chartData.map(d => d.count), 1);

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
          barCategoryGap="15%"
        >
          <XAxis
            type="number"
            hide
            domain={[0, maxCount + 1]}
          />
          <YAxis
            type="category"
            dataKey="shortName"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'rgba(251, 191, 36, 0.8)', fontSize: 11 }}
            width={80}
          />
          <Tooltip
            content={<MajorArcanaTooltip />}
            cursor={{ fill: 'rgba(251, 191, 36, 0.06)' }}
          />
          <Bar
            dataKey="count"
            radius={[0, 4, 4, 0]}
            onClick={(data) => onCardClick?.(data)}
            style={{ cursor: onCardClick ? 'pointer' : 'default' }}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={`rgba(251, 191, 36, ${0.3 + (0.5 * (1 - index / chartData.length))})`}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});

/**
 * MajorArcanaFocusTiles - Simple tiles showing top Majors
 */
export const MajorArcanaFocusTiles = memo(function MajorArcanaFocusTiles({
  frequency = {},
  limit = 3
}) {
  const topCards = useMemo(() => {
    if (!frequency || typeof frequency !== 'object') return [];

    return Object.entries(frequency)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }, [frequency, limit]);

  if (topCards.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {topCards.map((card) => (
        <div
          key={card.name}
          className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1"
        >
          <Star className="h-3 w-3 text-amber-300/70" weight="fill" />
          <span className="text-xs text-amber-100">{shortenCardName(card.name)}</span>
          <span className="text-xs text-amber-200/60">{card.count}×</span>
        </div>
      ))}
    </div>
  );
});

export default MajorArcanaChart;
