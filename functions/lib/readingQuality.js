/**
 * Reading Quality Metrics and Validation
 *
 * Provides quality gate thresholds, narrative metrics computation,
 * card coverage analysis, hallucination detection, vision metrics,
 * and metrics persistence.
 *
 * Extracted from tarot-reading.js to maintain <900 line limit.
 */

import {
  escapeRegex,
  hasExplicitCardContext,
  normalizeCardName,
  AMBIGUOUS_CARD_NAMES,
  TAROT_TERMINOLOGY_EXCLUSIONS
} from './cardContextDetection.js';
import { canonicalizeCardName, canonicalCardKey } from '../../shared/vision/cardNameMapping.js';
import { validateReadingNarrative } from './narrativeSpine.js';
import { normalizeVisionLabel } from './visionLabels.js';
import { MAJOR_ARCANA } from '../../src/data/majorArcana.js';
import { MINOR_ARCANA } from '../../src/data/minorArcana.js';

// ============================================================================
// Spread Definitions
// ============================================================================

/**
 * Map of spread display names to their canonical keys and card counts.
 * Frozen to prevent accidental mutation.
 */
export const SPREAD_NAME_MAP = Object.freeze({
  'Celtic Cross (Classic 10-Card)': Object.freeze({ key: 'celtic', count: 10 }),
  'Three-Card Story (Past · Present · Future)': Object.freeze({ key: 'threeCard', count: 3 }),
  'Five-Card Clarity': Object.freeze({ key: 'fiveCard', count: 5 }),
  'One-Card Insight': Object.freeze({ key: 'single', count: 1 }),
  'Relationship Snapshot': Object.freeze({ key: 'relationship', count: 3 }),
  'Decision / Two-Path': Object.freeze({ key: 'decision', count: 5 })
});

/**
 * Get spread definition by display name.
 *
 * @param {string} spreadName - Display name of the spread
 * @returns {Object|null} Spread definition with key and count
 */
export function getSpreadDefinition(spreadName) {
  return SPREAD_NAME_MAP[spreadName] || null;
}

/**
 * Get canonical spread key from display name.
 *
 * @param {string} spreadName - Display name of the spread
 * @param {string|null} fallbackKey - Fallback key if spread not found
 * @returns {string} Canonical spread key
 */
export function getSpreadKey(spreadName, fallbackKey = null) {
  const def = getSpreadDefinition(spreadName);
  if (def?.key) return def.key;
  if (typeof fallbackKey === 'string' && fallbackKey.trim()) {
    return fallbackKey.trim();
  }
  return 'general';
}

// ============================================================================
// Card Name Pattern Detection
// ============================================================================

/**
 * Pre-compiled card name patterns for hallucination detection.
 */
export const CARD_NAME_PATTERNS = [...MAJOR_ARCANA, ...MINOR_ARCANA]
  .map((card) => card.name)
  .map((name) => ({
    name,
    normalized: normalizeCardName(name),
    pattern: new RegExp(`\\b${escapeRegex(name)}\\b`, 'i')
  }));

/**
 * Card names that require title case to be considered card references.
 * Prevents false positives on common words like "the fool" in lowercase.
 */
export const CARD_NAMES_REQUIRING_CARD_CASE = new Set(
  MAJOR_ARCANA
    .map((card) => normalizeCardName(card.name))
    .filter((name) => name.startsWith('the ') || name === 'wheel of fortune')
);

/**
 * Stop words to exclude when checking title case.
 */
export const CARD_NAME_STOP_WORDS = new Set(['the', 'of']);

// ============================================================================
// Quality Gate Thresholds
// ============================================================================

/**
 * Weight threshold for high-importance positions.
 */
export const HIGH_WEIGHT_POSITION_THRESHOLD = 0.75;

/**
 * Get quality gate thresholds for a specific spread type.
 *
 * Returns coverage and hallucination thresholds that vary by spread:
 * - Celtic Cross: slightly more lenient due to complexity
 * - Smaller spreads: stricter coverage requirements
 * - Large custom spreads: scale by card count
 *
 * @param {string} spreadKey - Canonical spread key
 * @param {number} cardCount - Number of cards in the spread
 * @returns {Object} { minCoverage, maxHallucinations, highWeightThreshold }
 */
export function getQualityGateThresholds(spreadKey, cardCount) {
  const normalizedSpread = (spreadKey || 'general').toLowerCase();

  if (normalizedSpread === 'celtic') {
    return {
      minCoverage: 0.75,
      maxHallucinations: 2,
      highWeightThreshold: HIGH_WEIGHT_POSITION_THRESHOLD
    };
  }

  if (['relationship', 'decision', 'threecard', 'fivecard', 'single'].includes(normalizedSpread)) {
    return {
      minCoverage: 0.8,
      maxHallucinations: 1,
      highWeightThreshold: HIGH_WEIGHT_POSITION_THRESHOLD
    };
  }

  // Default: scale slightly by size; larger spreads allow a tiny bit more slack.
  const isLargeSpread = cardCount >= 8;
  return {
    minCoverage: isLargeSpread ? 0.75 : 0.8,
    maxHallucinations: isLargeSpread ? 2 : 1,
    highWeightThreshold: HIGH_WEIGHT_POSITION_THRESHOLD
  };
}

// ============================================================================
// Card Coverage Analysis
// ============================================================================

/**
 * Analyze how many drawn cards are mentioned in the reading text.
 *
 * @param {string} readingText - Generated reading narrative
 * @param {Array} cardsInfo - Array of card objects with .card property
 * @returns {Object} { coverage: number, missingCards: string[] }
 */
export function analyzeCardCoverage(readingText, cardsInfo = []) {
  if (!Array.isArray(cardsInfo) || cardsInfo.length === 0) {
    return { coverage: 1, missingCards: [] };
  }

  const text = typeof readingText === 'string' ? readingText : '';
  const missingCards = cardsInfo
    .filter((card) => card && typeof card.card === 'string')
    .map((card) => card.card)
    .filter((name) => {
      if (!name) return true;
      const pattern = new RegExp(escapeRegex(name), 'i');
      return !pattern.test(text);
    });

  const presentCount = cardsInfo.length - missingCards.length;
  const coverage = cardsInfo.length ? presentCount / cardsInfo.length : 1;
  return { coverage, missingCards };
}

// ============================================================================
// Hallucination Detection
// ============================================================================

/**
 * Check if text appears to use title case (card name formatting).
 *
 * @param {string} matchText - Matched text to check
 * @returns {boolean} Whether the text looks like a card name
 */
function looksLikeCardNameCase(matchText) {
  if (!matchText || typeof matchText !== 'string') return false;
  if (matchText === matchText.toUpperCase()) return true;

  const words = matchText.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return false;

  const significantWords = words.filter((word) => !CARD_NAME_STOP_WORDS.has(word.toLowerCase()));
  if (!significantWords.length) return false;

  return significantWords.every((word) => /^[A-Z]/.test(word));
}

/**
 * Detect cards mentioned in reading that weren't in the drawn spread.
 *
 * Uses context awareness to avoid false positives:
 * - Filters out tarot terminology (e.g., "Fool's Journey")
 * - Requires title case for ambiguous names (Justice, Strength, etc.)
 * - Cross-references against deck-specific canonical names
 *
 * @param {string} readingText - Generated reading narrative
 * @param {Array} cardsInfo - Array of drawn cards
 * @param {string} deckStyle - Deck style for name canonicalization
 * @returns {string[]} Array of hallucinated card names
 */
export function detectHallucinatedCards(readingText, cardsInfo = [], deckStyle = 'rws-1909') {
  if (!readingText) return [];

  let text = typeof readingText === 'string' ? readingText : '';
  const safeCards = Array.isArray(cardsInfo) ? cardsInfo : [];

  // Remove tarot terminology phrases that reference card names but aren't card references
  // e.g., "Fool's Journey" refers to the archetypal journey, not The Fool card
  TAROT_TERMINOLOGY_EXCLUSIONS.forEach(pattern => {
    text = text.replace(pattern, '[TERMINOLOGY]');
  });

  // Track both canonical deck-aware keys and normalized literal names for drawn cards.
  const drawnKeys = new Set(
    safeCards
      .filter((card) => card && typeof card.card === 'string')
      .map((card) => {
        const canonical = canonicalCardKey(card.card, deckStyle);
        return canonical || normalizeCardName(card.card);
      })
      .filter(Boolean)
  );

  const hallucinated = [];

  CARD_NAME_PATTERNS.forEach(({ name, normalized, pattern }) => {
    const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
    const matches = Array.from(text.matchAll(new RegExp(pattern.source, flags)));
    if (!matches.length) {
      return;
    }

    const hasContext = hasExplicitCardContext(text, name);
    const requiresCardCase = CARD_NAMES_REQUIRING_CARD_CASE.has(normalized);
    const hasCardCase = requiresCardCase
      ? matches.some((match) => looksLikeCardNameCase(match[0]))
      : true;

    // For names that are also common vocabulary (Justice, Strength, Temperance, Death, Judgement),
    // only treat them as card mentions when there is explicit card-like context in the text.
    if (AMBIGUOUS_CARD_NAMES.has(normalized) && !hasContext) {
      return;
    }

    if (requiresCardCase && !hasContext && !hasCardCase) {
      return;
    }

    const canonical = canonicalCardKey(name, deckStyle);
    const key = canonical || normalized;

    if (!drawnKeys.has(key)) {
      hallucinated.push(name);
    }
  });

  // De-duplicate while preserving insertion order
  return [...new Set(hallucinated)];
}

// ============================================================================
// Narrative Metrics
// ============================================================================

/**
 * Build comprehensive narrative quality metrics.
 *
 * Combines spine validation, card coverage, and hallucination detection
 * into a single metrics object for quality gating and telemetry.
 *
 * @param {string} readingText - Generated reading narrative
 * @param {Array} cardsInfo - Array of drawn cards
 * @param {string} deckStyle - Deck style for name canonicalization
 * @returns {Object} Narrative metrics object
 */
export function buildNarrativeMetrics(readingText, cardsInfo, deckStyle = 'rws-1909') {
  const text = typeof readingText === 'string' ? readingText : '';
  const safeCards = Array.isArray(cardsInfo) ? cardsInfo : [];
  const spine = validateReadingNarrative(text);
  const coverage = analyzeCardCoverage(text, safeCards);
  const hallucinatedCards = detectHallucinatedCards(text, safeCards, deckStyle);

  return {
    spine: {
      isValid: spine.isValid,
      totalSections: spine.totalSections || 0,
      completeSections: spine.completeSections || 0,
      incompleteSections: spine.incompleteSections || 0,
      suggestions: spine.suggestions || []
    },
    cardCoverage: coverage.coverage,
    missingCards: coverage.missingCards,
    hallucinatedCards
  };
}

// ============================================================================
// Vision Metrics
// ============================================================================

/**
 * Annotate vision proof insights with match information.
 *
 * Processes raw vision API outputs and matches predicted cards
 * against the drawn spread, normalizing names per deck style.
 *
 * @param {Array} proofInsights - Raw insights from vision proof
 * @param {Array} cardsInfo - Array of drawn cards
 * @param {string} deckStyle - Deck style for name canonicalization
 * @returns {Array} Annotated vision insights
 */
export function annotateVisionInsights(proofInsights, cardsInfo = [], deckStyle = 'rws-1909') {
  if (!Array.isArray(proofInsights) || proofInsights.length === 0) {
    return [];
  }

  const normalizedDeck = deckStyle || 'rws-1909';
  const drawnNames = new Set(
    (cardsInfo || [])
      .map((card) => canonicalCardKey(card?.card || card?.name, normalizedDeck))
      .filter(Boolean)
  );

  return proofInsights
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => {
      const predictedCard = canonicalizeCardName(entry.predictedCard || entry.card, normalizedDeck);
      if (!predictedCard) {
        return null;
      }

      const predictedKey = canonicalCardKey(predictedCard, normalizedDeck);
      const matchesDrawnCard = drawnNames.size > 0
        ? (predictedKey ? drawnNames.has(predictedKey) : null)
        : null;

      const matches = Array.isArray(entry.matches)
        ? entry.matches
          .map((match) => {
            const card = canonicalizeCardName(match?.card || match?.cardName, normalizedDeck);
            if (!card) return null;
            return {
              ...match,
              card
            };
          })
          .filter(Boolean)
          .slice(0, 3)
        : [];

      return {
        label: normalizeVisionLabel(entry.label),
        predictedCard,
        confidence: typeof entry.confidence === 'number' ? entry.confidence : null,
        basis: typeof entry.basis === 'string' ? entry.basis : null,
        matchesDrawnCard,
        matches,
        attention: entry.attention || null,
        symbolVerification: entry.symbolVerification || null,
        visualProfile: entry.visualProfile || null
      };
    })
    .filter(Boolean)
    .slice(0, 10);
}

/**
 * Build vision quality metrics from annotated insights.
 *
 * @param {Array} insights - Annotated vision insights
 * @param {number} avgConfidence - Average confidence score
 * @param {number} mismatchCount - Number of mismatched detections
 * @returns {Object} Vision metrics object
 */
export function buildVisionMetrics(insights, avgConfidence, mismatchCount) {
  const safeInsights = Array.isArray(insights) ? insights : [];
  const symbolStats = safeInsights
    .filter((entry) => entry && entry.symbolVerification)
    .map((entry) => ({
      card: entry.predictedCard,
      matchRate: typeof entry.symbolVerification.matchRate === 'number' ? entry.symbolVerification.matchRate : null,
      missingSymbols: Array.isArray(entry.symbolVerification.missingSymbols)
        ? entry.symbolVerification.missingSymbols
        : [],
      unexpectedDetections: Array.isArray(entry.symbolVerification.unexpectedDetections)
        ? entry.symbolVerification.unexpectedDetections
        : [],
      expectedCount: entry.symbolVerification.expectedCount ?? null,
      detectedCount: entry.symbolVerification.detectedCount ?? null
    }));

  return {
    uploads: safeInsights.length,
    avgConfidence: Number.isFinite(avgConfidence) ? avgConfidence : null,
    mismatchCount,
    symbolStats
  };
}

// ============================================================================
// Metrics Persistence
// ============================================================================

/**
 * Persist reading metrics to KV storage for telemetry.
 *
 * @param {Object} env - Cloudflare environment bindings
 * @param {Object} payload - Metrics payload to persist
 */
export async function persistReadingMetrics(env, payload) {
  if (!env?.METRICS_DB?.put) {
    return;
  }

  try {
    const key = `reading:${payload.requestId}`;
    await env.METRICS_DB.put(key, JSON.stringify(payload), {
      metadata: {
        provider: payload.provider,
        spreadKey: payload.spreadKey,
        deckStyle: payload.deckStyle,
        timestamp: payload.timestamp
      }
    });
  } catch (err) {
    console.warn(`[${payload.requestId}] Failed to persist reading metrics: ${err.message}`);
  }
}
