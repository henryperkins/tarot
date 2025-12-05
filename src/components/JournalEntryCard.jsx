import { useState, memo, useId } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { ShareNetwork, DownloadSimple, Trash, CaretDown, CaretUp, BookOpen, ClipboardText, Sparkle, CircleNotch } from '@phosphor-icons/react';
import { CardSymbolInsights } from './CardSymbolInsights';
import { buildCardInsightPayload, exportJournalEntriesToCsv, copyJournalEntrySummary, copyJournalEntriesToClipboard, REVERSED_PATTERN, formatContextName } from '../lib/journalInsights';
import { useSmallScreen } from '../hooks/useSmallScreen';
import { InlineStatus } from './InlineStatus.jsx';
import { useInlineStatus } from '../hooks/useInlineStatus';
import { CupsIcon, WandsIcon, SwordsIcon, PentaclesIcon, MajorIcon } from './illustrations/SuitIcons';

const ICON_BUTTON_CLASS = 'inline-flex items-center justify-center h-9 w-9 rounded-full border border-secondary/25 bg-surface/40 text-secondary/70 hover:border-secondary/50 hover:text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40 disabled:opacity-50 disabled:cursor-not-allowed active:bg-secondary/15';
const ICON_BUTTON_DANGER_CLASS = 'inline-flex items-center justify-center h-9 w-9 rounded-full border border-error/25 bg-surface/40 text-error/80 hover:border-error/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40 disabled:opacity-50 disabled:cursor-not-allowed active:bg-error/10';

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

function getSuitIcon(cardName) {
  if (!cardName) return MajorIcon;
  const lower = cardName.toLowerCase();
  if (lower.includes('cups') || lower.includes('chalices')) return CupsIcon;
  if (lower.includes('wands') || lower.includes('staves') || lower.includes('rods')) return WandsIcon;
  if (lower.includes('swords') || lower.includes('blades')) return SwordsIcon;
  if (lower.includes('pentacles') || lower.includes('coins') || lower.includes('disks')) return PentaclesIcon;
  return MajorIcon;
}

function renderSuitIcon(cardName, iconProps) {
  const IconComponent = getSuitIcon(cardName);
  return <IconComponent {...iconProps} />;
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
  const isReversed = REVERSED_PATTERN.test(card?.orientation || '');
  const suitIcon = renderSuitIcon(card.name, { className: 'w-3.5 h-3.5 text-secondary/60 shrink-0', 'aria-hidden': true });

  return (
    <li className="group relative flex flex-col gap-2 rounded-xl border border-secondary/20 bg-surface-muted/40 p-3 transition-colors hover:bg-surface-muted/60 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Position indicator bar */}
        <div className="flex-shrink-0 w-1 self-stretch rounded-full bg-secondary/30 hidden sm:block" />

        <div className="flex-1 min-w-0">
          {/* Position label */}
          <span className="text-[10px] font-bold uppercase tracking-wider text-secondary/70 leading-tight">
            {card.position}
          </span>
          {/* Card name + orientation */}
          <div className="flex items-center gap-2 mt-0.5">
            {suitIcon}
            <p className="text-sm font-medium text-main truncate">
              {card.name}
            </p>
            <span className={`flex-shrink-0 text-[10px] ${isReversed ? 'font-semibold text-error/80 bg-error/10' : 'text-secondary/50'} px-1.5 py-0.5 rounded`}>
              {isReversed ? 'Rev' : 'Up'}
            </span>
          </div>
        </div>
      </div>

      {/* Symbol insights - visible on mobile, hover-reveal on desktop */}
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
  const [pendingAction, setPendingAction] = useState(null);
  const entryContentId = useId();
  const narrativeId = useId();
  const cardsId = useId();
  const isSmallScreen = useSmallScreen(640); // < sm breakpoint
  const { status: inlineStatus, showStatus, clearStatus } = useInlineStatus();

  const runAction = async (actionKey, task) => {
    setPendingAction(actionKey);
    clearStatus();
    try {
      return await task();
    } finally {
      setPendingAction(null);
    }
  };

  const handleEntryExport = () => runAction('export', async () => {
    const filename = `tarot-entry-${entry.id || entry.ts || 'reading'}.csv`;
    const success = exportJournalEntriesToCsv([entry], filename);
    showStatus({
      tone: success ? 'success' : 'error',
      message: success ? `Saved ${filename}` : 'Unable to download this entry right now.'
    });
    return success;
  });

  const handleEntryCopy = async () => runAction('copy', async () => {
    const success = await copyJournalEntriesToClipboard([entry]);
    showStatus({
      tone: success ? 'success' : 'error',
      message: success ? 'Reading details copied to your clipboard.' : 'Copying was blocked by the browser.'
    });
    return success;
  });

  const handleEntryShare = async () => runAction('share', async () => {
    if (isAuthenticated && onCreateShareLink) {
      try {
        const data = await onCreateShareLink({ scope: 'entry', entryId: entry.id });
        const shareUrl = data?.url && typeof window !== 'undefined'
          ? `${window.location.origin}${data.url}`
          : null;
        if (shareUrl && navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(shareUrl);
          showStatus({ tone: 'success', message: 'Share link copied to clipboard.' });
        } else {
          showStatus({ tone: 'info', message: 'Share link ready—copy from your browser address bar.' });
        }
        return true;
      } catch (error) {
        showStatus({ tone: 'error', message: error.message || 'Unable to create a share link right now.' });
        return false;
      }
    }

    const success = await copyJournalEntrySummary(entry);
    showStatus({
      tone: success ? 'success' : 'error',
      message: success ? 'Entry summary copied to your clipboard.' : 'Unable to copy this entry right now.'
    });
    return success;
  });

  const timestamp = deriveTimestamp(entry);
  const formattedTimestamp = timestamp
    ? new Date(timestamp).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
    : 'Date unavailable';
  const cards = Array.isArray(entry?.cards) ? entry.cards : [];
  const reflections = entry?.reflections && typeof entry.reflections === 'object'
    ? Object.entries(entry.reflections).filter(([, note]) => typeof note === 'string' && note.trim())
    : [];
  const hasReflections = reflections.length > 0;
  const contextLabel = entry?.context ? formatContextName(entry.context) : '';
  const headerPadding = compact ? 'p-3.5 sm:p-4' : 'p-4';
  const contentPadding = compact ? 'px-4 py-4 sm:p-5' : 'p-5';
  const cardPreview = cards.slice(0, 3).map((card, index) => ({
    key: `${card?.position || card?.name || 'card'}-${index}`,
    name: card?.name || 'Card',
    isReversed: REVERSED_PATTERN.test(card?.orientation || (card?.isReversed ? 'reversed' : '')),
    icon: renderSuitIcon(card?.name, { className: 'w-3 h-3 text-secondary/60', 'aria-hidden': true })
  }));

  return (
    <article className="group relative rounded-2xl border border-secondary/20 bg-surface/40 transition-all hover:border-secondary/40 hover:bg-surface/60 animate-fade-in">
      <div className={`${headerPadding} ${isExpanded ? 'border-b border-secondary/10' : ''}`}>
        <button
          onClick={() => setIsExpanded(prev => !prev)}
          aria-expanded={isExpanded}
          aria-controls={entryContentId}
          className="w-full text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50 -m-1 p-1"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-surface-muted/70 text-secondary/70 ring-1 ring-secondary/25">
              {isExpanded ? (
                <CaretUp className="h-4 w-4" aria-hidden="true" />
              ) : (
                <CaretDown className="h-4 w-4" aria-hidden="true" />
              )}
            </span>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className={`font-serif ${compact ? 'text-base' : 'text-lg'} text-main truncate`}>
                  {entry.spread || 'Tarot Reading'}
                </h3>
                {contextLabel && (
                  <span className="inline-flex items-center rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-secondary/80">
                    {contextLabel}
                  </span>
                )}
                {hasReflections && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 border border-accent/20 px-2 py-0.5 text-[10px] font-semibold text-accent/90">
                    <Sparkle className="h-2.5 w-2.5" aria-hidden="true" />
                    {reflections.length}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-secondary/70">
                <span>{formattedTimestamp}</span>
                {cards.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted/60 px-2 py-0.5 text-[11px] text-secondary/70">
                    {cards.length} cards
                  </span>
                )}
              </div>

              {entry.question && (
                <p className="text-sm text-secondary/80 line-clamp-1">
                  &ldquo;{entry.question}&rdquo;
                </p>
              )}
            </div>
          </div>
        </button>

        {!isExpanded && cardPreview.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 sm:gap-2">
            {cardPreview.map((card) => (
              <span
                key={card.key}
                className="inline-flex items-center rounded-full border border-secondary/20 bg-surface-muted/80 px-2.5 py-1 text-[11px] font-medium text-main/80 shadow-sm gap-1.5"
              >
                {card.icon}
                <span className="truncate max-w-[8rem]">{card.name}</span>
                {card.isReversed && (
                  <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-error/10 text-[10px] text-error/90 ring-1 ring-error/20">
                    <CaretDown className="h-3 w-3 rotate-180" aria-hidden="true" />
                  </span>
                )}
              </span>
            ))}
            {cards.length > 3 && (
              <span className="text-[11px] font-semibold text-secondary/60">+{cards.length - 3}</span>
            )}
          </div>
        )}
      </div>

      {/* Collapsible content */}
      {isExpanded && (
        <div id={entryContentId} className={`${contentPadding} animate-slide-down`}>
          {/* Question */}
          {entry.question && (
            <div className="mb-4">
              <p className="journal-eyebrow mb-1 text-secondary/80">Question</p>
              <p className="journal-quote text-main/90">
                &ldquo;{entry.question}&rdquo;
              </p>
            </div>
          )}

          {/* Cards Grid - collapsible on mobile */}
          <div className="mb-5">
            {/* Mobile: collapsible toggle */}
            {isSmallScreen && cards.length > 0 ? (
              <div className="rounded-xl border border-secondary/15 bg-surface/30 overflow-hidden">
                <button
                  onClick={() => setShowCards(prev => !prev)}
                  aria-expanded={showCards}
                  aria-controls={cardsId}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-left active:bg-secondary/10"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-secondary/80">
                    Cards Drawn
                    <span className="ml-1.5 text-secondary/60">({cards.length})</span>
                  </span>
                  <div className="flex items-center gap-2">
                    {!showCards && (
                      <span className="text-xs text-secondary/50 truncate max-w-[140px]">
                        {cards.slice(0, 2).map(c => {
                          // Abbreviate long names: "The High Priestess" → "High Priestess", "Ace of Wands" → "Ace Wands"
                          const name = c.name || '';
                          return name.replace(/^The\s+/i, '').replace(/\s+of\s+/i, ' ');
                        }).join(', ')}
                        {cards.length > 2 && '…'}
                      </span>
                    )}
                    {showCards ? (
                      <CaretUp className="h-4 w-4 text-secondary/60 flex-shrink-0" aria-hidden="true" />
                    ) : (
                      <CaretDown className="h-4 w-4 text-secondary/60 flex-shrink-0" aria-hidden="true" />
                    )}
                  </div>
                </button>
                {showCards && (
                  <div id={cardsId} className="px-3 pb-3 animate-slide-down">
                    <ul className="grid gap-2">
                      {cards.map((card, idx) => (
                        <JournalCardListItem key={idx} card={card} />
                      ))}
                    </ul>
                  </div>
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
            <div className="mb-5">
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

      {/* Footer actions */}
      <div className="border-t border-secondary/10 bg-surface/30 px-3.5 py-2.5 flex items-center justify-between">
        <div className="hidden sm:block text-[11px] text-secondary/70">
          {hasReflections ? `${reflections.length} reflection${reflections.length === 1 ? '' : 's'}` : formattedTimestamp}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleEntryCopy}
            className={ICON_BUTTON_CLASS}
            aria-label="Copy reading details to clipboard"
            title="Copy entry"
            disabled={pendingAction === 'copy'}
          >
            {pendingAction === 'copy' ? <CircleNotch className="h-4 w-4 animate-spin" /> : <ClipboardText className="h-4 w-4" />}
            <span className="sr-only">Copy entry</span>
          </button>
          <button
            onClick={handleEntryShare}
            className={ICON_BUTTON_CLASS}
            aria-label="Share reading"
            title="Share"
            disabled={pendingAction === 'share'}
          >
            {pendingAction === 'share' ? <CircleNotch className="h-4 w-4 animate-spin" /> : <ShareNetwork className="h-4 w-4" />}
            <span className="sr-only">Share</span>
          </button>
          <button
            onClick={handleEntryExport}
            className={ICON_BUTTON_CLASS}
            aria-label="Export reading as CSV file"
            title="Export CSV"
            disabled={pendingAction === 'export'}
          >
            {pendingAction === 'export' ? <CircleNotch className="h-4 w-4 animate-spin" /> : <DownloadSimple className="h-4 w-4" />}
            <span className="sr-only">Export CSV</span>
          </button>
          {isAuthenticated && onDelete && (
            <button
              onClick={() => onDelete(entry.id)}
              className={ICON_BUTTON_DANGER_CLASS}
              aria-label="Delete reading permanently"
              title="Delete entry"
            >
              <Trash className="h-4 w-4" />
              <span className="sr-only">Delete</span>
            </button>
          )}
        </div>
      </div>
      <div className="px-4 pb-3">
        <InlineStatus tone={inlineStatus.tone} message={inlineStatus.message} />
      </div>
    </article>
  );
});
