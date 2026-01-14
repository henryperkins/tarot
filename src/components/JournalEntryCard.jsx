import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { DownloadSimple, CaretDown, CaretUp, ClipboardText, CircleNotch, DotsThreeVertical, FileText, Lightning } from '@phosphor-icons/react';
import { CardSymbolInsights } from './CardSymbolInsights';
import { buildCardInsightPayload, exportJournalEntriesToCsv, exportJournalEntriesToMarkdown, copyJournalEntrySummary, copyJournalEntriesToClipboard, REVERSED_PATTERN, formatContextName } from '../lib/journalInsights';
import { useSmallScreen } from '../hooks/useSmallScreen';
import { InlineStatus } from './InlineStatus.jsx';
import { useInlineStatus } from '../hooks/useInlineStatus';
import { CupsIcon, WandsIcon, SwordsIcon, PentaclesIcon, MajorIcon } from './illustrations/SuitIcons';
import { JournalBookIcon, JournalCommentAddIcon, JournalPlusCircleIcon, JournalShareIcon, JournalTrashIcon } from './JournalIcons';
import CardRelationshipGraph from './charts/CardRelationshipGraph';
import { normalizeTimestamp, getTimestamp } from '../../shared/journal/utils.js';
import { DECK_OPTIONS } from './DeckSelector';

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

const ui = {
  cardShell:
    'group relative overflow-hidden rounded-3xl border border-[color:var(--border-warm)] ' +
    'text-[color:var(--text-main)] shadow-[0_24px_64px_-40px_rgba(0,0,0,0.85)] ' +
    'transition-all hover:translate-y-[-2px] animate-fade-in',

  cardBgStyle: {
    background:
      'radial-gradient(circle at 0% 18%, var(--glow-gold), transparent 40%),' +
      'radial-gradient(circle at 100% 0%, var(--glow-blue), transparent 38%),' +
      'radial-gradient(circle at 52% 115%, var(--glow-pink), transparent 46%),' +
      'linear-gradient(135deg, var(--panel-dark-1), var(--panel-dark-2) 55%, var(--panel-dark-3))'
  },

  pill:
    'inline-flex items-center gap-2 rounded-full border border-[color:var(--border-warm-light)] ' +
    'bg-[color:rgba(232,218,195,0.06)] px-3 py-1 text-[11px] tracking-[0.18em] uppercase ' +
    'text-[color:var(--text-muted)]',

  iconButton:
    'inline-flex min-h-[44px] min-w-[44px] h-11 w-11 items-center justify-center rounded-full border border-[color:var(--border-warm-light)] ' +
    'bg-[color:rgba(232,218,195,0.04)] text-[color:var(--text-muted)] ' +
    'hover:bg-[color:rgba(212,184,150,0.10)] hover:text-[color:var(--brand-accent)] transition ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:rgba(232,218,195,0.45)]',

  section:
    'rounded-2xl border border-[color:var(--border-warm)] bg-[color:rgba(15,14,19,0.35)] ' +
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',

  sectionHeader:
    'flex items-center justify-between gap-3 px-4 py-3 border-b border-[color:rgba(255,255,255,0.06)]',

  sectionLabel:
    'text-[11px] font-semibold tracking-[0.24em] uppercase text-[color:var(--text-muted)]',

  bodyPad: 'px-4 py-4',

  divider: 'my-4 h-px bg-[color:rgba(255,255,255,0.06)]'
};

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
  love: 'var(--brand-primary)',
  career: 'var(--color-pentacles)',
  self: 'var(--brand-accent)',
  spiritual: 'var(--color-wands)',
  wellbeing: 'var(--color-cups)',
  decision: 'var(--color-swords)',
  default: 'var(--brand-primary)'
};

const DECK_LABEL_MAP = Object.fromEntries((DECK_OPTIONS || []).map((deck) => [deck.id, deck.label]));

function getSuitAccentVar(suitName) {
  const lower = (suitName || '').toLowerCase();
  if (lower.includes('wands')) return 'var(--color-wands)';
  if (lower.includes('cups')) return 'var(--color-cups)';
  if (lower.includes('swords')) return 'var(--color-swords)';
  if (lower.includes('pentacles')) return 'var(--color-pentacles)';
  return null;
}

function formatFollowUpTimestamp(value) {
  const ts = normalizeTimestamp(value);
  if (!ts) return null;
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatRelativeTimeFromNow(value) {
  const ts = normalizeTimestamp(value);
  if (!ts) return null;
  const diff = ts - Date.now();
  const ranges = [
    { unit: 'day', ms: 24 * 60 * 60 * 1000 },
    { unit: 'hour', ms: 60 * 60 * 1000 },
    { unit: 'minute', ms: 60 * 1000 },
  ];
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  for (const range of ranges) {
    const delta = diff / range.ms;
    if (Math.abs(delta) >= 1) {
      return formatter.format(Math.round(delta), range.unit);
    }
  }
  return 'just now';
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
  const suitColor = getSuitAccentVar(card?.name) || 'var(--brand-primary)';
  const suitIcon = renderSuitIcon(card.name, {
    className: 'w-3.5 h-3.5 shrink-0',
    style: { color: suitColor },
    'aria-hidden': true
  });

  return (
    <li className="group relative flex flex-col gap-2 rounded-xl border border-[color:rgba(255,255,255,0.08)] bg-[color:rgba(15,14,19,0.25)] p-3 transition-colors hover:bg-[color:rgba(15,14,19,0.35)] shadow-[0_14px_36px_-24px_rgba(0,0,0,0.7)] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Position indicator bar */}
        <div
          className="flex-shrink-0 w-1 self-stretch rounded-full hidden sm:block opacity-70"
          aria-hidden="true"
          style={{ backgroundColor: suitColor }}
        />

        <div className="flex-1 min-w-0">
          {/* Position label */}
          <span className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--text-muted)] leading-tight">
            {card.position}
          </span>
          {/* Card name + orientation */}
          <div className="flex items-center gap-2 mt-0.5">
            {suitIcon}
            <p className="text-sm font-medium text-[color:var(--text-main)] truncate">
              {card.name}
            </p>
            {isReversed ? (
              <span className="flex-shrink-0 rounded border border-[color:color-mix(in_srgb,var(--status-error)_45%,transparent)] bg-[color:color-mix(in_srgb,var(--status-error)_12%,transparent)] px-1.5 py-0.5 text-[10px] font-semibold text-[color:var(--status-error)]">
                Rev
              </span>
            ) : (
              <span className="flex-shrink-0 rounded border border-[color:rgba(255,255,255,0.10)] px-1.5 py-0.5 text-[10px] text-[color:var(--text-muted)]">
                Up
              </span>
            )}
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
  const [menuPlacement, setMenuPlacement] = useState(null);

  const canUseDom = typeof window !== 'undefined' && typeof document !== 'undefined';
  const MENU_WIDTH = 288; // Tailwind w-72

  const updateMenuPlacement = useCallback(() => {
    if (!canUseDom) return;
    const btn = actionMenuButtonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();

    // Anchor to the button's right edge, clamped to viewport.
    const anchorRight = Math.min(Math.max(rect.right, MENU_WIDTH + 8), window.innerWidth - 8);

    const availableBelow = window.innerHeight - rect.bottom;
    const availableAbove = rect.top;
    const direction = (availableBelow < 260 && availableAbove > availableBelow) ? 'up' : 'down';
    const top = direction === 'down' ? (rect.bottom + 8) : (rect.top - 8);

    setMenuPlacement({
      left: anchorRight,
      top,
      direction,
    });
  }, [canUseDom]);

  useEffect(() => {
    if (!actionMenuOpen) return;
    updateMenuPlacement();
  }, [actionMenuOpen, updateMenuPlacement]);

  useEffect(() => {
    if (!actionMenuOpen) return undefined;
    if (!canUseDom) return undefined;

    const handle = () => updateMenuPlacement();
    window.addEventListener('resize', handle);
    // Capture scroll events from nested scrollers too.
    window.addEventListener('scroll', handle, true);
    return () => {
      window.removeEventListener('resize', handle);
      window.removeEventListener('scroll', handle, true);
    };
  }, [actionMenuOpen, canUseDom, updateMenuPlacement]);

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

  const handleEntryMarkdownExport = () => runAction('export-md', async () => {
    const filename = `tarot-entry-${entry.id || entry.ts || 'reading'}.md`;
    const success = exportJournalEntriesToMarkdown([entry], filename);
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

  const timestamp = getTimestamp(entry);
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
  const deckLabel = entry?.deckName || (entry?.deckId && DECK_LABEL_MAP[entry.deckId]) || entry?.deck || '';
  const relativeTimeLabel = formatRelativeTimeFromNow(timestamp);
  const cardPreview = cards.slice(0, 2);
  const narrativeText = entry?.personalReading || entry?.reading || entry?.narrative || '';
  const reflections = entry?.reflections && typeof entry.reflections === 'object'
    ? Object.entries(entry.reflections).filter(([, note]) => typeof note === 'string' && note.trim())
    : [];
  const hasReflections = reflections.length > 0;
  const followUps = useMemo(() => Array.isArray(entry?.followUps) ? entry.followUps : [], [entry?.followUps]);
  const hasFollowUps = followUps.length > 0;
  const accentColor = getSuitAccentVar(entry?.themes?.dominantSuit)
    || CONTEXT_ACCENTS[entry?.context]
    || CONTEXT_ACCENTS.default;
  const collapsedHeaderPadding = compact ? 'px-3 py-2.5 sm:px-3.5 sm:py-3' : 'px-3.5 py-2.5';
  const expandedHeaderPadding = compact ? 'px-4 py-4 sm:px-5 sm:py-4' : 'px-4 py-3.5 sm:px-5 sm:py-4';
  const headerPadding = isExpanded ? expandedHeaderPadding : collapsedHeaderPadding;
  const contentPadding = compact ? 'px-4 py-4 sm:p-5' : 'px-4 py-4 sm:p-5';
  const actionMenuId = `${entry.id || entry.ts || 'entry'}-actions-menu`;
  const actionMenuItems = [
    { key: 'copy', label: 'Copy entry', icon: ClipboardText, onSelect: handleEntryCopy },
    { key: 'share', label: 'Share reading', icon: JournalShareIcon, onSelect: handleEntryShare },
    { key: 'export', label: 'Export CSV', icon: DownloadSimple, onSelect: handleEntryExport },
    { key: 'export-md', label: 'Export Markdown', icon: FileText, onSelect: handleEntryMarkdownExport }
  ];

  if (isAuthenticated && onDelete) {
    actionMenuItems.push({
      key: 'delete',
      label: 'Delete entry',
      icon: JournalTrashIcon,
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

  const actionMenuClassName = useMemo(() => (
    // Use a mostly-opaque surface so text remains readable regardless of what's behind it.
    'fixed z-[200] w-72 max-h-[75vh] overflow-y-auto rounded-2xl border border-[color:var(--border-warm)] ' +
    'bg-[color:rgba(10,10,14,0.96)] p-2 shadow-[0_18px_60px_-34px_rgba(0,0,0,0.95)]'
  ), []);

  const menuStyle = useMemo(() => {
    if (!menuPlacement) return null;
    const transform = menuPlacement.direction === 'down'
      ? 'translateX(-100%)'
      : 'translate(-100%, -100%)';
    return {
      left: menuPlacement.left,
      top: menuPlacement.top,
      transform,
    };
  }, [menuPlacement]);
  const navigate = useNavigate();

  const handleAskFollowUp = useCallback(() => {
    const followUpPayload = {
      id: entry?.id || null,
      question: entry?.question || '',
      cards: Array.isArray(entry?.cards) ? entry.cards : [],
      personalReading: entry?.personalReading || '',
      themes: entry?.themes || null,
      spreadKey: entry?.spreadKey || null,
      spreadName: entry?.spread || entry?.spreadName || null,
      context: entry?.context || null,
      deckId: entry?.deckId || null,
      followUps: hasFollowUps ? followUps : [],
      sessionSeed: entry?.sessionSeed || null,
      requestId: entry?.requestId || null
    };

    navigate('/', {
      state: {
        followUpEntry: followUpPayload,
        openFollowUp: true
      }
    });
  }, [entry, followUps, hasFollowUps, navigate]);

  const renderActionMenu = () => {
    if (!actionMenuOpen) return null;

    const menu = (
      <div
        id={actionMenuId}
        ref={actionMenuRef}
        role="menu"
        aria-label="Entry actions"
        className={actionMenuClassName}
        style={menuStyle || undefined}
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
                    ? 'text-[color:var(--status-error)] hover:bg-[color:color-mix(in_srgb,var(--status-error)_12%,transparent)] focus-visible:ring-[color:color-mix(in_srgb,var(--status-error)_45%,transparent)]'
                    : 'text-[color:var(--text-main)] hover:bg-[color:rgba(255,255,255,0.06)] focus-visible:ring-[color:rgba(232,218,195,0.45)]'
                }`}
              >
                <span className="flex items-center gap-2">
                  {isPending ? (
                    <CircleNotch className="h-3.5 w-3.5 animate-spin text-[color:var(--text-muted)]" aria-hidden="true" />
                  ) : (
                    <IconComponent
                      className={`h-4 w-4 ${item.tone === 'danger' ? 'text-[color:var(--status-error)]' : 'text-[color:var(--brand-primary)]'}`}
                      aria-hidden="true"
                    />
                  )}
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>

        {renderShareLinks()}
      </div>
    );

    // If we can, portal to <body> so the menu is not clipped by overflow-hidden on the card.
    if (canUseDom) {
      return createPortal(menu, document.body);
    }

    // Fallback for non-DOM environments.
    return menu;
  };

  const renderShareLinks = () => (
    <div className="mt-3 rounded-xl border border-[color:var(--border-warm)] bg-[color:rgba(15,14,19,0.35)] p-3 shadow-[0_14px_36px_-24px_rgba(0,0,0,0.8)]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Active share links</p>
        {shareLoading ? (
          <CircleNotch className="h-3.5 w-3.5 animate-spin text-[color:var(--text-muted)]" aria-label="Loading share links" />
        ) : (
          <span className="text-[11px] text-[color:var(--text-muted)]">
            {shareLinksPreview.length > 0 ? `${shareLinksPreview.length}${extraShareLinks ? '+' : ''} shown` : 'None'}
          </span>
        )}
      </div>
      {shareError && (
        <p className="mt-1 text-[11px] text-[color:var(--status-error)]" aria-live="polite">{shareError}</p>
      )}
      {shareLoading && (
        <div className="mt-2 space-y-2" aria-live="polite">
          {[0, 1].map((skeleton) => (
            <div key={skeleton} className="h-10 rounded-lg bg-[color:rgba(232,218,195,0.08)] animate-pulse" />
          ))}
        </div>
      )}
      {!shareLoading && !shareError && shareLinksPreview.length === 0 && (
        <p className="mt-2 text-[12px] text-[color:var(--text-muted)]">No active links for this reading yet—create one to share it.</p>
      )}
      {!shareLoading && shareLinksPreview.length > 0 && (
        <ul className="mt-2 space-y-2">
          {shareLinksPreview.map((link) => {
            const meta = formatShareMeta(link);
            const isShareLinkPending = shareActionsDisabled;
            return (
              <li key={link.token} className="rounded-lg border border-[color:rgba(255,255,255,0.10)] bg-[color:rgba(15,14,19,0.25)] p-2.5 shadow-[0_10px_26px_-22px_rgba(0,0,0,0.7)]">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate text-sm font-semibold text-[color:var(--text-main)]">{link.title || 'Untitled link'}</p>
                    <p className="truncate text-[11px] text-[color:var(--text-muted)]">{getShareScopeLabel(link)} · {meta}</p>
                  </div>
                  <span className="text-[11px] text-[color:var(--text-muted)]">{link.viewCount || 0} views</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyShareLink(link.token)}
                    disabled={isShareLinkPending}
                    className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-warm-light)] bg-[color:rgba(232,218,195,0.06)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--text-main)] hover:bg-[color:rgba(212,184,150,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:rgba(232,218,195,0.45)] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {pendingAction === 'share-link-copy' ? (
                      <CircleNotch className="h-3 w-3 animate-spin text-[color:var(--text-muted)]" aria-hidden="true" />
                    ) : (
                      <ClipboardText className="h-3.5 w-3.5 text-[color:var(--brand-primary)]" aria-hidden="true" />
                    )}
                    Copy
                  </button>
                  {onDeleteShareLink && (
                    <button
                      type="button"
                      onClick={() => handleDeleteShareLink(link.token)}
                      disabled={isShareLinkPending}
                      className="inline-flex items-center gap-1 rounded-full border border-[color:color-mix(in_srgb,var(--status-error)_45%,transparent)] bg-[color:color-mix(in_srgb,var(--status-error)_12%,transparent)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--status-error)] hover:border-[color:color-mix(in_srgb,var(--status-error)_70%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--status-error)_45%,transparent)] disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {pendingAction === 'share-link-delete' ? (
                        <CircleNotch className="h-3 w-3 animate-spin text-[color:var(--status-error)]" aria-hidden="true" />
                      ) : (
                        <JournalTrashIcon className="h-3.5 w-3.5" aria-hidden="true" />
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
        <p className="mt-2 text-[11px] text-[color:var(--text-muted)]">Showing the first {shareLinksPreview.length} of {entryShareLinks.length} links.</p>
      )}
    </div>
  );

  // Determine if we should use compact styling (only when collapsed)
  const useCompactStyle = compact && !isExpanded;

  // Compact collapsed view - minimal 2-3 line list style
  const renderCompactHeader = () => (
    <div className="relative z-10 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsExpanded(prev => !prev)}
          aria-expanded={isExpanded}
          aria-controls={entryContentId}
          className="flex flex-1 items-center gap-2.5 min-w-0 rounded-lg py-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:rgba(232,218,195,0.45)]"
        >
          <span className="flex h-5 w-5 items-center justify-center text-[color:var(--text-muted)] flex-shrink-0">
            <CaretDown className="h-3.5 w-3.5" aria-hidden="true" />
          </span>

          <div className="min-w-0 flex-1">
            {/* Line 1: Spread name + metadata */}
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-[13px] font-semibold text-[color:var(--brand-primary)] truncate flex-1">
                {entry.spread || entry.spreadName || 'Reading'}
              </h3>
              <span className="text-[10px] text-[color:var(--text-muted)] flex-shrink-0 tabular-nums">
                {cards.length} {cards.length === 1 ? 'card' : 'cards'}
              </span>
              {entry.context && (
                <span className="text-[10px] text-[color:var(--text-muted)] flex-shrink-0 hidden sm:inline">
                  · {formatContextName(entry.context)}
                </span>
              )}
            </div>

            {/* Line 2: Card chips + deck badge for quick scanning */}
            {(cardPreview.length > 0 || deckLabel) && (
              <div className="flex flex-wrap items-center gap-1 mt-1">
                {cardPreview.slice(0, 2).map((card, idx) => {
                  const name = (card.name || 'Card').replace(/^The\s+/i, '');
                  const reversed = REVERSED_PATTERN.test(card?.orientation || '') || card?.isReversed;
                  return (
                    <span
                      key={`compact-${card.name || 'card'}-${idx}`}
                      className="inline-flex items-center gap-0.5 rounded-full border border-[color:rgba(255,255,255,0.10)] bg-[color:rgba(15,14,19,0.4)] px-1.5 py-0.5 text-[10px] text-[color:var(--text-muted)]"
                    >
                      <span className="text-[color:var(--text-main)] font-medium truncate max-w-[72px]">{name}</span>
                      {reversed && (
                        <span className="text-[9px] text-[color:var(--status-error)] font-semibold">R</span>
                      )}
                    </span>
                  );
                })}
                {cards.length > 2 && (
                  <span className="text-[10px] text-[color:var(--text-muted)]">+{cards.length - 2}</span>
                )}
                {deckLabel && (
                  <span className="text-[10px] text-[color:var(--text-muted)] opacity-70 truncate max-w-[60px]">
                    {deckLabel}
                  </span>
                )}
              </div>
            )}

            {/* Line 3: Question (truncated) */}
            {entry.question && (
              <p className="text-[11px] text-[color:var(--text-muted)] truncate mt-0.5 leading-snug">
                {entry.question}
              </p>
            )}
          </div>

          {/* Right side: relative time */}
          <span className="text-[10px] text-[color:var(--text-muted)] flex-shrink-0 tabular-nums whitespace-nowrap">
            {relativeTimeLabel || formattedTimestamp}
          </span>
        </button>

        <button
          type="button"
          ref={actionMenuButtonRef}
          onClick={(event) => {
            event.stopPropagation();
            setActionMenuOpen((prev) => {
              const next = !prev;
              if (next) {
                if (typeof requestAnimationFrame !== 'undefined') {
                  requestAnimationFrame(() => updateMenuPlacement());
                } else {
                  updateMenuPlacement();
                }
              }
              return next;
            });
          }}
          className="flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--text-muted)] hover:bg-[color:rgba(232,218,195,0.08)] hover:text-[color:var(--brand-accent)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:rgba(232,218,195,0.45)] flex-shrink-0"
          aria-haspopup="menu"
          aria-controls={actionMenuId}
          aria-expanded={actionMenuOpen}
          title="Entry actions"
        >
          <DotsThreeVertical className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Open entry actions</span>
        </button>

        {renderActionMenu()}
      </div>
    </div>
  );

  // Comfortable collapsed/expanded header - full card style with pills and previews
  const renderComfortableHeader = () => (
    <div className={`relative z-10 ${headerPadding} ${isExpanded ? 'border-b border-[color:rgba(255,255,255,0.06)]' : ''}`}>
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => setIsExpanded(prev => !prev)}
          aria-expanded={isExpanded}
          aria-controls={entryContentId}
          className="flex flex-1 items-start gap-3 rounded-xl px-1 py-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:rgba(232,218,195,0.45)]"
        >
          <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--border-warm-light)] bg-[color:rgba(232,218,195,0.05)] text-[color:var(--text-muted)] shadow-[0_10px_28px_-18px_rgba(0,0,0,0.65)]">
            {isExpanded ? (
              <CaretUp className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <CaretDown className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </span>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2 min-w-0 flex-nowrap">
              <h3 className="font-[Cormorant_Garamond] text-lg text-[color:var(--brand-primary)] flex-1 truncate tracking-[0.04em]">
                {entry.spread || entry.spreadName || 'Tarot Reading'}
              </h3>
              {entry.context && (
                <span className={ui.pill}>
                  {formatContextName(entry.context)}
                </span>
              )}
              {hasReflections && (
                <span className={ui.pill}>
                  <JournalCommentAddIcon className="h-3 w-3 text-[color:var(--brand-primary)]" aria-hidden="true" />
                  {reflections.length}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-[11px] text-[color:var(--text-muted)] min-w-0">
              <span className="truncate">{formattedTimestamp}</span>
              {cards.length > 0 && (
                <span className={ui.pill}>
                  {cards.length} cards
                </span>
              )}
            </div>

            {(cardPreview.length > 0 || deckLabel || relativeTimeLabel) && (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[color:var(--text-muted)]">
                {cardPreview.map((card, idx) => {
                  const name = (card.name || 'Card').replace(/^The\\s+/i, '');
                  const reversed = REVERSED_PATTERN.test(card?.orientation || '') || card?.isReversed;
                  return (
                    <span
                      key={`${card.name || 'card'}-${idx}`}
                      className="inline-flex items-center gap-1 rounded-full border border-[color:rgba(255,255,255,0.12)] bg-[color:rgba(15,14,19,0.3)] px-2.5 py-1 font-semibold text-[color:var(--text-muted)]"
                    >
                      <JournalPlusCircleIcon className="h-3 w-3 text-[color:var(--text-muted)]" aria-hidden="true" />
                      <span className="text-[11px] text-[color:var(--text-main)]">{name}</span>
                      {reversed && (
                        <span className="rounded border border-[color:color-mix(in_srgb,var(--status-error)_45%,transparent)] bg-[color:color-mix(in_srgb,var(--status-error)_12%,transparent)] px-1.5 py-0.5 text-[10px] font-semibold text-[color:var(--status-error)]">
                          Rev
                        </span>
                      )}
                    </span>
                  );
                })}
                {cards.length > cardPreview.length && (
                  <span className="text-[11px] text-[color:var(--text-muted)]">+{cards.length - cardPreview.length} more</span>
                )}
                {deckLabel && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[color:rgba(255,255,255,0.12)] bg-[color:rgba(15,14,19,0.3)] px-2.5 py-1 font-semibold text-[color:var(--text-muted)]">
                    Deck: <span className="text-[color:var(--text-main)]">{deckLabel}</span>
                  </span>
                )}
                {relativeTimeLabel && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[color:rgba(255,255,255,0.12)] bg-[color:rgba(15,14,19,0.3)] px-2 py-0.5 font-semibold text-[10px] text-[color:var(--text-muted)]">
                    {relativeTimeLabel}
                  </span>
                )}
              </div>
            )}

            {entry.question && (
              <p className="text-sm text-[color:var(--text-muted)] line-clamp-1">
                &ldquo;{entry.question}&rdquo;
              </p>
            )}
          </div>
        </button>

        <div className="relative flex-shrink-0 self-start">
          <button
            type="button"
            ref={actionMenuButtonRef}
            onClick={(event) => {
              event.stopPropagation();
              setActionMenuOpen((prev) => {
                const next = !prev;
                // Ensure we compute placement on open.
                if (next) {
                  // Defer to next frame to ensure layout is stable.
                  if (typeof requestAnimationFrame !== 'undefined') {
                    requestAnimationFrame(() => updateMenuPlacement());
                  } else {
                    updateMenuPlacement();
                  }
                }
                return next;
              });
            }}
            className={ui.iconButton}
            aria-haspopup="menu"
            aria-controls={actionMenuId}
            aria-expanded={actionMenuOpen}
            title="Entry actions"
          >
            <DotsThreeVertical className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Open entry actions</span>
          </button>

          {renderActionMenu()}
        </div>
      </div>
    </div>
  );

  return (
    <article
      className={`${useCompactStyle
        ? 'group relative overflow-hidden rounded-xl border border-[color:var(--border-warm)] text-[color:var(--text-main)] shadow-[0_4px_12px_-8px_rgba(0,0,0,0.5)] transition-all hover:bg-[color:rgba(232,218,195,0.02)] animate-fade-in'
        : ui.cardShell
      } ${actionMenuOpen ? 'z-50' : 'z-0'}`}
      style={useCompactStyle
        ? {
            background: 'linear-gradient(135deg, var(--panel-dark-1), var(--panel-dark-2))',
            borderLeft: `3px solid ${accentColor}`
          }
        : {
            ...ui.cardBgStyle,
            borderLeft: `4px solid ${accentColor}`
          }
      }
    >
      {useCompactStyle ? renderCompactHeader() : renderComfortableHeader()}

      {/* Collapsible content */}
      {isExpanded && (
        <div id={entryContentId} className={`relative z-10 ${contentPadding} animate-slide-down`}>
          {entry.question && (
            <section className={ui.section}>
              <header className={ui.sectionHeader}>
                <div className="min-w-0">
                  <div className={ui.sectionLabel}>Question</div>
                  <div className="mt-1 text-[12px] text-[color:var(--text-muted)]">
                    {formattedTimestamp}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {entry.context && <span className={ui.pill}>{formatContextName(entry.context)}</span>}
                  <span className={ui.pill}>{cards.length} cards</span>
                </div>
              </header>

              <div className={ui.bodyPad}>
                <p className="font-[Cormorant_Garamond] text-[20px] leading-[1.35] text-[color:var(--text-main)] italic">
                  &ldquo;{entry.question}&rdquo;
                </p>
              </div>
            </section>
          )}

          <section className={`${ui.section} ${entry.question ? 'mt-4' : ''}`}>
            {isSmallScreen && cards.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowCards(prev => !prev)}
                aria-expanded={showCards}
                aria-controls={cardsId}
                className={`${ui.sectionHeader} w-full text-left hover:bg-[color:rgba(255,255,255,0.03)] transition`}
              >
                <div className="flex items-center gap-3">
                  <div className={ui.sectionLabel}>View cards</div>
                  <span className="text-[12px] text-[color:var(--text-muted)]">({cards.length})</span>
                </div>

                <div className="text-[color:var(--text-muted)]">
                  {showCards ? <CaretUp className="h-5 w-5" aria-hidden="true" /> : <CaretDown className="h-5 w-5" aria-hidden="true" />}
                </div>
              </button>
            ) : (
              <header className={ui.sectionHeader}>
                <div className={ui.sectionLabel}>Cards drawn</div>
                <span className="text-[12px] text-[color:var(--text-muted)]">{cards.length}</span>
              </header>
            )}

            {isSmallScreen && cards.length > 0 && !showCards && (
              <div className={ui.bodyPad}>
                <div className="flex flex-wrap gap-2">
                  {cards.slice(0, 2).map((card, idx) => {
                    const name = (card.name || '').replace(/^The\s+/i, '').replace(/\s+of\s+/i, ' ');
                    return (
                      <span
                        key={`${card.name || 'card'}-${idx}`}
                        className="inline-flex items-center gap-1 rounded-full border border-[color:rgba(255,255,255,0.10)] bg-[color:rgba(15,14,19,0.25)] px-2.5 py-1 text-[12px] font-medium text-[color:var(--text-main)]"
                      >
                        <JournalPlusCircleIcon className="h-3 w-3 text-[color:var(--text-muted)]" aria-hidden="true" />
                        {name || 'Card'}
                      </span>
                    );
                  })}
                  {cards.length > 2 && (
                    <span className="text-xs text-[color:var(--text-muted)]">+{cards.length - 2} more</span>
                  )}
                </div>
              </div>
            )}

            <div
              id={cardsId}
              className={`${isSmallScreen && cards.length > 0 ? (showCards ? 'block' : 'hidden') : 'block'} ${ui.bodyPad} ${isSmallScreen && cards.length > 0 ? 'pt-0' : ''}`}
            >
              {cards.length > 0 ? (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {cards.map((card, idx) => (
                    <JournalCardListItem key={idx} card={card} />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[color:var(--text-muted)]">No cards recorded for this entry.</p>
              )}
            </div>
          </section>

          {hasReflections && (
            <section className={`${ui.section} mt-4`}>
              <header className={ui.sectionHeader}>
                <div className={ui.sectionLabel}>Reflections</div>
                <span className="text-[12px] text-[color:var(--text-muted)]">{reflections.length}</span>
              </header>
              <div className={ui.bodyPad}>
                <ul className="space-y-2">
                  {reflections.map(([position, note], index) => (
                    <li key={`${position || 'reflection'}-${index}`} className="flex items-start gap-2 text-[14px] leading-relaxed">
                      <span className="font-semibold text-[color:var(--text-main)]">
                        {position || `Note ${index + 1}`}
                      </span>
                      <span className="text-[color:var(--text-muted)]">{note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {insights.length > 0 && (
            <section className={`${ui.section} mt-4`}>
              <header className={ui.sectionHeader}>
                <div className="flex items-center gap-2">
                  <JournalBookIcon className="h-4 w-4 text-[color:var(--brand-primary)]" aria-hidden="true" />
                  <div className={ui.sectionLabel}>Key themes</div>
                </div>
              </header>
              <div className={ui.bodyPad}>
                <ul className="space-y-2">
                  {insights.map((line, idx) => (
                    <li key={idx} className="text-[14px] leading-relaxed text-[color:var(--text-muted)]">
                      <span className="mr-2 text-[color:var(--brand-primary)]">•</span>
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {entry.themes?.knowledgeGraph?.graphKeys && (
            <section className={`${ui.section} mt-4`}>
              <CardRelationshipGraph
                cards={cards}
                graphKeys={entry.themes.knowledgeGraph.graphKeys}
              />
            </section>
          )}

          {hasFollowUps && (
            <section className={`${ui.section} mt-4`}>
              <header className={ui.sectionHeader}>
                <div className="flex items-center gap-2">
                  <Lightning className="h-4 w-4 text-[color:var(--brand-primary)]" aria-hidden="true" />
                  <div className={ui.sectionLabel}>Follow-up chat</div>
                </div>
                <span className="text-[12px] text-[color:var(--text-muted)]">{followUps.length}</span>
              </header>
              <div className={ui.bodyPad}>
                <ol className="space-y-3">
                  {followUps.map((turn, idx) => {
                    const key = turn.turnNumber || idx;
                    const turnLabel = turn.turnNumber ? `Turn ${turn.turnNumber}` : `Turn ${idx + 1}`;
                    const tsLabel = formatFollowUpTimestamp(turn.createdAt);
                    const patterns = turn.journalContext?.patterns || [];
                    return (
                      <li
                        key={key}
                        className="rounded-xl border border-[color:rgba(255,255,255,0.08)] bg-[color:rgba(15,14,19,0.25)] p-3 shadow-[0_10px_26px_-22px_rgba(0,0,0,0.7)]"
                      >
                        <div className="flex items-start justify-between gap-2 text-[12px] text-[color:var(--text-muted)]">
                          <span className="flex items-center gap-2">
                            <span className="font-semibold text-[color:var(--text-main)]">{turnLabel}</span>
                            {tsLabel && <span aria-hidden="true">•</span>}
                            {tsLabel && <span>{tsLabel}</span>}
                          </span>
                          {patterns.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-[color:var(--brand-primary)]">
                              <Lightning className="h-3 w-3" weight="fill" aria-hidden="true" />
                              {patterns.length} pattern{patterns.length === 1 ? '' : 's'}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 space-y-2">
                          <p className="text-sm font-semibold text-[color:var(--text-main)]">
                            Q: {turn.question}
                          </p>
                          <div className="prose prose-invert prose-sm max-w-none text-[color:var(--text-main)] prose-a:text-[color:var(--brand-primary)] prose-strong:text-[color:var(--text-main)]">
                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} skipHtml>
                              {turn.answer || ''}
                            </ReactMarkdown>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAskFollowUp}
                    className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-warm-light)] bg-[color:rgba(232,218,195,0.06)] px-3 py-1.5 text-[12px] font-semibold text-[color:var(--text-main)] hover:border-[color:var(--border-warm)] hover:bg-[color:rgba(232,218,195,0.12)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:rgba(232,218,195,0.45)]"
                  >
                    <Lightning className="h-3.5 w-3.5 text-[color:var(--brand-primary)]" aria-hidden="true" />
                    Ask a follow-up
                  </button>
                  <span className="text-[11px] text-[color:var(--text-muted)]">Opens chat with this reading</span>
                </div>
              </div>
            </section>
          )}

          {narrativeText && (
            <section className={`${ui.section} mt-4`}>
              <button
                type="button"
                onClick={() => setShowNarrative(prev => !prev)}
                aria-expanded={showNarrative}
                aria-controls={narrativeId}
                className={`${ui.sectionHeader} w-full text-left hover:bg-[color:rgba(255,255,255,0.03)] transition`}
              >
                <div className={ui.sectionLabel}>Reading narrative</div>
                <div className="text-[color:var(--text-muted)]">
                  {showNarrative ? <CaretUp className="h-5 w-5" aria-hidden="true" /> : <CaretDown className="h-5 w-5" aria-hidden="true" />}
                </div>
              </button>

              <div id={narrativeId} className={`${showNarrative ? 'block' : 'hidden'} ${ui.bodyPad}`}>
                <div className="prose prose-invert prose-sm max-w-none text-[color:var(--text-main)] prose-a:text-[color:var(--brand-primary)] prose-strong:text-[color:var(--text-main)]">
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} skipHtml>
                    {narrativeText}
                  </ReactMarkdown>
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {/* Footer - hidden in compact collapsed view */}
      {!useCompactStyle && (
        <div className="border-t border-[color:rgba(255,255,255,0.06)] bg-[color:rgba(15,14,19,0.25)] px-4 py-2 text-[11px] text-[color:var(--text-muted)]">
          {hasReflections ? `${reflections.length} reflection${reflections.length === 1 ? '' : 's'}` : formattedTimestamp}
        </div>
      )}
      {/* Inline status - always show when there's a message, otherwise respect compact style */}
      {(inlineStatus.message || !useCompactStyle) && (
        <div className={`${useCompactStyle ? 'px-3 pb-2' : 'px-4 pb-3 pt-2'}`} aria-live="polite">
          <InlineStatus tone={inlineStatus.tone} message={inlineStatus.message} />
        </div>
      )}
    </article>
  );
});
