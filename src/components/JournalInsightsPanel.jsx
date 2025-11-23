import { useState, useMemo, useEffect, useRef, memo } from 'react';
import { FileText, Copy, ArrowsClockwise, ChartBar, Sparkle, ShareNetwork, DownloadSimple, Trash } from '@phosphor-icons/react';
import { CoachSuggestion } from './CoachSuggestion';
import { ArchetypeJourneySection } from './ArchetypeJourneySection';
import {
    downloadInsightsSvg,
    exportJournalInsightsToPdf
} from '../lib/pdfExport';
import {
    exportJournalEntriesToCsv,
    copyJournalShareSummary,
    saveCoachRecommendation,
    persistCoachStatsSnapshot
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

function scheduleDeferred(callback) {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        const frameId = window.requestAnimationFrame(callback);
        return () => window.cancelAnimationFrame(frameId);
    }
    const timeoutId = setTimeout(callback, 0);
    return () => clearTimeout(timeoutId);
}

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
    const timestamp = getEntryTimestamp(entry);
    const dateLabel = timestamp ? new Date(timestamp).toLocaleDateString() : 'Undated';
    const contextLabel = entry?.context ? ` · ${entry.context}` : '';
    return `${spreadLabel} · ${dateLabel}${contextLabel}`;
}

function normalizeEntryTimestamp(value) {
    if (!Number.isFinite(value)) return null;
    return value < 1e12 ? value * 1000 : value;
}

function getEntryTimestamp(entry) {
    const candidates = [entry?.ts, entry?.created_at, entry?.updated_at].map(normalizeEntryTimestamp);
    return candidates.find(Boolean) || null;
}

export const JournalInsightsPanel = memo(function JournalInsightsPanel({
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
    const frequentCards = primaryStats?.frequentCards || [];
    const contextBreakdown = primaryStats?.contextBreakdown || [];
    const monthlyCadence = primaryStats?.monthlyCadence || [];
    const recentThemes = primaryStats?.recentThemes || [];
    const isFilteredView = Boolean(filtersActive && stats);

    const [actionMessage, setActionMessage] = useState('');
    const [shareComposerOpen, setShareComposerOpen] = useState(false);
    const [insightsOpen, setInsightsOpen] = useState(false);
    const [shareOpen, setShareOpen] = useState(false);
    const [shareComposer, setShareComposer] = useState({ scope: 'journal', entryId: '', title: '', limit: '5', expiresInHours: '72' });
    const [composerErrors, setComposerErrors] = useState({});
    const timeoutsRef = useRef([]);

    const scheduleActionClear = (delay = 3000) => {
        const id = setTimeout(() => setActionMessage(''), delay);
        timeoutsRef.current.push(id);
    };

    useEffect(() => () => timeoutsRef.current.forEach(clearTimeout), []);

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

    useEffect(() => {
        if (!summaryStats) return;
        const baseEntryCount = baseEntries.length;
        const totalEntriesCount = Array.isArray(allEntries) ? allEntries.length : null;
        persistCoachStatsSnapshot(summaryStats, {
            filtersActive: isFilteredView,
            filterLabel: isFilteredView ? 'Filtered journal view' : 'Entire journal',
            entryCount: baseEntryCount,
            totalEntries: totalEntriesCount
        });
    }, [summaryStats, isFilteredView, baseEntries.length, allEntries]);

    useEffect(() => {
        if (shareComposerOpen) {
            return undefined;
        }
        return scheduleDeferred(() => setComposerErrors({}));
    }, [shareComposerOpen]);

    useEffect(() => {
        if (!filtersActive) {
            return undefined;
        }
        return scheduleDeferred(() => setInsightsOpen(true));
    }, [filtersActive]);

    useEffect(() => {
        if (shareOpen) {
            return undefined;
        }
        return scheduleDeferred(() => setShareComposerOpen(false));
    }, [shareOpen]);

    const handleExport = () => {
        const exportEntries = isFilteredAndEmpty && Array.isArray(allEntries) ? allEntries : summaryEntries;
        const result = exportJournalEntriesToCsv(exportEntries);
        setActionMessage(result ? 'Export started' : 'Export failed');
        scheduleActionClear();
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
        scheduleActionClear();
    };

    const handleVisualCardDownload = () => {
        if (!svgStats) return;
        try {
            downloadInsightsSvg(svgStats);
            setActionMessage('Visual card downloaded');
        } catch (e) {
            setActionMessage('Visual card failed');
        }
        scheduleActionClear();
    };

    const handleShare = async () => {
        if (
            (!isFilteredAndEmpty && baseEntries.length === 0) ||
            (isFilteredAndEmpty && (!allEntries || allEntries.length === 0))
        ) {
            setActionMessage('No entries to share');
            scheduleActionClear(3500);
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
                    if (entryIds.length === 0) {
                        setActionMessage('Filtered entries need ids before sharing');
                        scheduleActionClear(3500);
                        return;
                    }
                    payload.entryIds = entryIds;
                    payload.limit = entryIds.length;
                }
                const data = await onCreateShareLink(payload);
                const shareUrl = data?.url && typeof window !== 'undefined'
                    ? `${window.location.origin}${data.url}`
                    : null;
                if (shareUrl && navigator?.clipboard?.writeText) {
                    try {
                        await navigator.clipboard.writeText(shareUrl);
                        setActionMessage(isFilteredAndEmpty ? 'Filters empty, created link for full journal' : 'Share link copied');
                    } catch (error) {
                        console.warn('Clipboard write failed for quick share link', error);
                        setActionMessage('Link created but copy failed—use clipboard manually');
                    }
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
        scheduleActionClear(3500);
    };

    const topContext = contextBreakdown.slice().sort((a, b) => b.count - a.count)[0];
    const contextSuggestion = topContext && CONTEXT_TO_SPREAD[topContext.name];
    const topCard = frequentCards[0];
    const topTheme = recentThemes[0];

    const coachRecommendation = (() => {
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
    })();

    const prevCoachRecRef = useRef(null);
    useEffect(() => {
        if (!coachRecommendation) return;
        if (filtersActive) return;
        const current = JSON.stringify(coachRecommendation);
        if (prevCoachRecRef.current === current) return;
        saveCoachRecommendation(coachRecommendation);
        prevCoachRecRef.current = current;
    }, [coachRecommendation, filtersActive]);

    const handleCoachPrefill = async () => {
        if (!coachRecommendation) return;
        if (filtersActive) {
            setActionMessage('Clear filters to sync this suggestion');
            scheduleActionClear(3500);
            return;
        }
        try {
            await Promise.resolve(saveCoachRecommendation(coachRecommendation));
            setActionMessage('Sent suggestion to intention coach');
        } catch (error) {
            console.warn('Unable to persist coach recommendation', error);
            setActionMessage('Unable to sync coach suggestion');
        }
        scheduleActionClear(3500);
    };

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

    const composerPreviewEntries = useMemo(() => {
        if (!filtersActive || shareComposer.scope !== 'journal') return [];
        const filteredList = Array.isArray(entries) ? entries : [];
        if (filteredList.length === 0) return [];
        const parsedLimit = Number.parseInt(shareComposer.limit, 10);
        const limit = Number.isFinite(parsedLimit)
            ? Math.min(10, Math.max(1, parsedLimit))
            : Math.min(10, filteredList.length);
        return filteredList.slice(0, limit);
    }, [entries, filtersActive, shareComposer.limit, shareComposer.scope]);

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

        const errors = {};

        if (scope === 'journal') {
            if (!Number.isFinite(normalizedLimit) || normalizedLimit < 1 || normalizedLimit > 10) {
                errors.limit = 'Choose 1-10 entries for a journal link';
            }
        } else {
            if (!shareComposer.entryId) {
                errors.entryId = 'Pick a journal entry to share';
            }
            if (!selectedEntryValid) {
                errors.entryId = 'Select an entry from your journal';
            }
        }

        let entryIdsForJournal;
        if (scope === 'journal' && filtersActive) {
            const filteredIds = (Array.isArray(entries) ? entries : [])
                .map((entry) => entry?.id)
                .filter(Boolean);
            if (filteredIds.length === 0) {
                errors.limit = 'No entries match your filters';
            }
            const limitForFilteredShare = normalizedLimit ?? Math.min(filteredIds.length, 10);
            entryIdsForJournal = filteredIds.slice(0, limitForFilteredShare);
        }

        if (Object.values(errors).some(Boolean)) {
            setComposerErrors(errors);
            return;
        }

        setComposerErrors({});

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
                try {
                    await navigator.clipboard.writeText(shareUrl);
                    setActionMessage('Custom link copied');
                } catch (error) {
                    console.warn('Clipboard write failed for custom link', error);
                    setActionMessage('Link ready but copy was blocked');
                }
            } else {
                setActionMessage('Custom link ready');
            }
            setShareComposerOpen(false);
        } catch (error) {
            setComposerErrors({ general: error.message || 'Unable to create custom link' });
        }
        scheduleActionClear(3500);
    };

    const copyShareUrl = async (token) => {
        if (typeof window === 'undefined') return;
        const url = `${window.location.origin}/share/${token}`;
        if (navigator?.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(url);
                setActionMessage('Link copied');
            } catch (error) {
                console.warn('Clipboard write failed for saved link', error);
                setActionMessage('Copy blocked—link ready to open manually');
            }
        } else {
            setActionMessage('Copy not supported in this browser');
        }
        scheduleActionClear(2500);
    };

    if (!primaryStats) {
        return null;
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Top Bar: Stats & Actions */}
            <div className="flex flex-col gap-4 rounded-3xl border border-secondary/30 bg-surface/70 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-2xl font-serif text-main">Journal Insights</h2>
                    <p className="mt-1 text-sm text-secondary/70">
                        {isFilteredView && allStats ? (
                            <>
                                <span className="font-medium text-secondary">Filtered: </span>
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
                    <button
                        type="button"
                        onClick={() => setInsightsOpen(prev => !prev)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${insightsOpen ? 'border-secondary text-secondary bg-secondary/10' : 'border-accent/30 text-muted hover:text-secondary hover:border-secondary/50'}`}
                    >
                        {insightsOpen ? 'Hide insights' : 'Show insights'}
                    </button>
                    <button
                        type="button"
                        onClick={() => setShareOpen(prev => !prev)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${shareOpen ? 'border-secondary text-secondary bg-secondary/10' : 'border-accent/30 text-muted hover:text-secondary hover:border-secondary/50'}`}
                    >
                        {shareOpen ? 'Hide share & export' : 'Share & export'}
                    </button>
                </div>
            </div>

            {shareOpen && (
                <div className="flex flex-wrap gap-3 rounded-2xl border border-secondary/20 bg-surface/70 p-3">
                    <div className="flex items-center gap-2 rounded-full border border-secondary/20 bg-surface-muted/50 p-1">
                        <button onClick={handleExport} className="rounded-full p-2 text-secondary hover:bg-secondary/20" title="Export CSV">
                            <FileText className="h-4 w-4" />
                        </button>
                        <button onClick={handlePdfDownload} className="rounded-full p-2 text-secondary hover:bg-secondary/20" title="Download PDF">
                            <DownloadSimple className="h-4 w-4" />
                        </button>
                        <button onClick={handleVisualCardDownload} disabled={!svgStats} className={`rounded-full p-2 ${svgStats ? 'text-secondary hover:bg-secondary/20' : 'text-secondary/30'}`} title="Visual Card">
                            <Sparkle className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="flex items-center gap-2 rounded-full border border-secondary/20 bg-surface-muted/50 p-1">
                        <button onClick={handleShare} className="rounded-full p-2 text-secondary hover:bg-secondary/20" title="Quick share link">
                            <ShareNetwork className="h-4 w-4" />
                        </button>
                        {isAuthenticated && onCreateShareLink && (
                            <button onClick={() => setShareComposerOpen(!shareComposerOpen)} className={`rounded-full p-2 hover:bg-secondary/20 ${shareComposerOpen ? 'bg-secondary/20 text-secondary' : 'text-secondary'}`} title="Custom Link">
                                <ArrowsClockwise className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>
            )}

            {actionMessage && (
                <div className="text-center text-sm text-secondary animate-fade-in">{actionMessage}</div>
            )}

            {/* Share & export composer */}
            {shareOpen && shareComposerOpen && (
                <form onSubmit={handleComposerSubmit} className="rounded-2xl border border-secondary/30 bg-surface-muted/50 p-6 animate-slide-down">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block">
                            <span className="text-xs uppercase tracking-wider text-secondary/80">Link Title</span>
                            <input
                                type="text"
                                value={shareComposer.title}
                                onChange={(e) => setShareComposer(p => ({ ...p, title: e.target.value }))}
                                placeholder="Optional title"
                                className="mt-2 w-full rounded-xl border border-secondary/30 bg-surface/50 px-3 py-2 text-sm text-main focus:ring-2 focus:ring-secondary/50"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs uppercase tracking-wider text-secondary/80">Expires In</span>
                            <select
                                value={shareComposer.expiresInHours ?? ''}
                                onChange={(e) => setShareComposer(p => ({ ...p, expiresInHours: e.target.value || undefined }))}
                                className="mt-2 w-full rounded-xl border border-secondary/30 bg-surface/50 px-3 py-2 text-sm text-main focus:ring-2 focus:ring-secondary/50"
                            >
                                <option value="24">24 hours</option>
                                <option value="72">3 days</option>
                                <option value="168">1 week</option>
                                <option value="">No expiry</option>
                            </select>
                        </label>
                        <label className="block">
                            <span className="text-xs uppercase tracking-wider text-secondary/80">Scope</span>
                            <select
                                value={shareComposer.scope}
                                onChange={(e) => {
                                    const nextScope = e.target.value;
                                    setShareComposer(p => ({ ...p, scope: nextScope }));
                                    setComposerErrors(prev => ({ ...prev, limit: '', entryId: '', general: '' }));
                                }}
                                className="mt-2 w-full rounded-xl border border-secondary/30 bg-surface/50 px-3 py-2 text-sm text-main focus:ring-2 focus:ring-secondary/50"
                            >
                                <option value="journal">Recent entries</option>
                                <option value="entry">Single entry</option>
                            </select>
                        </label>
                        {shareComposer.scope === 'journal' ? (
                            <label className="block">
                                <span className="text-xs uppercase tracking-wider text-secondary/80">How many entries to share (1–10)</span>
                                <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={shareComposer.limit}
                                    onChange={(e) => {
                                        setShareComposer(p => ({ ...p, limit: e.target.value }));
                                        setComposerErrors(prev => ({ ...prev, limit: '', general: '' }));
                                    }}
                                    className="mt-2 w-full rounded-xl border border-secondary/30 bg-surface/50 px-3 py-2 text-sm text-main focus:ring-2 focus:ring-secondary/50"
                                />
                                <p className="mt-1 text-xs text-secondary/70">Defaults to your latest entries{filtersActive ? ' in this filtered view' : ''}.</p>
                                {composerErrors.limit && (
                                    <p className="mt-1 text-xs text-error">{composerErrors.limit}</p>
                                )}
                            </label>
                        ) : (
                            <label className="block">
                                <span className="text-xs uppercase tracking-wider text-secondary/80">Pick an entry to share</span>
                                <select
                                    value={shareComposer.entryId || ''}
                                    onChange={(e) => {
                                        setShareComposer(p => ({ ...p, entryId: e.target.value }));
                                        setComposerErrors(prev => ({ ...prev, entryId: '', general: '' }));
                                    }}
                                    className="mt-2 w-full rounded-xl border border-secondary/30 bg-surface/50 px-3 py-2 text-sm text-main focus:ring-2 focus:ring-secondary/50"
                                >
                                    {entryOptions.all.map(opt => (
                                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                                    ))}
                                </select>
                                {composerErrors.entryId && (
                                    <p className="mt-1 text-xs text-error">{composerErrors.entryId}</p>
                                )}
                            </label>
                        )}
                        {filtersActive && shareComposer.scope === 'journal' && composerPreviewEntries.length > 0 && (
                            <div className="sm:col-span-2 rounded-xl border border-secondary/20 bg-surface/40 p-4">
                                <p className="text-xs uppercase tracking-[0.2em] text-secondary/80">
                                    Sharing {composerPreviewEntries.length} filtered entr{composerPreviewEntries.length === 1 ? 'y' : 'ies'}
                                </p>
                                <ul className="mt-2 space-y-1 text-sm text-muted">
                                    {composerPreviewEntries.map((entry, idx) => (
                                        <li key={entry?.id || idx} className="flex items-center gap-2">
                                            <span className="h-1.5 w-1.5 rounded-full bg-secondary/40" />
                                            <span className="truncate">{formatEntryOptionLabel(entry)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                    <div className="mt-4 flex justify-end">
                        {composerErrors.general && (
                            <p className="mr-4 text-sm text-error">{composerErrors.general}</p>
                        )}
                        <button type="submit" className="rounded-full bg-secondary/20 px-6 py-2 text-sm font-medium text-secondary hover:bg-secondary/30">
                            Create Link
                        </button>
                    </div>
                </form>
            )}

            {/* Analytics Grid */}
            {insightsOpen && (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {/* Frequent Cards */}
                    {frequentCards.length > 0 && (
                        <div className="rounded-3xl border border-secondary/20 bg-surface/40 p-5">
                            <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent/80">
                                <ChartBar className="h-3 w-3" /> Frequent Cards
                            </h3>
                            <ul className="space-y-2">
                                {frequentCards.slice(0, 5).map((card) => (
                                    <li key={card.name} className="flex items-center justify-between text-sm text-muted">
                                        <span>{card.name}</span>
                                        <span className="text-secondary/60">{card.count}×</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Context Mix */}
                    {contextBreakdown.length > 0 && (
                        <div className="rounded-3xl border border-secondary/20 bg-surface/40 p-5">
                            <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-accent/80">Context Mix</h3>
                            <div className="flex flex-wrap gap-2">
                                {contextBreakdown.map((ctx) => (
                                    <span key={ctx.name} className="rounded-full border border-secondary/20 bg-secondary/5 px-3 py-1 text-xs text-secondary">
                                        {ctx.name} <span className="opacity-50">({ctx.count})</span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recent Themes */}
                    {recentThemes.length > 0 && (
                        <div className="rounded-3xl border border-secondary/20 bg-surface/40 p-5">
                            <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent/80">
                                <Sparkle className="h-3 w-3" /> Recent Themes
                            </h3>
                            <ul className="space-y-2">
                                {recentThemes.slice(0, 5).map((theme, idx) => (
                                    <li key={idx} className="flex items-center gap-2 text-sm text-muted">
                                        <span className="h-1.5 w-1.5 rounded-full bg-secondary/40" />
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

                    {/* Archetype Journey Analytics */}
                    <ArchetypeJourneySection isAuthenticated={isAuthenticated} />
                </div>
            )}

            {/* Active Share Links */}
            {shareOpen && isAuthenticated && shareLinks.length > 0 && (
                <div className="rounded-3xl border border-secondary/20 bg-surface/40 p-5">
                    <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-accent/80">Active Share Links</h3>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {shareLinks.slice(0, 6).map((link) => (
                            <div key={link.token} className="flex items-center justify-between rounded-xl border border-secondary/10 bg-surface-muted/40 p-3">
                                <div className="overflow-hidden">
                                    <p className="truncate text-sm font-medium text-secondary">{link.title || 'Untitled Link'}</p>
                                    <p className="text-xs text-secondary/50">{link.viewCount || 0} views</p>
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => copyShareUrl(link.token)} className="p-1.5 text-secondary hover:text-secondary"><Copy className="h-3 w-3" /></button>
                                    <button onClick={() => onDeleteShareLink?.(link.token)} className="p-1.5 text-error hover:text-error/80"><Trash className="h-3 w-3" /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
});
