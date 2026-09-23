import { sanitizeText } from '../../utils.js';
import { detectPromptInjection } from '../../promptInjectionDetector.js';
import { sanitizeReadingContext } from '../../readingCardContext.js';
import { CARD_REFLECTION_MAX_LENGTH, USER_QUESTION_MAX_LENGTH, REFLECTIONS_TEXT_MAX_LENGTH } from '../../../../shared/contracts/readingSchema.js';
import { estimateTokenCount } from './budgeting.js';

function cleanText(value, cardReflection = false) {
  if (cardReflection) return sanitizeReadingContext(value);
  const safe = sanitizeText(value, { stripMarkdown: true, stripControlChars: true, filterInstructions: true });
  const check = detectPromptInjection(safe, { confidenceThreshold: 0.6, sanitize: true });
  return check.isInjection ? check.sanitizedText || '' : safe;
}

export function prepareUserContext(userQuestion, reflectionsText, cardsInfo, inputStats = {}) {
  const fields = {};
  const add = (key, value, limit, cardReflection = false) => {
    const original = typeof value === 'string' ? value : '';
    const sanitized = cleanText(original, cardReflection);
    fields[key] = {
      originalLength: inputStats[key]?.originalLength ?? original.length,
      sanitizationChanged: Boolean(inputStats[key]?.sanitizationChanged || original !== sanitized),
      sanitizedLength: sanitized.length,
      text: sliceUnicode(sanitized, 0, limit),
      limitApplied: sanitized.length > limit
    };
  };
  add('question', userQuestion, USER_QUESTION_MAX_LENGTH);
  add('reflections', reflectionsText, REFLECTIONS_TEXT_MAX_LENGTH);
  cardsInfo.forEach((card, index) => add(`card-${index}`, card?.userReflection, CARD_REFLECTION_MAX_LENGTH, true));
  const dedupKey = (text) => text.trim().toLowerCase().replace(/\s+/g, ' ');
  const globalKey = fields.reflections.text ? dedupKey(fields.reflections.text) : '';
  const cardKeys = Object.keys(fields).filter((key) => key.startsWith('card-') && fields[key].text);
  const duplicate = globalKey && cardKeys.find((key) => dedupKey(fields[key].text) === globalKey);
  // The reading client also sends every card reflection joined as "Position: text"
  // lines. That aggregate repeats the per-card fields, so it is a duplicate too.
  const aggregate = cardKeys.map((key) => {
    const index = Number(key.slice(5));
    return `${cardsInfo[index]?.position || `Position ${index + 1}`}: ${fields[key].text}`;
  }).join('\n');
  if (duplicate) {
    fields.reflections.duplicateOf = duplicate;
  } else if (globalKey && cardKeys.length > 0 && dedupKey(aggregate) === globalKey) {
    fields.reflections.duplicateOf = cardKeys[0];
    fields.reflections.duplicateSources = cardKeys;
  }
  return fields;
}

function representedDuplicateLength(field, included) {
  const sources = field.duplicateSources || [field.duplicateOf];
  let represented = 0;
  let complete = true;
  for (const source of sources) {
    const value = included.get(source);
    if (typeof value === 'string') {
      represented += value.length;
    } else {
      complete = false;
      if (value) represented += value.head.length + value.tail.length;
    }
  }
  return complete ? field.text.length : Math.min(field.text.length, represented);
}

export function renderUserContext(source, value) {
  const serialized = JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
  return `<user_context source="${source}">${serialized}</user_context>`;
}

export function parseUserContext(prompt) {
  const result = new Map();
  for (const match of prompt.matchAll(/<user_context source="(question|reflections|card-\d+)">([^\n]*?)<\/user_context>/g)) {
    try {
      const value = JSON.parse(match[2]);
      if (typeof value === 'string' || (value?.omittedForBudget === true && typeof value.head === 'string' && typeof value.tail === 'string')) result.set(match[1], value);
    } catch { /* An incomplete boundary is never counted as retained context. */ }
  }
  return result;
}

export function summarizeUserContext(fields, finalPrompt) {
  const included = parseUserContext(finalPrompt);
  return Object.fromEntries(Object.entries(fields).map(([key, field]) => {
    const value = included.get(key);
    const includedLength = typeof value === 'string' ? value.length : value ? value.head.length + value.tail.length : 0;
    const representedLength = field.duplicateOf
      ? representedDuplicateLength(field, included)
      : includedLength;
    const representationTruncated = Boolean(field.text && representedLength < field.text.length);
    const budgetTruncated = representationTruncated;
    return [key, {
      originalLength: field.originalLength,
      sanitizedLength: field.sanitizedLength,
      eligibleLength: field.text.length,
      includedLength,
      representedLength,
      representationTruncated,
      sanitizationChanged: field.sanitizationChanged,
      limitApplied: field.limitApplied,
      budgetTruncated,
      omitted: Boolean(field.originalLength && !includedLength),
      reason: field.duplicateOf ? 'deduplicated' : !field.text && field.originalLength ? 'sanitized_empty' : budgetTruncated ? 'removed_for_budget' : field.limitApplied ? 'input_limit' : null,
      ...(field.duplicateOf ? {
        duplicateOf: field.duplicateOf,
        representedByDuplicate: (field.duplicateSources || [field.duplicateOf]).every((source) => included.has(source))
      } : {})
    }];
  }));
}

function sliceUnicode(text, start, end) {
  let from = start;
  let to = end;
  if (from > 0 && /[\uDC00-\uDFFF]/.test(text[from] || '')) from += 1;
  if (to < text.length && /[\uDC00-\uDFFF]/.test(text[to] || '')) to -= 1;
  return text.slice(from, to);
}

// Preserve both the setup and closing constraints. An explicit data marker
// tells the model when the middle is unavailable; never splice a broken JSON tag.
export function fitUserContext(source, value, maxTokens) {
  const full = renderUserContext(source, value);
  if (estimateTokenCount(full) <= maxTokens) return full;
  const text = typeof value === 'string' ? value : `${value.head}${value.tail}`;
  let lo = 0;
  let hi = text.length;
  let fitted = '';
  while (lo <= hi) {
    const length = Math.floor((lo + hi) / 2);
    const headLength = Math.ceil(length / 2);
    const candidate = renderUserContext(source, { head: sliceUnicode(text, 0, headLength), omittedForBudget: true, tail: sliceUnicode(text, text.length - Math.floor(length / 2), text.length) });
    if (estimateTokenCount(candidate) <= maxTokens) {
      fitted = length ? candidate : '';
      lo = length + 1;
    } else hi = length - 1;
  }
  return fitted;
}
