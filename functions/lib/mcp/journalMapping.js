/**
 * Mapping from a completed MCP reading (job snapshot, or the audited
 * SaveReadingRequest payload) to a journal entry (spec §6.4, D11).
 *
 * Cards are stored under their canonical catalog identity, the namespace the
 * app's own saves use, resolved with the reading pipeline's own resolver
 * (resolveReadingCards). Deck labels such as Thoth "Prince of Wands" are not
 * catalog names; stored as-is they render as a card back, or as the wrong
 * card.
 */

import { ReadingCardResolutionError, resolveReadingCards } from '../readingCardResolution.js';

export const SPREAD_KEYS = Object.freeze(['single', 'threeCard', 'fiveCard', 'decision', 'relationship', 'celtic']);
export const JOURNAL_CONTEXTS = Object.freeze(['love', 'career', 'self', 'spiritual', 'wellbeing', 'decision', 'general']);

const DEFAULT_DECK = 'rws-1909';

export class JournalMappingError extends Error {
  constructor(message) {
    super(message);
    this.name = 'JournalMappingError';
  }
}

export function normalizeOrientation(value) {
  const lower = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (lower === 'upright') return 'Upright';
  if (lower === 'reversed') return 'Reversed';
  throw new JournalMappingError(`orientation must be Upright or Reversed, not ${JSON.stringify(value)}`);
}

function requireText(value, message) {
  if (typeof value !== 'string' || !value.trim()) throw new JournalMappingError(message);
  return value;
}

function nullableNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * A card as the MCP tools show it: the deck label plus catalog metadata.
 *
 * @param {object} card - { position, card (deck label), orientation, meaning }
 * @param {object} [catalog] - Resolved catalog identity; defaults to `card`
 */
export function toPublicCard(card, catalog = card) {
  return {
    position: card.position,
    card: card.card,
    orientation: normalizeOrientation(card.orientation),
    meaning: typeof card.meaning === 'string' ? card.meaning : null,
    number: nullableNumber(catalog?.number),
    suit: catalog?.suit || null,
    rank: catalog?.rank || null,
    rankValue: nullableNumber(catalog?.rankValue)
  };
}

function readLabels(cards, labelField) {
  if (!Array.isArray(cards) || cards.length === 0) {
    throw new JournalMappingError('the reading has no cards');
  }
  return cards.map((card, index) => ({
    card: requireText(card?.[labelField], `card ${index + 1} has no name`),
    position: requireText(card?.position, `card ${index + 1} has no position`),
    orientation: normalizeOrientation(card?.orientation)
  }));
}

function resolveCatalogCards(labels, deckStyle) {
  try {
    return resolveReadingCards(
      labels.map(({ card, position, orientation }) => ({ card, position, orientation, meaning: '' })),
      deckStyle
    );
  } catch (error) {
    if (error instanceof ReadingCardResolutionError) throw new JournalMappingError(error.message);
    throw error;
  }
}

function toJournalCard({ position, orientation }, catalog) {
  const card = { position, name: catalog.name, orientation };
  if (catalog.number !== null && catalog.number !== undefined) card.number = catalog.number;
  if (catalog.suit) card.suit = catalog.suit;
  if (catalog.rank) card.rank = catalog.rank;
  if (catalog.rankValue !== null && catalog.rankValue !== undefined) card.rankValue = catalog.rankValue;
  return card;
}

function normalizeContextInput(context) {
  if (context === undefined || context === null) return null;
  if (!JOURNAL_CONTEXTS.includes(context)) {
    throw new JournalMappingError(`context must be one of ${JOURNAL_CONTEXTS.join(', ')}`);
  }
  return context;
}

/**
 * Journal entry for a completed job, from the job's own snapshot and result.
 * The narrative is copied verbatim; `context` comes only from the tool input.
 *
 * @param {object} job - getMcpJobSnapshot(...).data
 * @param {{ context?: string }} [options]
 */
export function buildJournalEntryFromJob(job, { context } = {}) {
  const snapshot = job?.snapshot;
  const result = job?.result;
  if (!snapshot) throw new JournalMappingError('this job has no saved reading details');
  if (job.status !== 'complete' || typeof result?.reading !== 'string' || !result.reading.trim()) {
    throw new JournalMappingError('the reading has not finished; wait for it to complete first');
  }
  if (result.provider === 'safety-gate' || result.gateReason === 'crisis_gate') {
    throw new JournalMappingError('this response was a safety message, not a reading');
  }
  const requestId = requireText(result.requestId, 'the reading has no request ID');
  const spreadKey = snapshot.spreadInfo?.key;
  if (!SPREAD_KEYS.includes(spreadKey)) {
    throw new JournalMappingError('the reading has no recognised spread key');
  }

  const deckStyle = snapshot.deckStyle || DEFAULT_DECK;
  const labels = readLabels(snapshot.cardsInfo, 'card');
  const catalog = resolveCatalogCards(labels, deckStyle);

  return {
    spread: snapshot.spreadInfo?.name || spreadKey,
    spreadKey,
    question: snapshot.userQuestion ?? null,
    cards: labels.map((label, index) => toJournalCard(label, catalog[index])),
    personalReading: result.reading,
    themes: job.meta?.themes ?? null,
    context: normalizeContextInput(context),
    provider: result.provider ?? null,
    sessionSeed: snapshot.seed ?? null,
    requestId,
    deckId: deckStyle,
    userPreferences: snapshot.personalization ?? null
  };
}

function assertCatalogIdentity(card, catalog, index, deckStyle) {
  const where = `card ${index + 1} (${JSON.stringify(card.name)})`;
  if (catalog.number !== null && catalog.number !== undefined) {
    if (card.number === undefined || card.number === null) {
      throw new JournalMappingError(`${where} needs its number, as the reading returned it`);
    }
    if (card.number !== catalog.number) {
      throw new JournalMappingError(
        `${where} is ${catalog.name} (number ${catalog.number}) in deck ${deckStyle}, but number ${card.number} was sent`
      );
    }
    return;
  }
  if (!card.suit || card.rankValue === undefined || card.rankValue === null) {
    throw new JournalMappingError(`${where} needs its suit and rankValue, as the reading returned them`);
  }
  if (card.suit !== catalog.suit || card.rankValue !== catalog.rankValue) {
    throw new JournalMappingError(
      `${where} is ${catalog.name} (${catalog.suit}, rankValue ${catalog.rankValue}) in deck ${deckStyle}, but ${card.suit} rankValue ${card.rankValue} was sent`
    );
  }
}

/**
 * Journal entry from the audited SaveReadingRequest payload (the fallback
 * when a job has expired). Each card's label must agree with the catalog
 * metadata the reading returned, so a canonical name sent for a non-RWS deck
 * is refused rather than resolved to the wrong card.
 */
export function buildJournalEntryFromPayload(input) {
  const spreadKey = input?.spreadKey;
  if (!SPREAD_KEYS.includes(spreadKey)) {
    throw new JournalMappingError(`spreadKey must be one of ${SPREAD_KEYS.join(', ')}`);
  }
  const spread = requireText(input.spread, 'spread is required');
  const personalReading = requireText(
    input.personalReading,
    'personalReading is required: send the complete narrative exactly as the reading returned it'
  );
  const requestId = requireText(input.requestId, 'requestId is required: use the requestId the reading returned');

  const deckStyle = input.deckId || DEFAULT_DECK;
  const labels = readLabels(input.cards, 'name');
  const catalog = resolveCatalogCards(labels, deckStyle);
  input.cards.forEach((card, index) => assertCatalogIdentity(card, catalog[index], index, deckStyle));

  return {
    spread,
    spreadKey,
    question: input.question ?? null,
    cards: labels.map((label, index) => toJournalCard(label, catalog[index])),
    personalReading,
    themes: input.themes ?? null,
    context: normalizeContextInput(input.context),
    provider: input.provider ?? null,
    sessionSeed: input.sessionSeed ?? null,
    requestId,
    deckId: deckStyle,
    userPreferences: input.userPreferences ?? null
  };
}
