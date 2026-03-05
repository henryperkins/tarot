import { buildSystemPrompt } from './narrative/prompts/systemPrompt.js';
import { buildUserPrompt } from './narrative/prompts/userPrompt.js';
import {
  sanitizeMediaCardName,
  sanitizeMediaMeaning,
  sanitizeMediaPosition,
  sanitizeMediaQuestion,
  sanitizeMediaReflections
} from './mediaPromptSanitization.js';

const MEDIA_DEFAULT_DECK_STYLE = 'rws-1909';

function normalizeMediaQuestion(question) {
  return sanitizeMediaQuestion(question);
}

function normalizeMediaReflections(reflectionsText = '') {
  return sanitizeMediaReflections(reflectionsText);
}

function normalizeOrientation(card = {}) {
  if (typeof card.orientation === 'string' && card.orientation.trim()) {
    const raw = card.orientation.trim().toLowerCase();
    if (raw === 'upright' || raw === 'reversed') {
      return raw;
    }
  }
  return card.reversed ? 'reversed' : 'upright';
}

function normalizePosition(card = {}, index = 0) {
  return sanitizeMediaPosition(card.position, index);
}

function normalizeCardName(card = {}, index = 0) {
  return sanitizeMediaCardName(card.card || card.name || '', index);
}

function normalizeMeaning(card = {}) {
  return sanitizeMediaMeaning(card.meaning || card.interpretation || '');
}

function normalizeDeckStyle(cards = [], deckStyle = MEDIA_DEFAULT_DECK_STYLE) {
  if (typeof deckStyle === 'string' && deckStyle.trim()) {
    return deckStyle.trim();
  }
  for (const card of cards) {
    if (typeof card?.deckStyle === 'string' && card.deckStyle.trim()) {
      return card.deckStyle.trim();
    }
  }
  return MEDIA_DEFAULT_DECK_STYLE;
}

function inferSpreadKey(cards = [], spreadKey = null) {
  if (typeof spreadKey === 'string' && spreadKey.trim()) {
    return spreadKey.trim();
  }
  if (cards.length === 1) {
    return 'single';
  }
  return 'general';
}

function normalizeMediaCards(cards = []) {
  return cards.map((card, index) => ({
    card: normalizeCardName(card, index),
    position: normalizePosition(card, index),
    orientation: normalizeOrientation(card),
    meaning: normalizeMeaning(card),
    number: Number.isInteger(card?.number) ? card.number : null,
    suit: typeof card?.suit === 'string' ? card.suit : null,
    rank: typeof card?.rank === 'string' ? card.rank : null,
    rankValue: Number.isInteger(card?.rankValue) ? card.rankValue : null
  }));
}

export function buildMediaNarrativeReference({
  cards = [],
  question = '',
  reflectionsText = '',
  spreadKey = null,
  deckStyle = MEDIA_DEFAULT_DECK_STYLE
}) {
  const normalizedCards = normalizeMediaCards(cards);
  const safeQuestion = normalizeMediaQuestion(question);
  const safeReflections = normalizeMediaReflections(reflectionsText);
  const resolvedDeckStyle = normalizeDeckStyle(cards, deckStyle);
  const resolvedSpreadKey = inferSpreadKey(normalizedCards, spreadKey);
  const themes = {};
  const context = 'general';

  const systemPrompt = buildSystemPrompt(
    resolvedSpreadKey,
    themes,
    context,
    resolvedDeckStyle,
    safeQuestion,
    {
      includeDeckContext: true,
      includeDiagnostics: false,
      includeEphemeris: false,
      includeForecast: false
    }
  );

  const userPrompt = buildUserPrompt(
    resolvedSpreadKey,
    normalizedCards,
    safeQuestion,
    safeReflections,
    themes,
    null,
    context,
    [],
    resolvedDeckStyle,
    {
      includeDeckContext: true,
      includeDiagnostics: false,
      includeEphemeris: false,
      includeForecast: false
    }
  );

  const referenceBlock = `
READING MODEL ALIGNMENT (mirror the same interpretive contract used for text readings):
- Keep visuals aligned with the semantic arc, emotional tone, and card evidence from the prompts below.
- Treat markdown/output-format instructions as STRUCTURAL context only; do not render any text in the image/video.
- Never depict deterministic fate claims; preserve agency-forward symbolism.

TEXT MODEL SYSTEM PROMPT:
${systemPrompt}

TEXT MODEL USER PROMPT:
${userPrompt}
`.trim();

  return {
    question: safeQuestion,
    reflectionsText: safeReflections,
    cards: normalizedCards,
    spreadKey: resolvedSpreadKey,
    deckStyle: resolvedDeckStyle,
    systemPrompt,
    userPrompt,
    referenceBlock
  };
}
