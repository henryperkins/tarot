/**
 * useEntryMetadata.js
 * Custom hook for computing derived entry data (memoized).
 */
import { useMemo } from 'react';
import { normalizeTimestamp, getTimestamp } from '../../../../../shared/journal/utils.js';
import { formatContextName } from '../../../../lib/journalInsights';
import { DECK_OPTIONS } from '../../../DeckSelector';
import {
  CONTEXT_SUMMARIES,
  TIMING_SUMMARIES,
  FOLLOW_UP_LIMITS,
  getEntryAccentColor
} from '../EntryCard.primitives';

const DECK_LABEL_MAP = Object.fromEntries(
  (DECK_OPTIONS || []).map((deck) => [deck.id, deck.label])
);

/**
 * Build theme insight lines from entry data
 */
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

/**
 * Format timestamp for display
 */
function formatEntryTimestamp(timestamp) {
  if (!timestamp) return 'Date unavailable';
  return new Date(timestamp).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Format relative time from now
 */
function formatRelativeTimeFromNow(value) {
  const ts = normalizeTimestamp(value);
  if (!ts) return null;
  const diff = ts - Date.now();
  const ranges = [
    { unit: 'day', ms: 24 * 60 * 60 * 1000 },
    { unit: 'hour', ms: 60 * 60 * 1000 },
    { unit: 'minute', ms: 60 * 1000 }
  ];
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  for (const range of ranges) {
    const delta = diff / range.ms;
    if (Math.abs(delta) >= 1) {
      return formatter.format(Math.round(delta), range.unit);
    }
  }
  return null;
}

/**
 * Hook to compute all derived metadata for a journal entry
 */
export function useEntryMetadata(entry, { effectiveTier = 'free', isSmallScreen = false } = {}) {
  const timestamp = getTimestamp(entry);

  const insights = useMemo(() => buildThemeInsights(entry), [entry]);

  const accentColor = useMemo(() => getEntryAccentColor(entry), [entry]);

  const cards = useMemo(
    () => (Array.isArray(entry?.cards) ? entry.cards : []),
    [entry]
  );

  const deckLabel = useMemo(
    () =>
      entry?.deckName ||
      (entry?.deckId && DECK_LABEL_MAP[entry.deckId]) ||
      entry?.deck ||
      '',
    [entry]
  );

  const formattedTimestamp = useMemo(
    () => formatEntryTimestamp(timestamp),
    [timestamp]
  );

  const relativeTimeLabel = useMemo(
    () => formatRelativeTimeFromNow(timestamp),
    [timestamp]
  );

  const cardPreview = useMemo(() => cards.slice(0, 2), [cards]);

  const narrativeText = useMemo(
    () => entry?.personalReading || entry?.reading || entry?.narrative || '',
    [entry]
  );

  const reflections = useMemo(() => {
    if (!entry?.reflections || typeof entry.reflections !== 'object') return [];
    return Object.entries(entry.reflections).filter(
      ([, note]) => typeof note === 'string' && note.trim()
    );
  }, [entry]);

  const followUps = useMemo(
    () => (Array.isArray(entry?.followUps) ? entry.followUps : []),
    [entry]
  );

  const followUpLimit = useMemo(
    () => FOLLOW_UP_LIMITS[effectiveTier] || FOLLOW_UP_LIMITS.free,
    [effectiveTier]
  );

  const followUpTurnsUsed = useMemo(() => {
    if (followUps.length === 0) return 0;
    const turnNumbers = followUps
      .map((turn) => Number(turn?.turnNumber))
      .filter((value) => Number.isFinite(value));
    if (turnNumbers.length > 0) {
      return Math.max(...turnNumbers);
    }
    return followUps.length;
  }, [followUps]);

  const followUpPreviewCount = isSmallScreen ? 1 : 2;
  const followUpPreview = useMemo(
    () => (followUps.length > 0 ? followUps.slice(-followUpPreviewCount) : []),
    [followUps, followUpPreviewCount]
  );

  const contextLabel = useMemo(
    () => (entry?.context ? formatContextName(entry.context) : null),
    [entry]
  );

  return {
    // Raw data
    timestamp,
    cards,
    followUps,

    // Computed strings
    deckLabel,
    formattedTimestamp,
    relativeTimeLabel,
    narrativeText,
    contextLabel,

    // Derived arrays
    insights,
    reflections,
    cardPreview,
    followUpPreview,

    // Counts and flags
    hasReflections: reflections.length > 0,
    hasFollowUps: followUps.length > 0,
    hasHiddenFollowUps: followUps.length > followUpPreview.length,
    followUpLimit,
    followUpTurnsUsed,

    // Styling
    accentColor
  };
}
