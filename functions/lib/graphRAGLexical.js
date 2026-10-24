import { normalizeContextWords } from './readingContextVocabulary.js';

const INFLECTION_ALIASES = new Map([
  ['grieving', 'grief'],
  ['working', 'work']
]);

// Query values are supplied separately from semantic scaffolding. Strip only
// explicit labels here as defense for legacy callers; ordinary prose survives.
const QUERY_STOP_WORDS = new Set(
  'what when where which this that have from with about card cards reading does into your would could should their there them these those will been being were then than the and for are but not you all any can had her was our out who why how its may nor now off she too has his him did'.split(' ')
);

export function normalizeRetrievalTerms(text) {
  if (typeof text !== 'string' || !text.trim()) return [];
  const normalized = normalizeContextWords(text.normalize('NFKC'));
  if (!normalized) return [];
  return normalized.split(/\s+/u).filter(Boolean).map(token => INFLECTION_ALIASES.get(token) || token);
}

export function retrievalQueryTerms(query) {
  const content = typeof query === 'string' ? query.replace(/\b(?:question|reflections):/giu, '') : '';
  return [...new Set(normalizeRetrievalTerms(content).filter(word => [...word].length >= 3 && !QUERY_STOP_WORDS.has(word)))];
}

export function scoreKeywordRelevance(text, query, precomputedQueryTerms = null) {
  if (typeof text !== 'string' || !text.trim()) return 0;
  const terms = Array.isArray(precomputedQueryTerms) ? precomputedQueryTerms : retrievalQueryTerms(query);
  if (!terms.length) return 0;
  const words = new Set(normalizeRetrievalTerms(text));
  if (!words.size) return 0;
  return terms.filter(term => words.has(term)).length / terms.length;
}
