import { getTimestamp, safeJsonParse } from './utils.js';

export const REVERSED_PATTERN = /reversed/i;

const MIN_READINGS_FOR_CARD_FREQUENCY = 3;
const MIN_CARDS_FOR_REVERSAL_RATE = 10;
const THEME_RECENCY_WEIGHT_RANGE = 0.5;

function normalizeEntriesArray(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }
  return entries.filter(Boolean);
}

function buildThemeSignals(entries, limit = 4) {
  const safeEntries = normalizeEntriesArray(entries);
  if (safeEntries.length === 0) {
    return { themes: [], signals: [] };
  }

  const sorted = [...safeEntries].sort((a, b) => {
    const tsA = getTimestamp(a) || 0;
    const tsB = getTimestamp(b) || 0;
    return tsB - tsA;
  });

  const signalMap = new Map();
  let entriesWithThemes = 0;

  sorted.forEach((entry, index) => {
    // Parse themes_json if it's a string (from DB or localStorage)
    const themesRaw = entry?.themes || entry?.themes_json;
    const themes = safeJsonParse(themesRaw, {});
    const candidates = [
      { type: 'archetype', text: themes?.archetypeDescription },
      { type: 'suit', text: themes?.suitFocus },
      { type: 'element', text: themes?.elementalBalance },
      { type: 'reversal', text: themes?.reversalDescription?.name },
    ];

    const recencyFactor = (sorted.length - 1 - index) / Math.max(sorted.length - 1, 1);
    const recencyWeight = 1 + (recencyFactor * THEME_RECENCY_WEIGHT_RANGE);
    const seenInEntry = new Set();
    let hasTheme = false;

    for (const candidate of candidates) {
      const text = typeof candidate.text === 'string' ? candidate.text.trim() : '';
      if (!text) continue;
      if (seenInEntry.has(`${candidate.type}:${text}`)) continue;
      seenInEntry.add(`${candidate.type}:${text}`);
      hasTheme = true;

      const key = `${candidate.type}:${text}`;
      const existing = signalMap.get(key) || {
        label: text,
        type: candidate.type,
        count: 0,
        weight: 0,
      };
      existing.count += 1;
      existing.weight += recencyWeight;
      signalMap.set(key, existing);
    }

    if (!hasTheme) {
      const contextText = typeof entry?.context === 'string' ? entry.context.trim() : '';
      if (contextText) {
        const key = `context:${contextText}`;
        const existing = signalMap.get(key) || {
          label: contextText,
          type: 'context',
          count: 0,
          weight: 0,
        };
        existing.count += 1;
        existing.weight += recencyWeight;
        signalMap.set(key, existing);
        hasTheme = true;
      }
    }

    if (hasTheme) {
      entriesWithThemes += 1;
    }
  });

  const signals = Array.from(signalMap.values())
    .map((signal) => {
      const confidence = entriesWithThemes > 0 ? signal.count / entriesWithThemes : 0;
      return {
        ...signal,
        score: signal.weight,
        confidence,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label);
    });

  const themes = [];
  const seenLabels = new Set();
  for (const signal of signals) {
    if (themes.length >= limit) break;
    if (seenLabels.has(signal.label)) continue;
    seenLabels.add(signal.label);
    themes.push(signal.label);
  }

  return { themes, signals };
}

export function extractRecentThemes(entries, limit = 4) {
  return buildThemeSignals(entries, limit).themes;
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
  const { themes: recentThemes, signals: themeSignals } = buildThemeSignals(safeEntries);
  const topTheme = themeSignals?.[0]?.label || (recentThemes.length > 0 ? recentThemes[0] : null);

  return {
    totalReadings: safeEntries.length,
    totalCards,
    reversalRate,
    reversalRateReliable: totalCards >= MIN_CARDS_FOR_REVERSAL_RATE,
    reversalRateSample: totalCards,
    frequentCards,
    cardFrequencyReliable: safeEntries.length >= MIN_READINGS_FOR_CARD_FREQUENCY,
    cardFrequencySample: safeEntries.length,
    contextBreakdown,
    monthlyCadence,
    recentThemes,
    themeSignals,
    topTheme
  };
}
