import { Sparkle } from '@phosphor-icons/react';

export function CoachSuggestion({
    recommendation,
    onApply,
    onDismiss,
    className = "",
    showTitle = true,
    variant = 'default' // 'default' | 'journal'
}) {
    if (!recommendation) return null;

    const isJournalVariant = variant === 'journal';
    const headlineText = recommendation.question || recommendation.customFocus || recommendation.spreadName || 'Suggested focus';
    const journalSubtitle = isJournalVariant ? (recommendation.spreadName || 'Three-Card Story') : null;
    const journalHelper = isJournalVariant
        ? (recommendation.customFocus
            ? `Explore the theme of ${recommendation.customFocus}`
            : (!recommendation.question ? 'Reflect on your journey' : null))
        : null;

    // Styles that match the Journal Insights Panel design
    const containerClasses = isJournalVariant
        ? `rounded-3xl border border-secondary/20 bg-surface/40 p-5 ${className}`
        : `mt-3 rounded-xl border border-primary/30 bg-primary/5 p-3 ${className}`;

    const titleClasses = isJournalVariant
        ? "mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent/80"
        : "flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-primary";

    const questionClasses = isJournalVariant
        ? "font-serif text-lg text-main"
        : "mt-2 font-serif text-base text-accent";

    const spreadClasses = isJournalVariant
        ? "mt-2 text-sm text-muted"
        : "text-xs text-muted mt-1";

    return (
        <div className={containerClasses}>
            {showTitle && (
                <h3 className={titleClasses}>
                    <Sparkle className="h-3 w-3" aria-hidden="true" /> Suggested Focus
                </h3>
            )}

            {headlineText && (
                <p className={questionClasses}>
                    {headlineText}
                </p>
            )}

            {isJournalVariant ? (
                <>
                    {journalSubtitle && (
                        <p className={spreadClasses}>{journalSubtitle}</p>
                    )}
                    {journalHelper && (
                        <p className="text-xs text-muted mt-1">{journalHelper}</p>
                    )}
                </>
            ) : (
                recommendation.spreadName && <p className={spreadClasses}>Suggested spread: {recommendation.spreadName}</p>
            )}

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {isJournalVariant ? (
                    <button
                        type="button"
                        onClick={onApply}
                        className="mt-2 text-xs font-medium text-accent hover:text-main underline decoration-accent/30 underline-offset-4"
                    >
                        Start with Intention Coach →
                    </button>
                ) : (
                    <>
                        <button type="button" onClick={onApply} className="rounded-full border border-primary/50 px-3 py-1 text-main hover:bg-primary/10">Open in intention coach</button>
                        {onDismiss && (
                            <button type="button" onClick={onDismiss} className="rounded-full border border-secondary/40 px-3 py-1 text-muted hover:bg-secondary/10">Dismiss</button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
