import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, LogIn, Upload, Trash2, Copy, ExternalLink, FileText, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GlobalNav } from './GlobalNav';
import { useAuth } from '../contexts/AuthContext';
import { useJournal } from '../hooks/useJournal';
import AuthModal from './AuthModal';
import { CardSymbolInsights } from './CardSymbolInsights';
import { JournalFilters } from './JournalFilters.jsx';
import {
  buildCardInsightPayload,
  computeJournalStats,
  exportJournalEntriesToCsv,
  copyJournalShareSummary,
  copyJournalEntrySummary,
  saveCoachRecommendation
} from '../lib/journalInsights';
import { exportJournalInsightsToPdf, downloadInsightsSvg } from '../lib/pdfExport';
import { buildHeuristicJourneySummary } from '../../shared/journal/summary.js';
import { SPREADS } from '../data/spreads';

const CONTEXT_SUMMARIES = {
  love: 'Relationship lens — center relational reciprocity and communication.',
  career: 'Career lens — focus on vocation, impact, and material pathways.',
  self: 'Self lens — emphasize personal growth and inner landscape.',
  spiritual: 'Spiritual lens — frame insights through devotion, meaning, and practice.'
};

const TIMING_SUMMARIES = {
  'near-term-tilt': 'Timing: energy is likely to shift in the near-term if you engage with it.',
  'longer-arc-tilt': 'Timing: this pattern stretches over a longer arc demanding patience.',
  'developing-arc': 'Timing: expect this to develop as an unfolding chapter, not a single moment.'
};

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

const CONTEXT_FILTERS = [
  { value: 'love', label: 'Love' },
  { value: 'career', label: 'Career' },
  { value: 'self', label: 'Self' },
  { value: 'spiritual', label: 'Spiritual' },
  { value: 'wellbeing', label: 'Wellbeing' },
  { value: 'decision', label: 'Decision' }
];

const SPREAD_FILTERS = Object.entries(SPREADS || {}).map(([value, config]) => ({
  value,
  label: config?.name || value
}));

function mapContextToTopic(context) {
  switch (context) {
    case 'love':
      return 'relationships';
    case 'career':
      return 'career';
    case 'self':
      return 'growth';
    case 'spiritual':
      return 'growth';
    case 'wellbeing':
      return 'wellbeing';
    case 'decision':
      return 'decision';
    default:
      return null;
  }
}

function JournalCardListItem({ card }) {
  const insightCard = buildCardInsightPayload(card);

  return (
    <li className="rounded-2xl border border-emerald-400/30 bg-slate-950/60 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-amber-200">{card.position}</p>
          <p className="text-sm text-amber-100/80">
            {card.name} ({card.orientation})
          </p>
        </div>
        {insightCard && (
          <CardSymbolInsights card={insightCard} position={card.position} />
        )}
      </div>
    </li>
  );
}

function parseJourneySummary(text) {
  if (!text) return [];
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const sections = [];
  const headingRegex = /^(Arc of the Journey|Energies Calling for Focus|Gentle Next Steps)/i;
  let current = null;
  lines.forEach((line) => {
    const match = line.match(headingRegex);
    if (match) {
      current = { title: match[1], content: line.replace(headingRegex, '').trim() };
      sections.push(current);
    } else if (current) {
      current.content = current.content ? `${current.content}\n${line}` : line;
    } else {
      current = { title: 'Journey Highlights', content: line };
      sections.push(current);
    }
  });
  return sections;
}

function JournalInsightsPanel({
  stats, // Filtered stats for display
  allStats, // Full journal stats for exports/summaries
  entries,
  allEntries, // For summary generation (unfiltered)
  isAuthenticated,
  filtersActive,
  shareLinks = [],
  shareLoading,
  shareError,
  onCreateShareLink,
  onDeleteShareLink
}) {
  if (!stats) return null;

  const [actionMessage, setActionMessage] = useState('');
  const [journeySummary, setJourneySummary] = useState('');
  const [summarySections, setSummarySections] = useState([]);
  const [summaryStatus, setSummaryStatus] = useState('idle');
  const [summaryError, setSummaryError] = useState('');
  const [summaryGeneratedAt, setSummaryGeneratedAt] = useState(null);
  const [shareComposerOpen, setShareComposerOpen] = useState(false);
  const [shareComposer, setShareComposer] = useState({ scope: 'journal', entryId: '', title: '', limit: '5', expiresInHours: '72' });
  const [autoSummarySignature, setAutoSummarySignature] = useState('');

  const summaryEntries = useMemo(() => {
    if (filtersActive && Array.isArray(entries)) {
      return entries;
    }
    if (Array.isArray(allEntries) && allEntries.length > 0) {
      return allEntries;
    }
    return Array.isArray(entries) ? entries : [];
  }, [allEntries, entries, filtersActive]);

  const summaryStats = filtersActive ? stats : (allStats || stats);

  const entryOptions = useMemo(() => {
    const filteredList = Array.isArray(entries) ? entries : [];
    if (!Array.isArray(allEntries) || allEntries.length === 0) {
      return filteredList;
    }
    const seen = new Set(filteredList.map((entry) => entry?.id).filter(Boolean));
    const merged = [...filteredList];
    allEntries.forEach((entry) => {
      if (entry?.id && seen.has(entry.id)) {
        return;
      }
      merged.push(entry);
    });
    return merged;
  }, [allEntries, entries]);

  const handleExport = () => {
    // Always export full journal, not filtered subset
    const exportEntries = allEntries || entries;
    const result = exportJournalEntriesToCsv(exportEntries);
    const message = result
      ? (filtersActive ? `Exported full journal (${exportEntries.length} entries)` : 'Exported journal.csv')
      : 'Unable to export right now';
    setActionMessage(message);
    setTimeout(() => setActionMessage(''), 3500);
  };

  const handlePdfDownload = () => {
    try {
      // Use full journal stats for PDF exports
      const exportStats = allStats || stats;
      const exportEntries = allEntries || entries;
      exportJournalInsightsToPdf(exportStats, exportEntries);
      setActionMessage(filtersActive ? `PDF: full journal (${exportEntries.length} entries)` : 'PDF downloaded');
    } catch (error) {
      setActionMessage('Unable to create PDF');
    }
    setTimeout(() => setActionMessage(''), 3500);
  };

  const handleShare = async () => {
    if (isAuthenticated && onCreateShareLink) {
      try {
        const data = await onCreateShareLink({ scope: 'journal' });
        const shareUrl = data?.url && typeof window !== 'undefined'
          ? `${window.location.origin}${data.url}`
          : null;
        if (shareUrl && navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(shareUrl);
          setActionMessage('Share link copied');
        } else {
          setActionMessage('Share link ready');
        }
      } catch (error) {
        setActionMessage(error.message || 'Unable to create share link');
      }
    } else {
      const shareStats = allStats || stats;
      const success = await copyJournalShareSummary(shareStats);
      setActionMessage(success ? 'Snapshot copied for sharing' : 'Unable to copy snapshot');
    }
    setTimeout(() => setActionMessage(''), 3500);
  };

  const handleJourneySummary = useCallback(async ({ auto = false } = {}) => {
    if (!summaryEntries || summaryEntries.length === 0) return;
    setSummaryStatus('loading');
    setSummaryError('');
    try {
      let summaryText = '';
      if (isAuthenticated) {
        const entryIds = summaryEntries
          .slice(0, 10)
          .map((entry) => entry?.id)
          .filter(Boolean);
        const payload = filtersActive && entryIds.length > 0
          ? { entryIds, limit: entryIds.length }
          : { limit: Math.min(summaryEntries.length, 10) };
        const response = await fetch('/api/journal-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || 'Unable to generate summary');
        }
        const payload = await response.json();
        summaryText = payload.summary;
      }
      if (!summaryText) {
        summaryText = buildHeuristicJourneySummary(summaryEntries, summaryStats);
      }
      setJourneySummary(summaryText);
      setSummarySections(parseJourneySummary(summaryText));
      setSummaryGeneratedAt(Date.now());
    } catch (error) {
      if (!auto) {
        setSummaryError(error.message || 'Unable to generate summary');
      }
    } finally {
      setSummaryStatus('idle');
    }
  }, [filtersActive, isAuthenticated, summaryEntries, summaryStats]);

  useEffect(() => {
    if (shareComposer.entryId) return;
    const fallbackEntry = entries?.[0] || entryOptions?.[0];
    if (fallbackEntry?.id) {
      setShareComposer((prev) => ({ ...prev, entryId: fallbackEntry.id }));
    }
  }, [entries, entryOptions, shareComposer.entryId]);

  const entrySignature = useMemo(() => {
    if (!Array.isArray(summaryEntries) || summaryEntries.length === 0) {
      return '';
    }
    return summaryEntries
      .map((entry) => {
        const idPart = entry?.id ?? entry?.ts ?? 'entry';
        const tsPart = entry?.ts ?? entry?.updated_at ?? entry?.created_at ?? '';
        return `${idPart}:${tsPart}`;
      })
      .join('|');
  }, [summaryEntries]);

  useEffect(() => {
    if (!entrySignature) {
      if (autoSummarySignature) {
        setAutoSummarySignature('');
      }
      return;
    }
    if (autoSummarySignature === entrySignature) {
      return;
    }
    handleJourneySummary({ auto: true });
    setAutoSummarySignature(entrySignature);
  }, [entrySignature, autoSummarySignature, handleJourneySummary]);

  const topContext = stats.contextBreakdown?.slice().sort((a, b) => b.count - a.count)[0];
  const contextSuggestion = topContext && CONTEXT_TO_SPREAD[topContext.name];
  const topCard = stats.frequentCards?.[0];
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
  }, [contextSuggestion, topCard, topContext]);

  const handleCoachPrefill = useCallback(async () => {
    if (!coachRecommendation) return;
    try {
      await Promise.resolve(saveCoachRecommendation(coachRecommendation));
      setActionMessage('Sent suggestion to intention coach');
    } catch (error) {
      console.warn('Unable to persist coach recommendation', error);
      setActionMessage('Unable to sync coach suggestion');
    }
    setTimeout(() => setActionMessage(''), 3500);
  }, [coachRecommendation]);

  const handleComposerSubmit = async (event) => {
    event.preventDefault();
    if (!onCreateShareLink) return;
    const scope = shareComposer.scope;
    const trimmedTitle = shareComposer.title.trim();
    const parsedLimit = scope === 'journal' ? Number.parseInt(shareComposer.limit, 10) : undefined;
    const normalizedLimit = Number.isFinite(parsedLimit) ? parsedLimit : undefined;
    const expiresParsed = shareComposer.expiresInHours ? Number.parseInt(shareComposer.expiresInHours, 10) : undefined;
    const expiresInHours = Number.isFinite(expiresParsed) ? expiresParsed : undefined;

    if (scope === 'journal') {
      if (!Number.isFinite(normalizedLimit) || normalizedLimit < 1 || normalizedLimit > 10) {
        setActionMessage('Choose 1-10 entries for a journal link');
        setTimeout(() => setActionMessage(''), 3500);
        return;
      }
    } else if (!shareComposer.entryId) {
      setActionMessage('Pick a journal entry to share');
      setTimeout(() => setActionMessage(''), 3500);
      return;
    }

    try {
      const data = await onCreateShareLink({
        scope,
        entryId: scope === 'entry' ? shareComposer.entryId : undefined,
        title: trimmedTitle,
        limit: scope === 'journal' ? normalizedLimit : undefined,
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
      setActionMessage('Link copied to clipboard');
      setTimeout(() => setActionMessage(''), 2500);
    }
  };

  return (
    <section className="mb-8 rounded-3xl border border-emerald-400/40 bg-slate-950/70 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-300/80">Journal pulse</p>
          <h2 className="text-2xl font-serif text-amber-100">Reading insights at a glance</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={handleExport} className="inline-flex items-center gap-1 rounded-full border border-amber-400/50 px-3 py-1 text-xs text-amber-200 hover:bg-amber-500/10">
            <FileText className="h-3.5 w-3.5" /> Export CSV
          </button>
          <button type="button" onClick={handlePdfDownload} className="inline-flex items-center gap-1 rounded-full border border-amber-400/50 px-3 py-1 text-xs text-amber-200 hover:bg-amber-500/10">
            <Copy className="h-3.5 w-3.5" /> Download PDF
          </button>
          <button
            type="button"
            onClick={() => downloadInsightsSvg(stats)}
            className="inline-flex items-center gap-1 rounded-full border border-amber-400/50 px-3 py-1 text-xs text-amber-200 hover:bg-amber-500/10"
          >
            <FileText className="h-3.5 w-3.5" /> Visual card
          </button>
          <button type="button" onClick={handleShare} className="inline-flex items-center gap-1 rounded-full border border-emerald-400/50 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-500/10">
            <ExternalLink className="h-3.5 w-3.5" /> {isAuthenticated ? 'Copy share link' : 'Share snapshot'}
          </button>
          {isAuthenticated && onCreateShareLink && (
            <button
              type="button"
              onClick={() => setShareComposerOpen((prev) => !prev)}
              className="inline-flex items-center gap-1 rounded-full border border-emerald-400/50 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-500/10"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {shareComposerOpen ? 'Hide options' : 'Custom link'}
            </button>
          )}
        </div>
      </div>

      <p className="mt-2 text-sm text-amber-200/70">
        {filtersActive && allStats ? (
          <>
            <span className="font-medium text-emerald-300">Showing: </span>
            {stats.totalReadings} of {allStats.totalReadings} entries · {stats.totalCards} cards · {stats.reversalRate}% reversed
          </>
        ) : (
          <>
            {stats.totalReadings} entries · {stats.totalCards} cards · {stats.reversalRate}% reversed
          </>
        )}
      </p>
      {actionMessage && <p className="mt-2 text-xs text-emerald-200/70">{actionMessage}</p>}

      {shareComposerOpen && (
        <form onSubmit={handleComposerSubmit} className="mt-4 grid gap-3 rounded-2xl border border-emerald-400/30 bg-slate-900/50 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs uppercase tracking-[0.3em] text-emerald-300/80">
              Link title
              <input
                type="text"
                value={shareComposer.title}
                onChange={(event) => setShareComposer((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Optional"
                maxLength={60}
                className="mt-2 w-full rounded-2xl border border-emerald-400/30 bg-slate-950/70 px-3 py-2 text-sm text-amber-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              />
            </label>
            <label className="text-xs uppercase tracking-[0.3em] text-emerald-300/80">
              Expires in
              <select
                value={shareComposer.expiresInHours ?? ''}
                onChange={(event) => setShareComposer((prev) => ({ ...prev, expiresInHours: event.target.value || undefined }))}
                className="mt-2 w-full rounded-2xl border border-emerald-400/30 bg-slate-950/70 px-3 py-2 text-sm text-amber-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              >
                <option value="24">24 hours</option>
                <option value="72">3 days</option>
                <option value="168">1 week</option>
                <option value="">No expiry</option>
              </select>
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs uppercase tracking-[0.3em] text-emerald-300/80">
              Scope
              <select
                value={shareComposer.scope}
                onChange={(event) => setShareComposer((prev) => ({ ...prev, scope: event.target.value }))}
                className="mt-2 w-full rounded-2xl border border-emerald-400/30 bg-slate-950/70 px-3 py-2 text-sm text-amber-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              >
                <option value="journal">Recent journal entries</option>
                <option value="entry">Single entry</option>
              </select>
            </label>
            {shareComposer.scope === 'journal' ? (
              <label className="text-xs uppercase tracking-[0.3em] text-emerald-300/80">
                Entries included
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={shareComposer.limit}
                  onChange={(event) => setShareComposer((prev) => ({ ...prev, limit: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-emerald-400/30 bg-slate-950/70 px-3 py-2 text-sm text-amber-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                />
              </label>
            ) : (
              <label className="text-xs uppercase tracking-[0.3em] text-emerald-300/80">
                Choose entry
                <select
                  value={shareComposer.entryId || ''}
                  onChange={(event) => setShareComposer((prev) => ({ ...prev, entryId: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-emerald-400/30 bg-slate-950/70 px-3 py-2 text-sm text-amber-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                >
                  {entryOptions.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.spread} · {new Date(entry.ts).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-full border border-emerald-400/60 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-500/10"
            >
              Generate link
            </button>
          </div>
        </form>
      )}

      {stats.frequentCards.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-400/80">Most frequent cards</h3>
            {filtersActive && <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-200/70">Filtered view</span>}
          </div>
          <ul className="mt-3 space-y-2">
            {stats.frequentCards.map((card) => (
              <li key={card.name} className="flex items-center justify-between rounded-2xl bg-slate-900/60 px-4 py-3 text-sm text-amber-100/90">
                <span>{card.name}</span>
                <span className="text-amber-300/80">
                  {card.count}×{card.reversed ? ` · ${card.reversed} reversed` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {stats.contextBreakdown.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-400/80">Context mix</h3>
            {filtersActive && <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-200/70">Filtered view</span>}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {stats.contextBreakdown.map((context) => (
              <span key={context.name} className="rounded-full border border-emerald-400/30 px-3 py-1 text-xs text-emerald-200">
                {context.name}: {context.count}
              </span>
            ))}
          </div>
        </div>
      )}

      {stats.monthlyCadence.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-400/80">Monthly cadence</h3>
            {filtersActive && <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-200/70">Filtered view</span>}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {stats.monthlyCadence.map((month) => (
              <div key={month.label} className="rounded-2xl border border-emerald-400/30 bg-slate-950/60 p-3 text-center">
                <p className="text-xs text-amber-200/70">{month.label}</p>
                <p className="text-lg font-semibold text-amber-100">{month.count}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.recentThemes?.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-400/80">Recent themes</h3>
            {filtersActive && <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-200/70">Filtered view</span>}
          </div>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-100/80">
            {stats.recentThemes.map((theme, idx) => (
              <li key={`${theme}-${idx}`}>{theme}</li>
            ))}
          </ul>
        </div>
      )}

      {(contextSuggestion || topCard) && (
        <div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-500/5 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">Next reading idea</p>
          <p className="mt-2 font-serif text-lg text-amber-50">
            {contextSuggestion?.spread || 'Three-Card Story'}
          </p>
          <p className="mt-2 text-sm text-amber-100/80">
            {contextSuggestion?.question ||
              (topCard
                ? `What is ${topCard.name} inviting me to embody next?`
                : 'What pattern is ready to shift in my story?')}
          </p>
          {coachRecommendation && (
            <button
              type="button"
              onClick={handleCoachPrefill}
              className="mt-3 inline-flex items-center rounded-full border border-emerald-300/50 px-3 py-1 text-xs text-emerald-100 hover:bg-emerald-500/10"
            >
              Pre-fill intention coach
            </button>
          )}
        </div>
      )}

      {isAuthenticated && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-400/80">Manage share links</h3>
          {shareError && <p className="mt-2 text-xs text-rose-300">{shareError}</p>}
          {shareLoading ? (
            <p className="mt-3 text-xs text-amber-100/80">Loading share links…</p>
          ) : shareLinks.length === 0 ? (
            <p className="mt-3 text-xs text-amber-100/80">No active links yet. Share a reading to see it here.</p>
          ) : (
            <div className="mt-3 space-y-2 text-xs text-amber-100/80">
              {shareLinks.slice(0, 6).map((record) => (
                <div key={record.token} className="flex items-center justify-between rounded-2xl border border-emerald-400/20 bg-slate-900/60 p-3">
                  <div className="space-y-1">
                    <p className="font-semibold text-amber-200">{record.title || (record.scope === 'entry' ? 'Entry share' : 'Journal snapshot')}</p>
                    <p className="text-amber-100/70">{new Date(record.createdAt).toLocaleString()}</p>
                    <p className="text-amber-200/60">{record.entryCount ?? 0} entries · {record.viewCount || 0} visits</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyShareUrl(record.token)}
                      className="rounded-full border border-emerald-400/40 p-2 text-emerald-100 hover:bg-emerald-500/10"
                      title="Copy link"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <a
                      href={`/share/${record.token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full border border-amber-400/40 p-2 text-amber-100 hover:bg-amber-500/10"
                      title="Open link"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    <button
                      type="button"
                      onClick={() => onDeleteShareLink?.(record.token)}
                      className="rounded-full border border-red-400/40 p-2 text-red-100 hover:bg-red-500/10"
                      title="Revoke link"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function buildThemeInsights(entry) {
  const lines = [];
  const themes = entry?.themes;
  if (entry?.context) {
    lines.push(CONTEXT_SUMMARIES[entry.context] || `Context lens: ${entry.context}`);
  }

  if (!themes || typeof themes !== 'object') {
    return lines;
  }

  if (themes.suitFocus) {
    lines.push(themes.suitFocus);
  } else if (themes.dominantSuit) {
    lines.push(`Suit focus: ${themes.dominantSuit} themes stand out in this spread.`);
  }

  if (themes.elementalBalance) {
    lines.push(themes.elementalBalance);
  }

  if (themes.archetypeDescription) {
    lines.push(themes.archetypeDescription);
  }

  if (themes.reversalDescription?.name) {
    const desc = themes.reversalDescription.description
      ? ` — ${themes.reversalDescription.description}`
      : '';
    lines.push(`Reversal lens: ${themes.reversalDescription.name}${desc}`);
  }

  if (themes.timingProfile && TIMING_SUMMARIES[themes.timingProfile]) {
    lines.push(TIMING_SUMMARIES[themes.timingProfile]);
  }

  return lines.filter(Boolean);
}

function JournalEntryCard({ entry, onCreateShareLink, isAuthenticated }) {
  const insights = buildThemeInsights(entry);
  const [showNarrative, setShowNarrative] = useState(false);
  const [entryActionMessage, setEntryActionMessage] = useState('');

  const handleEntryExport = () => {
    const filename = `tarot-entry-${entry.id || entry.ts || 'reading'}.csv`;
    const success = exportJournalEntriesToCsv([entry], filename);
    setEntryActionMessage(success ? 'Entry CSV downloaded' : 'Export unavailable');
    setTimeout(() => setEntryActionMessage(''), 3500);
  };

  const handleEntryShare = async () => {
    if (isAuthenticated && onCreateShareLink) {
      try {
        const data = await onCreateShareLink({ scope: 'entry', entryId: entry.id });
        const shareUrl = data?.url && typeof window !== 'undefined'
          ? `${window.location.origin}${data.url}`
          : null;
        if (shareUrl && navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(shareUrl);
          setEntryActionMessage('Share link copied');
        } else {
          setEntryActionMessage('Share link ready');
        }
      } catch (error) {
        setEntryActionMessage(error.message || 'Unable to create share link');
      }
    } else {
      const success = await copyJournalEntrySummary(entry);
      setEntryActionMessage(success ? 'Entry snapshot ready to share' : 'Unable to share entry now');
    }
    setTimeout(() => setEntryActionMessage(''), 3500);
  };

  return (
    <div className="bg-slate-900/80 p-6 rounded-xl border border-emerald-400/40">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-serif text-amber-200">{entry.spread}</h2>
          <p className="text-sm text-amber-100/70">
            {new Date(entry.ts).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={handleEntryExport}
            className="rounded-full border border-amber-400/50 px-3 py-1 text-amber-200 hover:bg-amber-500/10"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={handleEntryShare}
            className="rounded-full border border-emerald-400/50 px-3 py-1 text-emerald-200 hover:bg-emerald-500/10"
          >
            Share snapshot
          </button>
        </div>
      </div>
      {entryActionMessage && (
        <p className="mt-2 text-xs text-emerald-200/70">{entryActionMessage}</p>
      )}
      <div className="mt-4">
        {entry.question && (
          <p className="italic text-amber-100/80 mb-4">Question: {entry.question}</p>
        )}
      </div>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-amber-200 mb-2">Cards</h3>
        <ul className="space-y-3">
          {entry.cards.map((card, idx) => (
            <JournalCardListItem key={idx} card={card} />
          ))}
        </ul>
      </div>
      {insights.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-amber-200 mb-2">Saved Insights</h3>
          <ul className="list-disc pl-5 space-y-1 text-amber-100/80">
            {insights.map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>
        </div>
      )}
      {entry.personalReading && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowNarrative(prev => !prev)}
            className="mb-2 inline-flex items-center px-3 py-1.5 rounded-full border border-amber-400/60 text-xs sm:text-sm text-amber-100 hover:bg-amber-500/10 transition"
          >
            {showNarrative ? 'Hide narrative' : 'View narrative'}
          </button>
          {showNarrative && (
            <div>
              <h3 className="text-sm font-semibold text-amber-200 mb-2">Narrative</h3>
              <p className="text-amber-100/80 whitespace-pre-wrap">
                {entry.personalReading}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Journal() {
  const { isAuthenticated, user, logout } = useAuth();
  const { entries, loading, deleteEntry, migrateToCloud } = useJournal();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrateMessage, setMigrateMessage] = useState('');
  const [deleteMessage, setDeleteMessage] = useState('');
  const [filters, setFilters] = useState({ query: '', contexts: [], spreads: [], timeframe: 'all', onlyReversals: false });
  const [shareLinks, setShareLinks] = useState([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState('');
  const navigate = useNavigate();

  const filteredEntries = useMemo(() => {
    if (!entries || entries.length === 0) {
      return [];
    }
    const query = filters.query.trim().toLowerCase();
    const contextSet = new Set(filters.contexts);
    const spreadSet = new Set(filters.spreads);
    const timeframeCutoff = (() => {
      const now = Date.now();
      switch (filters.timeframe) {
        case '30d':
          return now - 30 * 24 * 60 * 60 * 1000;
        case '90d':
          return now - 90 * 24 * 60 * 60 * 1000;
        case 'ytd': {
          const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
          return yearStart;
        }
        default:
          return null;
      }
    })();

    return entries.filter((entry) => {
      if (contextSet.size > 0 && !contextSet.has(entry?.context)) {
        return false;
      }
      if (spreadSet.size > 0 && !spreadSet.has(entry?.spreadKey)) {
        return false;
      }
      const entryTs = entry?.ts || (entry?.created_at ? entry.created_at * 1000 : null);
      if (timeframeCutoff && entryTs && entryTs < timeframeCutoff) {
        return false;
      }
      if (filters.onlyReversals) {
        const hasReversal = (entry?.cards || []).some((card) => (card?.orientation || '').toLowerCase().includes('reversed'));
        if (!hasReversal) {
          return false;
        }
      }
      if (query) {
        const reflections = entry?.reflections ? Object.values(entry.reflections).join(' ') : '';
        const cards = (entry?.cards || [])
          .map((card) => `${card.position || ''} ${card.name} ${card.orientation || ''}`)
          .join(' ');
        const haystack = [
          entry?.question,
          entry?.spread,
          entry?.context,
          entry?.personalReading,
          reflections,
          cards
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [entries, filters]);

  // Compute stats for both full journal and filtered view
  const allStats = useMemo(() => computeJournalStats(entries), [entries]);
  const filteredStats = useMemo(() => computeJournalStats(filteredEntries), [filteredEntries]);
  const filtersActive = Boolean(filters.query.trim()) || filters.contexts.length > 0 || filters.spreads.length > 0 || filters.timeframe !== 'all' || filters.onlyReversals;

  const fetchShareLinks = useCallback(async () => {
    if (!isAuthenticated) return;
    setShareLoading(true);
    setShareError('');
    try {
      const response = await fetch('/api/share', { credentials: 'include' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Unable to load share links');
      }
      const payload = await response.json();
      setShareLinks(payload.shares || []);
    } catch (error) {
      setShareError(error.message || 'Unable to load share links');
    } finally {
      setShareLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchShareLinks();
    } else {
      setShareLinks([]);
      setShareError('');
    }
  }, [isAuthenticated, fetchShareLinks]);

  const createShareLink = useCallback(
    async ({ scope = 'journal', entryId, title, limit, expiresInHours } = {}) => {
      if (!isAuthenticated) {
        throw new Error('Sign in to create share links');
      }
      const payload = { scope };
      if (scope === 'entry' && entryId) {
        payload.entryIds = [entryId];
      } else if (Number.isFinite(limit)) {
        payload.limit = Math.max(1, Math.min(10, Math.floor(limit)));
      }
      if (title) {
        payload.title = title;
      }
      if (Number.isFinite(expiresInHours) && expiresInHours > 0) {
        payload.expiresInHours = Math.floor(expiresInHours);
      }
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Unable to create share link');
      }
      const data = await response.json();
      await fetchShareLinks();
      return data;
    },
    [isAuthenticated, fetchShareLinks]
  );

  const deleteShareLink = useCallback(
    async (shareToken) => {
      if (!isAuthenticated) return;
      const response = await fetch(`/api/share/${shareToken}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Unable to delete share link');
      }
      await fetchShareLinks();
    },
    [isAuthenticated, fetchShareLinks]
  );

  useEffect(() => {
    const applyTheme = () => {
      const storedTheme = typeof localStorage !== 'undefined' ? localStorage.getItem('tarot-theme') : null;
      const activeTheme = storedTheme === 'light' ? 'light' : 'dark';
      const root = typeof document !== 'undefined' ? document.documentElement : null;
      if (root) {
        root.classList.toggle('light', activeTheme === 'light');
      }
    };

    applyTheme(); // Initial application

    // Guard against SSR / non-browser environments
    if (typeof window === 'undefined') return;

    // Listen for theme changes from other components or tabs
    const handleStorageChange = (e) => {
      if (e.key === 'tarot-theme') {
        applyTheme();
      }
    };
    const handleThemeBroadcast = () => applyTheme();

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('tarot-theme-change', handleThemeBroadcast);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('tarot-theme-change', handleThemeBroadcast);
    };
  }, []);

  const handleMigrate = async () => {
    setMigrating(true);
    setMigrateMessage('');

    const result = await migrateToCloud();

    if (result.success) {
      const parts = [`Migrated ${result.migrated} entries`];
      if (typeof result.skipped === 'number' && result.skipped > 0) {
        parts.push(`${result.skipped} already existed`);
      }
      setMigrateMessage(`Migration complete! ${parts.join(', ')}.`);
      setTimeout(() => setMigrateMessage(''), 5000);
    } else {
      setMigrateMessage(`Migration failed: ${result.error}`);
    }

    setMigrating(false);
  };

  const handleDelete = async (entryId) => {
    if (!confirm('Are you sure you want to delete this journal entry?')) {
      return;
    }

    const result = await deleteEntry(entryId);

    if (result.success) {
      if (isAuthenticated) {
        setDeleteMessage('Entry deleted');
        setTimeout(() => setDeleteMessage(''), 4000);
      }
    } else {
      setDeleteMessage(`Delete failed: ${result.error || 'Unknown error'}`);
      setTimeout(() => setDeleteMessage(''), 4000);
    }
  };

  // Check if we have localStorage entries that can be migrated
  const hasLocalStorageEntries = () => {
    if (typeof localStorage === 'undefined') return false;
    const stored = localStorage.getItem('tarot_journal');
    if (!stored) return false;
    try {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) && parsed.length > 0;
    } catch {
      return false;
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-amber-50">
        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <GlobalNav />

          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => navigate('/')}
              className="flex items-center text-amber-200 hover:text-amber-100"
            >
              <ChevronLeft className="w-5 h-5 mr-2" />
              Back to Reading
            </button>

            {/* Auth controls */}
            <div className="flex items-center gap-4">
              {isAuthenticated ? (
                <>
                  <span className="text-sm text-amber-200">
                    {user?.username}
                  </span>
                  <button
                    onClick={logout}
                    className="text-sm text-amber-300 hover:text-amber-200 underline"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </button>
              )}
            </div>
          </div>

          <h1 className="text-3xl font-serif text-amber-200 mb-4">Your Tarot Journal</h1>

          {/* Auth status & migration banner */}
          {isAuthenticated ? (
            <div className="mb-6 p-4 bg-emerald-900/30 border border-emerald-400/40 rounded-lg">
              <p className="text-sm text-emerald-200">
                ✓ Signed in — Your journal is synced across devices
              </p>
              {hasLocalStorageEntries() && !migrating && (
                <button
                  onClick={handleMigrate}
                  className="mt-2 flex items-center gap-2 text-sm text-emerald-300 hover:text-emerald-200 underline"
                >
                  <Upload className="w-4 h-4" />
                  Migrate localStorage entries to cloud
                </button>
              )}
              {migrating && (
                <p className="mt-2 text-sm text-emerald-300">Migrating...</p>
              )}
              {migrateMessage && (
                <p className="mt-2 text-sm text-emerald-200">{migrateMessage}</p>
              )}
            </div>
          ) : (
            <div className="mb-6 p-4 bg-amber-900/30 border border-amber-400/40 rounded-lg">
              <p className="text-sm text-amber-200">
                Your journal is currently stored locally in this browser only.{' '}
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="underline hover:text-amber-100"
                >
                  Sign in
                </button>{' '}
                to sync across devices.
              </p>
            </div>
          )}

          {/* Delete status message */}
          {deleteMessage && (
            <div className={`mb-4 p-3 rounded-lg ${deleteMessage.includes('failed') ? 'bg-red-900/30 border border-red-400/40 text-red-200' : 'bg-emerald-900/30 border border-emerald-400/40 text-emerald-200'}`}>
              <p className="text-sm">{deleteMessage}</p>
            </div>
          )}

          {/* Loading state */}
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400"></div>
              <p className="mt-4 text-amber-100/70">Loading journal...</p>
            </div>
          ) : entries.length === 0 ? (
            <p className="text-amber-100/80">No entries yet. Save a reading to start your journal.</p>
          ) : (
            <div className="space-y-8">
              <JournalFilters
                filters={filters}
                onChange={setFilters}
                contexts={CONTEXT_FILTERS}
                spreads={SPREAD_FILTERS}
              />
              {filteredStats && (
                <JournalInsightsPanel
                  stats={filteredStats}
                  allStats={allStats}
                  entries={filteredEntries}
                  allEntries={entries}
                  isAuthenticated={isAuthenticated}
                  filtersActive={filtersActive}
                  shareLinks={shareLinks}
                  shareLoading={shareLoading}
                  shareError={shareError}
                  onCreateShareLink={isAuthenticated ? createShareLink : null}
                  onDeleteShareLink={isAuthenticated ? deleteShareLink : null}
                />
              )}
              {filteredEntries.length === 0 ? (
                <p className="text-amber-100/80">No entries match your filters.</p>
              ) : (
                filteredEntries.map((entry) => (
                  <div key={entry.id} className="relative">
                    <JournalEntryCard
                      entry={entry}
                      isAuthenticated={isAuthenticated}
                      onCreateShareLink={isAuthenticated ? createShareLink : null}
                    />
                    {isAuthenticated && (
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="absolute top-4 right-4 p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition"
                        title="Delete entry"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </main>
      </div>

      {/* Auth Modal */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </>
  );
}
