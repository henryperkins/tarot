import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { FileText, Copy, RefreshCw, BarChart2, Sparkles, Share2, Download, Trash2 } from 'lucide-react';
import { CoachSuggestion } from './CoachSuggestion';
import {
    downloadInsightsSvg,
    exportJournalInsightsToPdf
} from '../lib/pdfExport';
import {
    exportJournalEntriesToCsv,
    copyJournalShareSummary,
    saveCoachRecommendation
} from '../lib/journalInsights';

const CONTEXT_TO_SPREAD = {
    love: {
        spread: 'Relationship Snapshot',
        spreadKey: 'relationship',
        question: 'How can I nurture reciprocity in my closest connection right now?'
    },
    career: {
        spread: 'Decision / Two-Path',
        spreadKey: 'decision',
        question: 'What would help me choose the path that aligns with my purpose?'
    },
    self: {
        spread: 'Three-Card Story',
        spreadKey: 'threeCard',
        question: 'What inner story is ready to evolve this season?'
    },
    spiritual: {
        spread: 'Celtic Cross',
        spreadKey: 'celtic',
        question: 'How can I deepen trust with my spiritual practice now?'
    },
    wellbeing: {
        spread: 'Five-Card Clarity',
        spreadKey: 'fiveCard',
        question: 'Where can I rebalance my energy in the days ahead?'
    },
    decision: {
        spread: 'Decision / Two-Path',
        spreadKey: 'decision',
        question: 'What do I need to understand about the paths before me?'
    }
};

function mapContextToTopic(context) {
    switch (context) {
        case 'love': return 'relationships';
        case 'career': return 'career';
        case 'self': return 'growth';
        case 'spiritual': return 'growth';
        case 'wellbeing': return 'wellbeing';
        case 'decision': return 'decision';
        default: return null;
    }
}

function formatEntryOptionLabel(entry) {
    const spreadLabel = entry?.spread || 'Reading';
    const timestamp = entry?.ts
        ? entry.ts
        : entry?.created_at
            ? entry.created_at * 1000
            : entry?.updated_at
                ? entry.updated_at * 1000
                : null;
    const dateLabel = timestamp ? new Date(timestamp).toLocaleDateString() : 'Undated';
    const contextLabel = entry?.context ? ` · ${entry.context}` : '';
    return `${spreadLabel} · ${dateLabel}${contextLabel}`;
}

export const JournalInsightsPanel = React.memo(function JournalInsightsPanel({
    stats,
    allStats,
    entries,
    allEntries,
    isAuthenticated,
    filtersActive,
    shareLinks = [],
    shareLoading,
    shareError,
    onCreateShareLink,
    onDeleteShareLink
}) {
    const primaryStats = stats || allStats;
    if (!primaryStats) return null;

    const frequentCards = primaryStats.frequentCards || [];
    const contextBreakdown = primaryStats.contextBreakdown || [];
    const monthlyCadence = primaryStats.monthlyCadence || [];
    const recentThemes = primaryStats.recentThemes || [];
    const isFilteredView = Boolean(filtersActive && stats);

    const [actionMessage, setActionMessage] = useState('');
    const [shareComposerOpen, setShareComposerOpen] = useState(false);
    const [shareComposer, setShareComposer] = useState({ scope: 'journal', entryId: '', title: '', limit: '5', expiresInHours: '72' });

    const summaryEntries = useMemo(() => {
        if (filtersActive) {
            return Array.isArray(entries) ? entries : [];
        }
        if (Array.isArray(allEntries) && allEntries.length > 0) {
            return allEntries;
        }
        return Array.isArray(entries) ? entries : [];
    }, [allEntries, entries, filtersActive]);

    const summaryStats = useMemo(() => {
        if (isFilteredView) {
            return stats;
        }
        return allStats || stats || null;
    }, [allStats, isFilteredView, stats]);

    const usingFilteredEntries = filtersActive && Array.isArray(entries) && entries.length > 0;
    const svgStats = stats || allStats;
    const baseEntries = Array.isArray(summaryEntries) ? summaryEntries : [];
    const isFilteredAndEmpty =
        filtersActive &&
        baseEntries.length === 0 &&
        Array.isArray(allEntries) &&
        allEntries.length > 0;

    const handleExport = () => {
        const exportEntries = isFilteredAndEmpty && Array.isArray(allEntries) ? allEntries : summaryEntries;
        const result = exportJournalEntriesToCsv(exportEntries);
        setActionMessage(result ? 'Export started' : 'Export failed');
        setTimeout(() => setActionMessage(''), 3000);
    };

    const handlePdfDownload = () => {
        const pdfStats = isFilteredAndEmpty && allStats ? allStats : summaryStats;
        const pdfEntries = isFilteredAndEmpty && Array.isArray(allEntries) ? allEntries : summaryEntries;
        try {
            exportJournalInsightsToPdf(pdfStats, pdfEntries);
            setActionMessage('PDF download started');
        } catch (e) {
            setActionMessage('PDF generation failed');
        }
        setTimeout(() => setActionMessage(''), 3000);
    };

    const handleVisualCardDownload = () => {
        if (!svgStats) return;
        try {
            downloadInsightsSvg(svgStats);
            setActionMessage('Visual card downloaded');
        } catch (e) {
            setActionMessage('Visual card failed');
        }
        setTimeout(() => setActionMessage(''), 3000);
    };

    const handleShare = async () => {
        if (
            (!isFilteredAndEmpty && baseEntries.length === 0) ||
            (isFilteredAndEmpty && (!allEntries || allEntries.length === 0))
        ) {
            setActionMessage('No entries to share');
            setTimeout(() => setActionMessage(''), 3500);
            return;
        }

        if (isAuthenticated && onCreateShareLink) {
            try {
                const shareFromFilteredView = usingFilteredEntries && !isFilteredAndEmpty;
                const payload = { scope: 'journal' };
                if (shareFromFilteredView) {
                    const entryIds = baseEntries
                        .slice(0, 10)
                        .map((entry) => entry?.id)
                        .filter(Boolean);
                    if (entryIds.length > 0) {
                        payload.entryIds = entryIds;
                        payload.limit = entryIds.length;
                    }
                }
                const data = await onCreateShareLink(payload);
                const shareUrl = data?.url && typeof window !== 'undefined'
                    ? `${window.location.origin}${data.url}`
                    : null;
                if (shareUrl && navigator?.clipboard?.writeText) {
                    await navigator.clipboard.writeText(shareUrl);
                    setActionMessage(isFilteredAndEmpty ? 'Filters empty, created link for full journal' : 'Share link copied');
                } else {
                    setActionMessage(isFilteredAndEmpty ? 'Filters empty, link for full journal ready' : 'Share link ready');
                }
            } catch (error) {
                console.warn('Share link creation failed, falling back to snapshot', error);
                const shareStats = isFilteredAndEmpty ? allStats : (summaryStats || allStats || primaryStats);
                const success = await copyJournalShareSummary(shareStats);
                setActionMessage(success ? 'Link creation failed, copied snapshot instead' : 'Unable to create share link');
            }
        } else {
            const shareStats = isFilteredAndEmpty ? allStats : (summaryStats || allStats || primaryStats);
            const success = await copyJournalShareSummary(shareStats);
            setActionMessage(success ? (isFilteredAndEmpty ? 'Filters empty, copied full journal summary' : 'Snapshot copied for sharing') : 'Unable to copy snapshot');
        }
        setTimeout(() => setActionMessage(''), 3500);
    };

    const topContext = contextBreakdown.slice().sort((a, b) => b.count - a.count)[0];
    const contextSuggestion = topContext && CONTEXT_TO_SPREAD[topContext.name];
    const topCard = frequentCards[0];
    const topTheme = recentThemes[0];

    const coachRecommendation = useMemo(() => {
        if (contextSuggestion) {
            return {
                question: contextSuggestion.question,
                spreadName: contextSuggestion.spread,
                spreadKey: contextSuggestion.spreadKey,
                topicValue: mapContextToTopic(topContext?.name),
                timeframeValue: 'week',
                depthValue: 'guided',
                source: topContext?.name ? `context:${topContext.name}` : 'context'
            };
        }
        if (topTheme) {
            return {
                question: `How can I explore the theme of ${topTheme} more deeply?`,
                spreadName: 'Three-Card Story',
                spreadKey: 'threeCard',
                topicValue: 'growth',
                timeframeValue: 'month',
                depthValue: 'guided',
                source: `theme:${topTheme}`,
                customFocus: topTheme
            };
        }
        if (topCard) {
            return {
                question: `What is ${topCard.name} inviting me to embody next?`,
                spreadName: 'Three-Card Story',
                spreadKey: 'threeCard',
                topicValue: 'growth',
                timeframeValue: 'open',
                depthValue: 'lesson',
                source: `card:${topCard.name}`,
                cardName: topCard.name
            };
        }
        return null;
    }, [contextSuggestion, topCard, topContext, topTheme]);

    const prevCoachRecRef = React.useRef(null);
    useEffect(() => {
        if (!coachRecommendation) return;
        if (filtersActive) return;
        const current = JSON.stringify(coachRecommendation);
        if (prevCoachRecRef.current === current) return;
        saveCoachRecommendation(coachRecommendation);
        prevCoachRecRef.current = current;
    }, [coachRecommendation, filtersActive]);

    const handleCoachPrefill = useCallback(async () => {
        if (!coachRecommendation) return;
        if (filtersActive) {
            setActionMessage('Clear filters to sync this suggestion');
            setTimeout(() => setActionMessage(''), 3500);
            return;
        }
        try {
            await Promise.resolve(saveCoachRecommendation(coachRecommendation));
            setActionMessage('Sent suggestion to intention coach');
        } catch (error) {
            console.warn('Unable to persist coach recommendation', error);
            setActionMessage('Unable to sync coach suggestion');
        }
        setTimeout(() => setActionMessage(''), 3500);
    }, [coachRecommendation, filtersActive]);

    const entryOptions = useMemo(() => {
        const filteredList = Array.isArray(entries) ? entries : [];
        const filteredOptions = filteredList
            .filter((entry) => entry?.id)
            .map((entry) => ({ id: entry.id, entry, source: 'filtered', label: formatEntryOptionLabel(entry) }));

        if (!Array.isArray(allEntries) || allEntries.length === 0) {
            return { filtered: filteredOptions, journal: [], all: filteredOptions };
        }

        const seen = new Set(filteredOptions.map((option) => option.id));
        const journalOptions = [];
        allEntries.forEach((entry) => {
            if (!entry?.id || seen.has(entry.id)) return;
            journalOptions.push({ id: entry.id, entry, source: 'journal', label: formatEntryOptionLabel(entry) });
        });

        return { filtered: filteredOptions, journal: journalOptions, all: [...filteredOptions, ...journalOptions] };
    }, [allEntries, entries]);

    const handleComposerSubmit = async (event) => {
        event.preventDefault();
        if (!onCreateShareLink) return;
        const scope = shareComposer.scope;
        const trimmedTitle = shareComposer.title.trim();
        const parsedLimit = scope === 'journal' ? Number.parseInt(shareComposer.limit, 10) : undefined;
        const normalizedLimit = Number.isFinite(parsedLimit)
            ? Math.min(10, Math.max(1, parsedLimit))
            : undefined;
        const expiresParsed = shareComposer.expiresInHours ? Number.parseInt(shareComposer.expiresInHours, 10) : undefined;
        const expiresInHours = Number.isFinite(expiresParsed) && expiresParsed > 0
            ? Math.floor(expiresParsed)
            : undefined;

        const selectedEntryValid = entryOptions.all.some((option) => option.id === shareComposer.entryId);

        if (scope === 'journal') {
            if (!Number.isFinite(normalizedLimit) || normalizedLimit < 1 || normalizedLimit > 10) {
                setActionMessage('Choose 1-10 entries for a journal link');
                setTimeout(() => setActionMessage(''), 3500);
                return;
            }
        } else {
            if (!shareComposer.entryId) {
                setActionMessage('Pick a journal entry to share');
                setTimeout(() => setActionMessage(''), 3500);
                return;
            }
            if (!selectedEntryValid) {
                setActionMessage('Select an entry from your journal');
                setTimeout(() => setActionMessage(''), 3500);
                return;
            }
        }

        let entryIdsForJournal;
        if (scope === 'journal' && filtersActive) {
            const filteredIds = (Array.isArray(entries) ? entries : [])
                .map((entry) => entry?.id)
                .filter(Boolean);
            if (filteredIds.length === 0) {
                setActionMessage('No entries match your filters');
                setTimeout(() => setActionMessage(''), 3500);
                return;
            }
            const limitForFilteredShare = normalizedLimit ?? Math.min(filteredIds.length, 10);
            entryIdsForJournal = filteredIds.slice(0, limitForFilteredShare);
        }

        try {
            const data = await onCreateShareLink({
                scope,
                entryId: scope === 'entry' ? shareComposer.entryId : undefined,
                title: trimmedTitle,
                limit: scope === 'journal' ? normalizedLimit : undefined,
                entryIds: scope === 'journal' ? entryIdsForJournal : undefined,
                expiresInHours
            });
            const shareUrl = data?.url && typeof window !== 'undefined'
                ? `${window.location.origin}${data.url}`
                : null;
            if (shareUrl && navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(shareUrl);
                setActionMessage('Custom link copied');
            } else {
                setActionMessage('Custom link ready');
            }
            setShareComposerOpen(false);
        } catch (error) {
            setActionMessage(error.message || 'Unable to create custom link');
        }
        setTimeout(() => setActionMessage(''), 3500);
    };

    const copyShareUrl = async (token) => {
        if (typeof window === 'undefined') return;
        const url = `${window.location.origin}/share/${token}`;
        if (navigator?.clipboard?.writeText) {
            await navigator.clipboard.writeText(url);
            setActionMessage('Link copied');
            setTimeout(() => setActionMessage(''), 2500);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Top Bar: Stats & Actions */}
            <div className="flex flex-col gap-4 rounded-3xl border border-emerald-400/30 bg-slate-950/70 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-2xl font-serif text-amber-100">Journal Insights</h2>
                    <p className="mt-1 text-sm text-emerald-200/70">
                        {isFilteredView && allStats ? (
                            <>
                                <span className="font-medium text-emerald-300">Filtered: </span>
                                {stats.totalReadings} of {allStats.totalReadings} entries · {stats.reversalRate}% reversed
                            </>
                        ) : (
                            <>
                                {primaryStats.totalReadings} entries · {primaryStats.totalCards} cards · {primaryStats.reversalRate}% reversed
                            </>
                        )}
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-slate-900/50 p-1">
                        <button onClick={handleExport} className="rounded-full p-2 text-emerald-200 hover:bg-emerald-500/20" title="Export CSV">
                            <FileText className="h-4 w-4" />
                        </button>
                        <button onClick={handlePdfDownload} className="rounded-full p-2 text-emerald-200 hover:bg-emerald-500/20" title="Download PDF">
                            <Download className="h-4 w-4" />
                        </button>
                        <button onClick={handleVisualCardDownload} disabled={!svgStats} className={`rounded-full p-2 ${svgStats ? 'text-emerald-200 hover:bg-emerald-500/20' : 'text-emerald-200/30'}`} title="Visual Card">
                            <Sparkles className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-slate-900/50 p-1">
                        <button onClick={handleShare} className="rounded-full p-2 text-emerald-200 hover:bg-emerald-500/20" title="Quick Share">
                            <Share2 className="h-4 w-4" />
                        </button>
                        {isAuthenticated && onCreateShareLink && (
                            <button onClick={() => setShareComposerOpen(!shareComposerOpen)} className={`rounded-full p-2 hover:bg-emerald-500/20 ${shareComposerOpen ? 'bg-emerald-500/20 text-emerald-100' : 'text-emerald-200'}`} title="Custom Link">
                                <RefreshCw className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {actionMessage && (
                <div className="text-center text-sm text-emerald-300 animate-fade-in">{actionMessage}</div>
            )}

            {/* Share Composer */}
            {shareComposerOpen && (
                <form onSubmit={handleComposerSubmit} className="rounded-2xl border border-emerald-400/30 bg-slate-900/50 p-6 animate-slide-down">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block">
                            <span className="text-xs uppercase tracking-wider text-emerald-300/80">Link Title</span>
                            <input
                                type="text"
                                value={shareComposer.title}
                                onChange={(e) => setShareComposer(p => ({ ...p, title: e.target.value }))}
                                placeholder="Optional title"
                                className="mt-2 w-full rounded-xl border border-emerald-400/30 bg-slate-950/50 px-3 py-2 text-sm text-amber-100 focus:ring-2 focus:ring-emerald-400/50"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs uppercase tracking-wider text-emerald-300/80">Expires In</span>
                            <select
                                value={shareComposer.expiresInHours ?? ''}
                                onChange={(e) => setShareComposer(p => ({ ...p, expiresInHours: e.target.value || undefined }))}
                                className="mt-2 w-full rounded-xl border border-emerald-400/30 bg-slate-950/50 px-3 py-2 text-sm text-amber-100 focus:ring-2 focus:ring-emerald-400/50"
                            >
                                <option value="24">24 hours</option>
                                <option value="72">3 days</option>
                                <option value="168">1 week</option>
                                <option value="">No expiry</option>
                            </select>
                        </label>
                        <label className="block">
                            <span className="text-xs uppercase tracking-wider text-emerald-300/80">Scope</span>
                            <select
                                value={shareComposer.scope}
                                onChange={(e) => setShareComposer(p => ({ ...p, scope: e.target.value }))}
                                className="mt-2 w-full rounded-xl border border-emerald-400/30 bg-slate-950/50 px-3 py-2 text-sm text-amber-100 focus:ring-2 focus:ring-emerald-400/50"
                            >
                                <option value="journal">Recent entries</option>
                                <option value="entry">Single entry</option>
                            </select>
                        </label>
                        {shareComposer.scope === 'journal' ? (
                            <label className="block">
                                <span className="text-xs uppercase tracking-wider text-emerald-300/80">Count</span>
                                <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={shareComposer.limit}
                                    onChange={(e) => setShareComposer(p => ({ ...p, limit: e.target.value }))}
                                    className="mt-2 w-full rounded-xl border border-emerald-400/30 bg-slate-950/50 px-3 py-2 text-sm text-amber-100 focus:ring-2 focus:ring-emerald-400/50"
                                />
                            </label>
                        ) : (
                            <label className="block">
                                <span className="text-xs uppercase tracking-wider text-emerald-300/80">Select Entry</span>
                                <select
                                    value={shareComposer.entryId || ''}
                                    onChange={(e) => setShareComposer(p => ({ ...p, entryId: e.target.value }))}
                                    className="mt-2 w-full rounded-xl border border-emerald-400/30 bg-slate-950/50 px-3 py-2 text-sm text-amber-100 focus:ring-2 focus:ring-emerald-400/50"
                                >
                                    {entryOptions.all.map(opt => (
                                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                                    ))}
                                </select>
                            </label>
                        )}
                    </div>
                    <div className="mt-4 flex justify-end">
                        <button type="submit" className="rounded-full bg-emerald-500/20 px-6 py-2 text-sm font-medium text-emerald-100 hover:bg-emerald-500/30">
                            Create Link
                        </button>
                    </div>
                </form>
            )}

            {/* Analytics Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* Frequent Cards */}
                {frequentCards.length > 0 && (
                    <div className="rounded-3xl border border-emerald-400/20 bg-slate-950/40 p-5">
                        <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400/80">
                            <BarChart2 className="h-3 w-3" /> Frequent Cards
                        </h3>
                        <ul className="space-y-2">
                            {frequentCards.slice(0, 5).map((card) => (
                                <li key={card.name} className="flex items-center justify-between text-sm text-amber-100/80">
                                    <span>{card.name}</span>
                                    <span className="text-emerald-300/60">{card.count}×</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Context Mix */}
                {contextBreakdown.length > 0 && (
                    <div className="rounded-3xl border border-emerald-400/20 bg-slate-950/40 p-5">
                        <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-amber-400/80">Context Mix</h3>
                        <div className="flex flex-wrap gap-2">
                            {contextBreakdown.map((ctx) => (
                                <span key={ctx.name} className="rounded-full border border-emerald-400/20 bg-emerald-500/5 px-3 py-1 text-xs text-emerald-200">
                                    {ctx.name} <span className="opacity-50">({ctx.count})</span>
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Recent Themes */}
                {recentThemes.length > 0 && (
                    <div className="rounded-3xl border border-emerald-400/20 bg-slate-950/40 p-5">
                        <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400/80">
                            <Sparkles className="h-3 w-3" /> Recent Themes
                        </h3>
                        <ul className="space-y-2">
                            {recentThemes.slice(0, 5).map((theme, idx) => (
                                <li key={idx} className="flex items-center gap-2 text-sm text-amber-100/80">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/40" />
                                    <span>{theme}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Next Steps / Coach */}
                {(contextSuggestion || topTheme || topCard) && coachRecommendation && (
                    <CoachSuggestion
                        recommendation={coachRecommendation}
                        onApply={handleCoachPrefill}
                        variant="journal"
                        className={filtersActive ? "opacity-50 pointer-events-none" : ""}
                    />
                )}
            </div>

            {/* Active Share Links */}
            {isAuthenticated && shareLinks.length > 0 && (
                <div className="rounded-3xl border border-emerald-400/20 bg-slate-950/40 p-5">
                    <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-amber-400/80">Active Share Links</h3>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {shareLinks.slice(0, 6).map((link) => (
                            <div key={link.token} className="flex items-center justify-between rounded-xl border border-emerald-400/10 bg-slate-900/40 p-3">
                                <div className="overflow-hidden">
                                    <p className="truncate text-sm font-medium text-emerald-100">{link.title || 'Untitled Link'}</p>
                                    <p className="text-xs text-emerald-200/50">{link.viewCount || 0} views</p>
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => copyShareUrl(link.token)} className="p-1.5 text-emerald-200 hover:text-emerald-100"><Copy className="h-3 w-3" /></button>
                                    <button onClick={() => onDeleteShareLink?.(link.token)} className="p-1.5 text-rose-300 hover:text-rose-200"><Trash2 className="h-3 w-3" /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
});
