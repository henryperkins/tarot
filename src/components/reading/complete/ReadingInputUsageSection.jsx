import { useId, useState } from 'react';
import { CaretDown, CheckCircle, MinusCircle, WarningCircle } from '@phosphor-icons/react';
import { formatUsageSummary, USAGE_BADGE_CLASSES } from './sourceUsageSummary';
import {
  READING_PANEL_CLASS, READING_PANEL_COLUMN_CLASS, READING_PANEL_DISCLOSURE_CLASS, READING_PANEL_TITLE_CLASS
} from '../../../styles/panelClasses';

const USAGE_ICONS = {
  used: CheckCircle,
  partial: WarningCircle,
  omitted: WarningCircle,
  neutral: MinusCircle
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

export function ReadingInputUsageSection({ personalReading, sourceUsage, provider, isPersonalReadingError }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const headingId = useId();
  const descriptionId = useId();
  const contentId = useId();
  const usage = formatUsageSummary(sourceUsage);

  if (!personalReading || personalReading.isError || isPersonalReadingError || personalReading.isStreaming
    || provider === 'safe-fallback' || personalReading.provider === 'safe-fallback' || usage.rows.length === 0) return null;

  return (
    <section className={`${READING_PANEL_COLUMN_CLASS} mt-6`} aria-labelledby={headingId}>
      <div className={READING_PANEL_CLASS}>
        <h2 className={READING_PANEL_TITLE_CLASS}>
          <button
            id={headingId}
            type="button"
            aria-expanded={isExpanded}
            aria-controls={contentId}
            aria-describedby={descriptionId}
            onClick={() => setIsExpanded((expanded) => !expanded)}
            className={READING_PANEL_DISCLOSURE_CLASS}
          >
            Reading Inputs Used
            <CaretDown className={`h-5 w-5 shrink-0 ${isExpanded ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
        </h2>
        <p id={descriptionId} className="text-sm text-muted mt-1">{usage.summaryText}</p>
        {usage.summary.attention > 0 && (
          <p className="mt-2 text-sm text-warning">
            <WarningCircle className="inline h-4 w-4 align-middle" aria-hidden="true" />{' '}
            Some of your input was shortened or left out. {isExpanded ? 'See the details below.' : 'Expand for details.'}
          </p>
        )}
        <div id={contentId} hidden={!isExpanded}>
          <p className="mt-3 text-sm text-muted">Included means available when this reading was prepared.</p>
          {[
            { key: 'you', label: 'You provided' },
            { key: 'sources', label: 'Additional context' }
          ].map(group => usage.rows.some(row => row.group === group.key) && (
            <div key={group.key} className="mt-4">
              <h3 className="text-sm font-semibold text-main">{group.label}</h3>
              <ul className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {usage.rows.filter(row => row.group === group.key).map((row) => (
                  <li key={row.label} className="min-w-0 border-t border-[color:var(--border-warm-light)] pt-3">
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
          ))}
        </div>
      </div>
    </section>
  );
}
