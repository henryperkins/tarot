import { memo } from 'react';
import {
  Cards,
  ChartLine,
  ShieldWarning,
  Flask
} from '@phosphor-icons/react';

/**
 * SummaryCards - Top-level KPI cards for the admin dashboard
 *
 * @param {Object} props
 * @param {Object} props.summary - Summary data from API
 * @param {number} [props.alertCount] - Number of unacknowledged alerts
 */
export const SummaryCards = memo(function SummaryCards({ summary, alertCount = 0 }) {
  const avgScore = summary?.avgOverall ? parseFloat(summary.avgOverall) : null;
  const safetyRate = summary?.safetyFlagRate ? parseFloat(summary.safetyFlagRate) : null;

  const cards = [
    {
      label: 'Total Readings',
      value: summary?.totalReadings?.toLocaleString() || '0',
      icon: Cards,
      color: 'text-accent',
      bgColor: 'bg-accent/10'
    },
    {
      label: 'Avg Quality Score',
      value: avgScore !== null ? avgScore.toFixed(2) : '--',
      subtext: avgScore !== null ? `/ 5.00` : null,
      icon: ChartLine,
      color: avgScore === null
        ? 'text-muted'
        : avgScore >= 4
          ? 'text-success'
          : avgScore >= 3
            ? 'text-warning'
            : 'text-error',
      bgColor: avgScore === null
        ? 'bg-secondary/10'
        : avgScore >= 4
          ? 'bg-success/10'
          : avgScore >= 3
            ? 'bg-warning/10'
            : 'bg-error/10'
    },
    {
      label: 'Safety Flag Rate',
      value: safetyRate !== null ? `${(safetyRate * 100).toFixed(2)}%` : '--',
      icon: ShieldWarning,
      color: safetyRate === null
        ? 'text-muted'
        : safetyRate > 0.05
          ? 'text-error'
          : safetyRate > 0.02
            ? 'text-warning'
            : 'text-success',
      bgColor: safetyRate === null
        ? 'bg-secondary/10'
        : safetyRate > 0.05
          ? 'bg-error/10'
          : safetyRate > 0.02
            ? 'bg-warning/10'
            : 'bg-success/10'
    },
    {
      label: 'Active Alerts',
      value: alertCount,
      icon: Flask,
      color: alertCount > 0 ? 'text-warning' : 'text-success',
      bgColor: alertCount > 0 ? 'bg-warning/10' : 'bg-success/10'
    }
  ];

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl border border-secondary/30 bg-surface p-4"
        >
          <div className="flex items-center gap-2 text-xs text-muted mb-2">
            <div className={`flex h-6 w-6 items-center justify-center rounded-full ${card.bgColor}`}>
              <card.icon className={`h-3.5 w-3.5 ${card.color}`} weight="duotone" />
            </div>
            <span>{card.label}</span>
          </div>
          <div className="flex items-baseline gap-1">
            <p className={`text-2xl font-bold ${card.color}`}>
              {card.value}
            </p>
            {card.subtext && (
              <span className="text-sm text-muted">{card.subtext}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
});

export default SummaryCards;
