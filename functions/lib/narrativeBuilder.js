/**
 * Narrative builder entrypoint that proxies to modular spread/prompt helpers.
 */
export { buildPositionCardText, buildElementalRemedies, shouldOfferElementalRemedies, formatReversalLens } from './narrative/helpers.js';
export { buildEnhancedClaudePrompt } from './narrative/prompts.js';
export { buildCelticCrossReading } from './narrative/spreads/celticCross.js';
export { buildFiveCardReading } from './narrative/spreads/fiveCard.js';
export { buildRelationshipReading } from './narrative/spreads/relationship.js';
export { buildDecisionReading } from './narrative/spreads/decision.js';
export { buildSingleCardReading } from './narrative/spreads/singleCard.js';
export { buildThreeCardReading } from './narrative/spreads/threeCard.js';
