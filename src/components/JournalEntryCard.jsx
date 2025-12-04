import { useEffect, useRef, useState, memo, useId } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { ShareNetwork, DownloadSimple, Trash, CaretDown, CaretUp, BookOpen, ClipboardText, DotsThreeVertical, Sparkle } from '@phosphor-icons/react';
import { CardSymbolInsights } from './CardSymbolInsights';
import { buildCardInsightPayload, exportJournalEntriesToCsv, copyJournalEntrySummary, copyJournalEntriesToClipboard, REVERSED_PATTERN } from '../lib/journalInsights';
import { useSmallScreen } from '../hooks/useSmallScreen';
import { useToast } from '../contexts/ToastContext.jsx';

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

export const JournalEntryCard = memo(function JournalEntryCard({ entry, onCreateShareLink, isAuthenticated, onDelete, defaultExpanded = false, compact = false }) {
  const insights = buildThemeInsights(entry);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [showNarrative, setShowNarrative] = useState(false);
  const [showCards, setShowCards] = useState(false); // Collapsed by default on mobile
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const entryContentId = useId();
  const narrativeId = useId();
  const cardsId = useId();
  const actionsMenuRef = useRef(null);
  const isSmallScreen = useSmallScreen(640); // < sm breakpoint
  const { publish: showToast } = useToast();

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

  const handleEntryExport = () => {
    const filename = `tarot-entry-${entry.id || entry.ts || 'reading'}.csv`;
    const success = exportJournalEntriesToCsv([entry], filename);
    showToast({
      type: success ? 'success' : 'error',
      title: success ? 'Export started' : 'Export unavailable',
      description: success ? `Saved ${filename}` : 'Unable to download this entry right now.'
    });
  };

  const handleEntryCopy = async () => {
    const success = await copyJournalEntriesToClipboard([entry]);
    showToast({
      type: success ? 'success' : 'error',
      title: success ? 'Entry copied' : 'Copy blocked',
      description: success ? 'Reading details are in your clipboard.' : 'Copying is not supported in this browser.'
    });
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
          showToast({
            type: 'success',
            title: 'Share link copied',
            description: 'Anyone with the link can view this entry.'
          });
        } else {
          showToast({
            type: 'success',
            title: 'Share link ready',
            description: 'Copy the link shown in your browser to share.'
          });
        }
      } catch (error) {
        showToast({
          type: 'error',
          title: 'Unable to create share link',
          description: error.message || 'Please try again shortly.'
        });
      }
    } else {
      const success = await copyJournalEntrySummary(entry);
      showToast({
        type: success ? 'success' : 'error',
        title: success ? 'Snapshot ready' : 'Share unavailable',
        description: success ? 'Entry summary copied to your clipboard.' : 'Unable to copy this entry right now.'
      });
    }
  };

  const timestamp = deriveTimestamp(entry);
  const cards = Array.isArray(entry?.cards) ? entry.cards : [];
  const reflections = entry?.reflections && typeof entry.reflections === 'object'
    ? Object.entries(entry.reflections).filter(([, note]) => typeof note === 'string' && note.trim())
    : [];
  const hasReflections = reflections.length > 0;
  const headerPadding = compact ? 'p-4 sm:p-5' : 'p-5';
  const contentPadding = compact ? 'p-4 sm:p-5' : 'p-5';
  const cardPreview = cards.slice(0, 3).map((card, index) => ({
    key: `${card?.position || card?.name || 'card'}-${index}`,
    name: card?.name || 'Card',
    isReversed: REVERSED_PATTERN.test(card?.orientation || (card?.isReversed ? 'reversed' : ''))
  }));

  return (
    <article className="group relative rounded-2xl border border-secondary/20 bg-surface/40 transition-all hover:border-secondary/40 hover:bg-surface/60 animate-fade-in">
      <div className={`${headerPadding} ${isExpanded ? 'border-b border-secondary/10' : ''}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <button
            onClick={() => setIsExpanded(prev => !prev)}
            aria-expanded={isExpanded}
            aria-controls={entryContentId}
            className="flex flex-1 items-start gap-3 text-left min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50"
          >
            <div className="mt-1 flex-shrink-0">
              {isExpanded ? (
                <CaretUp className="h-4 w-4 text-secondary/60" aria-hidden="true" />
              ) : (
                <CaretDown className="h-4 w-4 text-secondary/60" aria-hidden="true" />
              )}
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className={`font-serif ${compact ? 'text-base' : 'text-lg'} text-main`}>{entry.spread || 'Tarot Reading'}</h3>
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
              {entry.question && (
                <p className="journal-prose text-muted truncate">
                  &ldquo;{entry.question}&rdquo;
                </p>
              )}
            </div>
          </button>
          {hasReflections && (
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-secondary/10 px-3 py-1 text-[11px] font-medium text-secondary/80 sm:mt-0">
              <Sparkle className="h-3 w-3" aria-hidden="true" />
              {reflections.length} reflection{reflections.length === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {!isExpanded && cardPreview.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-secondary/70">
            {cardPreview.map((card) => (
              <span key={card.key} className="rounded-full bg-surface-muted/60 px-2 py-1">
                {card.name}
                {card.isReversed && <span className="ml-1 text-error/80">R</span>}
              </span>
            ))}
            {cards.length > 3 && (
              <span className="text-secondary/50">+{cards.length - 3} more</span>
            )}
          </div>
        )}
      </div>

      {/* Collapsible content */}
      {isExpanded && (
        <div id={entryContentId} className={`${contentPadding} animate-slide-down`}>
          {/* Question */}
          {entry.question && (
            <div className="mb-6">
              <p className="journal-eyebrow mb-1 text-secondary/80">Question</p>
              <p className="journal-quote text-main/90">
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
                      <p className="journal-prose text-xs text-secondary/60">
                        {cards.map(c => c.name).slice(0, 3).join(', ')}
                        {cards.length > 3 && ` +${cards.length - 3} more`}
                      </p>
                    )}
              </div>
            ) : (
              <>
                {/* Desktop: always expanded */}
                <p className="journal-eyebrow mb-2 text-secondary/80">Cards Drawn</p>
                {cards.length > 0 ? (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {cards.map((card, idx) => (
                      <JournalCardListItem key={idx} card={card} />
                    ))}
                  </ul>
                ) : (
                  <p className="journal-prose text-sm text-secondary/70">No cards recorded for this entry.</p>
                )}
              </>
            )}
          </div>

          {hasReflections && (
            <div className="mb-6">
              <p className="journal-eyebrow mb-2 text-secondary/80">Reflections</p>
              <ul className="journal-prose space-y-1.5 text-secondary/80">
                {reflections.map(([position, note], index) => (
                  <li key={`${position || 'reflection'}-${index}`} className="flex items-start gap-2">
                    <span className="font-medium text-main">{position || `Note ${index + 1}`}</span>
                    <span className="text-secondary/70">{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

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
                  className="flex w-full items-center justify-between rounded-xl border border-secondary/20 bg-surface/30 px-4 py-3 text-sm font-medium text-main transition-colors hover:bg-surface/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50"
                >
                  <span>Reading Narrative</span>
                  {showNarrative ? <CaretUp className="h-4 w-4" aria-hidden="true" /> : <CaretDown className="h-4 w-4" aria-hidden="true" />}
                </button>

                {showNarrative && (
                  <div id={narrativeId} className="mt-2 animate-slide-down rounded-xl border border-secondary/10 bg-surface/20 p-4">
                    <div className="prose prose-invert prose-sm max-w-prose font-serif leading-relaxed text-muted">
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

      <div className="border-t border-secondary/10 bg-surface/30 px-4 py-3 sm:flex sm:items-center sm:justify-between">
        <div className="text-xs text-secondary/70">
          {hasReflections ? `${reflections.length} reflection${reflections.length === 1 ? '' : 's'}` : ''}
        </div>
        <div className="hidden sm:flex flex-wrap items-center gap-2">
          <button
            onClick={handleEntryCopy}
            className="inline-flex items-center gap-2 rounded-full border border-secondary/30 px-3 py-1.5 text-xs font-semibold text-secondary hover:border-secondary/60 hover:text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50"
            aria-label="Copy reading details to clipboard"
          >
            <ClipboardText className="h-4 w-4" />
            Copy
          </button>
          <button
            onClick={handleEntryExport}
            className="inline-flex items-center gap-2 rounded-full border border-secondary/30 px-3 py-1.5 text-xs font-semibold text-secondary hover:border-secondary/60 hover:text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50"
            aria-label="Export reading as CSV file"
          >
            <DownloadSimple className="h-4 w-4" />
            Export CSV
          </button>
          <button
            onClick={handleEntryShare}
            className="inline-flex items-center gap-2 rounded-full border border-secondary/30 px-3 py-1.5 text-xs font-semibold text-secondary hover:border-secondary/60 hover:text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50"
            aria-label="Share reading"
          >
            <ShareNetwork className="h-4 w-4" />
            Share
          </button>
          {isAuthenticated && onDelete && (
            <button
              onClick={() => onDelete(entry.id)}
              className="inline-flex items-center gap-2 rounded-full border border-error/40 px-3 py-1.5 text-xs font-semibold text-error hover:border-error/60 hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/50"
              aria-label="Delete reading permanently"
            >
              <Trash className="h-4 w-4" />
              Delete
            </button>
          )}
        </div>

        <div className="sm:hidden relative mt-3" ref={actionsMenuRef}>
          <button
            onClick={() => setShowActionsMenu(prev => !prev)}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-secondary/30 px-3 py-2 text-sm font-medium text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50"
            aria-label="More actions"
            aria-expanded={showActionsMenu}
            aria-haspopup="menu"
          >
            <DotsThreeVertical className="h-5 w-5" weight="bold" />
            Actions
          </button>
          {showActionsMenu && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-2 z-20 min-w-[160px] rounded-xl border border-secondary/20 bg-surface shadow-xl py-1 animate-fade-in"
            >
              <button
                role="menuitem"
                onClick={() => { handleEntryCopy(); setShowActionsMenu(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-main hover:bg-secondary/10 transition-colors focus-visible:outline-none focus-visible:bg-secondary/10"
              >
                <ClipboardText className="h-4 w-4 text-secondary/70" />
                Copy details
              </button>
              <button
                role="menuitem"
                onClick={() => { handleEntryExport(); setShowActionsMenu(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-main hover:bg-secondary/10 transition-colors focus-visible:outline-none focus-visible:bg-secondary/10"
              >
                <DownloadSimple className="h-4 w-4 text-secondary/70" />
                Export CSV
              </button>
              <button
                role="menuitem"
                onClick={() => { handleEntryShare(); setShowActionsMenu(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-main hover:bg-secondary/10 transition-colors focus-visible:outline-none focus-visible:bg-secondary/10"
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
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-error hover:bg-error/10 transition-colors focus-visible:outline-none focus-visible:bg-error/10"
                  >
                    <Trash className="h-4 w-4" />
                    Delete
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
});
