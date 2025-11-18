import React from 'react';

export function CoachSuggestion({
    recommendation,
    onApply,
    onDismiss
}) {
    if (!recommendation) return null;

    return (
        <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-500/5 p-3">
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">Journal suggestion</p>
            <p className="mt-2 font-serif text-base text-amber-50">{recommendation.question}</p>
            {recommendation.spreadName && <p className="text-xs text-emerald-200/80 mt-1">Suggested spread: {recommendation.spreadName}</p>}
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <button type="button" onClick={onApply} className="rounded-full border border-emerald-400/50 px-3 py-1 text-emerald-100 hover:bg-emerald-500/10">Open in intention coach</button>
                <button type="button" onClick={onDismiss} className="rounded-full border border-amber-400/40 px-3 py-1 text-amber-100 hover:bg-amber-500/10">Dismiss</button>
            </div>
        </div>
    );
}
