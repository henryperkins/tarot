/**
 * ContextBreakdown - Context distribution bars with drift indicator.
 */

import { memo } from 'react';
import { Lightning, Info } from '@phosphor-icons/react';
import { Tooltip } from '../../Tooltip';

// Context colors
const CONTEXT_COLORS = {
  love: 'context-bar context-love',
  career: 'context-bar context-career',
  self: 'context-bar context-self',
  spiritual: 'context-bar context-spiritual',
  wellbeing: 'context-bar context-wellbeing',
  general: 'context-bar context-general',
};

function getContextColor(context) {
  return CONTEXT_COLORS[context?.toLowerCase()] || CONTEXT_COLORS.general;
}

function ContextBreakdown({ data = [], preferenceDrift, maxItems = 4 }) {
  if (!data.length) return null;

  // Sort by count descending
  const sorted = [...data].sort((a, b) => b.count - a.count);
  const total = sorted.reduce((sum, item) => sum + item.count, 0);
  const normalizedMaxItems = typeof maxItems === 'number' ? maxItems : sorted.length;

  return (
    <div>
      <p className="text-xs text-muted mb-3">Your Focus Areas</p>

      <div className="space-y-2">
        {sorted.slice(0, normalizedMaxItems).filter(item => item?.name).map((item) => {
          const percentage = total > 0 ? Math.round((item.count / total) * 100) : 0;
          const contextName = item.name.charAt(0).toUpperCase() + item.name.slice(1);

          return (
            <div key={item.name} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-main">{contextName}</span>
                <span className="text-muted">{percentage}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-[color:var(--border-warm-subtle)] overflow-hidden">
                <div
                  className={`h-full rounded-full ${getContextColor(item.name)} transition-all duration-300`}
                  style={{ width: `${percentage}%` }}
                  role="progressbar"
                  aria-valuenow={percentage}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${contextName}: ${percentage}%`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Preference drift indicator */}
      {preferenceDrift?.hasDrift && preferenceDrift.driftContexts?.[0]?.context && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-[color:var(--border-warm-subtle)] p-2 border border-[color:var(--border-warm-light)]">
          <Lightning className="h-3.5 w-3.5 text-accent mt-0.5 flex-shrink-0" />
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-high">
              <span className="font-medium">Emerging:</span>{' '}
              {preferenceDrift.driftContexts[0].context.charAt(0).toUpperCase() +
                preferenceDrift.driftContexts[0].context.slice(1)}{' '}
              (+{preferenceDrift.driftContexts[0].count} readings)
            </p>
            {preferenceDrift.detail && (
              <Tooltip
                content={preferenceDrift.detail}
                position="top"
                ariaLabel="Why is this showing up?"
                triggerClassName="text-muted hover:text-main"
              >
                <Info className="h-3 w-3" />
              </Tooltip>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(ContextBreakdown);
