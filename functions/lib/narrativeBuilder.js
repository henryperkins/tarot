/**
 * Narrative builder entrypoint that proxies to modular spread/prompt helpers.
 */
export { buildPositionCardText, buildElementalRemedies, shouldOfferElementalRemedies, formatReversalLens, computeRemedyRotationIndex } from './narrative/helpers.js';
export { buildEnhancedClaudePrompt } from './narrative/prompts.js';

import { buildCelticCrossReading as buildCelticCrossReadingImpl } from './narrative/spreads/celticCross.js';
import { buildFiveCardReading as buildFiveCardReadingImpl } from './narrative/spreads/fiveCard.js';
import { buildRelationshipReading as buildRelationshipReadingImpl } from './narrative/spreads/relationship.js';
import { buildDecisionReading as buildDecisionReadingImpl } from './narrative/spreads/decision.js';
import { buildSingleCardReading as buildSingleCardReadingImpl } from './narrative/spreads/singleCard.js';
import { buildThreeCardReading as buildThreeCardReadingImpl } from './narrative/spreads/threeCard.js';
import {
  RELATIONSHIP_SPREAD_MIN_CARDS,
  RELATIONSHIP_SPREAD_MAX_CARDS
} from './spreadContracts.js';

function assertValidCardsInfo(cardsInfo, expectedCount, options = {}) {
  const minimumOnly = options.minimumOnly === true;
  const maxCount = Number.isFinite(options.maxCount) ? options.maxCount : null;
  if (!Array.isArray(cardsInfo) || cardsInfo.length === 0) {
    const err = new Error('NARRATIVE_NO_CARDS');
    err.details = {
      expectedCount,
      receivedCount: Array.isArray(cardsInfo) ? cardsInfo.length : 0
    };
    throw err;
  }

  const hasCardCountMismatch = Number.isFinite(expectedCount) && (
    minimumOnly
      ? cardsInfo.length < expectedCount
      : cardsInfo.length !== expectedCount
  );
  if (hasCardCountMismatch) {
    const err = new Error('NARRATIVE_CARD_COUNT_MISMATCH');
    err.details = { expectedCount, receivedCount: cardsInfo.length };
    throw err;
  }
  if (maxCount !== null && cardsInfo.length > maxCount) {
    const err = new Error('NARRATIVE_CARD_COUNT_MISMATCH');
    err.details = { expectedCount, maxCount, receivedCount: cardsInfo.length };
    throw err;
  }

  const requiredFields = ['position', 'card', 'orientation', 'meaning'];
  for (let i = 0; i < cardsInfo.length; i++) {
    const card = cardsInfo[i];
    if (typeof card !== 'object' || card === null) {
      const err = new Error('NARRATIVE_INVALID_CARD_AT_INDEX');
      err.details = { index: i, reason: 'card_not_object' };
      throw err;
    }

    const missing = requiredFields.filter((field) => {
      const value = card[field];
      return typeof value !== 'string' || !value.trim();
    });

    if (missing.length > 0) {
      const err = new Error('NARRATIVE_INVALID_CARD_AT_INDEX');
      err.details = { index: i, missing };
      throw err;
    }
  }
}

export async function buildCelticCrossReading(payload, options = {}) {
  assertValidCardsInfo(payload?.cardsInfo, 10);
  return await buildCelticCrossReadingImpl(payload, options);
}

export async function buildFiveCardReading(payload, options = {}) {
  assertValidCardsInfo(payload?.cardsInfo, 5);
  return await buildFiveCardReadingImpl(payload, options);
}

export async function buildRelationshipReading(payload, options = {}) {
  assertValidCardsInfo(payload?.cardsInfo, RELATIONSHIP_SPREAD_MIN_CARDS, {
    minimumOnly: true,
    maxCount: RELATIONSHIP_SPREAD_MAX_CARDS
  });
  return await buildRelationshipReadingImpl(payload, options);
}

export async function buildDecisionReading(payload, options = {}) {
  assertValidCardsInfo(payload?.cardsInfo, 5);
  return await buildDecisionReadingImpl(payload, options);
}

export function buildSingleCardReading(payload, options = {}) {
  assertValidCardsInfo(payload?.cardsInfo, 1);
  return buildSingleCardReadingImpl(payload, options);
}

export async function buildThreeCardReading(payload, options = {}) {
  assertValidCardsInfo(payload?.cardsInfo, 3);
  return await buildThreeCardReadingImpl(payload, options);
}
