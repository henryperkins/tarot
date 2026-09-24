import { useId, useState } from 'react';
import { CaretDown, CheckCircle, MinusCircle, SkipForward, WarningCircle } from '@phosphor-icons/react';
import { formatUsageSummary, USAGE_BADGE_CLASSES } from './sourceUsageSummary';

const USAGE_ICONS = {
  used: CheckCircle,
  requestedNotUsed: WarningCircle,
  skipped: SkipForward,
  notRequested: MinusCircle
};

function UsageBadge({ state, children }) {
  const Icon = USAGE_ICONS[state];

  // Keep the opaque status pair above the panel's decorative grain.
  return (
    <span className={`relative z-[1] inline-block max-w-full break-words rounded-full border px-[min(0.625rem,10px)] py-1 text-sm font-semibold leading-snug sm:px-2.5 ${USAGE_BADGE_CLASSES[state]}`}>
      <Icon className="inline h-[16px] w-[16px] align-middle" weight="bold" aria-hidden="true" />{' '}
      {children}
    </span>
  );
}

export function ReadingInputUsageSection({ personalReading, sourceUsage }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const headingId = useId();
  const descriptionId = useId();
  const contentId = useId();
  const usage = formatUsageSummary(sourceUsage);

  if (!personalReading || usage.rows.length === 0) return null;

  return (
    <section className="w-full max-w-2xl mx-auto mt-6" aria-labelledby={headingId}>
      <div className="panel-mystic rounded-2xl border border-[color:var(--border-warm-light)] p-[min(1rem,16px)] sm:p-5">
        <h2 className="text-base font-semibold text-main">
          <button
            id={headingId}
            type="button"
            aria-expanded={isExpanded}
            aria-controls={contentId}
            aria-describedby={descriptionId}
            onClick={() => setIsExpanded((expanded) => !expanded)}
            className="flex min-h-touch min-w-touch w-full items-center justify-between gap-3 rounded-md text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring-color)]"
          >
            Reading Inputs Used
            <CaretDown className={`h-5 w-5 shrink-0 ${isExpanded ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
        </h2>
        <p id={descriptionId} className="text-sm text-muted mt-1">Which sources shaped this interpretation.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <UsageBadge state="used">{usage.summary.used} used</UsageBadge>
          <UsageBadge state="requestedNotUsed">{usage.summary.requestedNotUsed} requested not used</UsageBadge>
        </div>
        <div id={contentId} hidden={!isExpanded}>
          <ul className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {usage.rows.map((row) => (
              <li
                key={row.label}
                className="min-w-0 rounded-xl border border-[color:var(--border-warm-light)] bg-surface/45 px-[min(0.75rem,12px)] py-2.5 sm:px-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="min-w-0 max-w-full break-words text-sm font-semibold text-main leading-snug">{row.label}</p>
                  <UsageBadge state={row.state}>{row.badgeText}</UsageBadge>
                </div>
                {row.detail && (
                  <p className="mt-1.5 text-sm text-muted leading-relaxed break-words">
                    {row.detail}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
