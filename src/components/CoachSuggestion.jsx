import { Sparkle, ArrowRight, Trash } from '@phosphor-icons/react';

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

/**
 * Format date for note variant display
 */
function formatNoteDate(recommendation) {
    const raw =
        recommendation?.createdAt ??
        recommendation?.created_at ??
        recommendation?.timestamp ??
        recommendation?.date;

    if (!raw) return null;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;

    return d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', year: 'numeric' });
}

export function CoachSuggestion({
    recommendation,
    onApply,
    onDismiss,
    className = "",
    showTitle = true,
    variant = 'default' // 'default' | 'journal' | 'note'
}) {
    if (!recommendation) return null;

    const isJournalVariant = variant === 'journal';
    const isNoteVariant = variant === 'note';

    const headlineText = getHeadline(recommendation);
    const noteDate = isNoteVariant ? formatNoteDate(recommendation) : null;

    const { subtitle: journalSubtitle, helper: journalHelper } = isJournalVariant
        ? getJournalContent(recommendation)
        : { subtitle: null, helper: null };

    // NOTE VARIANT (post-it card matching reference image)
    if (isNoteVariant) {
        const handleCardClick = (e) => {
            // Don't trigger if clicking delete button
            if (e.target.closest('.coach-note__delete')) return;
            onApply?.();
        };

        const handleDelete = (e) => {
            e.stopPropagation();
            onDismiss?.();
        };

        return (
            <article
                className={`coach-note coach-note--interactive ${className}`}
                role="button"
                tabIndex={0}
                aria-label={`Use suggestion: ${headlineText}`}
                onClick={handleCardClick}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleCardClick(e);
                    }
                }}
            >
                {/* Tape decoration at top */}
                <span className="coach-note__tape" aria-hidden="true" />

                {/* Paper curl at bottom-right */}
                <span className="coach-note__curl" aria-hidden="true" />

                {/* Delete button (shows on hover) */}
                {onDismiss && (
                    <button
                        type="button"
                        className="coach-note__delete"
                        onClick={handleDelete}
                        aria-label="Delete this suggestion"
                    >
                        <Trash aria-hidden="true" />
                    </button>
                )}

                <div className="coach-note__inner">
                    {/* Label */}
                    <div className="coach-note__label">
                        <Sparkle weight="fill" aria-hidden="true" />
                        <span>Guided Coach</span>
                    </div>

                    {/* Question/title */}
                    {headlineText && (
                        <p className="coach-note__title">{headlineText}</p>
                    )}

                    {/* Date at bottom */}
                    {noteDate && (
                        <div className="coach-note__date">{noteDate}</div>
                    )}
                </div>
            </article>
        );
    }

    // Existing variants (default and journal)
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
                            Use this focus
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
