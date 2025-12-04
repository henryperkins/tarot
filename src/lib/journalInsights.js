import { computeJournalStats, REVERSED_PATTERN } from '../../shared/journal/stats.js';
import { buildThemeQuestion, normalizeThemeLabel } from './themeText.js';

export { computeJournalStats, REVERSED_PATTERN };

const JOURNAL_INSIGHTS_STORAGE_KEY = 'tarot_journal_insights';
const SHARE_TOKEN_STORAGE_KEY = 'tarot_journal_share_tokens';
const COACH_RECOMMENDATION_KEY = 'tarot_coach_recommendation';
const COACH_STATS_SNAPSHOT_KEY = 'tarot_coach_stats_snapshot';
const COACH_RECOMMENDATION_TTL = 24 * 60 * 60 * 1000; // 24 hours

function normalizeCoachRecommendation(recommendation) {
  if (!recommendation || typeof recommendation !== 'object') return recommendation;

  const normalized = { ...recommendation };

  if (typeof normalized.customFocus === 'string') {
    const cleanedFocus = normalizeThemeLabel(normalized.customFocus) || normalized.customFocus.trim();
    normalized.customFocus = cleanedFocus || normalized.customFocus;
  }

  if (typeof normalized.question === 'string') {
    const themeMatch = normalized.question.match(/^How can I explore (?:the theme of )?(.+?) more deeply\??$/i);
    if (themeMatch) {
      const cleanedTheme = normalizeThemeLabel(themeMatch[1]) || themeMatch[1].trim();
      normalized.question = buildThemeQuestion(cleanedTheme);
      if (!normalized.customFocus) {
        normalized.customFocus = cleanedTheme;
      }
      if (cleanedTheme && typeof normalized.source === 'string' && normalized.source.startsWith('theme:')) {
        normalized.source = `theme:${cleanedTheme}`;
      }
    }
  }

  return normalized;
}

export function buildCardInsightPayload(card) {
  if (!card?.name) return null;
  return {
    name: card.name,
    isReversed: REVERSED_PATTERN.test(card?.orientation),
    image: card.image || null
  };
}

export function persistJournalInsights(entries) {
  if (typeof localStorage === 'undefined') return null;
  const stats = computeJournalStats(entries);
  if (!stats) {
    try {
      localStorage.removeItem(JOURNAL_INSIGHTS_STORAGE_KEY);
    } catch (error) {
      console.warn('Unable to clear journal insights cache:', error);
    }
    return null;
  }
  const payload = {
    stats,
    updatedAt: Date.now()
  };
  try {
    localStorage.setItem(JOURNAL_INSIGHTS_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('Unable to persist journal insights:', error);
  }
  return payload;
}

export function loadStoredJournalInsights() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(JOURNAL_INSIGHTS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.stats) return null;
    return parsed;
  } catch (error) {
    console.warn('Unable to load journal insights cache:', error);
    return null;
  }
}

export function persistCoachStatsSnapshot(stats, meta = {}) {
  if (typeof localStorage === 'undefined') return;
  try {
    if (!stats) {
      localStorage.removeItem(COACH_STATS_SNAPSHOT_KEY);
      return;
    }
    const payload = {
      stats,
      meta: {
        filtersActive: Boolean(meta.filtersActive),
        filterLabel: meta.filterLabel || null,
        entryCount: typeof meta.entryCount === 'number' ? meta.entryCount : null,
        totalEntries: typeof meta.totalEntries === 'number' ? meta.totalEntries : null
      },
      updatedAt: Date.now()
    };
    localStorage.setItem(COACH_STATS_SNAPSHOT_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('Unable to persist coach stats snapshot:', error);
  }
}

export function loadCoachStatsSnapshot() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(COACH_STATS_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.stats) return null;
    return parsed;
  } catch (error) {
    console.warn('Unable to load coach stats snapshot:', error);
    return null;
  }
}

export function buildJournalCsv(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return '';
  const header = [
    'Timestamp',
    'Spread',
    'Spread Key',
    'Question',
    'Cards',
    'Context',
    'Provider',
    'Deck',
    'Session Seed',
    'Reflections',
    'Themes',
    'Narrative'
  ];

  const escapeCsv = (value) => {
    if (value === null || value === undefined) return '""';
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    return `"${str.replace(/"/g, '""')}"`;
  };

  const formatCards = (cards = []) => {
    if (!Array.isArray(cards) || cards.length === 0) return '';
    return cards
      .map(card => {
        const pos = card?.position || '';
        const name = card?.name || card?.card || '';
        const orientation = card?.orientation || '';
        return `${pos}: ${name}${orientation ? ` (${orientation})` : ''}`;
      })
      .join(' | ');
  };

  const rows = entries.map((entry) => {
    const timestamp = entry?.ts ? new Date(entry.ts).toISOString() : '';
    const spread = entry?.spread || entry?.spreadName || '';
    const spreadKey = entry?.spreadKey || '';
    const question = entry?.question || '';
    const cards = formatCards(entry?.cards);
    const context = entry?.context || '';
    const provider = entry?.provider || '';
    const deck = entry?.deckId || entry?.deckStyle || '';
    const sessionSeed = entry?.sessionSeed || '';
    const reflections = entry?.reflections || '';
    const themes = entry?.themes || '';
    const narrative = entry?.personalReading || '';

    return [
      timestamp,
      spread,
      spreadKey,
      question,
      cards,
      context,
      provider,
      deck,
      sessionSeed,
      reflections,
      themes,
      narrative
    ].map(escapeCsv).join(',');
  });
  return `${header.join(',')}
${rows.join('\n')}`;
}

function generateShareToken() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `share_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function persistShareTokenRecord(record) {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(SHARE_TOKEN_STORAGE_KEY);
    const existing = raw ? JSON.parse(raw) : [];
    const next = [record, ...existing].slice(0, 50);
    localStorage.setItem(SHARE_TOKEN_STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.warn('Unable to persist share token record:', error);
  }
}

function registerShareToken(entries, scope = 'journal', meta = {}) {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  const entryIds = entries.map(entry => entry?.id).filter(Boolean);
  const token = generateShareToken();
  persistShareTokenRecord({
    token,
    scope,
    entryIds,
    count: entries.length,
    createdAt: Date.now(),
    meta
  });
  return token;
}

export function loadShareTokenHistory() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SHARE_TOKEN_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Unable to load share tokens:', error);
    return [];
  }
}

export function revokeShareToken(token) {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SHARE_TOKEN_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const next = Array.isArray(parsed) ? parsed.filter(record => record.token !== token) : [];
    localStorage.setItem(SHARE_TOKEN_STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch (error) {
    console.warn('Unable to revoke share token:', error);
    return [];
  }
}

export function saveCoachRecommendation(recommendation) {
  if (typeof localStorage === 'undefined') return;
  try {
    if (!recommendation) {
      localStorage.removeItem(COACH_RECOMMENDATION_KEY);
      return;
    }
    const normalized = normalizeCoachRecommendation(recommendation);
    const payload = {
      ...normalized,
      updatedAt: Date.now()
    };
    localStorage.setItem(COACH_RECOMMENDATION_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('Unable to save coach recommendation:', error);
  }
}

export function loadCoachRecommendation() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(COACH_RECOMMENDATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.updatedAt && (Date.now() - parsed.updatedAt) > COACH_RECOMMENDATION_TTL) {
      localStorage.removeItem(COACH_RECOMMENDATION_KEY);
      return null;
    }
    return normalizeCoachRecommendation(parsed);
  } catch (error) {
    console.warn('Unable to load coach recommendation:', error);
    return null;
  }
}

export function exportJournalEntriesToCsv(entries, filename = 'tarot-journal.csv') {
  if (typeof document === 'undefined') return false;
  const csv = buildJournalCsv(entries);
  if (!csv) return false;
  // CSV export is local-only; no share token needed
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}

export async function copyJournalEntriesToClipboard(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return false;
  const csv = buildJournalCsv(entries);
  if (!csv) return false;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(csv);
      return true;
    }
  } catch (error) {
    console.warn('Unable to copy journal CSV to clipboard:', error);
  }
  if (typeof document === 'undefined') return false;
  try {
    const textarea = document.createElement('textarea');
    textarea.value = csv;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (error) {
    console.warn('Unable to copy journal CSV via fallback:', error);
    return false;
  }
}

export async function copyJournalShareSummary(stats) {
  if (!stats) return false;
  const summaryLines = [
    'Mystic Tarot Journal Snapshot',
    `Entries: ${stats.totalReadings}`,
    `Cards logged: ${stats.totalCards}`,
    `Reversal rate: ${stats.reversalRate}%`
  ];

  if (Array.isArray(stats.frequentCards) && stats.frequentCards.length > 0) {
    const top = stats.frequentCards.map(card => `${card.name} (${card.count}×)`).join(', ');
    summaryLines.push(`Top cards: ${top}`);
  }

  if (Array.isArray(stats.recentThemes) && stats.recentThemes.length > 0) {
    summaryLines.push(`Themes: ${stats.recentThemes.join('; ')}`);
  }

  const summary = summaryLines.join('\n');

  try {
    if (navigator?.share) {
      await navigator.share({ text: summary, title: 'Mystic Tarot Journal Snapshot' });
      return true;
    }
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(summary);
      return true;
    }
    const textarea = document.createElement('textarea');
    textarea.value = summary;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (error) {
    console.warn('Unable to share journal summary:', error);
    return false;
  }
}

export async function copyJournalEntrySummary(entry) {
  if (!entry) return false;
  const lines = [
    `Spread: ${entry.spread || entry.spreadName || 'Reading'}`,
    entry.question ? `Question: ${entry.question}` : null,
    `Cards: ${(entry.cards || []).map(card => `${card.name}${card.orientation ? ` (${card.orientation})` : ''}`).join(', ')}`,
    entry.context ? `Context: ${entry.context}` : null,
    entry.ts ? `When: ${new Date(entry.ts).toLocaleString()}` : null
  ].filter(Boolean);
  const text = lines.join('\n');
  try {
    if (navigator?.share) {
      await navigator.share({ text, title: 'Tarot reading snapshot' });
      return true;
    }
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (error) {
    console.warn('Unable to share entry snapshot:', error);
    return false;
  }
}

// ============================================================================
// Preference Drift Analysis (Phase 5.3)
// ============================================================================
// Compares user's stated focus areas with actual reading contexts
// to surface emerging interests they might want to add to their profile.

/**
 * Map focus areas (from onboarding) to reading context categories.
 * This allows comparing what users said they care about vs what they
 * actually read about.
 */
const FOCUS_TO_CONTEXT = {
  love: 'love',
  career: 'career',
  self_worth: 'self',
  healing: 'wellbeing',
  creativity: 'career', // approximate mapping
  spirituality: 'spiritual'
};

/**
 * Compute preference drift between stated focus areas and actual reading contexts.
 *
 * @param {Array} entries - Journal entries with context field
 * @param {Array} currentFocusAreas - User's stated focus areas from onboarding
 * @returns {Object|null} Drift analysis or null if insufficient data
 */
export function computePreferenceDrift(entries, currentFocusAreas = []) {
  // Guard against empty/invalid inputs
  if (!Array.isArray(entries) || entries.length === 0) return null;
  if (!Array.isArray(currentFocusAreas) || currentFocusAreas.length === 0) return null;

  // Map focus areas to expected contexts
  const expectedContexts = new Set(
    currentFocusAreas
      .map(f => FOCUS_TO_CONTEXT[f])
      .filter(Boolean)
  );

  // Count actual contexts from entries
  const actualContextCounts = {};
  entries.forEach(entry => {
    const ctx = entry?.context;
    if (ctx && typeof ctx === 'string') {
      actualContextCounts[ctx] = (actualContextCounts[ctx] || 0) + 1;
    }
  });

  // Find drift: contexts user reads about but didn't select as focus
  const driftContexts = Object.entries(actualContextCounts)
    .filter(([ctx]) => !expectedContexts.has(ctx))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // Get top actual contexts for comparison
  const actualTopContexts = Object.entries(actualContextCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([context, count]) => ({ context, count }));

  return {
    expectedContexts: Array.from(expectedContexts),
    actualTopContexts,
    driftContexts: driftContexts.map(([context, count]) => ({ context, count })),
    hasDrift: driftContexts.length > 0
  };
}

/**
 * Format a context name for display (capitalize first letter).
 * @param {string} context - Raw context string
 * @returns {string} Formatted context name
 */
export function formatContextName(context) {
  if (!context || typeof context !== 'string') return '';
  return context.charAt(0).toUpperCase() + context.slice(1);
}

export {
  JOURNAL_INSIGHTS_STORAGE_KEY,
  SHARE_TOKEN_STORAGE_KEY,
  COACH_RECOMMENDATION_KEY,
  registerShareToken
};
