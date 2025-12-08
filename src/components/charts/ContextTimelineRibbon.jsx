import { memo, useMemo, useState } from 'react';

/**
 * Context colors matching the existing icon colors
 */
const CONTEXT_COLORS = {
  love: '#f472b6',      // pink-400
  career: '#60a5fa',    // blue-400
  self: '#a78bfa',      // violet-400
  spiritual: '#c084fc', // purple-400
  wellbeing: '#34d399', // emerald-400
  decision: '#fbbf24',  // amber-400
  general: '#9ca3af'    // gray-400
};

/**
 * Get month key from timestamp
 */
function getMonthKey(ts) {
  if (!ts) return null;
  const date = new Date(typeof ts === 'number' && ts < 1e12 ? ts * 1000 : ts);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Get short month label
 */
function getMonthLabel(monthKey) {
  if (!monthKey) return '';
  const [year, month] = monthKey.split('-');
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
  return date.toLocaleDateString('default', { month: 'short' });
}

/**
 * Compute context breakdown by month
 */
function computeContextByMonth(entries) {
  if (!Array.isArray(entries)) return [];

  const monthMap = new Map();

  entries.forEach(entry => {
    const monthKey = getMonthKey(entry?.ts || entry?.created_at);
    if (!monthKey) return;

    const ctx = entry?.context || 'general';

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, { monthKey, contexts: {}, total: 0 });
    }

    const month = monthMap.get(monthKey);
    month.contexts[ctx] = (month.contexts[ctx] || 0) + 1;
    month.total += 1;
  });

  // Sort by month and take last 6
  return Array.from(monthMap.values())
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .slice(-6)
    .map(month => {
      // Find dominant context
      let dominant = 'general';
      let maxCount = 0;

      Object.entries(month.contexts).forEach(([ctx, count]) => {
        if (count > maxCount) {
          dominant = ctx;
          maxCount = count;
        }
      });

      return {
        ...month,
        dominant,
        label: getMonthLabel(month.monthKey)
      };
    });
}

/**
 * ContextTimelineRibbon - Horizontal dots showing dominant context per month
 *
 * @param {Object} props
 * @param {Array} props.entries - Journal entries
 */
export const ContextTimelineRibbon = memo(function ContextTimelineRibbon({
  entries = []
}) {
  const [activeMonth, setActiveMonth] = useState(null);

  const monthData = useMemo(() => computeContextByMonth(entries), [entries]);

  if (monthData.length < 2) {
    return null;
  }

  return (
    <div className="relative flex items-center gap-2">
      {/* Connecting line behind dots */}
      <div
        className="absolute left-2 right-2 top-2 h-0.5 -z-10"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(251,191,36,0.2) 10%, rgba(251,191,36,0.2) 90%, transparent 100%)'
        }}
        aria-hidden="true"
      />
      {monthData.map((month, index) => {
        const color = CONTEXT_COLORS[month.dominant] || CONTEXT_COLORS.general;
        const isActive = activeMonth === index;

        return (
          <div
            key={month.monthKey}
            className="flex flex-col items-center gap-1"
            onMouseEnter={() => setActiveMonth(index)}
            onMouseLeave={() => setActiveMonth(null)}
            onTouchStart={() => setActiveMonth(index)}
            onTouchEnd={() => setActiveMonth(null)}
          >
            {/* Context dot */}
            <div
              className="relative h-4 w-4 rounded-full transition-transform duration-150"
              style={{
                backgroundColor: color,
                transform: isActive ? 'scale(1.25)' : 'scale(1)',
                boxShadow: isActive ? `0 0 8px ${color}` : 'none'
              }}
              title={`${month.label}: ${month.dominant} (${month.contexts[month.dominant] || 0} readings)`}
            />

            {/* Month label */}
            <span className="text-[10px] text-amber-100/50">
              {month.label}
            </span>

            {/* Tooltip on active */}
            {isActive && (
              <div className="absolute -bottom-12 z-10 rounded-md border border-amber-300/25 bg-[#0b0c1d]/95 px-2 py-1 text-xs shadow-md whitespace-nowrap">
                <span className="font-medium text-amber-100" style={{ color }}>
                  {month.dominant}
                </span>
                <span className="text-amber-100/70">
                  {' · '}{month.total} reading{month.total === 1 ? '' : 's'}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

/**
 * ContextTimelineRibbonCompact - Even simpler version for tight spaces
 */
export const ContextTimelineRibbonCompact = memo(function ContextTimelineRibbonCompact({
  entries = []
}) {
  const monthData = useMemo(() => computeContextByMonth(entries), [entries]);

  if (monthData.length < 2) {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5">
      {monthData.map((month) => {
        const color = CONTEXT_COLORS[month.dominant] || CONTEXT_COLORS.general;

        return (
          <div
            key={month.monthKey}
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: color }}
            title={`${month.label}: ${month.dominant}`}
          />
        );
      })}
    </div>
  );
});

export default ContextTimelineRibbon;
