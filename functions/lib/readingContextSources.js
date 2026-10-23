import { prepareUserContext } from './narrative/prompts/userContext.js';
import { resolveDecisionPathContext } from './decisionPathContext.js';
import { sanitizeReadingContext } from './readingCardContext.js';
import { MAXIMUM_CARD_COUNT } from '../../shared/contracts/readingRequestLimits.js';

/** Private request-local sources. Never send their text to ordinary telemetry. */
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
  (Array.isArray(focusAreas) ? focusAreas : []).slice(0, 6).forEach((entry, index) => {
    const raw = typeof entry === 'string' ? entry : entry?.label || entry?.name || '';
    if (typeof raw !== 'string' || !raw) return;
    const text = sanitizeReadingContext(raw);
    sources.push({ id: `focus-${index}`, kind: 'savedFocus', text: sliceContextUnicode(text, 0, 60), originalLength: raw.length, sanitizedLength: text.length });
  });
  return sources;
}

export function sliceContextUnicode(text, start, end) {
  let from = Math.max(0, start);
  let to = Math.max(from, end);
  if (from > 0 && /[\uDC00-\uDFFF]/.test(text[from] || '')) from += 1;
  if (to < text.length && /[\uDC00-\uDFFF]/.test(text[to] || '')) to -= 1;
  return text.slice(from, to);
}
