import { CONTEXT_KEYWORDS, GRAPH_RAG_CONTEXT_KEYWORDS, contextPhraseMatches, excludedContextRanges } from './readingContextVocabulary.js';
import { sliceContextUnicode } from './readingContextSources.js';

const ALL_KEYWORDS = [...Object.values(CONTEXT_KEYWORDS).flat(), ...Object.values(GRAPH_RAG_CONTEXT_KEYWORDS).flat()];
// A complete negative clause is safer than a window that can change its scope.
const negativeQualifiers = new WeakMap();
const hasNegativeQualifier = span => {
  let value = negativeQualifiers.get(span);
  if (value === undefined) {
    value = /\b(?:not|never|cannot|no|[a-z]+n['’‘ʼ＇]t)\b/iu.test(span.text);
    negativeQualifiers.set(span, value);
  }
  return value;
};
const normalized = text => text.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();

/** Sentence/clause boundaries retain original UTF-16 offsets and qualifiers. */
export function extractReadingContextSpans(text = '') {
  return [...text.matchAll(/(?:[^.!?。！？;；\n]|\.(?=\d))+(?:(?:\.(?!\d)|[!?。！？;；])+|$)/gu)].flatMap(match => {
    // Only explicit contrast boundaries are safe without rewriting the subject.
    const parts = [...match[0].matchAll(/.+?(?=\s+but\s+|$)|\s+but\s+.+/giu)];
    return (parts.length ? parts : [{ 0: match[0], index: 0 }]).flatMap(part => {
      const leading = part[0].length - part[0].trimStart().length;
      const value = part[0].trim();
      return value ? [{ start: match.index + part.index + leading, end: match.index + part.index + leading + value.length, text: value }] : [];
    });
  });
}

/**
 * Private full-source eligibility, shared with memory admission. This precedes
 * query excerpting; mandatory full query fields do not override this filtering.
 * No source text or span offsets belong in ordinary telemetry.
 */
export function projectReadingContextSpans(sources = [], selection = {}) {
  const selectedKeywords = [...(CONTEXT_KEYWORDS[selection.context] || []), ...(GRAPH_RAG_CONTEXT_KEYWORDS[selection.graphRAGContext] || [])];
  const excludedKeywords = [
    ...(selection.excludedContexts?.reading || []).flatMap(key => CONTEXT_KEYWORDS[key] || []),
    ...(selection.excludedContexts?.graph || []).flatMap(key => GRAPH_RAG_CONTEXT_KEYWORDS[key] || [])
  ];
  const selectedPhrases = new Set(selectedKeywords.flatMap(keyword => contextPhraseMatches(keyword, [keyword]).map(match => match.phrase)));
  const hasTopic = Boolean(selection.context && selection.context !== 'general' || selection.graphRAGContext && selection.graphRAGContext !== 'general');
  return sources.map(source => {
    const spans = extractReadingContextSpans(source.text).flatMap(span => {
      const matches = contextPhraseMatches(span.text, ALL_KEYWORDS);
      const topical = contextPhraseMatches(span.text, selectedKeywords);
      const otherMatches = matches.filter(match => !selectedPhrases.has(match.phrase));
      const neutralConstraint = /\b(?:evenings?|weekends?|available|fully remote|school pickup|timetable|can only prepare)\b/iu.test(span.text) && otherMatches.every(match => ['shift', 'shifting'].includes(match.phrase));
      const conflicting = otherMatches.length > 0 && !neutralConstraint;
      const explicitExclusion = excludedContextRanges(span.text).length > 0;
      const excludedTopic = contextPhraseMatches(span.text, excludedKeywords).length > 0;
      const savedIgnored = source.kind === 'savedFocus' && selection.source !== 'focusAreas';
      if (savedIgnored || explicitExclusion && !topical.length || excludedTopic && !topical.length || hasTopic && conflicting && !topical.length) return [];
      return [{ ...span, kind: topical.length ? conflicting ? 'mixed' : 'topical' : 'neutral', classificationSupport: /[^\p{Script=Latin}\p{N}\p{P}\p{Z}\p{M}\p{S}]/u.test(span.text) ? 'limited' : 'keyword' }];
    });
    const reason = !source.text ? 'sanitized_empty' : spans.length ? null : source.kind === 'savedFocus' ? 'unrelated_to_current_topic' : excludedContextRanges(source.text).length ? 'explicit_topic_exclusion' : 'unrelated_to_current_topic';
    return { source, spans, classifiedLength: source.text.length, eligibleLength: spans.reduce((sum, span) => sum + span.text.length, 0), reason };
  });
}

const excerptPlans = new WeakMap();

function spanExcerpt(span, size, keywords) {
  if (size >= span.text.length) return span.text;
  // Retain the whole qualifying clause, or omit it if that context cannot fit.
  // This also prevents contracted negatives from becoming mid-word fragments.
  if (hasNegativeQualifier(span)) return '';
  let plan = excerptPlans.get(span);
  if (!plan) {
    const words = typeof Intl.Segmenter === 'function'
      ? [...new Intl.Segmenter('und', { granularity: 'word' }).segment(span.text)].filter(segment => segment.isWordLike).map(segment => ({ start: segment.index, end: segment.index + segment.segment.length }))
      // Align Latin words in older runtimes; leave nonspace scripts to the
      // grapheme-safe cutter rather than treating an entire sentence as a word.
      : [...span.text.matchAll(/[\p{Script=Latin}\p{N}\p{M}]+(?:['’‘ʼ＇-][\p{Script=Latin}\p{N}\p{M}]+)*/gu)].map(match => ({ start: match.index, end: match.index + match[0].length }));
    plan = { anchor: contextPhraseMatches(span.text, keywords)[0]?.start ?? 0, words };
    excerptPlans.set(span, plan);
  }
  const { anchor, words } = plan;
  plan.nextSize = size + 1;
  let start = Math.max(0, Math.min(anchor - Math.floor(size / 4), span.text.length - size));
  const startingWord = words.find(word => start > word.start && start < word.end);
  if (startingWord) start = startingWord.end <= anchor ? startingWord.end : startingWord.start;
  while (/\s/u.test(span.text[start] || '') && start < span.text.length) start += 1;
  let end = Math.min(span.text.length, start + size);
  const endingWord = words.find(word => end > word.start && end < word.end);
  if (endingWord) {
    end = endingWord.start;
    plan.nextSize = Math.max(size + 1, endingWord.end - start);
  }
  if (end - start < Math.min(48, span.text.length) || anchor < start || anchor >= end) return '';
  return sliceContextUnicode(span.text, start, end).trim();
}

/** Bounded query projection; accepted full notes remain available to assembly. */
export function buildReadingRetrievalQuery(sources = [], selection = {}, { maxLength = 8000 } = {}) {
  const budget = Number.isFinite(maxLength) && maxLength >= 0 ? Math.min(8000, Math.floor(maxLength)) : 8000;
  const keywords = [...(CONTEXT_KEYWORDS[selection.context] || []), ...(GRAPH_RAG_CONTEXT_KEYWORDS[selection.graphRAGContext] || [])];
  const seen = new Set();
  const projections = projectReadingContextSpans(sources, selection);
  const entries = projections.map((projection, index) => {
    const { source } = projection;
    const mandatory = source.kind === 'question' || source.kind === 'decisionPath';
    const key = normalized(source.text);
    const duplicate = !mandatory && key && seen.has(key);
    if (key) seen.add(key);
    const spans = mandatory ? [{ start: 0, end: source.text.length, text: source.text, kind: 'mandatory' }] : [...projection.spans].sort((a, b) => (a.kind === 'neutral') - (b.kind === 'neutral') || a.start - b.start);
    const reason = !source.text ? 'sanitized_empty' : duplicate ? 'duplicate' : mandatory ? null : projection.reason;
    return { ...projection, eligibleSpans: projection.spans, index, mandatory, spans, reason, pieces: [], label: source.kind === 'savedFocus' ? `focus areas ${source.id}: ` : `${source.id}: ` };
  });
  const selectedIds = new Set(selection.selectedSourceIds || []);
  const mandatory = entries.filter(entry => entry.mandatory).sort((a, b) => (a.source.kind === 'decisionPath') - (b.source.kind === 'decisionPath') || a.index - b.index);
  const notes = entries.filter(entry => !entry.mandatory && !entry.reason).sort((a, b) => {
    const rank = entry => selectedIds.has(entry.source.id) ? 0 : entry.spans.some(span => span.kind !== 'neutral') ? 1 : 2;
    return rank(a) - rank(b) || a.index - b.index;
  });
  let remaining = budget;
  let noteRemaining = selection.source === 'question' ? 750 : budget;
  let usedSources = 0;
  const contentLength = entry => entry.pieces.reduce((sum, piece) => sum + piece.text.length, 0);
  const mixedLabel = entry => entry.pieces.some(piece => piece.span.kind === 'mixed') ? '[mixed_context] ' : '';
  const rendering = entry => entry.pieces.map(piece => piece.text).join(' … ');
  const allocate = (entry, span, target) => {
    const previous = entry.pieces.find(piece => piece.span === span);
    const before = previous?.text || '';
    const value = spanExcerpt(span, Math.min(target, span.text.length), keywords);
    if (value.length <= before.length) return 0;
    const extraText = value.length - before.length;
    const overhead = entry.pieces.length ? previous ? 0 : 3 : entry.label.length + (usedSources ? 3 : 0);
    const mixedOverhead = span.kind === 'mixed' && !mixedLabel(entry) ? '[mixed_context] '.length : 0;
    if (extraText + overhead + mixedOverhead > remaining || !entry.mandatory && extraText > noteRemaining) return 0;
    remaining -= extraText + overhead + mixedOverhead;
    if (!entry.mandatory) noteRemaining -= extraText;
    if (!entry.pieces.length) usedSources += 1;
    if (previous) previous.text = value;
    else entry.pieces.push({ span, text: value });
    return extraText;
  };
  for (const entry of mandatory) if (!entry.reason) allocate(entry, entry.spans[0], entry.source.text.length);
  // Readable first excerpts replace the previous fragments-for-every-source rule.
  for (const entry of notes) {
    const span = entry.spans[0];
    const target = hasNegativeQualifier(span) ? span.text.length : Math.min(span.text.length, 48);
    let size = target;
    while (size < span.text.length && spanExcerpt(span, size, keywords).length < target) {
      // Jump over an incomplete word instead of probing every character in it.
      size = Math.min(span.text.length, Math.max(size + 1, excerptPlans.get(span)?.nextSize || 0));
    }
    allocate(entry, span, size);
  }
  let expanded = true;
  while (expanded && remaining > 0 && noteRemaining > 0) {
    expanded = false;
    for (const entry of notes.filter(value => value.pieces.length)) {
      const current = entry.pieces.at(-1);
      const span = current.text.length < current.span.text.length ? current.span : entry.spans[entry.pieces.length];
      if (!span) continue;
      const previous = entry.pieces.find(piece => piece.span === span)?.text.length || 0;
      const target = hasNegativeQualifier(span) ? span.text.length : Math.min(span.text.length, previous + Math.min(48, noteRemaining));
      if (!previous && target < Math.min(48, span.text.length)) continue;
      expanded = allocate(entry, span, target) > 0 || expanded;
    }
  }
  const retained = [...mandatory, ...notes].filter(entry => entry.pieces.length);
  const text = retained.map(entry => `${entry.label}${mixedLabel(entry)}${rendering(entry)}`).join(' | ');
  const contentText = retained.flatMap(entry => entry.mandatory ? entry.eligibleSpans.map(span => span.text) : entry.pieces.map(piece => piece.text)).join(' ');
  const coverage = entries.map(entry => {
    const { source } = entry;
    const includedLength = contentLength(entry);
    const queryEligibleLength = entry.mandatory ? source.text.length : entry.eligibleLength;
    return {
      id: source.id, originalLength: source.originalLength, sanitizedLength: source.sanitizedLength,
      classifiedLength: entry.classifiedLength,
      classificationSupport: /[^\p{Script=Latin}\p{N}\p{P}\p{Z}\p{M}\p{S}]/u.test(source.text) ? 'limited' : 'keyword',
      eligibleLength: queryEligibleLength, topicEligibleLength: entry.eligibleLength, includedLength,
      included: includedLength > 0, truncated: includedLength < source.text.length,
      mixed: entry.spans.some(span => span.kind === 'mixed'),
      reason: entry.reason || (includedLength < queryEligibleLength ? 'query_budget' : entry.eligibleLength < source.text.length && !entry.mandatory ? 'topic_projection' : source.sanitizedLength > source.text.length ? 'source_char_limit' : null)
    };
  });
  return { text, contentText, coverage };
}
