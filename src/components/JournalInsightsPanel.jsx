import { useState, useMemo, useEffect, useRef, memo } from 'react';
import { FileText, Copy, ArrowsClockwise, ChartBar, Sparkle, ShareNetwork, DownloadSimple, Trash, BookOpen, CircleNotch } from '@phosphor-icons/react';
import {
    LoveIcon,
    CareerIcon,
    SelfIcon,
    SpiritualIcon,
    WellbeingIcon,
    DecisionIcon,
    GeneralIcon
} from './illustrations/ContextIcons';
import { ThemeIcon } from './illustrations/ThemeIcons';
import { useSmallScreen } from '../hooks/useSmallScreen';
import { useLandscape } from '../hooks/useLandscape';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { CoachSuggestion } from './CoachSuggestion';
import {
    downloadInsightsSvg,
    exportJournalInsightsToPdf
} from '../lib/pdfExport';
import {
    exportJournalEntriesToCsv,
    copyJournalShareSummary,
    saveCoachRecommendation,
    persistCoachStatsSnapshot,
    computePreferenceDrift,
    formatContextName
} from '../lib/journalInsights';
import { usePreferences } from '../contexts/PreferencesContext';
import { buildThemePolishPrompt, buildThemeQuestion, ensureQuestionMark, normalizeThemeLabel } from '../lib/themeText';
import { callLlmApi } from '../lib/intentionCoach';
import { InlineStatus } from './InlineStatus.jsx';
import { useInlineStatus } from '../hooks/useInlineStatus';

const OUTLINE_BUTTON_CLASS = 'inline-flex items-center gap-2 rounded-full border border-secondary/40 px-3 py-1.5 text-xs font-semibold text-secondary hover:border-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50 disabled:opacity-50 disabled:cursor-not-allowed';

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

const CONTEXT_ICONS = {
    love: LoveIcon,
    career: CareerIcon,
    self: SelfIcon,
    spiritual: SpiritualIcon,
    wellbeing: WellbeingIcon,
    decision: DecisionIcon,
    general: GeneralIcon
};

function getContextIcon(contextName) {
    const normalized = contextName?.toLowerCase?.() || 'general';
    return CONTEXT_ICONS[normalized] || GeneralIcon;
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
    shareLoading: _shareLoading,
    shareError: _shareError,
    onCreateShareLink,
    onDeleteShareLink
}) {
    const isSmallScreen = useSmallScreen();
    const isLandscape = useLandscape();
    const prefersReducedMotion = useReducedMotion();
    const { personalization } = usePreferences();
    const primaryStats = stats || allStats;
    const frequentCards = primaryStats?.frequentCards || [];
    const contextBreakdown = primaryStats?.contextBreakdown || [];
    const _monthlyCadence = primaryStats?.monthlyCadence || [];
    const recentThemes = primaryStats?.recentThemes || [];
    const isFilteredView = Boolean(filtersActive && stats);

    const [shareComposerOpen, setShareComposerOpen] = useState(false);
    const [shareComposer, setShareComposer] = useState({ scope: 'journal', entryId: '', title: '', limit: '5', expiresInHours: '72' });
    const [composerErrors, setComposerErrors] = useState({});
    const [shareLinkFeedback, setShareLinkFeedback] = useState({ token: null, message: '' });
    const [pendingAction, setPendingAction] = useState(null);
    const { status: inlineStatus, showStatus, clearStatus } = useInlineStatus();
    const shareFeedbackTimeout = useRef(null);

    const showLinkFeedback = (token, message, delay = 2500) => {
        setShareLinkFeedback({ token, message });
        if (shareFeedbackTimeout.current) {
            clearTimeout(shareFeedbackTimeout.current);
        }
        shareFeedbackTimeout.current = setTimeout(() => {
            setShareLinkFeedback({ token: null, message: '' });
            shareFeedbackTimeout.current = null;
        }, delay);
    };

    const runToolbarAction = async (actionKey, task) => {
        setPendingAction(actionKey);
        clearStatus();
        try {
            return await task();
        } finally {
            setPendingAction(null);
        }
    };

    useEffect(() => () => {
        if (shareFeedbackTimeout.current) {
            clearTimeout(shareFeedbackTimeout.current);
        }
    }, []);

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

    // Compute preference drift for "Emerging Interests" insight (Phase 5.4)
    const preferenceDrift = useMemo(
        () => computePreferenceDrift(
            filtersActive ? allEntries : summaryEntries,
            personalization?.focusAreas
        ),
        [allEntries, summaryEntries, filtersActive, personalization?.focusAreas]
    );

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
        if (!isAuthenticated && shareComposerOpen) {
            setShareComposerOpen(false);
        }
    }, [isAuthenticated, shareComposerOpen]);

    useEffect(() => {
        if (!shareLinkFeedback.token) return;
        const stillExists = shareLinks.some(link => link.token === shareLinkFeedback.token);
        if (!stillExists) {
            setShareLinkFeedback({ token: null, message: '' });
        }
    }, [shareLinks, shareLinkFeedback.token]);

    const handleExport = () => runToolbarAction('export', async () => {
        const exportEntries = isFilteredAndEmpty && Array.isArray(allEntries) ? allEntries : summaryEntries;
        const result = exportJournalEntriesToCsv(exportEntries);
        showStatus({
            tone: result ? 'success' : 'error',
            message: result ? 'Export started—CSV download is on its way.' : 'Unable to export this view right now.'
        });
        return result;
    });

    const handlePdfDownload = () => runToolbarAction('pdf', async () => {
        const pdfStats = isFilteredAndEmpty && allStats ? allStats : summaryStats;
        const pdfEntries = isFilteredAndEmpty && Array.isArray(allEntries) ? allEntries : summaryEntries;
        try {
            exportJournalInsightsToPdf(pdfStats, pdfEntries);
            showStatus({ tone: 'success', message: 'PDF download started.' });
            return true;
        } catch {
            showStatus({ tone: 'error', message: 'PDF generation failed. Please try again.' });
            return false;
        }
    });

    const handleVisualCardDownload = () => runToolbarAction('visual-card', async () => {
        if (!svgStats) {
            showStatus({ tone: 'warning', message: 'Add more readings to unlock the visual card.' });
            return false;
        }
        try {
            downloadInsightsSvg(svgStats);
            showStatus({ tone: 'success', message: 'Visual card downloaded.' });
            return true;
        } catch {
            showStatus({ tone: 'error', message: 'Unable to download the visual card.' });
            return false;
        }
    });

    const handleShare = async () => runToolbarAction('share', async () => {
        const noEntriesAvailable =
            (!isFilteredAndEmpty && baseEntries.length === 0) ||
            (isFilteredAndEmpty && (!allEntries || allEntries.length === 0));

        if (noEntriesAvailable) {
            showStatus({ tone: 'info', message: 'Log a reading or clear filters to share.' });
            return false;
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
                        showStatus({ tone: 'warning', message: 'Filtered entries need IDs before they can be shared.' });
                        return false;
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
                        showStatus({
                            tone: 'success',
                            message: isFilteredAndEmpty ? 'Shared full journal link copied.' : 'Share link copied to clipboard.'
                        });
                    } catch (error) {
                        console.warn('Clipboard write failed for quick share link', error);
                        showStatus({ tone: 'warning', message: 'Link ready—copy from your browser if clipboard was blocked.' });
                    }
                } else {
                    showStatus({
                        tone: 'info',
                        message: isFilteredAndEmpty ? 'Full journal link ready in the address bar.' : 'Share link ready—copy from your browser.'
                    });
                }
                return true;
            } catch (error) {
                console.warn('Share link creation failed, falling back to snapshot', error);
                const shareStats = isFilteredAndEmpty ? allStats : (summaryStats || allStats || primaryStats);
                const success = await copyJournalShareSummary(shareStats);
                showStatus({
                    tone: success ? 'warning' : 'error',
                    message: success
                        ? 'Link unavailable; copied a journal snapshot instead.'
                        : 'Unable to create a share link right now.'
                });
                return success;
            }
        }

        const shareStats = isFilteredAndEmpty ? allStats : (summaryStats || allStats || primaryStats);
        const success = await copyJournalShareSummary(shareStats);
        showStatus({
            tone: success ? 'success' : 'error',
            message: success
                ? (isFilteredAndEmpty ? 'Copied a full journal summary.' : 'Snapshot copied—paste to share these insights.')
                : 'Clipboard copy failed in this browser.'
        });
        return success;
    });

    const topContext = contextBreakdown.slice().sort((a, b) => b.count - a.count)[0];
    const contextSuggestion = topContext && CONTEXT_TO_SPREAD[topContext.name];
    const topCard = frequentCards[0];
    const topTheme = recentThemes[0];
    const normalizedTopTheme = normalizeThemeLabel(topTheme);
    const [polishedThemeQuestion, setPolishedThemeQuestion] = useState(null);

    // Automatically polish the theme-based suggestion via LLM for smoother default wording
    useEffect(() => {
        let isCancelled = false;
        const controller = new AbortController();

        const run = async () => {
            // Reset when there is no theme or insights are hidden
            if (!normalizedTopTheme) {
                setPolishedThemeQuestion(null);
                return;
            }

            const fallbackQuestion = buildThemeQuestion(normalizedTopTheme);

            try {
                if (typeof callLlmApi !== 'function') {
                    setPolishedThemeQuestion(fallbackQuestion);
                    return;
                }

                const { prompt, metadata } = buildThemePolishPrompt(normalizedTopTheme, {
                    draftQuestion: fallbackQuestion,
                    spreadName: 'Three-Card Story',
                    topic: 'growth',
                    timeframe: 'month',
                    contextHint: topContext?.name || null,
                    entryCount: primaryStats?.totalReadings
                });

                const result = await callLlmApi(prompt, metadata, { signal: controller.signal });
                const refined = typeof result === 'string' ? result : result?.question;

                if (!isCancelled && refined) {
                    setPolishedThemeQuestion(ensureQuestionMark(refined));
                } else if (!isCancelled) {
                    setPolishedThemeQuestion(fallbackQuestion);
                }
            } catch (error) {
                if (!isCancelled) {
                    console.warn('Theme polish failed; using fallback', error);
                    setPolishedThemeQuestion(fallbackQuestion);
                }
            }
        };

        try {
            run();
        } catch (err) {
            console.error('Theme polish unexpected error; disabling polish', err);
            if (!isCancelled) {
                setPolishedThemeQuestion(null);
            }
        }

        return () => {
            isCancelled = true;
            controller.abort();
        };
    }, [normalizedTopTheme, topContext?.name, primaryStats?.totalReadings]);

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
        if (normalizedTopTheme) {
            return {
                question: polishedThemeQuestion || buildThemeQuestion(normalizedTopTheme),
                spreadName: 'Three-Card Story',
                spreadKey: 'threeCard',
                topicValue: 'growth',
                timeframeValue: 'month',
                depthValue: 'guided',
                source: `theme:${normalizedTopTheme}`,
                customFocus: normalizedTopTheme
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
            showStatus({ tone: 'info', message: 'Clear filters to sync this coach recommendation.' });
            return;
        }
        try {
            await Promise.resolve(saveCoachRecommendation(coachRecommendation));
            showStatus({ tone: 'success', message: 'Sent to Intention Coach.' });
        } catch (error) {
            console.warn('Unable to persist coach recommendation', error);
            showStatus({ tone: 'error', message: 'Unable to sync suggestion. Please try again.' });
        }
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

    const insightsGridLayout = useMemo(() => {
        if (isSmallScreen) {
            return 'grid-cols-1 gap-4';
        }
        if (isLandscape) {
            return 'grid-cols-2 gap-3';
        }
        return 'sm:grid-cols-2 gap-6';
    }, [isLandscape, isSmallScreen]);

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
                    showStatus({ tone: 'success', message: 'Custom link copied to clipboard.' });
                } catch (error) {
                    console.warn('Clipboard write failed for custom link', error);
                    showStatus({ tone: 'warning', message: 'Link ready—copy manually if clipboard was blocked.' });
                }
            } else {
                showStatus({ tone: 'info', message: 'Custom link ready—copy from your browser to share.' });
            }
            setShareComposerOpen(false);
        } catch (error) {
            const message = error.message || 'Unable to create custom link';
            setComposerErrors({ general: message });
            showStatus({ tone: 'error', message });
        }
    };

    const copyShareUrl = async (token) => {
        if (typeof window === 'undefined') return;
        const url = `${window.location.origin}/share/${token}`;
        if (navigator?.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(url);
                showLinkFeedback(token, 'Link copied');
                showStatus({ tone: 'success', message: 'Link copied.' });
                return;
            } catch (error) {
                console.warn('Clipboard write failed for saved link', error);
                showLinkFeedback(token, 'Copy blocked—use tap-and-hold to copy');
                showStatus({ tone: 'warning', message: 'Copy blocked—open the link and copy manually.' });
            }
        } else {
            showLinkFeedback(token, 'Copy not supported in this browser');
            showStatus({ tone: 'error', message: 'Copy not supported—open the link to share it.' });
        }
    };

    if (!primaryStats) {
        return null;
    }

    return (
        <div className={prefersReducedMotion ? '' : 'animate-fade-in'}>
            <div className="space-y-6 rounded-3xl bg-surface/75 ring-1 ring-white/5 p-6 shadow-[0_22px_60px_-36px_rgba(0,0,0,0.8)]">
                <div>
                    <h2 className="text-2xl font-serif text-main">Journal Insights</h2>
                    <p className="mt-1 text-sm text-secondary/70">
                        {isFilteredView && allStats ? (
                            <>
                                <span className="font-medium text-secondary">Filtered:</span> {stats.totalReadings} of {allStats.totalReadings} entries · {stats.reversalRate}% reversed
                            </>
                        ) : (
                            <>
                                {primaryStats.totalReadings} entries · {primaryStats.totalCards} cards · {primaryStats.reversalRate}% reversed
                            </>
                        )}
                    </p>
                    {isFilteredAndEmpty && (
                        <p className="mt-1 text-xs text-secondary/70">Filters returned no entries, showing full journal insights.</p>
                    )}
                </div>

                <div className="rounded-2xl bg-surface/60 ring-1 ring-white/5 p-3 lg:sticky lg:top-0 lg:z-10 shadow-[0_14px_40px_-28px_rgba(0,0,0,0.7)]">
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={handleShare}
                            className={OUTLINE_BUTTON_CLASS}
                            disabled={pendingAction === 'share'}
                        >
                            {pendingAction === 'share' ? <CircleNotch className="h-4 w-4 animate-spin" /> : <ShareNetwork className="h-4 w-4" />}
                            Share link
                        </button>
                        <button
                            type="button"
                            onClick={handleExport}
                            className={OUTLINE_BUTTON_CLASS}
                            disabled={pendingAction === 'export'}
                        >
                            {pendingAction === 'export' ? <CircleNotch className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                            Export CSV
                        </button>
                        <button
                            type="button"
                            onClick={handlePdfDownload}
                            className={OUTLINE_BUTTON_CLASS}
                            disabled={pendingAction === 'pdf'}
                        >
                            {pendingAction === 'pdf' ? <CircleNotch className="h-4 w-4 animate-spin" /> : <DownloadSimple className="h-4 w-4" />}
                            PDF
                        </button>
                        <button
                            type="button"
                            onClick={handleVisualCardDownload}
                            disabled={!svgStats}
                            className={`${OUTLINE_BUTTON_CLASS} ${svgStats ? '' : 'border-secondary/20 text-secondary/40'}`}
                        >
                            {pendingAction === 'visual-card' ? <CircleNotch className="h-4 w-4 animate-spin" /> : <Sparkle className="h-4 w-4" />}
                            Visual card
                        </button>
                    {isAuthenticated && onCreateShareLink && (
                        <button
                            type="button"
                            onClick={() => setShareComposerOpen(prev => !prev)}
                            className={`${OUTLINE_BUTTON_CLASS} ${shareComposerOpen ? 'border-secondary text-secondary bg-secondary/10' : ''}`}
                            >
                                <ArrowsClockwise className="h-4 w-4" />
                                {shareComposerOpen ? 'Close custom link' : 'Custom link'}
                            </button>
                        )}
                    </div>
                    <div className="mt-2">
                        <InlineStatus tone={inlineStatus.tone} message={inlineStatus.message} />
                    </div>
                </div>

                {shareComposerOpen && (
                    <form onSubmit={handleComposerSubmit} className={`rounded-2xl bg-surface/65 ring-1 ring-white/5 shadow-[0_16px_46px_-30px_rgba(0,0,0,0.75)] ${isSmallScreen ? 'p-4' : 'p-6'} ${prefersReducedMotion ? '' : 'animate-slide-down'}`}>
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

                <div className={`grid ${insightsGridLayout} lg:grid-cols-1 lg:gap-4`}>
                    {/* Frequent Cards */}
                    {frequentCards.length > 0 && (
                        <div className={`rounded-3xl border border-secondary/20 bg-surface/40 ${isLandscape ? 'p-3' : 'p-5'}`}>
                            <h3 className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent/80 ${isLandscape ? 'mb-2' : 'mb-4'}`}>
                                <ChartBar className="h-3 w-3" /> Frequent Cards
                            </h3>
                            <ul className={isLandscape ? 'space-y-1' : 'space-y-2'}>
                                {frequentCards.slice(0, isLandscape ? 3 : 5).map((card) => (
                                    <li key={card.name} className={`flex items-center justify-between text-muted ${isLandscape ? 'text-xs' : 'text-sm'}`}>
                                        <span>{card.name}</span>
                                        <span className="text-secondary/60">{card.count}×</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Context Mix */}
                    {contextBreakdown.length > 0 && (
                        <div className={`rounded-3xl border border-secondary/20 bg-surface/40 ${isLandscape ? 'p-3' : 'p-5'}`}>
                            <h3 className={`text-xs font-bold uppercase tracking-wider text-accent/80 ${isLandscape ? 'mb-2' : 'mb-4'}`}>Context Mix</h3>
                            <div className={`flex flex-wrap ${isLandscape ? 'gap-1' : 'gap-2'}`}>
                                {contextBreakdown.map((ctx) => {
                                    const ContextIcon = getContextIcon(ctx.name);
                                    return (
                                        <span
                                            key={ctx.name}
                                            className={`inline-flex items-center gap-1.5 rounded-full border border-secondary/20 bg-secondary/5 text-secondary ${isLandscape ? 'px-2 py-0.5 text-[0.65rem]' : 'px-3 py-1 text-xs'}`}
                                        >
                                            <ContextIcon className={`${isLandscape ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-accent/70`} aria-hidden="true" />
                                            {ctx.name} <span className="opacity-50">({ctx.count})</span>
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Recent Themes */}
                    {recentThemes.length > 0 && (
                        <div className={`rounded-3xl border border-secondary/20 bg-surface/40 ${isLandscape ? 'p-3' : 'p-5'}`}>
                            <h3 className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent/80 ${isLandscape ? 'mb-2' : 'mb-4'}`}>
                                <Sparkle className="h-3 w-3" /> Recent Themes
                            </h3>
                            <ul className={isLandscape ? 'space-y-1' : 'space-y-2'}>
                                {recentThemes.slice(0, isLandscape ? 3 : 5).map((theme, idx) => (
                                    <li key={idx} className={`flex items-center gap-2 text-muted ${isLandscape ? 'text-xs' : 'text-sm'}`}>
                                        <ThemeIcon
                                            theme={theme}
                                            className={`${isLandscape ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-accent/60 flex-shrink-0`}
                                            aria-hidden="true"
                                        />
                                        <span>{theme}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Emerging Interests (Preference Drift) - Phase 5.4 */}
                    {preferenceDrift?.hasDrift && (
                        <div className={`rounded-3xl border border-amber-500/30 bg-amber-500/5 ${isLandscape ? 'p-3' : 'p-5'}`}>
                            <h3 className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400/90 ${isLandscape ? 'mb-2' : 'mb-4'}`}>
                                <BookOpen className="h-3 w-3" /> Emerging Interests
                            </h3>
                            <p className={`text-muted leading-relaxed ${isLandscape ? 'text-xs' : 'text-sm'}`}>
                                You&apos;ve been exploring{' '}
                                <span className="font-medium text-amber-300">
                                    {preferenceDrift.driftContexts
                                        .slice(0, 2)
                                        .map(d => formatContextName(d.context))
                                        .join(' and ')}
                                </span>{' '}
                                themes beyond your selected focus areas.
                            </p>
                            <p className={`mt-2 text-secondary/60 ${isLandscape ? 'text-[0.65rem]' : 'text-xs'}`}>
                                Consider updating your focus areas in Settings to personalize future readings.
                            </p>
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

                {isAuthenticated && shareLinks.length > 0 && (
                    <div className="rounded-3xl border border-secondary/20 bg-surface/40 p-5">
                        <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-accent/80">
                            Active Share Links
                        </h3>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {shareLinks.slice(0, 6).map((link) => (
                                <div key={link.token} className="rounded-xl border border-secondary/10 bg-surface-muted/40 p-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="overflow-hidden">
                                            <p className="truncate text-sm font-medium text-secondary">{link.title || 'Untitled Link'}</p>
                                            <p className="text-xs text-secondary/50">{link.viewCount || 0} views</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                onClick={() => copyShareUrl(link.token)}
                                                className="inline-flex items-center gap-1.5 rounded-full border border-secondary/40 px-2.5 py-1 text-xs font-semibold text-secondary hover:border-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50"
                                                aria-label="Copy share link"
                                            >
                                                <Copy className="h-3.5 w-3.5" />
                                                <span>Copy</span>
                                            </button>
                                            <button
                                                onClick={() => onDeleteShareLink?.(link.token)}
                                                className="inline-flex items-center gap-1.5 rounded-full border border-error/40 px-2.5 py-1 text-xs font-semibold text-error hover:border-error/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/50"
                                                aria-label="Delete share link"
                                            >
                                                <Trash className="h-3.5 w-3.5" />
                                                <span>Delete</span>
                                            </button>
                                        </div>
                                    </div>
                                    {shareLinkFeedback.token === link.token && shareLinkFeedback.message && (
                                        <p className="mt-2 text-[11px] text-secondary/70" aria-live="polite">
                                            {shareLinkFeedback.message}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});
