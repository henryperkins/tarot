import { Sparkle, ArrowRight } from '@phosphor-icons/react';

/**
 * Get headline text from recommendation with proper fallback chain
 */
function getHeadline(recommendation) {
    return recommendation?.question
        ?? recommendation?.customFocus
        ?? recommendation?.spreadName
        ?? 'Suggested focus';
}

/**
 * Get journal-specific content
 */
function getJournalContent(recommendation) {
    if (!recommendation) return { subtitle: null, helper: null };

    return {
        subtitle: recommendation.spreadName ?? 'Three-Card Story',
        helper: recommendation.customFocus
            ? `Explore the theme of ${recommendation.customFocus}`
            : recommendation.question
                ? null
                : 'Reflect on your journey'
    };
}

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
    const headlineText = getHeadline(recommendation);
    const { subtitle: journalSubtitle, helper: journalHelper } = isJournalVariant
        ? getJournalContent(recommendation)
        : { subtitle: null, helper: null };

    // Styles that match the Journal Insights Panel design
    const containerClasses = isJournalVariant
        ? `rounded-3xl border border-secondary/20 bg-surface/40 p-5 ${className}`
        : `mt-3 rounded-xl border border-primary/30 bg-primary/5 p-4 ${className}`;

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
        <div
            className={containerClasses}
            role="region"
            aria-labelledby={showTitle ? "coach-suggestion-title" : undefined}
        >
            {showTitle && (
                <h3 id="coach-suggestion-title" className={titleClasses}>
                    <Sparkle className="h-3 w-3" aria-hidden="true" />
                    Suggested Focus
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
                recommendation.spreadName && (
                    <p className={spreadClasses}>Suggested spread: {recommendation.spreadName}</p>
                )
            )}

            <div className="mt-4 flex flex-wrap gap-3">
                {isJournalVariant ? (
                    <button
                        type="button"
                        onClick={onApply}
                        className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-accent hover:text-main underline decoration-accent/30 underline-offset-4 transition-colors
                            focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 touch-manipulation"
                    >
                        <span>Start with Intention Coach</span>
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                ) : (
                    <>
                        <button
                            type="button"
                            onClick={onApply}
                            className="min-h-[44px] rounded-full border border-primary/50 px-4 py-2 text-sm text-main transition-colors
                                hover:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 touch-manipulation"
                        >
                            Open in intention coach
                        </button>
                        {onDismiss && (
                            <button
                                type="button"
                                onClick={onDismiss}
                                className="min-h-[44px] rounded-full border border-secondary/40 px-4 py-2 text-sm text-muted transition-colors
                                    hover:bg-secondary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50 focus-visible:ring-offset-2 touch-manipulation"
                            >
                                Dismiss
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
