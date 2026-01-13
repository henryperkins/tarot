import { getTimestamp, safeJsonParse } from './utils.js';

export const REVERSED_PATTERN = /reversed/i;

function normalizeEntriesArray(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }
  return entries.filter(Boolean);
}

export function extractRecentThemes(entries, limit = 4) {
  const safeEntries = normalizeEntriesArray(entries);
  if (safeEntries.length === 0) {
    return [];
  }

  const seen = new Set();
  const results = [];

  const sorted = [...safeEntries].sort((a, b) => {
    const tsA = getTimestamp(a) || 0;
    const tsB = getTimestamp(b) || 0;
    return tsB - tsA;
  });

  for (const entry of sorted) {
    if (results.length >= limit) break;
    // Parse themes_json if it's a string (from DB or localStorage)
    const themesRaw = entry?.themes || entry?.themes_json;
    const themes = safeJsonParse(themesRaw, {});
    const candidates = [
      themes?.archetypeDescription,
      themes?.suitFocus,
      themes?.elementalBalance,
      themes?.reversalDescription?.name,
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
  const safeEntries = normalizeEntriesArray(entries);
  if (safeEntries.length === 0) {
    return null;
  }

  let totalCards = 0;
  let reversalCount = 0;
  const cardMap = new Map();
  const contextMap = new Map();
  const monthMap = new Map();

  safeEntries.forEach((entry) => {
    const contextKey = entry?.context || 'general';
    contextMap.set(contextKey, (contextMap.get(contextKey) || 0) + 1);

    const entryTimestamp = getTimestamp(entry);
    const entryDate = entryTimestamp ? new Date(entryTimestamp) : null;

    if (entryDate && !Number.isNaN(entryDate.getTime())) {
      const monthKey = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}`;
      const label = entryDate.toLocaleString('default', { month: 'short', year: 'numeric' });
      const existing = monthMap.get(monthKey) || { label, count: 0 };
      existing.count += 1;
      monthMap.set(monthKey, existing);
    }

    // Parse cards_json if it's a string (from DB or localStorage)
    const cardsRaw = entry?.cards || entry?.cards_json;
    const cards = Array.isArray(cardsRaw) ? cardsRaw : safeJsonParse(cardsRaw, []);

    cards.forEach((card) => {
      if (!card) return;
      totalCards += 1;
      const orientationFlag = card?.orientation || (card?.isReversed ? 'reversed' : 'upright');
      const isReversed = REVERSED_PATTERN.test(orientationFlag);
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
  const recentThemes = extractRecentThemes(safeEntries);

  return {
    totalReadings: safeEntries.length,
    totalCards,
    reversalRate,
    frequentCards,
    contextBreakdown,
    monthlyCadence,
    recentThemes
  };
}
