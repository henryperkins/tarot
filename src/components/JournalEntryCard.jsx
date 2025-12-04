import { useEffect, useRef, useState, memo, useId } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { ShareNetwork, DownloadSimple, Trash, CaretDown, CaretUp, BookOpen, ClipboardText, DotsThreeVertical } from '@phosphor-icons/react';
import { CardSymbolInsights } from './CardSymbolInsights';
import { buildCardInsightPayload, exportJournalEntriesToCsv, copyJournalEntrySummary, copyJournalEntriesToClipboard } from '../lib/journalInsights';
import { useSmallScreen } from '../hooks/useSmallScreen';

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

export const JournalEntryCard = memo(function JournalEntryCard({ entry, onCreateShareLink, isAuthenticated, onDelete, defaultExpanded = false }) {
  const insights = buildThemeInsights(entry);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [showNarrative, setShowNarrative] = useState(false);
  const [entryActionMessage, setEntryActionMessage] = useState('');
  const [showCards, setShowCards] = useState(false); // Collapsed by default on mobile
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const timeoutsRef = useRef([]);
  const entryContentId = useId();
  const narrativeId = useId();
  const cardsId = useId();
  const actionsMenuRef = useRef(null);
  const isSmallScreen = useSmallScreen(640); // < sm breakpoint

  // Close actions menu when clicking outside
  useEffect(() => {
    if (!showActionsMenu) return undefined;

    const handleClickOutside = (event) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target)) {
        setShowActionsMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showActionsMenu]);

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
      {/* Header - clickable to expand/collapse */}
      <div className={`flex items-start justify-between p-5 ${isExpanded ? 'border-b border-secondary/10' : ''}`}>
        <button
          onClick={() => setIsExpanded(prev => !prev)}
          aria-expanded={isExpanded}
          aria-controls={entryContentId}
          className="flex-1 text-left flex items-start gap-3 min-w-0"
        >
          <div className="flex-shrink-0 mt-1">
            {isExpanded ? (
              <CaretUp className="h-4 w-4 text-secondary/60" aria-hidden="true" />
            ) : (
              <CaretDown className="h-4 w-4 text-secondary/60" aria-hidden="true" />
            )}
          </div>
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
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
            {/* Preview when collapsed */}
            {!isExpanded && entry.question && (
              <p className="text-sm text-muted truncate max-w-md mt-1">
                &ldquo;{entry.question}&rdquo;
              </p>
            )}
          </div>
        </button>

        {/* Actions Toolbar - only show when expanded */}
        {isExpanded && (
          <>
            {/* Desktop: inline buttons */}
            <div className="hidden sm:flex items-center gap-1 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100">
              <button
                onClick={handleEntryCopy}
                className="rounded-lg p-2 text-secondary/60 hover:bg-secondary/10 hover:text-secondary min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Copy reading details to clipboard"
                title="Copy details"
              >
                <ClipboardText className="h-4 w-4" />
              </button>
              <button
                onClick={handleEntryExport}
                className="rounded-lg p-2 text-secondary/60 hover:bg-secondary/10 hover:text-secondary min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Export reading as CSV file"
                title="Export CSV"
              >
                <DownloadSimple className="h-4 w-4" />
              </button>
              <button
                onClick={handleEntryShare}
                className="rounded-lg p-2 text-secondary/60 hover:bg-secondary/10 hover:text-secondary min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Share reading"
                title="Share"
              >
                <ShareNetwork className="h-4 w-4" />
              </button>
              {isAuthenticated && onDelete && (
                <button
                  onClick={() => onDelete(entry.id)}
                  className="rounded-lg p-2 text-error/60 hover:bg-error/10 hover:text-error min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label="Delete reading permanently"
                  title="Delete"
                >
                  <Trash className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Mobile: overflow menu */}
            <div className="sm:hidden relative" ref={actionsMenuRef}>
              <button
                onClick={() => setShowActionsMenu(prev => !prev)}
                className="rounded-lg p-2 text-secondary/60 hover:bg-secondary/10 hover:text-secondary min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="More actions"
                aria-expanded={showActionsMenu}
                aria-haspopup="menu"
              >
                <DotsThreeVertical className="h-5 w-5" weight="bold" />
              </button>
              {showActionsMenu && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-1 z-20 min-w-[160px] rounded-xl border border-secondary/20 bg-surface shadow-xl py-1 animate-fade-in"
                >
                  <button
                    role="menuitem"
                    onClick={() => { handleEntryCopy(); setShowActionsMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-main hover:bg-secondary/10 transition-colors"
                  >
                    <ClipboardText className="h-4 w-4 text-secondary/70" />
                    Copy details
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { handleEntryExport(); setShowActionsMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-main hover:bg-secondary/10 transition-colors"
                  >
                    <DownloadSimple className="h-4 w-4 text-secondary/70" />
                    Export CSV
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { handleEntryShare(); setShowActionsMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-main hover:bg-secondary/10 transition-colors"
                  >
                    <ShareNetwork className="h-4 w-4 text-secondary/70" />
                    Share
                  </button>
                  {isAuthenticated && onDelete && (
                    <>
                      <div className="my-1 border-t border-secondary/10" />
                      <button
                        role="menuitem"
                        onClick={() => { onDelete(entry.id); setShowActionsMenu(false); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-error hover:bg-error/10 transition-colors"
                      >
                        <Trash className="h-4 w-4" />
                        Delete
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Collapsible content */}
      {isExpanded && (
        <div id={entryContentId} className="p-5 animate-slide-down">
          {/* Question */}
          {entry.question && (
            <div className="mb-6">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-secondary/80">Question</p>
              <p className="font-serif text-lg italic leading-relaxed text-main/90">
                &ldquo;{entry.question}&rdquo;
              </p>
            </div>
          )}

          {/* Cards Grid - collapsible on mobile */}
          <div className="mb-6">
            {/* Mobile: collapsible toggle */}
            {isSmallScreen && cards.length > 0 ? (
              <div>
                <button
                  onClick={() => setShowCards(prev => !prev)}
                  aria-expanded={showCards}
                  aria-controls={cardsId}
                  className="w-full flex items-center justify-between mb-2 text-left"
                >
                  <span className="text-[10px] font-medium uppercase tracking-wider text-secondary/80">
                    Cards Drawn ({cards.length})
                  </span>
                  {showCards ? (
                    <CaretUp className="h-4 w-4 text-secondary/60" aria-hidden="true" />
                  ) : (
                    <CaretDown className="h-4 w-4 text-secondary/60" aria-hidden="true" />
                  )}
                </button>
                {showCards && (
                  <ul id={cardsId} className="grid gap-2 animate-slide-down">
                    {cards.map((card, idx) => (
                      <JournalCardListItem key={idx} card={card} />
                    ))}
                  </ul>
                )}
                {!showCards && (
                  <p className="text-xs text-secondary/60">
                    {cards.map(c => c.name).slice(0, 3).join(', ')}
                    {cards.length > 3 && ` +${cards.length - 3} more`}
                  </p>
                )}
              </div>
            ) : (
              <>
                {/* Desktop: always expanded */}
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
              </>
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
                  aria-expanded={showNarrative}
                  aria-controls={narrativeId}
                  className="flex w-full items-center justify-between rounded-xl border border-secondary/20 bg-surface/30 px-4 py-3 text-sm font-medium text-main transition-colors hover:bg-surface/50"
                >
                  <span>Reading Narrative</span>
                  {showNarrative ? <CaretUp className="h-4 w-4" aria-hidden="true" /> : <CaretDown className="h-4 w-4" aria-hidden="true" />}
                </button>

                {showNarrative && (
                  <div id={narrativeId} className="mt-2 animate-slide-down rounded-xl border border-secondary/10 bg-surface/20 p-4">
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
      )}

      {entryActionMessage && (
        <div className="absolute bottom-4 right-4 animate-fade-in rounded-lg bg-secondary/90 px-3 py-1.5 text-xs text-white shadow-lg">
          {entryActionMessage}
        </div>
      )}
    </article>
  );
});
