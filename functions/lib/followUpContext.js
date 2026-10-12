import { sanitizeText } from './utils.js';

// Budgets measure serialized characters, including JSON/XML escaping. Together
// with the card list and static instructions these keep the user prompt <92k.
// The reading is all-or-nothing: this ceiling rejects oversized input instead
// of silently removing evidence needed to answer questions about the reading.
export const FOLLOW_UP_NARRATIVE_BUDGET = 64000;
const QUESTION_BUDGET = 2400;
const REFLECTION_BUDGET = 4200;
const HISTORY_BUDGET = 4200;
const MAX_HISTORY_PAIRS = 3;
const MAX_CARDS = 12;
const OMITTED = '...[truncated]...';

export class FollowUpContextTooLargeError extends Error {
  constructor() {
    super('This reading is too long for follow-up chat to include in full.');
    this.name = 'FollowUpContextTooLargeError';
  }
}

export function escapeFollowUpData(text) {
  return text.replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

export function serializeFollowUpReference(tag, data) {
  return `<${tag}>${escapeFollowUpData(JSON.stringify(data))}</${tag}>`;
}

function serializedLength(text) {
  return escapeFollowUpData(JSON.stringify(text)).length;
}

function cleanText(value, filterInstructions = false) {
  return typeof value === 'string'
    ? sanitizeText(value.replace(/\r\n?/g, '\n').replace(/\p{Cc}/gu, character => character === '\n' ? '\n' : ' '), {
      collapseWhitespace: false,
      filterInstructions
    })
    : '';
}

function fitText(text, budget) {
  if (serializedLength(text) <= budget) return { text, retainedChars: text.length };
  let low = 0;
  let high = text.length;
  const candidate = count => {
    const head = Math.ceil(count / 2);
    const tail = Math.floor(count / 2);
    return `${text.slice(0, head)}${OMITTED}${tail ? text.slice(-tail) : ''}`;
  };
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (serializedLength(candidate(middle)) <= budget) low = middle;
    else high = middle - 1;
  }
  return { text: candidate(low), retainedChars: low };
}

export function boundFollowUpText(value, budget, { filterInstructions = false } = {}) {
  const sanitized = cleanText(value, filterInstructions);
  const result = fitText(sanitized, budget);
  return {
    ...result,
    originalChars: typeof value === 'string' ? value.length : 0,
    sanitizedChars: sanitized.length,
    omittedChars: sanitized.length - result.retainedChars
  };
}

function boundTextList(values, budget, options = {}) {
  const sorted = values.map((value, index) => ({
    value,
    index,
    size: serializedLength(cleanText(value, options.filterInstructions))
  })).sort((left, right) => left.size - right.size);
  const results = [];
  let remaining = budget;
  sorted.forEach(({ value, index }, offset) => {
    const bounded = boundFollowUpText(value, Math.floor(remaining / (sorted.length - offset)), options);
    remaining -= serializedLength(bounded.text);
    results[index] = bounded;
  });
  return results;
}

function fullNarrative(value) {
  const text = cleanText(value);
  if (serializedLength(text) > FOLLOW_UP_NARRATIVE_BUDGET) {
    throw new FollowUpContextTooLargeError();
  }
  return {
    text,
    originalChars: typeof value === 'string' ? value.length : 0,
    sanitizedChars: text.length,
    retainedChars: text.length,
    omittedChars: 0
  };
}

export function buildFollowUpReadingReference(originalReading) {
  const reading = originalReading || {};
  const cards = Array.isArray(reading.cardsInfo) ? reading.cardsInfo.slice(0, MAX_CARDS) : [];
  const reflections = [];
  if (typeof reading.reflectionsText === 'string' && reading.reflectionsText.trim()) {
    reflections.push({ source: 'reading', value: reading.reflectionsText });
  }
  cards.forEach((card, cardIndex) => {
    const value = reading.reflections?.[cardIndex] ?? card?.userReflection;
    if (typeof value === 'string' && value.trim()) {
      reflections.push({ source: 'card', cardIndex, position: boundFollowUpText(card?.position, 120).text, value });
    }
  });
  const reflectionText = boundTextList(reflections.map(item => item.value), REFLECTION_BUDGET);
  const boundedReflections = reflections.map(({ value: _value, ...context }, index) => ({ ...context, ...reflectionText[index] }));
  return serializeFollowUpReference('reading_context', {
    question: boundFollowUpText(reading.userQuestion, QUESTION_BUDGET),
    deckStyle: boundFollowUpText(reading.deckStyle, 120).text,
    narrative: fullNarrative(reading.narrative),
    reflections: boundedReflections,
    omittedReflectionCards: Math.max(0, (Array.isArray(reading.cardsInfo) ? reading.cardsInfo.length : 0) - cards.length)
  });
}

export function buildFollowUpHistoryReference(history) {
  if (!Array.isArray(history) || !history.length) return '';
  const valid = history.filter(item => item && typeof item.content === 'string' && ['user', 'assistant'].includes(item.role));
  const pairs = [];
  for (let index = 0; index < valid.length - 1; index++) {
    if (valid[index].role === 'user' && valid[index + 1].role === 'assistant') {
      pairs.push([valid[index], valid[index + 1]]);
      index++;
    }
  }
  const selectedMessages = pairs.slice(-MAX_HISTORY_PAIRS).flat();
  const historyText = boundTextList(selectedMessages.map(item => item.content), HISTORY_BUDGET, { filterInstructions: true });
  const messages = selectedMessages.map((item, index) => ({
    role: item.role,
    ...historyText[index]
  }));
  return serializeFollowUpReference('conversation_history', {
    messages,
    omittedMessages: history.length - messages.length
  });
}

export function buildFollowUpJournalReference(journalContext) {
  if (!Array.isArray(journalContext?.patterns)) return '';
  const recurring = journalContext.patterns.filter(item => item?.type === 'recurring_card');
  const similar = journalContext.patterns.filter(item => item?.type === 'similar_themes');
  // Leave a slot for retrieved evidence even when many cards recur.
  const selected = [...recurring.slice(0, similar.length ? 2 : 3), ...similar.slice(0, 1)];
  if (!selected.length) return '';
  const patterns = selected.map(pattern => {
    const result = { type: pattern.type, description: boundFollowUpText(pattern.description, 240).text };
    if (pattern.type === 'recurring_card') {
      result.contexts = Array.isArray(pattern.contexts)
        ? pattern.contexts.slice(0, 3).map(value => boundFollowUpText(value, 180).text).filter(Boolean)
        : [];
    } else {
      result.entries = (Array.isArray(pattern.entries) ? pattern.entries : []).slice(0, 3).map(entry => ({
        date: boundFollowUpText(entry?.date, 50).text,
        question: boundFollowUpText(entry?.question, 450),
        narrative: boundFollowUpText(entry?.narrative, 600)
      }));
      result.omittedEntries = Math.max(0, (Array.isArray(pattern.entries) ? pattern.entries.length : 0) - result.entries.length);
    }
    return result;
  });
  return serializeFollowUpReference('journal_context', {
    patterns,
    omittedPatterns: journalContext.patterns.length - patterns.length
  });
}
