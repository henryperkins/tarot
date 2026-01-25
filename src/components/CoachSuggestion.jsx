import { Sparkle, ArrowRight, Trash, Info, Fire } from '@phosphor-icons/react';
import { Tooltip } from './Tooltip';

const SPREAD_LABELS = {
    single: '1-card',
    threeCard: '3-card',
    fiveCard: '5-card',
    relationship: 'Relationship',
    decision: 'Decision',
    celtic: 'Celtic Cross',
};

function getSpreadLabel(recommendation) {
    if (!recommendation) return '';
    const spreadName = typeof recommendation.spreadName === 'string' ? recommendation.spreadName.trim() : '';
    if (spreadName) return spreadName;
    const spreadKey = typeof recommendation.spread === 'string' ? recommendation.spread.trim() : '';
    if (!spreadKey) return '';
    return SPREAD_LABELS[spreadKey] || spreadKey;
}

function getStartLabel(recommendation, overrideLabel) {
    if (typeof overrideLabel === 'string' && overrideLabel.trim()) {
        return overrideLabel.trim();
    }
    const spreadKey = typeof recommendation?.spread === 'string' ? recommendation.spread.trim() : '';
    if (!spreadKey) return 'Start Reading';
    const spreadLabel = SPREAD_LABELS[spreadKey] || spreadKey;
    return `Start ${spreadLabel}`;
}

/**
 * Get headline text from recommendation with proper fallback chain
 */
function getHeadline(recommendation) {
    return recommendation?.question
        ?? recommendation?.text
        ?? recommendation?.customFocus
        ?? getSpreadLabel(recommendation)
        ?? 'Suggested focus';
}

/**
 * Get journal-specific content
 */
function getJournalContent(recommendation) {
    if (!recommendation) return { subtitle: null, helper: null };
    const spreadLabel = getSpreadLabel(recommendation);

    return {
        subtitle: spreadLabel || 'Three-Card Story',
        helper: recommendation.customFocus
            ? `Explore the theme of ${recommendation.customFocus}`
            : (recommendation.question || recommendation.text)
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
    onSaveIntention,
    onOpenJournal,
    onSetFocusAreas,
    filtersActive = false,
    scopeLabel = '',
    saveNotice = false,
    saveError = '',
    className = '',
    showTitle = true,
    variant = 'default', // 'default' | 'journal' | 'note' | 'journey'
    showStartReadingCta = true,
    startLabel = '',
    themeHint = '',
    themeContextHint = '',
    showFocusAreasCta = false,
    focusAreasCtaPlacement = 'after-actions', // 'before-actions' | 'after-actions'
    tone = 'warm', // 'warm' | 'amber'
    showStartArrow = false
}) {
    if (!recommendation) return null;

    const isJournalVariant = variant === 'journal';
    const isNoteVariant = variant === 'note';
    const isJourneyVariant = variant === 'journey';

    const headlineText = getHeadline(recommendation);
    const spreadLabel = getSpreadLabel(recommendation);
    const startButtonLabel = getStartLabel(recommendation, startLabel);
    const noteDate = isNoteVariant ? formatNoteDate(recommendation) : null;

    const { subtitle: journalSubtitle, helper: journalHelper } = isJournalVariant
        ? getJournalContent(recommendation)
        : { subtitle: null, helper: null };

    // NOTE VARIANT (post-it card matching reference image)
    if (isNoteVariant) {
        const handleCardClick = () => {
            onApply?.();
        };

        const handleDelete = (e) => {
            e.stopPropagation();
            onDismiss?.();
        };

        return (
            <article className="coach-note-shell">
                <button
                    type="button"
                    className={`coach-note coach-note--interactive ${className}`}
                    aria-label={`Use suggestion: ${headlineText}`}
                    onClick={handleCardClick}
                >
                    {/* Tape decoration at top */}
                    <span className="coach-note__tape" aria-hidden="true" />

                    {/* Paper curl at bottom-right */}
                    <span className="coach-note__curl" aria-hidden="true" />

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
                </button>

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
            </article>
        );
    }

    const badgeDetail = recommendation?.signalsUsed?.find((signal) => signal?.type === 'badge')?.detail;
    const relatedSteps = Array.isArray(recommendation?.relatedSteps)
        ? recommendation.relatedSteps.filter(Boolean).slice(0, 2)
        : [];
    const remainingStepCount = typeof recommendation?.clusterSize === 'number'
        ? Math.max(recommendation.clusterSize - relatedSteps.length, 0)
        : 0;
    const hasThemeHints = Boolean(themeHint || themeContextHint);
    const shouldShowFocusAreasCta = showFocusAreasCta && typeof onSetFocusAreas === 'function';

    if (isJourneyVariant) {
        const isAmberTone = tone === 'amber';
        const focusCtaPlacement = focusAreasCtaPlacement || (isAmberTone ? 'before-actions' : 'after-actions');
        const classes = isAmberTone
            ? {
                container: 'rounded-lg bg-amber-200/5 p-3 border border-amber-300/10',
                headline: 'text-sm sm:text-xs text-amber-100/70 mb-2',
                scope: 'mb-2 text-[10px] uppercase tracking-[0.18em] text-amber-200/50',
                badge: 'mb-2 flex items-center gap-1 text-[11px] text-amber-200/80',
                source: 'mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-amber-200/60',
                sourceTrigger: 'text-amber-200/60 hover:text-amber-100',
                theme: 'mb-2 space-y-1 text-[11px] text-amber-100/60',
                related: 'mb-2 text-[11px] text-amber-100/70',
                relatedTitle: 'text-[10px] uppercase tracking-[0.18em] text-amber-200/60',
                remaining: 'mt-1 text-[10px] text-amber-200/50',
                actions: 'flex flex-wrap items-center gap-2',
                startButton: 'inline-flex items-center gap-1.5 min-h-touch px-3 py-2 text-xs font-medium text-amber-200 hover:text-amber-100 transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50',
                saveButton: 'min-h-touch rounded-full border border-amber-300/30 px-3 py-2 text-xs text-amber-100/80 hover:text-amber-100 hover:border-amber-200/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50',
                openButton: 'min-h-touch rounded-full border border-amber-300/20 px-3 py-2 text-xs text-amber-100/70 hover:text-amber-100 hover:border-amber-200/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50',
                status: 'text-[11px] text-amber-100/70',
                focusCta: 'mb-2 text-[11px] text-amber-200/70 underline underline-offset-4 hover:text-amber-100 transition-colors',
            }
            : {
                container: 'rounded-lg bg-[color:var(--border-warm-subtle)] p-3 border border-[color:var(--border-warm-light)]',
                headline: 'text-xs text-muted-high',
                scope: 'mt-2 text-[10px] uppercase tracking-[0.2em] text-muted',
                badge: 'mt-2 flex items-center gap-1 text-[11px] text-[color:var(--text-accent)]',
                source: 'mt-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted',
                sourceTrigger: 'text-muted hover:text-main',
                theme: 'mt-2 space-y-1 text-[11px] text-muted',
                related: 'mt-2 text-[11px] text-muted-high',
                relatedTitle: 'text-[10px] uppercase tracking-[0.2em] text-muted',
                remaining: 'mt-1 text-[10px] text-muted',
                actions: 'mt-2 flex flex-wrap items-center gap-2',
                startButton: 'min-h-touch rounded-full border border-[color:var(--border-warm-light)] px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-accent)] hover:text-main hover:border-[color:var(--border-warm)] transition-colors',
                saveButton: 'min-h-touch rounded-full border border-[color:var(--border-warm-light)] px-3 py-1.5 text-[11px] text-muted-high hover:text-main hover:border-[color:var(--border-warm)] transition-colors',
                openButton: 'min-h-touch rounded-full border border-[color:var(--border-warm-light)] px-3 py-1.5 text-[11px] text-muted-high hover:text-main hover:border-[color:var(--border-warm)] transition-colors',
                status: 'text-[11px] text-muted',
                focusCta: 'mt-2 text-[11px] text-muted underline underline-offset-4 hover:text-main transition-colors',
            };
        const focusAreasCta = shouldShowFocusAreasCta ? (
            <button
                type="button"
                onClick={onSetFocusAreas}
                className={classes.focusCta}
            >
                Set focus areas to unlock drift insights
            </button>
        ) : null;

        return (
            <div className={`${classes.container} ${className}`.trim()}>
                {headlineText && (
                    <p className={classes.headline}>💡 {headlineText}</p>
                )}
                {filtersActive && scopeLabel && (
                    <p className={classes.scope}>
                        Scoped to: {scopeLabel}
                    </p>
                )}
                {recommendation.source === 'badge' && badgeDetail && (
                    <p className={classes.badge}>
                        <Fire className="h-3 w-3" aria-hidden="true" />
                        Streak badge earned for {badgeDetail}
                    </p>
                )}
                {recommendation.sourceLabel && (
                    <div className={classes.source}>
                        <span>Source: {recommendation.sourceLabel}</span>
                        {recommendation.sourceDetail && (
                            <Tooltip
                                content={recommendation.sourceDetail}
                                position="top"
                                ariaLabel="Why am I seeing this?"
                                triggerClassName={classes.sourceTrigger}
                            >
                                <Info className="h-3 w-3" />
                            </Tooltip>
                        )}
                    </div>
                )}
                {hasThemeHints && (
                    <div className={classes.theme}>
                        {themeHint && <p>{themeHint}</p>}
                        {themeContextHint && <p>{themeContextHint}</p>}
                    </div>
                )}
                {relatedSteps.length > 0 && (
                    <div className={classes.related}>
                        <p className={classes.relatedTitle}>Recent steps</p>
                        <ul className="mt-1 list-disc list-inside space-y-1">
                            {relatedSteps.map((step, index) => (
                                <li key={`${step}-${index}`}>{step}</li>
                            ))}
                        </ul>
                        {remainingStepCount > 0 && (
                            <p className={classes.remaining}>
                                + {remainingStepCount} more step{remainingStepCount === 1 ? '' : 's'}
                            </p>
                        )}
                    </div>
                )}
                {focusCtaPlacement === 'before-actions' && focusAreasCta}
                <div className={classes.actions}>
                    {onApply && showStartReadingCta && (
                        <button
                            type="button"
                            onClick={onApply}
                            className={classes.startButton}
                        >
                            {startButtonLabel}
                            {showStartArrow && <ArrowRight className="h-3 w-3" />}
                        </button>
                    )}
                    {onSaveIntention && (
                        <button
                            type="button"
                            onClick={() => onSaveIntention(recommendation)}
                            className={classes.saveButton}
                        >
                            Save intention
                        </button>
                    )}
                    {onOpenJournal && (
                        <button
                            type="button"
                            onClick={() => onOpenJournal(recommendation)}
                            className={classes.openButton}
                        >
                            Open journal
                        </button>
                    )}
                    {(saveNotice || saveError) && (
                        <span role="status" aria-live="polite" className={classes.status}>
                            {saveNotice && 'Saved to intentions.'}
                            {saveError && saveError}
                        </span>
                    )}
                </div>
                {focusCtaPlacement === 'after-actions' && focusAreasCta}
            </div>
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
                spreadLabel && (
                    <p className={spreadClasses}>Suggested spread: {spreadLabel}</p>
                )
            )}

            {filtersActive && scopeLabel && (
                <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-muted">
                    Scoped to: {scopeLabel}
                </p>
            )}
            {recommendation.source === 'badge' && badgeDetail && (
                <p className="mt-2 text-xs text-muted">
                    Streak badge earned for {badgeDetail}
                </p>
            )}
            {recommendation.sourceLabel && (
                <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-muted">
                    <span>Source: {recommendation.sourceLabel}</span>
                    {recommendation.sourceDetail && (
                        <Tooltip
                            content={recommendation.sourceDetail}
                            position="top"
                            ariaLabel="Why am I seeing this?"
                            triggerClassName="text-muted hover:text-main"
                        >
                            <Info className="h-3 w-3" />
                        </Tooltip>
                    )}
                </div>
            )}
            {relatedSteps.length > 0 && (
                <div className="mt-2 text-xs text-muted">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted">Recent steps</p>
                    <ul className="mt-1 list-disc list-inside space-y-1">
                        {relatedSteps.map((step, index) => (
                            <li key={`${step}-${index}`}>{step}</li>
                        ))}
                    </ul>
                    {remainingStepCount > 0 && (
                        <p className="mt-1 text-[10px] text-muted">
                            + {remainingStepCount} more step{remainingStepCount === 1 ? '' : 's'}
                        </p>
                    )}
                </div>
            )}

            <div className="mt-4 flex flex-wrap gap-3">
                {isJournalVariant ? (
                    <button
                        type="button"
                        onClick={onApply}
                        className="min-h-touch inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-accent hover:text-main underline decoration-accent/30 underline-offset-4 transition-colors
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
                            className="min-h-touch rounded-full border border-primary/50 px-4 py-2 text-sm text-main transition-colors
                                hover:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 touch-manipulation"
                        >
                            Use this focus
                        </button>
                        {onDismiss && (
                            <button
                                type="button"
                                onClick={onDismiss}
                                className="min-h-touch rounded-full border border-secondary/40 px-4 py-2 text-sm text-muted transition-colors
                                    hover:bg-secondary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50 focus-visible:ring-offset-2 touch-manipulation"
                            >
                                Dismiss
                            </button>
                        )}
                    </>
                )}
                {onSaveIntention && (
                    <button
                        type="button"
                        onClick={() => onSaveIntention(recommendation)}
                        className="min-h-touch rounded-full border border-secondary/40 px-4 py-2 text-sm text-muted transition-colors
                            hover:bg-secondary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50 focus-visible:ring-offset-2 touch-manipulation"
                    >
                        Save intention
                    </button>
                )}
                {onOpenJournal && (
                    <button
                        type="button"
                        onClick={() => onOpenJournal(recommendation)}
                        className="min-h-touch rounded-full border border-secondary/40 px-4 py-2 text-sm text-muted transition-colors
                            hover:bg-secondary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50 focus-visible:ring-offset-2 touch-manipulation"
                    >
                        Open journal
                    </button>
                )}
                {(saveNotice || saveError) && (
                    <span role="status" aria-live="polite" className="text-xs text-muted">
                        {saveNotice && 'Saved to intentions.'}
                        {saveError && saveError}
                    </span>
                )}
            </div>
        </div>
    );
}
