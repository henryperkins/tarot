import { computeJournalStats } from './stats.js';

function formatCardList(entry) {
  const cards = Array.isArray(entry?.cards) ? entry.cards : [];
  if (cards.length === 0) return '';
  return cards
    .slice(0, 4)
    .map(card => `${card.name}${card.orientation ? ` (${card.orientation})` : ''}`)
    .join(', ');
}

export function buildHeuristicJourneySummary(entries, statsOverride) {
  const stats = statsOverride || computeJournalStats(entries);
  if (!stats) {
    return 'Log a few readings to see your journey summary come alive.';
  }

  const opening = `Over ${stats.totalReadings} logged reading${stats.totalReadings === 1 ? '' : 's'}, a ${stats.reversalRate}% reversal tilt and ${stats.totalCards} cards point to the themes you keep circling back to.`;

  const contextLine = stats.contextBreakdown.length > 0
    ? `Top contexts: ${stats.contextBreakdown
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
        .map(ctx => `${ctx.name} (${ctx.count})`)
        .join(', ')}.`
    : '';

  const cardLine = stats.frequentCards.length > 0
    ? `Recurring cards: ${stats.frequentCards
        .map(card => `${card.name}${card.reversed ? ` · ${card.reversed} rev` : ''}`)
        .join(', ')}.`
    : '';

  const themeLine = stats.recentThemes.length > 0
    ? `Recent themes whisper about ${stats.recentThemes.slice(0, 3).join(', ')}.`
    : '';

  const highlightEntries = Array.isArray(entries)
    ? entries.slice(0, 3).map(entry => {
        const when = entry?.ts ? new Date(entry.ts).toLocaleDateString() : 'recently';
        const context = entry?.context ? `${entry.context} lens` : 'open lens';
        const spread = entry?.spread || entry?.spreadName || 'Reading';
        const cards = formatCardList(entry);
        return `• ${spread} (${context}) on ${when}${cards ? ` featured ${cards}` : ''}.`;
      })
    : [];

  const closing = 'Notice where these threads overlap and invite one grounded action to honor the energy.';

  return [opening, contextLine, cardLine, themeLine, '', ...highlightEntries, '', closing]
    .filter(Boolean)
    .join('\n');
}
