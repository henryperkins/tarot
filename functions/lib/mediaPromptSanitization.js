import { sanitizeText } from './utils.js';

export const DEFAULT_MEDIA_QUESTION = 'What energy should this reading highlight visually?';

export const MEDIA_PROMPT_LIMITS = Object.freeze({
  question: 280,
  reflections: 2000,
  cardName: 80,
  position: 80,
  meaning: 180,
  maxCards: 10
});

const POSITION_ALLOWED_PATTERN = /^[\p{L}\p{N}\s.,:;!?'"()&/+\-‐–—―−]+$/u;
const DASH_VARIANT_PATTERN = /[‐–—―−]/gu;

export function normalizeMediaDashPunctuation(value = '') {
  return String(value).replace(DASH_VARIANT_PATTERN, '-');
}

function sanitizeMediaText(value, { maxLength, addEllipsis = true } = {}) {
  return sanitizeText(value, {
    maxLength,
    addEllipsis,
    stripMarkdown: true,
    stripControlChars: true,
    filterInstructions: true
  });
}

export function sanitizeMediaQuestion(question) {
  const safeQuestion = sanitizeMediaText(question, {
    maxLength: MEDIA_PROMPT_LIMITS.question,
    addEllipsis: true
  });
  return safeQuestion || DEFAULT_MEDIA_QUESTION;
}

export function sanitizeMediaReflections(reflectionsText = '') {
  return sanitizeMediaText(reflectionsText, {
    maxLength: MEDIA_PROMPT_LIMITS.reflections,
    addEllipsis: true
  });
}

export function sanitizeMediaCardName(rawName, index = 0) {
  const safeName = sanitizeMediaText(rawName, {
    maxLength: MEDIA_PROMPT_LIMITS.cardName,
    addEllipsis: true
  });
  return safeName || `Card ${index + 1}`;
}

export function sanitizeMediaPosition(rawPosition, index = 0) {
  const safePosition = sanitizeMediaText(rawPosition, {
    maxLength: MEDIA_PROMPT_LIMITS.position,
    addEllipsis: true
  });
  const normalizedPosition = normalizeMediaDashPunctuation(safePosition);
  return normalizedPosition || `Card ${index + 1}`;
}

export function sanitizeMediaMeaning(rawMeaning = '') {
  return sanitizeMediaText(rawMeaning, {
    maxLength: MEDIA_PROMPT_LIMITS.meaning,
    addEllipsis: true
  });
}

export function isValidMediaPositionText(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return POSITION_ALLOWED_PATTERN.test(trimmed);
}

export function sanitizeMediaCard(card = {}, index = 0) {
  const safeName = sanitizeMediaCardName(card.card || card.name || '', index);
  const safePosition = sanitizeMediaPosition(card.position || '', index);
  const safeMeaning = sanitizeMediaMeaning(card.meaning || card.interpretation || '');

  return {
    ...card,
    card: safeName,
    name: safeName,
    position: safePosition,
    meaning: safeMeaning
  };
}

export function sanitizeMediaCards(cards = []) {
  return cards.map((card, index) => sanitizeMediaCard(card, index));
}
