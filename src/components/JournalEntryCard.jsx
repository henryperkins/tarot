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

const MAX_SHARE_LINKS_IN_MENU = 6;

function formatShareExpiry(expiresAt) {
  if (!expiresAt) return 'No expiry';
  const expiryMs = typeof expiresAt === 'number' ? expiresAt : new Date(expiresAt).getTime();
  if (!Number.isFinite(expiryMs)) return 'No expiry';
  const delta = expiryMs - Date.now();
  if (delta <= 0) return 'Expired';
  const days = Math.ceil(delta / (1000 * 60 * 60 * 24));
  if (days <= 1) return 'Expires soon';
  return `Expires in ${days}d`;
}

function getShareScopeLabel(link) {
  return link?.scope === 'entry' ? 'Single reading' : 'Journal snapshot';
}

function formatShareMeta(link) {
  const entryCount = link?.entryCount || 0;
  const countLabel = entryCount === 1 ? '1 entry' : `${entryCount} entries`;
  const expiryLabel = formatShareExpiry(link?.expiresAt);
  return `${countLabel} • ${expiryLabel}`;
}

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
  const suitIcon = renderSuitIcon(card.name, { className: 'w-3.5 h-3.5 text-amber-200/70 shrink-0', 'aria-hidden': true });

  return (
    <li className="group relative flex flex-col gap-2 rounded-xl border border-amber-300/15 bg-amber-200/5 p-3 transition-colors hover:bg-amber-200/10 shadow-[0_14px_36px_-24px_rgba(0,0,0,0.7)] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Position indicator bar */}
        <div className="flex-shrink-0 w-1 self-stretch rounded-full bg-amber-300/30 hidden sm:block" />

        <div className="flex-1 min-w-0">
          {/* Position label */}
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-100/75 leading-tight">
            {card.position}
          </span>
          {/* Card name + orientation */}
          <div className="flex items-center gap-2 mt-0.5">
            {suitIcon}
            <p className="text-sm font-medium text-amber-50 truncate">
              {card.name}
            </p>
            <span className={`flex-shrink-0 text-[10px] ${isReversed ? 'font-semibold text-error/80 bg-error/10' : 'text-amber-100/60 border border-amber-200/20'} px-1.5 py-0.5 rounded`}>
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

export const JournalEntryCard = memo(function JournalEntryCard({
  entry,
  onCreateShareLink,
  isAuthenticated,
  shareLinks = [],
  shareLoading = false,
  shareError = '',
  onDelete,
  onDeleteShareLink,
  defaultExpanded = false,
  compact = false
}) {
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

    const handleCopyShareLink = async (token) => runAction('share-link-copy', async () => {
      if (!token) return false;
      if (typeof window === 'undefined') {
        showStatus({ tone: 'error', message: 'Copy is unavailable in this environment.' });
        return false;
      }
      const url = `${window.location.origin}/share/${token}`;
      if (navigator?.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(url);
          showStatus({ tone: 'success', message: 'Share link copied.' });
          return true;
        } catch (error) {
          console.warn('Clipboard write failed for share link', error);
          showStatus({ tone: 'warning', message: 'Copy blocked—open the link and copy manually.' });
          return false;
        }
      }
      showStatus({ tone: 'error', message: 'Copy not supported—open the link to share.' });
      return false;
    });

    const handleDeleteShareLink = async (token) => runAction('share-link-delete', async () => {
      if (!token || !onDeleteShareLink) return false;
      try {
        await onDeleteShareLink(token);
        showStatus({ tone: 'success', message: 'Share link removed.' });
        return true;
      } catch (error) {
        showStatus({ tone: 'error', message: error?.message || 'Unable to delete share link.' });
        return false;
      }
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

  const currentEntryId = entry?.id;
  const entryShareLinks = Array.isArray(shareLinks)
    ? shareLinks.filter((link) => {
        // Only show entry-scoped links that include this entry
        if (link?.scope && link.scope !== 'entry') return false;
        const ids = Array.isArray(link?.entryIds) ? link.entryIds : [];
        if (currentEntryId) {
          return ids.includes(currentEntryId) || link?.entryId === currentEntryId;
        }
        // Fallback: allow single-entry links even if id is missing locally
        return ids.length === 1 || link?.entryCount === 1;
      })
    : [];
  const shareLinksPreview = entryShareLinks.slice(0, MAX_SHARE_LINKS_IN_MENU);
  const extraShareLinks = Math.max(0, entryShareLinks.length - shareLinksPreview.length);
  const shareActionsDisabled = pendingAction === 'share-link-copy' || pendingAction === 'share-link-delete';

  const renderShareLinks = () => (
    <div className="mt-3 rounded-xl border border-amber-300/15 bg-amber-200/5 p-3 shadow-[0_14px_36px_-24px_rgba(0,0,0,0.8)]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-100/75">Active share links</p>
        {shareLoading ? (
          <CircleNotch className="h-3.5 w-3.5 animate-spin text-amber-200/70" aria-label="Loading share links" />
        ) : (
          <span className="text-[11px] text-amber-100/60">
            {shareLinksPreview.length > 0 ? `${shareLinksPreview.length}${extraShareLinks ? '+' : ''} shown` : 'None'}
          </span>
        )}
      </div>
      {shareError && (
        <p className="mt-1 text-[11px] text-error" aria-live="polite">{shareError}</p>
      )}
      {shareLoading && (
        <div className="mt-2 space-y-2" aria-live="polite">
          {[0, 1].map((skeleton) => (
            <div key={skeleton} className="h-10 rounded-lg bg-amber-200/10 animate-pulse" />
          ))}
        </div>
      )}
      {!shareLoading && !shareError && shareLinksPreview.length === 0 && (
        <p className="mt-2 text-[12px] text-amber-100/70">No active links for this reading yet—create one to share it.</p>
      )}
      {!shareLoading && shareLinksPreview.length > 0 && (
        <ul className="mt-2 space-y-2">
          {shareLinksPreview.map((link) => {
            const meta = formatShareMeta(link);
            const isShareLinkPending = shareActionsDisabled;
            return (
              <li key={link.token} className="rounded-lg border border-amber-200/20 bg-amber-200/5 p-2.5 shadow-[0_10px_26px_-22px_rgba(0,0,0,0.7)]">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate text-sm font-semibold text-amber-50">{link.title || 'Untitled link'}</p>
                    <p className="truncate text-[11px] text-amber-100/65">{getShareScopeLabel(link)} · {meta}</p>
                  </div>
                  <span className="text-[11px] text-amber-100/60">{link.viewCount || 0} views</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyShareLink(link.token)}
                    disabled={isShareLinkPending}
                    className="inline-flex items-center gap-1 rounded-full border border-amber-300/30 bg-amber-200/10 px-2.5 py-1 text-[11px] font-semibold text-amber-50 hover:border-amber-300/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/40 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {pendingAction === 'share-link-copy' ? (
                      <CircleNotch className="h-3 w-3 animate-spin text-amber-200/70" aria-hidden="true" />
                    ) : (
                      <ClipboardText className="h-3.5 w-3.5 text-amber-200/75" aria-hidden="true" />
                    )}
                    Copy
                  </button>
                  {onDeleteShareLink && (
                    <button
                      type="button"
                      onClick={() => handleDeleteShareLink(link.token)}
                      disabled={isShareLinkPending}
                      className="inline-flex items-center gap-1 rounded-full border border-error/40 bg-error/5 px-2.5 py-1 text-[11px] font-semibold text-error hover:border-error/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/30 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {pendingAction === 'share-link-delete' ? (
                        <CircleNotch className="h-3 w-3 animate-spin text-error/70" aria-hidden="true" />
                      ) : (
                        <Trash className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      Delete
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {extraShareLinks > 0 && (
        <p className="mt-2 text-[11px] text-amber-100/60">Showing the first {shareLinksPreview.length} of {entryShareLinks.length} links.</p>
      )}
    </div>
  );

  return (
    <article
      className={`group relative ${actionMenuOpen ? 'z-50' : 'z-0'} rounded-3xl border border-amber-300/15 bg-gradient-to-br from-[#0f0b16]/85 via-[#0c0a13]/85 to-[#0a0810]/90 ring-1 ring-amber-300/10 shadow-[0_22px_60px_-32px_rgba(0,0,0,0.9)] transition-all hover:shadow-[0_24px_70px_-26px_rgba(251,191,36,0.35)] animate-fade-in`}
      style={{
        borderLeft: `4px solid ${accentColor}66`
      }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-60 mix-blend-screen" aria-hidden="true" style={{ backgroundImage: 'radial-gradient(circle at 12% 18%, rgba(251,191,36,0.08), transparent 32%), radial-gradient(circle at 86% 28%, rgba(56,189,248,0.08), transparent 30%), radial-gradient(circle at 58% 76%, rgba(167,139,250,0.08), transparent 32%)' }} />
      <div className="pointer-events-none absolute -left-28 top-10 h-64 w-64 rounded-full bg-amber-500/12 blur-[110px]" aria-hidden="true" />
      <div className="pointer-events-none absolute right-[-120px] top-1/3 h-72 w-72 rounded-full bg-cyan-400/10 blur-[110px]" aria-hidden="true" />
      <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-transparent via-amber-200/30 to-transparent pointer-events-none" aria-hidden="true" />
      <div className={`relative z-10 ${headerPadding} ${isExpanded ? 'border-b border-amber-200/10' : ''}`}>
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={() => setIsExpanded(prev => !prev)}
            aria-expanded={isExpanded}
            aria-controls={entryContentId}
            className="flex flex-1 items-start gap-3 rounded-xl px-1 py-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50"
          >
            <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-amber-200/10 text-amber-200/80 ring-1 ring-amber-200/30 shadow-[0_10px_28px_-18px_rgba(251,191,36,0.5)]">
              {isExpanded ? (
                <CaretUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <CaretDown className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </span>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 min-w-0 flex-nowrap">
                <h3 className={`font-serif ${compact ? 'text-base' : 'text-lg'} text-amber-50 flex-1 truncate`}>
                  {entry.spread || 'Tarot Reading'}
                </h3>
                {entry.context && (
                  <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full border border-amber-200/25 bg-amber-200/10 px-2 py-0.5 text-[10px] font-semibold leading-tight text-amber-50">
                    {formatContextName(entry.context)}
                  </span>
                )}
                {hasReflections && (
                  <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full border border-amber-300/25 bg-amber-300/15 px-2 py-0.5 text-[10px] font-semibold text-amber-50 shadow-[0_12px_30px_-18px_rgba(251,191,36,0.45)]">
                    <Sparkle className="h-2.5 w-2.5 text-amber-200" aria-hidden="true" />
                    {reflections.length}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-[11px] text-amber-100/70 min-w-0">
                <span className="truncate">{formattedTimestamp}</span>
                {cards.length > 0 && (
                  <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full border border-amber-200/20 bg-amber-200/5 px-2 py-0.5 text-[11px] text-amber-100/80">
                    {cards.length} cards
                  </span>
                )}
              </div>

              {entry.question && (
                <p className="text-sm text-amber-100/75 line-clamp-1">
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
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-300/25 bg-amber-200/10 text-amber-100/75 hover:border-amber-300/50 hover:text-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/40 shadow-[0_12px_30px_-20px_rgba(251,191,36,0.5)]"
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
                className="absolute right-0 top-full z-50 mt-2 w-72 max-h-[75vh] overflow-y-auto rounded-2xl border border-amber-300/20 bg-[#0b0d18]/95 p-2 shadow-[0_16px_48px_-30px_rgba(0,0,0,0.9)] backdrop-blur"
              >
                <div className="space-y-1">
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
                            : 'text-amber-50/80 hover:bg-amber-300/10 focus-visible:ring-amber-300/40'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          {isPending ? (
                            <CircleNotch className="h-3.5 w-3.5 animate-spin text-amber-200/70" aria-hidden="true" />
                          ) : (
                            <IconComponent className="h-4 w-4 text-amber-200/75" aria-hidden="true" />
                          )}
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {renderShareLinks()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Collapsible content */}
      {isExpanded && (
        <div id={entryContentId} className={`relative z-10 ${contentPadding} animate-slide-down`}>
          {/* Question */}
          {entry.question && (
            <div className="mb-4">
              <p className="journal-eyebrow mb-1 text-amber-100/75">Question</p>
              <p className="journal-quote text-amber-50">
                &ldquo;{entry.question}&rdquo;
              </p>
            </div>
          )}

          {/* Cards Grid - collapsible on mobile */}
          <div className="mb-5">
            {/* Mobile: collapsible toggle */}
            {isSmallScreen && cards.length > 0 ? (
              <div className="rounded-xl border border-amber-200/20 bg-amber-200/5 overflow-hidden">
                <button
                  onClick={() => setShowCards(prev => !prev)}
                  aria-expanded={showCards}
                  aria-controls={cardsId}
                  className="w-full flex flex-col items-start gap-2 px-3 py-3 text-left active:bg-amber-200/10"
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-100/75">
                      View cards
                      <span className="ml-1.5 text-amber-100/60">({cards.length})</span>
                    </span>
                    {showCards ? (
                      <CaretUp className="h-5 w-5 text-amber-100/60 flex-shrink-0" aria-hidden="true" />
                    ) : (
                      <CaretDown className="h-5 w-5 text-amber-100/60 flex-shrink-0" aria-hidden="true" />
                    )}
                  </div>
                  {!showCards && (
                    <div className="flex flex-wrap gap-2">
                      {cards.slice(0, 2).map((card, idx) => {
                        const name = (card.name || '').replace(/^The\s+/i, '').replace(/\s+of\s+/i, ' ');
                        return (
                          <span
                            key={`${card.name || 'card'}-${idx}`}
                            className="inline-flex items-center gap-1 rounded-full border border-amber-200/20 bg-amber-200/5 px-2.5 py-1 text-[12px] font-medium text-amber-50"
                          >
                            <Sparkle className="h-3 w-3 text-amber-200/70" weight="fill" aria-hidden="true" />
                            {name || 'Card'}
                          </span>
                        );
                      })}
                      {cards.length > 2 && (
                        <span className="text-xs text-amber-100/60">+{cards.length - 2} more</span>
                      )}
                    </div>
                  )}
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
                <p className="journal-eyebrow mb-2 text-amber-100/75">Cards Drawn</p>
                {cards.length > 0 ? (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {cards.map((card, idx) => (
                      <JournalCardListItem key={idx} card={card} />
                    ))}
                  </ul>
                ) : (
                  <p className="journal-prose text-sm text-amber-100/65">No cards recorded for this entry.</p>
                )}
              </>
            )}
          </div>

          {hasReflections && (
            <div className="mb-5">
              <p className="journal-eyebrow mb-2 text-amber-100/75">Reflections</p>
              <ul className="journal-prose space-y-1.5 text-amber-100/80">
                {reflections.map(([position, note], index) => (
                  <li key={`${position || 'reflection'}-${index}`} className="flex items-start gap-2">
                    <span className="font-medium text-amber-50">{position || `Note ${index + 1}`}</span>
                    <span className="text-amber-100/65">{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Insights & Narrative */}
          <div className="space-y-4">
            {insights.length > 0 && (
              <div className="rounded-xl border border-amber-200/20 bg-amber-200/5 p-4">
                <h4 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-100/80">
                  <BookOpen className="h-3 w-3" />
                  Key Themes
                </h4>
                <ul className="space-y-1.5">
                  {insights.map((line, idx) => (
                    <li key={idx} className="text-sm leading-relaxed text-amber-100/80">
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
                  className="flex w-full items-center justify-between rounded-xl border border-amber-300/25 bg-amber-200/10 px-4 py-3 text-sm font-medium text-amber-50 transition-colors hover:-translate-y-0.5 hover:bg-amber-200/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50"
                >
                  <span>Reading Narrative</span>
                  {showNarrative ? <CaretUp className="h-4 w-4 text-amber-200/70" aria-hidden="true" /> : <CaretDown className="h-4 w-4 text-amber-200/70" aria-hidden="true" />}
                </button>

                {showNarrative && (
                  <div id={narrativeId} className="mt-2 animate-slide-down rounded-xl border border-amber-200/20 bg-amber-200/5 p-4">
                    <div className="prose prose-invert prose-sm max-w-prose font-serif leading-relaxed text-amber-100/80">
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

      <div className="border-t border-amber-200/15 bg-amber-200/5 px-4 py-2 text-[11px] text-amber-100/70">
        {hasReflections ? `${reflections.length} reflection${reflections.length === 1 ? '' : 's'}` : formattedTimestamp}
      </div>
      <div className="px-4 pb-3 pt-2" aria-live="polite">
        <InlineStatus tone={inlineStatus.tone} message={inlineStatus.message} />
      </div>
    </article>
  );
});
