/**
 * CadenceSection - Reading cadence sparkline/bar chart.
 */

import { lazy, memo, Suspense } from 'react';
import { ChartLine } from '@phosphor-icons/react';

const CadenceChart = lazy(() => import('../../charts/CadenceChart'));

// Use larger height on mobile for better touch interaction
const CHART_HEIGHT_MOBILE = 72;
const CHART_HEIGHT_DESKTOP = 60;

function CadenceSection({ data = [], variant = 'mobile' }) {
  if (!data || data.length < 2) return null;

  // Calculate average readings per month
  const total = data.reduce((sum, item) => sum + (item.count || 0), 0);
  const avg = Number((total / data.length).toFixed(1));

  // Use larger height on mobile for better touch targets
  const chartHeight = variant === 'mobile' ? CHART_HEIGHT_MOBILE : CHART_HEIGHT_DESKTOP;

  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs text-muted mb-3">
        <ChartLine className="h-3 w-3" />
        Reading Rhythm
      </p>

      <Suspense fallback={(
        <div
          className="flex items-center justify-center rounded-lg text-xs text-muted"
          style={{ height: chartHeight }}
          role="status"
        >
          Loading reading rhythm…
        </div>
      )}>
        <CadenceChart data={data} height={chartHeight} />
      </Suspense>

      <p className="mt-2 text-2xs text-muted/70">
        {total} readings over {data.length} months ({avg}/month avg)
      </p>
    </div>
  );
}

export default memo(CadenceSection);
