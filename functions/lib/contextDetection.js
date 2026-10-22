import { prepareReadingContextSources } from './readingContextSources.js';
import { buildReadingRetrievalQuery } from './readingRetrievalQuery.js';
import { CONTEXT_KEYWORDS, GRAPH_RAG_CONTEXT_KEYWORDS, GRAPH_RAG_CONTEXT_PRIORITY, countMatches, matchedContextPhrases } from './readingContextVocabulary.js';
import { normalizeContext } from './narrative/helpers.js';
import { sanitizeText } from './utils.js';
import {
  USER_QUESTION_MAX_LENGTH,
  REFLECTIONS_TEXT_MAX_LENGTH
} from '../../shared/contracts/readingSchema.js';

const SPREAD_CONTEXT_DEFAULTS = {
  relationship: 'love',
  decision: 'decision'
};

const GRAPH_RAG_SPREAD_DEFAULTS = {
  relationship: 'relationship'
};

// The accepted question (2,000) and reflections (5,000), existing six bounded
// focus labels, and section labels all fit within the embedding input boundary.
// Smaller explicit caller budgets remain supported without shortening defaults.
const MAX_CONTEXT_TEXT_LENGTH = 8000;
const GENERIC_QUESTION_CUES = new Set([...CONTEXT_KEYWORDS.decision, 'energy', 'energetic']);
const QUESTION_TOPIC_KEYWORDS = [...new Set([
  ...Object.values(CONTEXT_KEYWORDS).flat(),
  ...Object.values(GRAPH_RAG_CONTEXT_KEYWORDS).flat()
])].filter(keyword => !GENERIC_QUESTION_CUES.has(keyword));

function sanitizeQuestion(question) {
  return typeof question === 'string' ? question.trim().toLowerCase() : '';
}

function sanitizeContextSegment(value, maxLength) {
  if (typeof value !== 'string') return '';
  return sanitizeText(value, {
    maxLength,
    addEllipsis: true,
    stripMarkdown: true,
    stripControlChars: true,
    collapseWhitespace: true,
    filterInstructions: true
  });
}

function normalizeFocusAreas(focusAreas) {
  if (!Array.isArray(focusAreas)) return [];

  return focusAreas
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      if (entry && typeof entry === 'object') {
        if (typeof entry.label === 'string') return entry.label;
        if (typeof entry.name === 'string') return entry.name;
      }
      return '';
    })
    .map((value) => sanitizeContextSegment(value, 60))
    .filter(Boolean)
    .slice(0, 6);
}

export function buildContextInferenceInput({
  userQuestion,
  reflectionsText,
  focusAreas,
  maxLength = MAX_CONTEXT_TEXT_LENGTH
} = {}) {
  const segments = [];
  const safeQuestion = sanitizeContextSegment(userQuestion, USER_QUESTION_MAX_LENGTH);
  const safeReflections = sanitizeContextSegment(reflectionsText, REFLECTIONS_TEXT_MAX_LENGTH);
  const normalizedFocusAreas = normalizeFocusAreas(focusAreas);

  if (safeQuestion) {
    segments.push(`question: ${safeQuestion}`);
  }
  if (safeReflections) {
    segments.push(`reflections: ${safeReflections}`);
  }
  if (normalizedFocusAreas.length > 0) {
    segments.push(`focus areas: ${normalizedFocusAreas.join(', ')}`);
  }

  if (segments.length === 0) {
    return '';
  }

  const safeMaxLength = Number.isFinite(maxLength) && maxLength > 0
    ? Math.min(Math.floor(maxLength), MAX_CONTEXT_TEXT_LENGTH)
    : MAX_CONTEXT_TEXT_LENGTH;

  return sanitizeText(segments.join(' | '), {
    maxLength: safeMaxLength,
    addEllipsis: true,
    stripMarkdown: true,
    stripControlChars: true,
    collapseWhitespace: true,
    filterInstructions: true
  });
}

/**
 * Select topic evidence before applying spread defaults. Sources remain separate
 * so a long reflection or saved preference cannot outvote a clear question.
 * The original fields are still supplied independently to the narrative prompt.
 */
function leadingContexts(scores) {
  const highest = Math.max(0, ...Object.values(scores));
  return highest > 0 ? Object.keys(scores).filter((key) => scores[key] === highest) : [];
}

export function resolveContextSelection(input = {}, spreadKey, options = {}) {
  const hasStructured = Array.isArray(input.sources) || typeof input.reflectionsText === 'string'
    || Array.isArray(input.focusAreas) || Array.isArray(input.cardsInfo) || input.decisionPaths;
  const sources = Array.isArray(input.sources) ? input.sources : prepareReadingContextSources({
    ...input,
    spreadKey,
    reflectionsText: !hasStructured && input.contextInputText !== input.userQuestion
      ? input.contextInputText : input.reflectionsText
  });
  const group = (source, entries) => ({
    source, entries,
    reading: scores(entries, CONTEXT_KEYWORDS),
    graph: scores(entries, GRAPH_RAG_CONTEXT_KEYWORDS)
  });
  // Count distinct phrases across the complete sources, never repeated copies.
  function scores(entries, vocabulary) {
    return Object.fromEntries(Object.entries(vocabulary).map(([key, keywords]) => {
      const phrases = new Set(entries.flatMap((entry) => matchedContextPhrases(entry.text, keywords)));
      return [key, [...phrases].reduce((sum, phrase) => sum + (phrase.includes(' ') ? 3 : 2), 0)];
    }));
  }
  const question = group('question', sources.filter((entry) => entry.kind === 'question'));
  const notes = group('reflections', sources.filter((entry) => ['reflection', 'cardReflection'].includes(entry.kind)));
  const paths = group('decisionPaths', sources.filter((entry) => entry.kind === 'decisionPath'));
  const focus = group('focusAreas', sources.filter((entry) => entry.kind === 'savedFocus'));
  const hasEvidence = (entry) => [...Object.values(entry.reading), ...Object.values(entry.graph)].some((score) => score > 0);
  const specificQuestion = question.entries.some((entry) => countMatches(entry.text, QUESTION_TOPIC_KEYWORDS) > 0);
  const selected = (specificQuestion && hasEvidence(question) ? question : null)
    || [notes, paths, focus].find(hasEvidence) || (hasEvidence(question) ? question : null);
  const normalizedSpread = typeof spreadKey === 'string' ? spreadKey.toLowerCase() : '';
  let clarifiedBy = null;
  const pick = (taxonomy, priority, spreadDefault) => {
    let candidates = leadingContexts(selected[taxonomy]);
    if (selected === question && candidates.length > 1) {
      for (const background of [notes, paths]) {
        const narrowed = leadingContexts(Object.fromEntries(candidates.map((key) => [key, background[taxonomy][key]])));
        if (narrowed.length && narrowed.length < candidates.length) {
          candidates = narrowed;
          clarifiedBy = background.source;
        }
      }
    }
    if (candidates.includes(spreadDefault)) return spreadDefault;
    return priority.find((key) => candidates.includes(key)) || candidates[0] || 'general';
  };
  const result = {
    context: selected
      ? normalizeContext(pick('reading', ['decision', 'wellbeing', 'love', 'career', 'self', 'spiritual'], SPREAD_CONTEXT_DEFAULTS[normalizedSpread]), options)
      : inferContext('', spreadKey, options),
    graphRAGContext: selected ? pick('graph', GRAPH_RAG_CONTEXT_PRIORITY, GRAPH_RAG_SPREAD_DEFAULTS[normalizedSpread]) : inferGraphRAGContext('', spreadKey),
    source: selected?.source || (SPREAD_CONTEXT_DEFAULTS[normalizedSpread] || GRAPH_RAG_SPREAD_DEFAULTS[normalizedSpread] ? 'spread' : 'none'),
    clarifiedBy,
    selectedSourceIds: []
  };
  result.selectedSourceIds = (selected?.entries || []).filter((entry) => countMatches(entry.text,
    [...(CONTEXT_KEYWORDS[result.context] || []), ...(GRAPH_RAG_CONTEXT_KEYWORDS[result.graphRAGContext] || [])]) > 0).map((entry) => entry.id);
  const query = buildReadingRetrievalQuery(sources, result, options);
  return { ...result, retrievalQuery: query.text, queryCoverage: query.coverage };
}

export function inferContext(userQuestion, spreadKey, options = {}) {
  const { onUnknown } = options;
  const normalizedSpreadKey = typeof spreadKey === 'string' ? spreadKey.toLowerCase() : '';
  const defaultContext = SPREAD_CONTEXT_DEFAULTS[normalizedSpreadKey] || null;

  const text = sanitizeQuestion(userQuestion);
  const scores = {
    love: 0,
    career: 0,
    self: 0,
    spiritual: 0,
    wellbeing: 0,
    decision: 0
  };

  for (const [context, keywords] of Object.entries(CONTEXT_KEYWORDS)) {
    scores[context] = countMatches(text, keywords);
  }

  // Weight spread default slightly to break ties when relevant
  if (defaultContext) {
    scores[defaultContext] += 1;
  }

  let bestContext = 'general';
  let bestScore = 0;

  for (const [context, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestContext = context;
    } else if (score === bestScore && score > 0) {
      // Tie-breaker priority: decision > wellbeing > love > career > self > spiritual
      // decision/wellbeing first since they're more specific intents
      const priority = ['decision', 'wellbeing', 'love', 'career', 'self', 'spiritual'];
      if (priority.indexOf(context) < priority.indexOf(bestContext)) {
        bestContext = context;
      }
    }
  }

  if (bestScore === 0 && defaultContext) {
    return normalizeContext(defaultContext, { onUnknown });
  }

  const detected = bestScore > 0 ? bestContext : 'general';
  return normalizeContext(detected, { onUnknown });
}

export function inferGraphRAGContext(userQuestion, spreadKey) {
  const normalizedSpreadKey = typeof spreadKey === 'string' ? spreadKey.toLowerCase() : '';
  const defaultContext = GRAPH_RAG_SPREAD_DEFAULTS[normalizedSpreadKey] || null;
  const text = sanitizeQuestion(userQuestion);

  const scores = {};
  for (const [context, keywords] of Object.entries(GRAPH_RAG_CONTEXT_KEYWORDS)) {
    scores[context] = countMatches(text, keywords);
  }

  if (defaultContext && scores[defaultContext] !== undefined) {
    scores[defaultContext] += 1;
  }

  let bestContext = 'general';
  let bestScore = 0;

  for (const [context, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestContext = context;
    } else if (score === bestScore && score > 0) {
      const currentPriority = GRAPH_RAG_CONTEXT_PRIORITY.indexOf(context);
      const bestPriority = GRAPH_RAG_CONTEXT_PRIORITY.indexOf(bestContext);
      if (currentPriority !== -1 && (bestPriority === -1 || currentPriority < bestPriority)) {
        bestContext = context;
      }
    }
  }

  if (bestScore === 0 && defaultContext) {
    return defaultContext;
  }

  return bestScore > 0 ? bestContext : 'general';
}
