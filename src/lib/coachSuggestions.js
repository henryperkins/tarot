import { buildThemeQuestion, ensureQuestionMark, normalizeThemeLabel } from './themeText.js';
import { CONTEXT_HINTS, FOCUS_AREA_SUGGESTIONS } from './coachConstants.js';

const SUGGESTION_SOURCE_LABELS = {
  journal: 'journal trends',
  focus: 'focus areas',
  history: 'recent questions'
};

const CARD_QUESTION_ANGLES = [
  name => `What is ${name} inviting me to embody next?`,
  name => `What is ${name} asking me to notice that I have been overlooking?`,
  name => `How can I work with the energy of ${name} instead of against it?`
];

const THEME_QUESTION_ANGLES = [
  label => buildThemeQuestion(label),
  label => ensureQuestionMark(`What is ${label} beginning to teach me`),
  label => ensureQuestionMark(`Where is ${label} already stirring, and what does it need from me next`)
];

function normalizeQuestionText(question) {
  return typeof question === 'string' ? question.trim().toLowerCase() : '';
}

/**
 * Explain why the suggestion panel is populated from the sources its cards
 * actually carry, so a focus-area-only list never claims journal trends.
 *
 * @param {Array<{ source?: string }>} suggestions
 * @returns {string}
 */
export function describeSuggestionSources(suggestions = []) {
  const sources = new Set(
    (Array.isArray(suggestions) ? suggestions : [])
      .map(suggestion => suggestion?.source)
      .filter(source => Object.hasOwn(SUGGESTION_SOURCE_LABELS, source))
  );
  const labels = ['journal', 'focus', 'history']
    .filter(source => sources.has(source))
    .map(source => SUGGESTION_SOURCE_LABELS[source]);

  if (labels.length === 0) return 'A few starting points for this reading.';
  if (labels.length === 1) return `Based on your ${labels[0]}.`;
  if (labels.length === 2) return `Based on your ${labels[0]} and ${labels[1]}.`;
  return `Based on your ${labels[0]}, ${labels[1]}, and ${labels[2]}.`;
}

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

/**
 * Drop later suggestions that repeat an earlier suggestion's question (or,
 * for question-less suggestions, its focus and topic pairing).
 */
export function dedupeSuggestions(suggestions = []) {
  const seen = new Set();
  const result = [];
  for (const suggestion of Array.isArray(suggestions) ? suggestions : []) {
    if (!suggestion) continue;
    const questionKey = normalizeQuestionText(suggestion.question);
    const focusKey = !questionKey && typeof suggestion.customFocus === 'string' && suggestion.customFocus.trim()
      ? `focus:${suggestion.customFocus.trim().toLowerCase()}|${suggestion.topic || ''}`
      : '';
    const key = questionKey ? `q:${questionKey}` : focusKey;
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    result.push(suggestion);
  }
  return result;
}

/**
 * The visible window of suggestions: `size` entries starting at `start`,
 * wrapping around the pool so cycling never lands on an empty page.
 */
export function rotateSuggestionWindow(suggestions = [], start = 0, size = 3) {
  const pool = Array.isArray(suggestions) ? suggestions : [];
  if (pool.length === 0) return [];
  const offset = ((Math.trunc(start) % pool.length) + pool.length) % pool.length;
  return Array.from({ length: Math.min(size, pool.length) }, (_, index) => pool[(offset + index) % pool.length]);
}

export function buildPersonalizedSuggestions(stats, history = [], focusAreas = [], { angleOffset = 0 } = {}) {
  const suggestions = [];
  // Questions the reader has already asked through the coach are not
  // suggestions; they are the anti-repeat filter. The old "Revisit your
  // last question" card re-offered history[0] verbatim, which is a large
  // part of why this list felt stale.
  const askedQuestions = new Set(
    (Array.isArray(history) ? history : [])
      .map(entry => normalizeQuestionText(entry?.question))
      .filter(Boolean)
  );
  const angle = Number.isFinite(angleOffset) ? Math.trunc(angleOffset) : 0;

  const push = suggestion => {
    const questionKey = normalizeQuestionText(suggestion.question);
    if (questionKey && askedQuestions.has(questionKey)) return;
    suggestions.push(suggestion);
  };

  if (stats?.frequentCards?.length) {
    stats.frequentCards.slice(0, 2).forEach((card, idx) => {
      const reversedCount = Number.isFinite(card.reversed)
        ? card.reversed
        : (Number.isFinite(card.reversedCount) ? card.reversedCount : 0);
      const label =
        idx === 0 ? `Recurring card: ${card.name}` : `${card.name} keeps showing up`;
      const angleFn = CARD_QUESTION_ANGLES[(((idx + angle) % CARD_QUESTION_ANGLES.length) + CARD_QUESTION_ANGLES.length) % CARD_QUESTION_ANGLES.length];
      push({
        id: `card-${card.name}-${idx}`,
        source: 'journal',
        label,
        helper: `${card.count} pulls logged${reversedCount ? ` (${reversedCount} reversed)` : ''}`,
        question: angleFn(card.name),
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
      const angleFn = THEME_QUESTION_ANGLES[(((idx + angle) % THEME_QUESTION_ANGLES.length) + THEME_QUESTION_ANGLES.length) % THEME_QUESTION_ANGLES.length];
      push({
        id: `theme-${idx}`,
        source: 'journal',
        label: `Lean into: ${label}`,
        helper: 'Recent journal theme',
        question: angleFn(label),
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
      push({
        id: `context-${primary.name}`,
        source: 'journal',
        label: hint.label,
        helper: `Most logged context (${primary.count})`,
        topic: hint.topic,
        timeframe: hint.timeframe,
        depth: hint.depth,
        customFocus: hint.customFocus
      });
    }
  }

  // Focus areas are the reader's stated intent, so they stay in the pool
  // even when journal signals exist; dedupe below keeps one voice per theme.
  const normalizedFocusAreas = Array.isArray(focusAreas)
    ? focusAreas.map(area => (typeof area === 'string' ? area.trim() : '')).filter(Boolean)
    : [];

  normalizedFocusAreas.slice(0, 3).forEach((area, idx) => {
    const suggestion = FOCUS_AREA_SUGGESTIONS[area];
    if (!suggestion) return;
    push({
      id: `focus-${area}-${idx}`,
      source: 'focus',
      label: suggestion.label,
      helper: 'Based on your focus areas',
      topic: suggestion.topic,
      timeframe: suggestion.timeframe,
      depth: suggestion.depth,
      customFocus: suggestion.customFocus
    });
  });

  return dedupeSuggestions(suggestions);
}
