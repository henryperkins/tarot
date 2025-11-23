import { useEffect, useRef, useState, memo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { ShareNetwork, DownloadSimple, Trash, CaretDown, CaretUp, BookOpen, ClipboardText } from '@phosphor-icons/react';
import { CardSymbolInsights } from './CardSymbolInsights';
import { buildCardInsightPayload, exportJournalEntriesToCsv, copyJournalEntrySummary, copyJournalEntriesToClipboard } from '../lib/journalInsights';

const CONTEXT_SUMMARIES = {
    love: 'Relationship lens — center relational reciprocity and communication.',
    career: 'Career lens — focus on vocation, impact, and material pathways.',
    self: 'Self lens — emphasize personal growth and inner landscape.',
    spiritual: 'Spiritual lens — frame insights through devotion, meaning, and practice.',
    decision: 'Decision lens — weigh the tradeoffs and clarify what aligns before choosing a path.'
};

const TIMING_SUMMARIES = {
  'near-term-tilt': 'Timing: energy is likely to shift in the near-term if you engage with it.',
  'longer-arc-tilt': 'Timing: this pattern stretches over a longer arc demanding patience.',
  'developing-arc': 'Timing: expect this to develop as an unfolding chapter, not a single moment.'
};

function normalizeTimestamp(value) {
  if (!Number.isFinite(value)) return null;
  return value < 1e12 ? value * 1000 : value;
}

function deriveTimestamp(entry) {
  const tsCandidates = [entry?.ts, entry?.created_at, entry?.updated_at].map(normalizeTimestamp);
  return tsCandidates.find(Boolean) || null;
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

const JournalCardListItem = memo(function JournalCardListItem({ card }) {
  const insightCard = buildCardInsightPayload(card);

  return (
    <li className="group relative flex flex-col gap-2 rounded-xl border border-secondary/20 bg-surface-muted/40 p-3 transition-colors hover:bg-surface-muted/60 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1 min-w-0">
        <span className="text-[10px] font-bold uppercase tracking-wider text-secondary/70 leading-tight">
          {card.position}
        </span>
        <div>
          <p className="text-sm font-medium text-main">
            {card.name}
          </p>
          <p className="text-xs text-secondary/60">
            {card.orientation}
          </p>
        </div>
      </div>
      {insightCard && (
        <div className="transition-opacity sm:opacity-0 sm:group-hover:opacity-100 shrink-0">
          <CardSymbolInsights card={insightCard} position={card.position} />
        </div>
      )}
    </li>
  );
});

export const JournalEntryCard = memo(function JournalEntryCard({ entry, onCreateShareLink, isAuthenticated, onDelete }) {
  const insights = buildThemeInsights(entry);
  const [showNarrative, setShowNarrative] = useState(false);
  const [entryActionMessage, setEntryActionMessage] = useState('');
  const timeoutsRef = useRef([]);

  const scheduleClear = (delay = 3500) => {
    const id = setTimeout(() => setEntryActionMessage(''), delay);
    timeoutsRef.current.push(id);
  };

  useEffect(() => () => {
    timeoutsRef.current.forEach(clearTimeout);
  }, []);

  const handleEntryExport = () => {
    const filename = `tarot-entry-${entry.id || entry.ts || 'reading'}.csv`;
    const success = exportJournalEntriesToCsv([entry], filename);
    setEntryActionMessage(success ? 'Entry CSV downloaded' : 'Export unavailable');
    scheduleClear();
  };

  const handleEntryCopy = async () => {
    const success = await copyJournalEntriesToClipboard([entry]);
    setEntryActionMessage(success ? 'Journal entry copied!' : 'Copy unavailable');
    scheduleClear();
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
    scheduleClear();
  };

  const timestamp = deriveTimestamp(entry);
  const cards = Array.isArray(entry?.cards) ? entry.cards : [];

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-secondary/20 bg-surface/40 transition-all hover:border-secondary/40 hover:bg-surface/60 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-secondary/10 p-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="font-serif text-lg text-main">{entry.spread || 'Tarot Reading'}</h3>
            {entry.context && (
              <span className="rounded-full border border-secondary/30 px-2 py-0.5 text-[10px] uppercase tracking-wider text-secondary">
                {entry.context}
              </span>
            )}
          </div>
          <p className="text-xs text-secondary/60">
            {timestamp
              ? new Date(timestamp).toLocaleString(undefined, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })
              : 'Date unavailable'}
          </p>
        </div>

        {/* Actions Toolbar */}
        <div className="flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
          <button
            onClick={handleEntryCopy}
            className="rounded-lg p-2 text-secondary/60 hover:bg-secondary/10 hover:text-secondary"
            title="Copy details"
          >
            <ClipboardText className="h-4 w-4" />
          </button>
          <button
            onClick={handleEntryExport}
            className="rounded-lg p-2 text-secondary/60 hover:bg-secondary/10 hover:text-secondary"
            title="Export CSV"
          >
            <DownloadSimple className="h-4 w-4" />
          </button>
          <button
            onClick={handleEntryShare}
            className="rounded-lg p-2 text-secondary/60 hover:bg-secondary/10 hover:text-secondary"
            title="Share"
          >
            <ShareNetwork className="h-4 w-4" />
          </button>
          {isAuthenticated && onDelete && (
            <button
              onClick={() => onDelete(entry.id)}
              className="rounded-lg p-2 text-error/60 hover:bg-error/10 hover:text-error"
              title="Delete"
            >
              <Trash className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="p-5">
        {/* Question */}
        {entry.question && (
          <div className="mb-6">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-secondary/80">Question</p>
            <p className="font-serif text-lg italic leading-relaxed text-main/90">
              &ldquo;{entry.question}&rdquo;
            </p>
          </div>
        )}

        {/* Cards Grid */}
        <div className="mb-6">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-secondary/80">Cards Drawn</p>
          {cards.length > 0 ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {cards.map((card, idx) => (
                <JournalCardListItem key={idx} card={card} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-secondary/70">No cards recorded for this entry.</p>
          )}
        </div>

        {/* Insights & Narrative */}
        <div className="space-y-4">
          {insights.length > 0 && (
            <div className="rounded-xl bg-secondary/10 p-4">
              <h4 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-secondary">
                <BookOpen className="h-3 w-3" />
                Key Themes
              </h4>
              <ul className="space-y-1.5">
                {insights.map((line, idx) => (
                  <li key={idx} className="text-sm leading-relaxed text-secondary/80">
                    • {line}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {entry.personalReading && (
            <div>
              <button
                onClick={() => setShowNarrative(!showNarrative)}
                className="flex w-full items-center justify-between rounded-xl border border-secondary/20 bg-surface/30 px-4 py-3 text-sm font-medium text-main transition-colors hover:bg-surface/50"
              >
                <span>Reading Narrative</span>
                {showNarrative ? <CaretUp className="h-4 w-4" /> : <CaretDown className="h-4 w-4" />}
              </button>

              {showNarrative && (
                <div className="mt-2 animate-slide-down rounded-xl border border-secondary/10 bg-surface/20 p-4">
                  <div className="prose prose-invert prose-sm max-w-none font-serif leading-relaxed text-muted">
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} skipHtml>
                      {entry.personalReading}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {entryActionMessage && (
        <div className="absolute bottom-4 right-4 animate-fade-in rounded-lg bg-secondary/90 px-3 py-1.5 text-xs text-white shadow-lg">
          {entryActionMessage}
        </div>
      )}
    </article>
  );
});
