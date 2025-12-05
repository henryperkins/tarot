import { memo, useEffect, useId, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { ShareNetwork, DownloadSimple, Trash, CaretDown, CaretUp, BookOpen, ClipboardText, Sparkle, CircleNotch, DotsThreeVertical } from '@phosphor-icons/react';
import { CardSymbolInsights } from './CardSymbolInsights';
import { buildCardInsightPayload, exportJournalEntriesToCsv, copyJournalEntrySummary, copyJournalEntriesToClipboard, REVERSED_PATTERN, formatContextName } from '../lib/journalInsights';
import { useSmallScreen } from '../hooks/useSmallScreen';
import { InlineStatus } from './InlineStatus.jsx';
import { useInlineStatus } from '../hooks/useInlineStatus';
import { CupsIcon, WandsIcon, SwordsIcon, PentaclesIcon, MajorIcon } from './illustrations/SuitIcons';

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

const CONTEXT_ACCENTS = {
  love: '#f4b8d6',
  career: '#8fb3ff',
  self: '#a8d9c1',
  spiritual: '#c3b4ff',
  wellbeing: '#9ce8d5',
  decision: '#f6c174',
  default: '#d2c3a5'
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
    <li className="group relative flex flex-col gap-2 rounded-xl bg-surface/50 ring-1 ring-white/5 p-3 transition-colors hover:bg-surface/60 shadow-[0_10px_26px_-20px_rgba(0,0,0,0.65)] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Position indicator bar */}
        <div className="flex-shrink-0 w-1 self-stretch rounded-full bg-secondary/25 hidden sm:block" />

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
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const entryContentId = useId();
  const narrativeId = useId();
  const cardsId = useId();
  const isSmallScreen = useSmallScreen(640); // < sm breakpoint
  const { status: inlineStatus, showStatus, clearStatus } = useInlineStatus();
  const actionMenuRef = useRef(null);
  const actionMenuButtonRef = useRef(null);

  useEffect(() => {
    if (!actionMenuOpen) return;

    const handlePointerDown = (event) => {
      const menuEl = actionMenuRef.current;
      const buttonEl = actionMenuButtonRef.current;
      if (!menuEl || menuEl.contains(event.target)) return;
      if (buttonEl && buttonEl.contains(event.target)) return;
      setActionMenuOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setActionMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [actionMenuOpen]);

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
  const accentColor = CONTEXT_ACCENTS[entry?.context] || CONTEXT_ACCENTS.default;
  const accentChipBg = `${accentColor}1f`;
  const accentChipBorder = `${accentColor}66`;
  const collapsedHeaderPadding = compact ? 'px-3 py-2.5 sm:px-3.5 sm:py-3' : 'px-3.5 py-2.5';
  const expandedHeaderPadding = compact ? 'px-4 py-4 sm:px-5 sm:py-4' : 'px-4 py-3.5 sm:px-5 sm:py-4';
  const headerPadding = isExpanded ? expandedHeaderPadding : collapsedHeaderPadding;
  const contentPadding = compact ? 'px-4 py-4 sm:p-5' : 'px-4 py-4 sm:p-5';
  const actionMenuId = `${entry.id || entry.ts || 'entry'}-actions-menu`;
  const actionMenuItems = [
    { key: 'copy', label: 'Copy entry', icon: ClipboardText, onSelect: handleEntryCopy },
    { key: 'share', label: 'Share reading', icon: ShareNetwork, onSelect: handleEntryShare },
    { key: 'export', label: 'Export CSV', icon: DownloadSimple, onSelect: handleEntryExport }
  ];

  if (isAuthenticated && onDelete) {
    actionMenuItems.push({
      key: 'delete',
      label: 'Delete entry',
      icon: Trash,
      onSelect: () => onDelete(entry.id),
      tone: 'danger'
    });
  }

  return (
    <article
      className="group relative overflow-hidden rounded-2xl bg-surface/65 ring-1 ring-white/5 transition-all shadow-[0_24px_60px_-36px_rgba(0,0,0,0.85)] hover:shadow-[0_24px_70px_-30px_rgba(0,0,0,0.9)] animate-fade-in"
      style={{
        borderLeft: `4px solid ${accentColor}66`,
        backgroundImage: 'linear-gradient(145deg, rgba(255,255,255,0.02), rgba(255,255,255,0.04))'
      }}
    >
      <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-transparent via-white/25 to-transparent pointer-events-none" aria-hidden="true" />
      <div className={`${headerPadding} ${isExpanded ? 'border-b border-white/5' : ''}`}>
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={() => setIsExpanded(prev => !prev)}
            aria-expanded={isExpanded}
            aria-controls={entryContentId}
            className="flex flex-1 items-start gap-3 rounded-xl px-1 py-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50"
          >
            <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-surface-muted/70 text-secondary/70 ring-1 ring-secondary/25">
              {isExpanded ? (
                <CaretUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <CaretDown className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </span>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 min-w-0 flex-nowrap">
                <h3 className={`font-serif ${compact ? 'text-base' : 'text-lg'} text-main flex-1 truncate`}>
                  {entry.spread || 'Tarot Reading'}
                </h3>
                {entry.context && (
                  <span
                    className="inline-flex flex-shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-tight"
                    style={{
                      color: accentColor,
                      backgroundColor: accentChipBg,
                      borderColor: accentChipBorder
                    }}
                  >
                    {formatContextName(entry.context)}
                  </span>
                )}
                {hasReflections && (
                  <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-accent/12 ring-1 ring-accent/30 px-2 py-0.5 text-[10px] font-semibold text-accent/90">
                    <Sparkle className="h-2.5 w-2.5" aria-hidden="true" />
                    {reflections.length}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-[11px] text-secondary/70 min-w-0">
                <span className="truncate">{formattedTimestamp}</span>
                {cards.length > 0 && (
                  <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-surface-muted/60 px-2 py-0.5 text-[11px] text-secondary/70">
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
          </button>

          <div className="relative flex-shrink-0 self-start">
            <button
              type="button"
              ref={actionMenuButtonRef}
              onClick={() => setActionMenuOpen((prev) => !prev)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-secondary/25 bg-surface/40 text-secondary/70 hover:border-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40"
              aria-haspopup="menu"
              aria-controls={actionMenuId}
              aria-expanded={actionMenuOpen}
              title="Entry actions"
            >
              <DotsThreeVertical className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Open entry actions</span>
            </button>

            {actionMenuOpen && (
              <div
                id={actionMenuId}
                ref={actionMenuRef}
                role="menu"
                aria-label="Entry actions"
                className="absolute right-0 top-full z-30 mt-2 w-56 rounded-2xl border border-secondary/20 bg-surface/95 p-1.5 shadow-2xl backdrop-blur"
              >
                {actionMenuItems.map((item) => {
                  const IconComponent = item.icon;
                  const isPending = pendingAction === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setActionMenuOpen(false);
                        item.onSelect();
                      }}
                      disabled={isPending}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-60 disabled:cursor-not-allowed ${
                        item.tone === 'danger'
                          ? 'text-error hover:bg-error/10 focus-visible:ring-error/40'
                          : 'text-main/80 hover:bg-secondary/10 focus-visible:ring-secondary/40'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {isPending ? (
                          <CircleNotch className="h-3.5 w-3.5 animate-spin text-secondary/70" aria-hidden="true" />
                        ) : (
                          <IconComponent className="h-4 w-4 text-secondary/70" aria-hidden="true" />
                        )}
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
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

      <div className="border-t border-secondary/10 bg-surface/30 px-4 py-2 text-[11px] text-secondary/70">
        {hasReflections ? `${reflections.length} reflection${reflections.length === 1 ? '' : 's'}` : formattedTimestamp}
      </div>
      <div className="px-4 pb-3 pt-2">
        <InlineStatus tone={inlineStatus.tone} message={inlineStatus.message} />
      </div>
    </article>
  );
});
