import { buildThemeQuestion, normalizeThemeLabel } from './themeText.js';
import { CONTEXT_HINTS, FOCUS_AREA_SUGGESTIONS } from './coachConstants.js';

export function describePrefillSource(source) {
  if (!source) return null;
  const label = typeof source.label === 'string' ? source.label.trim() : '';
  const normalizedSource = typeof source.source === 'string' ? source.source.toLowerCase() : '';

  if (normalizedSource === 'template') {
    return label ? `template "${label}"` : 'a saved template';
  }

  if (normalizedSource === 'suggestion') {
    return label ? `suggestion "${label}"` : 'a personalized suggestion';
  }

  if (normalizedSource === 'journal' || normalizedSource === 'insight' || normalizedSource === 'insights') {
    return label ? `journal insight "${label}"` : 'your journal insights';
  }

  if (normalizedSource && label) {
    return `${source.source} "${label}"`;
  }

  if (label) {
    return label;
  }

  if (normalizedSource) {
    return source.source;
  }

  return 'your journal insights';
}

export function buildPersonalizedSuggestions(stats, history = [], focusAreas = []) {
  const suggestions = [];
  const hasJournalSignals = Boolean(
    (Array.isArray(stats?.frequentCards) && stats.frequentCards.length > 0)
    || (Array.isArray(stats?.recentThemes) && stats.recentThemes.length > 0)
    || (Array.isArray(stats?.contextBreakdown) && stats.contextBreakdown.length > 0)
  );

  if (stats?.frequentCards?.length) {
    stats.frequentCards.slice(0, 2).forEach((card, idx) => {
      const reversedCount = Number.isFinite(card.reversed)
        ? card.reversed
        : (Number.isFinite(card.reversedCount) ? card.reversedCount : 0);
      const label =
        idx === 0 ? `Recurring card: ${card.name}` : `${card.name} keeps showing up`;
      suggestions.push({
        id: `card-${card.name}-${idx}`,
        label,
        helper: `${card.count} pulls logged${reversedCount ? ` (${reversedCount} reversed)` : ''}`,
        question: `What is ${card.name} inviting me to embody next?`,
        topic: 'growth',
        timeframe: 'open',
        depth: 'lesson',
        customFocus: `${card.name} recurring energy`
      });
    });
  }

  if (Array.isArray(stats?.recentThemes)) {
    stats.recentThemes.slice(0, 2).forEach((theme, idx) => {
      const label = normalizeThemeLabel(theme);
      if (!label) return;
      const themeQuestion = buildThemeQuestion(label);
      suggestions.push({
        id: `theme-${idx}`,
        label: `Lean into: ${label}`,
        helper: 'Recent journal theme',
        question: themeQuestion,
        topic: 'growth',
        timeframe: 'open',
        depth: 'lesson',
        customFocus: label
      });
    });
  }

  if (Array.isArray(stats?.contextBreakdown) && stats.contextBreakdown.length > 0) {
    const primary = stats.contextBreakdown.slice().sort((a, b) => b.count - a.count)[0];
    const hint = CONTEXT_HINTS[primary.name];
    if (hint) {
      suggestions.push({
        id: `context-${primary.name}`,
        label: hint.label,
        helper: `Most logged context (${primary.count})`,
        topic: hint.topic,
        timeframe: hint.timeframe,
        depth: hint.depth,
        customFocus: hint.customFocus
      });
    }
  }

  if (!hasJournalSignals) {
    const normalizedFocusAreas = Array.isArray(focusAreas)
      ? focusAreas.map(area => (typeof area === 'string' ? area.trim() : '')).filter(Boolean)
      : [];

    normalizedFocusAreas.slice(0, 3).forEach((area, idx) => {
      const suggestion = FOCUS_AREA_SUGGESTIONS[area];
      if (!suggestion) return;
      suggestions.push({
        id: `focus-${area}-${idx}`,
        label: suggestion.label,
        helper: 'Based on your focus areas',
        topic: suggestion.topic,
        timeframe: suggestion.timeframe,
        depth: suggestion.depth,
        customFocus: suggestion.customFocus
      });
    });
  }

  if (Array.isArray(history) && history.length > 0) {
    const last = history[0];
    suggestions.push({
      id: `history-${last.id}`,
      label: 'Revisit your last question',
      helper: last.question,
      question: last.question
    });
  }

  return suggestions;
}
