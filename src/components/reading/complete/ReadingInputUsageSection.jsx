import { formatUsageSummary, USAGE_BADGE_CLASSES } from './sourceUsageSummary';

export function ReadingInputUsageSection({
    personalReading,
    sourceUsage
}) {
    const usage = formatUsageSummary(sourceUsage);
    const sourceUsageRows = usage.rows;

    if (!personalReading || sourceUsageRows.length === 0) return null;

    return (
        <div className="w-full max-w-2xl mx-auto mt-6">
            <div className="panel-mystic rounded-2xl border border-[color:var(--border-warm-light)] p-4 sm:p-5">
                <p className="text-sm font-semibold text-main">Reading Inputs Used</p>
                <p className="text-xs text-muted mt-1">Which sources shaped this interpretation.</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-[color:rgb(var(--status-success-rgb)/0.4)] bg-[color:rgb(var(--status-success-rgb)/0.12)] px-2.5 py-1 text-2xs font-semibold uppercase tracking-[0.08em] text-[color:rgb(var(--status-success-rgb)/0.95)]">
                        {usage.summary.used} used
                    </span>
                    <span className="inline-flex items-center rounded-full border border-[color:rgb(var(--status-warning-rgb)/0.4)] bg-[color:rgb(var(--status-warning-rgb)/0.12)] px-2.5 py-1 text-2xs font-semibold uppercase tracking-[0.08em] text-[color:rgb(var(--status-warning-rgb)/0.95)]">
                        {usage.summary.requestedNotUsed} requested not used
                    </span>
                </div>
                <ul className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {sourceUsageRows.map((row) => (
                        <li
                            key={row.label}
                            className="rounded-xl border border-[color:var(--border-warm-light)] bg-surface/45 px-3 py-2.5"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <p className="text-xs-plus font-semibold text-main leading-snug">{row.label}</p>
                                <span className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-semibold uppercase tracking-[0.06em] ${USAGE_BADGE_CLASSES[row.state]}`}>
                                    {row.badgeText}
                                </span>
                            </div>
                            {row.detail && (
                                <p className="mt-1.5 text-2xs sm:text-xs text-muted leading-relaxed">
                                    {row.detail}
                                </p>
                            )}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
