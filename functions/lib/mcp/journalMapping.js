/**
 * Mapping from a completed MCP reading job to a journal entry (spec §6.4,
 * D11). Saves always rebuild the entry from the account's own job; the model
 * never supplies the narrative or cards.
 *
 * Cards are stored under their canonical catalog identity, the namespace the
 * app's own saves use, resolved with the reading pipeline's own resolver
 * (resolveReadingCards). Deck labels such as Thoth "Prince of Wands" are not
 * catalog names; stored as-is they render as a card back, or as the wrong
 * card.
 */

import { ReadingCardResolutionError, resolveReadingCards } from '../readingCardResolution.js';
import { classifyReadingResult, READING_OUTCOME } from './readingOutcome.js';

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

function readLabels(cards) {
  if (!Array.isArray(cards) || cards.length === 0) {
    throw new JournalMappingError('the reading has no cards');
  }
  return cards.map((card, index) => ({
    card: requireText(card?.card, `card ${index + 1} has no name`),
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

function toJournalCard({ card: label, position, orientation }, catalog) {
  const card = { position, name: catalog.name, orientation };
  if (label !== catalog.name) card.displayName = label;
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

const NOT_A_READING = Object.freeze({
  [READING_OUTCOME.SUPPORT]: 'this response was a safety message, not a reading',
  [READING_OUTCOME.WITHHELD]: "Tableu's safety check held back this reading, so there is no reading to save",
  [READING_OUTCOME.EMPTY]: 'the reading finished without any text, so there is nothing to save'
});

/**
 * Journal entry for a completed job, from the job's own snapshot and result.
 * Only a job that produced a reading can be saved (readingOutcome.js). The
 * narrative is copied verbatim; `context` comes only from the tool input.
 *
 * @param {object} job - getMcpJobSnapshot(...).data
 * @param {{ context?: string }} [options]
 */
export function buildJournalEntryFromJob(job, { context } = {}) {
  const snapshot = job?.snapshot;
  const result = job?.result;
  if (!snapshot) throw new JournalMappingError('this job has no saved reading details');
  if (job.status === 'error') throw new JournalMappingError('the reading failed, so there is nothing to save');
  if (job.status !== 'complete') {
    throw new JournalMappingError('the reading has not finished; wait for it to complete first');
  }
  const outcome = classifyReadingResult(result);
  if (outcome !== READING_OUTCOME.READING) throw new JournalMappingError(NOT_A_READING[outcome]);
  const requestId = requireText(result.requestId, 'the reading has no request ID');
  const spreadKey = snapshot.spreadInfo?.key;
  if (!SPREAD_KEYS.includes(spreadKey)) {
    throw new JournalMappingError('the reading has no recognised spread key');
  }

  const deckStyle = snapshot.deckStyle || DEFAULT_DECK;
  const labels = readLabels(snapshot.cardsInfo);
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
