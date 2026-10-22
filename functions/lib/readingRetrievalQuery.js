import { CONTEXT_KEYWORDS, GRAPH_RAG_CONTEXT_KEYWORDS, matchedContextPhrases, normalizeContextWords } from './readingContextVocabulary.js';

const ALL_CONTEXT_KEYWORDS = [...Object.values(CONTEXT_KEYWORDS).flat(), ...Object.values(GRAPH_RAG_CONTEXT_KEYWORDS).flat()];

function slice(text, start, end) {
  if (start > 0 && /[\uDC00-\uDFFF]/.test(text[start] || '')) start += 1;
  if (end < text.length && /[\uDC00-\uDFFF]/.test(text[end] || '')) end -= 1;
  return text.slice(start, end);
}

function excerpt(text, size, phrases) {
  if (size >= text.length) return text;
  if (size <= 0) return '';
  // Match normalized phrases while retaining offsets into the original text:
  // companies/company and mental-health/mental health must share an anchor.
  const tokens = [...text.matchAll(/[\p{L}\p{N}]+/gu)].map((token) => ({ word: normalizeContextWords(token[0]), index: token.index }));
  const phraseWords = phrases.map((phrase) => phrase.split(' '));
  const match = tokens.find((token, index) => phraseWords.some((words) => words.every((word, offset) => tokens[index + offset]?.word === word)))?.index;
  if (match !== undefined) {
    const start = Math.max(0, Math.min(match - Math.floor(size / 4), text.length - size));
    return slice(text, start, start + size);
  }
  if (size < 5) return slice(text, 0, size);
  const usable = size - 1;
  return `${slice(text, 0, Math.ceil(usable / 2))}…${slice(text, text.length - Math.floor(usable / 2), text.length)}`;
}

/** Bounded retrieval projection; the full sources still go to narrative assembly. */
export function buildReadingRetrievalQuery(sources = [], selection = {}, { maxLength = 8000 } = {}) {
  const budget = Number.isFinite(maxLength) && maxLength >= 0 ? Math.min(8000, Math.floor(maxLength)) : 8000;
  const vocabulary = [...(CONTEXT_KEYWORDS[selection.context] || []), ...(GRAPH_RAG_CONTEXT_KEYWORDS[selection.graphRAGContext] || [])];
  const hasTopic = sources.some((source) => source.kind !== 'savedFocus' && matchedContextPhrases(source.text, vocabulary).length);
  const seen = new Set();
  const entries = sources.map((source) => {
    const normalized = source.text.toLowerCase().replace(/\s+/g, ' ').trim();
    const duplicate = source.kind !== 'decisionPath' && normalized && seen.has(normalized);
    if (normalized) seen.add(normalized);
    const phrases = matchedContextPhrases(source.text, vocabulary);
    const mandatory = ['question', 'decisionPath'].includes(source.kind);
    // Current notes without taxonomy keywords can still supply useful constraints.
    // Exclude them only when they contain evidence for a different topic.
    const unrelated = source.kind === 'savedFocus'
      ? selection.source !== 'focusAreas'
      : hasTopic && !mandatory && !phrases.length && matchedContextPhrases(source.text, ALL_CONTEXT_KEYWORDS).length > 0;
    const reason = !source.text ? 'sanitized_empty' : duplicate ? 'duplicate' : unrelated ? 'unrelated_to_current_topic' : null;
    return { source, phrases, mandatory, reason, size: 0, label: source.kind === 'savedFocus' ? `focus areas ${source.id}: ` : `${source.id}: ` };
  });
  // Reserving labels and separators is part of the same hard character bound.
  let remaining = budget;
  let count = 0;
  const allocate = (entry, target) => {
    const overhead = entry.size ? 0 : entry.label.length + (count ? 3 : 0);
    const available = Math.max(0, remaining - overhead);
    const delta = Math.min(target - entry.size, available, entry.source.text.length - entry.size);
    if (delta <= 0) return 0;
    remaining -= delta + overhead;
    if (!entry.size) count += 1;
    entry.size += delta;
    return delta;
  };
  const ordered = [...entries.filter((entry) => entry.source.kind === 'question'), ...entries.filter((entry) => entry.source.kind === 'decisionPath')];
  for (const entry of ordered) if (!entry.reason) allocate(entry, entry.source.text.length);
  const notes = entries.filter((entry) => !entry.mandatory && !entry.reason);
  let noteBudget = selection.source === 'question' ? 750 : budget;
  // Reserve an initial share for every eligible note before expanding excerpts.
  for (const [index, entry] of notes.entries()) {
    const initialShare = Math.min(32, Math.floor(noteBudget / (notes.length - index)));
    noteBudget -= allocate(entry, initialShare);
  }
  let expanded = true;
  while (expanded && remaining > 0 && noteBudget > 0) {
    expanded = false;
    for (const entry of notes) {
      const delta = allocate(entry, entry.size + Math.min(32, noteBudget));
      noteBudget -= delta;
      expanded ||= delta > 0;
      if (noteBudget <= 0) break;
    }
  }
  const rendered = new Map(entries.map((entry) => [entry, excerpt(entry.source.text, entry.size, entry.phrases)]));
  const text = [...ordered, ...notes].filter((entry) => rendered.get(entry)).map((entry) => `${entry.label}${rendered.get(entry)}`).join(' | ');
  const coverage = entries.map((entry) => {
    const { source, reason } = entry;
    const includedLength = rendered.get(entry).length;
    return {
      id: source.id, originalLength: source.originalLength, sanitizedLength: source.sanitizedLength,
      eligibleLength: source.text.length, includedLength,
      included: includedLength > 0, truncated: includedLength < source.text.length,
      reason: reason || (includedLength < source.text.length ? 'query_budget' : source.sanitizedLength > source.text.length ? 'source_char_limit' : null)
    };
  });
  return { text, coverage };
}
