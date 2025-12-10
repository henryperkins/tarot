/**
 * ContextBreakdown - Context distribution bars with drift indicator.
 */

import { memo } from 'react';
import { Lightning } from '@phosphor-icons/react';

// Context colors
const CONTEXT_COLORS = {
  love: 'bg-pink-500/70',
  career: 'bg-blue-500/70',
  self: 'bg-purple-500/70',
  spiritual: 'bg-indigo-500/70',
  wellbeing: 'bg-green-500/70',
  general: 'bg-amber-500/70',
};

function getContextColor(context) {
  return CONTEXT_COLORS[context?.toLowerCase()] || CONTEXT_COLORS.general;
}

function ContextBreakdown({ data = [], preferenceDrift }) {
  if (!data.length) return null;

  // Sort by count descending
  const sorted = [...data].sort((a, b) => b.count - a.count);
  const total = sorted.reduce((sum, item) => sum + item.count, 0);

  return (
    <div>
      <p className="text-xs text-amber-100/60 mb-3">Your Focus Areas</p>

      <div className="space-y-2">
        {sorted.slice(0, 4).map((item) => {
          const percentage = total > 0 ? Math.round((item.count / total) * 100) : 0;
          const contextName = item.name.charAt(0).toUpperCase() + item.name.slice(1);

          return (
            <div key={item.name} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-amber-100/80">{contextName}</span>
                <span className="text-amber-100/60">{percentage}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-amber-200/10 overflow-hidden">
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
      {preferenceDrift?.hasDrift && preferenceDrift.driftContexts?.[0] && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-cyan-500/10 p-2 border border-cyan-500/20">
          <Lightning className="h-3.5 w-3.5 text-cyan-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-cyan-100/80">
            <span className="font-medium">Emerging:</span>{' '}
            {preferenceDrift.driftContexts[0].context.charAt(0).toUpperCase() +
              preferenceDrift.driftContexts[0].context.slice(1)}{' '}
            (+{preferenceDrift.driftContexts[0].count} readings)
          </p>
        </div>
      )}
    </div>
  );
}

export default memo(ContextBreakdown);
