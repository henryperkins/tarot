import { prepareUserContext } from './narrative/prompts/userContext.js';
import { resolveDecisionPathContext } from './decisionPathContext.js';
import { sanitizeReadingContext } from './readingCardContext.js';
import { MAXIMUM_CARD_COUNT } from '../../shared/contracts/readingRequestLimits.js';

/**
 * @typedef {Object} ReadingContextSource
 * @property {string} id Fixed question/reflections/card-N/pathA/pathB/focus-N ID.
 * @property {'question'|'reflection'|'cardReflection'|'decisionPath'|'savedFocus'} kind
 * @property {string} text Independently sanitized accepted source, before query cuts.
 * @property {number} originalLength
 * @property {number} sanitizedLength
 * @property {number} [cardIndex]
 * @property {string} [pathKey]
 * @property {string} [origin]
 */
/** @returns {ReadingContextSource[]} Private request-local sources; never log text. */
export function prepareReadingContextSources({ userQuestion, reflectionsText, cardsInfo = [], decisionPaths = {}, spreadKey, focusAreas = [] } = {}) {
  const cards = Array.isArray(cardsInfo) ? cardsInfo.slice(0, MAXIMUM_CARD_COUNT) : [];
  const fields = prepareUserContext(userQuestion, reflectionsText, cards);
  const sources = Object.entries(fields).filter(([id, field]) => !id.startsWith('interpretation-') && field.originalLength > 0).map(([id, field]) => ({
    id,
    kind: id === 'question' ? 'question' : id === 'reflections' ? 'reflection' : 'cardReflection',
    text: field.text,
    originalLength: field.originalLength,
    sanitizedLength: field.sanitizedLength,
    ...(id.startsWith('card-') ? { cardIndex: Number(id.slice(5)) } : {})
  }));
  sources.push(...resolveDecisionPathContext({ spreadKey, cardsInfo: cards, decisionPaths }).sources);
  (Array.isArray(focusAreas) ? focusAreas : []).slice(0, 12).forEach((entry, index) => {
    const raw = typeof entry === 'string' ? entry : entry?.label || entry?.name || '';
    if (typeof raw !== 'string' || !raw) return;
    const text = sanitizeReadingContext(raw);
    sources.push({ id: `focus-${index}`, kind: 'savedFocus', text: sliceContextUnicode(text, 0, 60), originalLength: raw.length, sanitizedLength: text.length });
  });
  return sources;
}

/** Cut at complete grapheme boundaries; offsets remain UTF-16 code units. */
export function sliceContextUnicode(text, start, end) {
  const from = Math.max(0, start);
  const to = Math.max(from, Math.min(text.length, end));
  if (from === 0 && to === text.length) return text;
  if (typeof Intl.Segmenter === 'function') {
    const segments = new Intl.Segmenter('und', { granularity: 'grapheme' }).segment(text);
    let first = text.length;
    let last = 0;
    for (const segment of segments) {
      const finish = segment.index + segment.segment.length;
      if (segment.index >= from && finish <= to) {
        first = Math.min(first, segment.index);
        last = finish;
      }
      if (segment.index > to) break;
    }
    return first <= last ? text.slice(first, last) : '';
  }
  // Older runtimes: retain complete scalar/combining/ZWJ groups conservatively.
  let offset = 0;
  let result = '';
  for (const match of text.matchAll(/(?:\p{Regional_Indicator}{2}|[^\p{M}\u200d])(?:[\p{M}\p{Emoji_Modifier}])*(?:\u200d[^\p{M}\u200d](?:[\p{M}\p{Emoji_Modifier}])*)*/gu)) {
    offset = match.index + match[0].length;
    if (match.index >= from && offset <= to) result += match[0];
  }
  return result;
}
