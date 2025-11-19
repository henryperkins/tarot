import React from 'react';
import { Sparkles } from 'lucide-react';

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

    // Styles that match the Journal Insights Panel design
    const containerClasses = isJournalVariant
        ? `rounded-3xl border border-emerald-400/20 bg-emerald-900/10 p-5 ${className}`
        : `mt-3 rounded-xl border border-emerald-400/30 bg-emerald-500/5 p-3 ${className}`;

    const titleClasses = isJournalVariant
        ? "mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-300"
        : "flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-emerald-200";

    const questionClasses = isJournalVariant
        ? "font-serif text-lg text-amber-100"
        : "mt-2 font-serif text-base text-amber-50";

    const spreadClasses = isJournalVariant
        ? "mt-2 text-sm text-emerald-100/70"
        : "text-xs text-emerald-200/80 mt-1";

    return (
        <div className={containerClasses}>
            {showTitle && (
                <h3 className={titleClasses}>
                    <Sparkles className="h-3 w-3" /> Suggested Focus
                </h3>
            )}

            <p className={questionClasses}>
                {isJournalVariant
                    ? (recommendation.spreadName || 'Three-Card Story')
                    : recommendation.question}
            </p>

            {isJournalVariant ? (
                <p className={spreadClasses}>
                    {recommendation.question ||
                        (recommendation.customFocus ? `Explore the theme of ${recommendation.customFocus}` : 'Reflect on your journey')}
                </p>
            ) : (
                recommendation.spreadName && <p className={spreadClasses}>Suggested spread: {recommendation.spreadName}</p>
            )}

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {isJournalVariant ? (
                    <button
                        onClick={onApply}
                        className="mt-2 text-xs font-medium text-emerald-300 hover:text-emerald-200 underline decoration-emerald-500/30 underline-offset-4"
                    >
                        Start with Intention Coach →
                    </button>
                ) : (
                    <>
                        <button type="button" onClick={onApply} className="rounded-full border border-emerald-400/50 px-3 py-1 text-emerald-100 hover:bg-emerald-500/10">Open in intention coach</button>
                        {onDismiss && (
                            <button type="button" onClick={onDismiss} className="rounded-full border border-amber-400/40 px-3 py-1 text-amber-100 hover:bg-amber-500/10">Dismiss</button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
