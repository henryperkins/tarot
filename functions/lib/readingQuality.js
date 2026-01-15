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
import {
  THOTH_MAJOR_ALIASES,
  THOTH_MINOR_TITLES,
  THOTH_SUIT_ALIASES,
  THOTH_COURT_ALIASES,
  MARSEILLE_MAJOR_ALIASES,
  MARSEILLE_SUIT_ALIASES,
  MARSEILLE_COURT_ALIASES
} from '../../shared/vision/deckAssets.js';
import { validateReadingNarrative } from './narrativeSpine.js';
import { normalizeVisionLabel } from './visionLabels.js';
import { MAJOR_ARCANA } from '../../src/data/majorArcana.js';
import { MINOR_ARCANA } from '../../src/data/minorArcana.js';

// ============================================================================
// Ambiguous Thoth Epithets
// ============================================================================

/**
 * Thoth minor arcana epithets that are common English words.
 * These require explicit card context (like AMBIGUOUS_CARD_NAMES) to avoid
 * false positives in hallucination detection.
 *
 * Note: "Strength" is already in AMBIGUOUS_CARD_NAMES as a Major Arcana name.
 */
export const AMBIGUOUS_THOTH_EPITHETS = new Set([
  'love',           // Two of Cups
  'abundance',      // Three of Cups
  'luxury',         // Four of Cups
  'pleasure',       // Six of Cups
  'happiness',      // Nine of Cups
  'peace',          // Two of Swords
  'sorrow',         // Three of Swords
  'truce',          // Four of Swords
  'defeat',         // Five of Swords
  'science',        // Six of Swords
  'ruin',           // Ten of Swords
  'dominion',       // Two of Wands
  'virtue',         // Three of Wands
  'completion',     // Four of Wands
  'strife',         // Five of Wands
  'victory',        // Six of Wands
  'valour',         // Seven of Wands
  'swiftness',      // Eight of Wands
  'oppression',     // Ten of Wands
  'change',         // Two of Pentacles/Disks
  'works',          // Three of Pentacles/Disks
  'power',          // Four of Pentacles/Disks
  'worry',          // Five of Pentacles/Disks
  'success',        // Six of Pentacles/Disks
  'failure',        // Seven of Pentacles/Disks
  'prudence',       // Eight of Pentacles/Disks
  'gain',           // Nine of Pentacles/Disks
  'wealth'          // Ten of Pentacles/Disks
]);

// ============================================================================
// Deck-Aware Alias Building
// ============================================================================

/**
 * Build all valid textual representations for a card given a deck style.
 *
 * For RWS, returns just the canonical name.
 * For Thoth/Marseille, returns both the canonical name AND deck-specific aliases.
 *
 * @param {Object} card - Card object with name, suit, rank, rankValue, number properties
 * @param {string} deckStyle - Deck style identifier
 * @returns {string[]} Array of valid names for the card
 */
export function buildCardAliases(card, deckStyle = 'rws-1909') {
  if (!card?.name) return [];

  const aliases = [card.name];

  if (deckStyle === 'thoth-a1') {
    // Major Arcana Thoth aliases
    if (typeof card.number === 'number') {
      const thothName = THOTH_MAJOR_ALIASES[card.number];
      if (thothName && thothName !== card.name) {
        aliases.push(thothName);
      }
    }
    // Minor Arcana Thoth aliases
    else if (card.suit && typeof card.rankValue === 'number') {
      const suitAlias = THOTH_SUIT_ALIASES[card.suit] || card.suit;

      // Court cards: Page→Princess, Knight→Prince, King→Knight
      if (card.rankValue >= 11) {
        const courtMap = { 11: 'Page', 12: 'Knight', 13: 'Queen', 14: 'King' };
        const baseRank = courtMap[card.rankValue];
        const thothRank = THOTH_COURT_ALIASES[baseRank] || baseRank;
        const thothCourtName = `${thothRank} of ${suitAlias}`;
        if (thothCourtName !== card.name) {
          aliases.push(thothCourtName);
        }
      }
      // Pip cards: include epithet forms
      else {
        const epithet = THOTH_MINOR_TITLES[card.suit]?.[card.rankValue];
        if (epithet) {
          // Full form: "Dominion (Two of Wands)"
          const rankLabels = { 1: 'Ace', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five',
                               6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten' };
          const rankLabel = rankLabels[card.rankValue] || card.rank;
          aliases.push(`${epithet} (${rankLabel} of ${suitAlias})`);
          // Epithet-only form (for matching "the Dominion card")
          aliases.push(epithet);
        }
        // Suit alias form: "Two of Disks" instead of "Two of Pentacles"
        if (suitAlias !== card.suit) {
          aliases.push(`${card.rank} of ${suitAlias}`);
        }
      }
    }
  } else if (deckStyle === 'marseille-classic') {
    // Major Arcana Marseille aliases
    if (typeof card.number === 'number') {
      const marseilleName = MARSEILLE_MAJOR_ALIASES[card.number];
      if (marseilleName && marseilleName !== card.name) {
        aliases.push(marseilleName);
        // Also add the parenthetical form that getMarseilleAlias produces
        aliases.push(`${marseilleName} (RWS: ${card.name})`);
      }
    }
    // Minor Arcana Marseille aliases
    else if (card.suit && card.rank) {
      const suitAlias = MARSEILLE_SUIT_ALIASES[card.suit] || card.suit;
      const rankAlias = MARSEILLE_COURT_ALIASES[card.rank] || card.rank;
      const marseilleMinorName = `${rankAlias} of ${suitAlias}`;
      if (marseilleMinorName !== card.name) {
        aliases.push(marseilleMinorName);
      }
    }
  }

  return aliases;
}

/**
 * Lookup map from card name (lowercase) → full card object.
 * @type {Map<string, Object>}
 */
const cardLookupMap = new Map(
  [...MAJOR_ARCANA, ...MINOR_ARCANA].map((card) => [card.name.toLowerCase(), card])
);

/**
 * Look up full card object by name.
 *
 * @param {string} name - Card name to look up
 * @returns {Object|null} Full card object or null if not found
 */
export function lookupCardByName(name) {
  if (!name || typeof name !== 'string') return null;
  return cardLookupMap.get(name.toLowerCase()) || null;
}

/**
 * Cache for deck-aware pattern sets.
 * @type {Map<string, Array<{name: string, canonical: string, pattern: RegExp, isEpithet: boolean}>>}
 */
const deckPatternCache = new Map();

/**
 * Build deck-aware card name patterns for hallucination detection.
 *
 * Returns patterns for all 78 cards in both RWS and deck-specific forms,
 * each mapped to its canonical RWS name.
 *
 * @param {string} deckStyle - Deck style identifier
 * @returns {Array<{name: string, canonical: string, pattern: RegExp, isEpithet: boolean}>}
 */
export function buildDeckAwarePatterns(deckStyle = 'rws-1909') {
  if (deckPatternCache.has(deckStyle)) {
    return deckPatternCache.get(deckStyle);
  }

  const patterns = [];
  const allCards = [...MAJOR_ARCANA, ...MINOR_ARCANA];

  for (const card of allCards) {
    const aliases = buildCardAliases(card, deckStyle);

    for (const alias of aliases) {
      // Skip empty aliases
      if (!alias || typeof alias !== 'string') continue;

      // Check if this alias is a Thoth epithet (single-word common vocabulary)
      const normalized = normalizeCardName(alias);
      const isEpithet = AMBIGUOUS_THOTH_EPITHETS.has(normalized);

      patterns.push({
        name: alias,
        canonical: card.name,
        normalized,
        pattern: new RegExp(`\\b${escapeRegex(alias)}\\b`, 'i'),
        isEpithet
      });
    }
  }

  deckPatternCache.set(deckStyle, patterns);
  return patterns;
}

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
 * Deck-aware: checks for both RWS canonical names AND deck-specific aliases.
 * For example, with Thoth deck, "Princess of Cups" counts as coverage for
 * "Page of Cups".
 *
 * @param {string} readingText - Generated reading narrative
 * @param {Array} cardsInfo - Array of card objects with .card property
 * @param {string} deckStyle - Deck style for alias resolution
 * @returns {Object} { coverage: number, missingCards: string[] }
 */
export function analyzeCardCoverage(readingText, cardsInfo = [], deckStyle = 'rws-1909') {
  if (!Array.isArray(cardsInfo) || cardsInfo.length === 0) {
    return { coverage: 1, missingCards: [] };
  }

  const text = typeof readingText === 'string' ? readingText : '';

  const missingCards = cardsInfo
    .filter((card) => card && typeof card.card === 'string')
    .map((cardInfo) => cardInfo.card)
    .filter((name) => {
      if (!name) return true;

      // Look up full card object to build all valid aliases
      const fullCard = lookupCardByName(name);
      const aliasesToCheck = fullCard
        ? buildCardAliases(fullCard, deckStyle)
        : [name];

      // Card is present if ANY valid name/alias appears in the text
      return !aliasesToCheck.some((alias) => {
        if (!alias) return false;
        const pattern = new RegExp(`\\b${escapeRegex(alias)}\\b`, 'i');
        return pattern.test(text);
      });
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
 * Deck-aware: recognizes both RWS names and deck-specific aliases (Thoth, Marseille).
 * For example, "Princess of Cups" in a Thoth reading maps to "Page of Cups" canonical.
 *
 * Uses context awareness to avoid false positives:
 * - Filters out tarot terminology (e.g., "Fool's Journey")
 * - Requires title case for ambiguous names (Justice, Strength, etc.)
 * - Requires explicit card context for Thoth epithets (Love, Dominion, etc.)
 * - Cross-references against deck-specific canonical names
 *
 * @param {string} readingText - Generated reading narrative
 * @param {Array} cardsInfo - Array of drawn cards
 * @param {string} deckStyle - Deck style for name canonicalization
 * @returns {string[]} Array of hallucinated card names (canonical RWS names)
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

  // Track canonical keys for drawn cards (always RWS canonical names, lowercased)
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
  const seenCanonicals = new Set();

  // Use deck-aware patterns that include both RWS and deck-specific aliases
  const patterns = buildDeckAwarePatterns(deckStyle);

  patterns.forEach(({ name, canonical, normalized, pattern, isEpithet }) => {
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

    // For RWS names that are common vocabulary (Justice, Strength, etc.),
    // only treat them as card mentions when there is explicit card-like context.
    if (AMBIGUOUS_CARD_NAMES.has(normalized) && !hasContext) {
      return;
    }

    // For Thoth epithets (Love, Dominion, Victory, etc.), also require context
    // since these are common English words
    if (isEpithet && !hasContext) {
      return;
    }

    if (requiresCardCase && !hasContext && !hasCardCase) {
      return;
    }

    // Use the canonical RWS name for comparison
    const canonicalKey = canonical.toLowerCase();

    // Skip if this card is in the drawn spread
    if (drawnKeys.has(canonicalKey)) {
      return;
    }

    // Avoid duplicate reports for the same canonical card
    if (seenCanonicals.has(canonicalKey)) {
      return;
    }

    seenCanonicals.add(canonicalKey);
    hallucinated.push(canonical);
  });

  return hallucinated;
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
  const coverage = analyzeCardCoverage(text, safeCards, deckStyle);
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
 * Persist reading metrics to D1 storage for telemetry.
 *
 * @param {Object} env - Cloudflare environment bindings
 * @param {Object} payload - Metrics payload to persist
 */
export async function persistReadingMetrics(env, payload) {
  if (!env?.DB?.prepare) {
    return;
  }

  try {
    await env.DB.prepare(`
      INSERT INTO eval_metrics (
        request_id, spread_key, deck_style, provider,
        card_coverage, reading_prompt_version, variant_id, payload
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(request_id) DO UPDATE SET
        updated_at = datetime('now'),
        spread_key = excluded.spread_key,
        deck_style = excluded.deck_style,
        provider = excluded.provider,
        card_coverage = excluded.card_coverage,
        reading_prompt_version = excluded.reading_prompt_version,
        variant_id = excluded.variant_id,
        payload = excluded.payload
    `).bind(
      payload.requestId,
      payload.spreadKey || null,
      payload.deckStyle || null,
      payload.provider || null,
      payload.narrative?.cardCoverage ?? null,
      payload.readingPromptVersion || payload.promptMeta?.readingPromptVersion || null,
      payload.variantId || null,
      JSON.stringify(payload)
    ).run();
  } catch (err) {
    console.warn(`[${payload.requestId}] Failed to persist reading metrics: ${err.message}`);
  }
}
