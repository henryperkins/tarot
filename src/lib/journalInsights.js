const JOURNAL_INSIGHTS_STORAGE_KEY = 'tarot_journal_insights';
const SHARE_TOKEN_STORAGE_KEY = 'tarot_journal_share_tokens';
const COACH_RECOMMENDATION_KEY = 'tarot_coach_recommendation';
export const REVERSED_PATTERN = /reversed/i;

export function buildCardInsightPayload(card) {
  if (!card?.name) return null;
  return {
    name: card.name,
    isReversed: REVERSED_PATTERN.test(card?.orientation),
    image: card.image || null
  };
}

function extractRecentThemes(entries, limit = 4) {
  if (!Array.isArray(entries)) return [];
  const seen = new Set();
  const results = [];

  const sorted = [...entries].sort((a, b) => (b.ts || 0) - (a.ts || 0));
  for (const entry of sorted) {
    if (results.length >= limit) break;
    const themes = entry?.themes || {};
    const candidates = [
      themes.archetypeDescription,
      themes.suitFocus,
      themes.elementalBalance,
      themes.reversalDescription?.name,
      entry?.context
    ];
    for (const candidate of candidates) {
      const text = typeof candidate === 'string' ? candidate.trim() : '';
      if (text && !seen.has(text)) {
        seen.add(text);
        results.push(text);
        if (results.length >= limit) {
          break;
        }
      }
    }
  }

  return results;
}

export function computeJournalStats(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return null;
  }

  let totalCards = 0;
  let reversalCount = 0;
  const cardMap = new Map();
  const contextMap = new Map();
  const monthMap = new Map();

  entries.forEach((entry) => {
    const contextKey = entry?.context || 'general';
    contextMap.set(contextKey, (contextMap.get(contextKey) || 0) + 1);

    const entryDate = entry?.ts ? new Date(entry.ts) : null;
    if (entryDate && !Number.isNaN(entryDate.getTime())) {
      const monthKey = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}`;
      const label = entryDate.toLocaleString('default', { month: 'short', year: 'numeric' });
      const existing = monthMap.get(monthKey) || { label, count: 0 };
      existing.count += 1;
      monthMap.set(monthKey, existing);
    }

    (entry?.cards || []).forEach((card) => {
      totalCards += 1;
      const isReversed = REVERSED_PATTERN.test(card?.orientation);
      if (isReversed) {
        reversalCount += 1;
      }
      const cardKey = card?.name || 'Unknown card';
      const aggregate = cardMap.get(cardKey) || { name: cardKey, count: 0, reversed: 0 };
      aggregate.count += 1;
      if (isReversed) {
        aggregate.reversed += 1;
      }
      cardMap.set(cardKey, aggregate);
    });
  });

  const frequentCards = Array.from(cardMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  const contextBreakdown = Array.from(contextMap.entries()).map(([name, count]) => ({ name, count }));

  const monthlyCadence = Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6)
    .map(([, data]) => data);

  const reversalRate = totalCards === 0 ? 0 : Math.round((reversalCount / totalCards) * 100);
  const recentThemes = extractRecentThemes(entries);

  return {
    totalReadings: entries.length,
    totalCards,
    reversalRate,
    frequentCards,
    contextBreakdown,
    monthlyCadence,
    recentThemes
  };
}

export function persistJournalInsights(entries) {
  if (typeof localStorage === 'undefined') return null;
  const stats = computeJournalStats(entries);
  if (!stats) {
    localStorage.removeItem(JOURNAL_INSIGHTS_STORAGE_KEY);
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

function buildCsv(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return '';
  const header = ['Timestamp', 'Spread', 'Question', 'Cards', 'Context'];
  const rows = entries.map((entry) => {
    const timestamp = entry?.ts ? new Date(entry.ts).toISOString() : '';
    const spread = entry?.spread || entry?.spreadName || '';
    const question = (entry?.question || '').replace(/"/g, '""');
    const cards = (entry?.cards || [])
      .map(card => `${card.position}: ${card.name} (${card.orientation})`)
      .join(' | ')
      .replace(/"/g, '""');
    const context = entry?.context || '';
    return [timestamp, spread, question, cards, context].map(value => `"${value || ''}"`).join(',');
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
    const payload = {
      ...recommendation,
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
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Unable to load coach recommendation:', error);
    return null;
  }
}

export function exportJournalEntriesToCsv(entries, filename = 'tarot-journal.csv', scopeOverride) {
  if (typeof document === 'undefined') return false;
  const csv = buildCsv(entries);
  if (!csv) return false;
  registerShareToken(entries, scopeOverride || (filename.includes('entry') ? 'entry' : 'journal'));
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

export {
  JOURNAL_INSIGHTS_STORAGE_KEY,
  SHARE_TOKEN_STORAGE_KEY,
  COACH_RECOMMENDATION_KEY,
  registerShareToken
};
