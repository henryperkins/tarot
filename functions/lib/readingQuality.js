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
import { sanitizeMetricsPayload } from './evaluation.js';
import {
  getPromptVersion,
  getNarrativeCoverage,
  isSchemaV2
} from './telemetrySchema.js';
import { validateReadingNarrative } from './narrativeSpine.js';
import { normalizeVisionLabel } from './visionLabels.js';
import { MAJOR_ARCANA } from '../../src/data/majorArcana.js';
import { MINOR_ARCANA } from '../../src/data/minorArcana.js';
import {
  RELATIONSHIP_SPREAD_MIN_CARDS,
  RELATIONSHIP_SPREAD_MAX_CARDS
} from './spreadContracts.js';

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

const ROMAN_NUMERALS = {
  1: 'I',
  2: 'II',
  3: 'III',
  4: 'IV',
  5: 'V',
  6: 'VI',
  7: 'VII',
  8: 'VIII',
  9: 'IX',
  10: 'X'
};

const COURT_RANK_ABBREVIATIONS = {
  Page: ['Pg'],
  Knight: ['Kn'],
  Queen: ['Q'],
  King: ['K']
};

function stripReflectionSections(text = '') {
  if (!text || typeof text !== 'string') return '';
  return text.replace(
    /(^|\n)#{2,6}\s*(?:Your\s+)?Reflections?\b[\s\S]*?(?=\n#{2,6}\s+|$)/gi,
    '\n'
  ).trim();
}

function getSuitAliasesForShorthand(suit, deckStyle) {
  const suits = new Set();
  if (suit) suits.add(suit);

  if (deckStyle === 'thoth-a1') {
    suits.add(THOTH_SUIT_ALIASES[suit] || suit);
  } else if (deckStyle === 'marseille-classic') {
    suits.add(MARSEILLE_SUIT_ALIASES[suit] || suit);
  }

  return Array.from(suits).filter(Boolean);
}

function addMinorShorthandAliases(aliases, card, deckStyle) {
  if (!card?.suit || typeof card.rankValue !== 'number') return;

  const suitAliases = getSuitAliasesForShorthand(card.suit, deckStyle);

  if (card.rankValue <= 10) {
    const roman = ROMAN_NUMERALS[card.rankValue];
    suitAliases.forEach((suitAlias) => {
      aliases.push(`${card.rankValue} of ${suitAlias}`);
      if (roman) {
        aliases.push(`${roman} of ${suitAlias}`);
      }
    });
    return;
  }

  const abbreviations = COURT_RANK_ABBREVIATIONS[card.rank];
  if (!abbreviations || abbreviations.length === 0) return;

  suitAliases.forEach((suitAlias) => {
    abbreviations.forEach((abbr) => {
      aliases.push(`${abbr} of ${suitAlias}`);
    });
  });
}

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

  addMinorShorthandAliases(aliases, card, deckStyle);

  return Array.from(new Set(aliases));
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
// Fuzzy Matching (Typo Tolerance)
// ============================================================================

const FUZZY_MIN_LENGTH = 4;
const FUZZY_MAX_WORDS = 5;
const FUZZY_MAX_LENGTH = 60;
const fuzzyAliasCache = new Map();

function normalizeForFuzzy(value = '') {
  if (!value || typeof value !== 'string') return '';
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getFuzzyMaxDistance(length) {
  if (length <= 4) return 0;
  if (length <= 7) return 1;
  return 2;
}

function levenshteinDistance(a, b) {
  if (a === b) return 0;
  const aLen = a.length;
  const bLen = b.length;
  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;

  let prev = new Array(bLen + 1).fill(0);
  let curr = new Array(bLen + 1).fill(0);

  for (let j = 0; j <= bLen; j += 1) {
    prev[j] = j;
  }

  for (let i = 1; i <= aLen; i += 1) {
    curr[0] = i;
    const aChar = a[i - 1];
    for (let j = 1; j <= bLen; j += 1) {
      const cost = aChar === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[bLen];
}

function isFuzzyCandidateAllowed(candidate, entry) {
  if (!candidate?.explicit) {
    if (entry.isEpithet) return false;
    if (AMBIGUOUS_CARD_NAMES.has(entry.normalizedAlias)) return false;
  }
  return true;
}

function extractCardCandidates(text = '') {
  if (!text || typeof text !== 'string') return [];

  const candidates = new Map();

  const addCandidate = (raw, explicit) => {
    const cleaned = raw.replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim();
    if (!cleaned) return;
    if (cleaned.length > FUZZY_MAX_LENGTH) return;
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length === 0 || words.length > FUZZY_MAX_WORDS) return;

    const normalized = normalizeForFuzzy(cleaned);
    if (!normalized || normalized.length < FUZZY_MIN_LENGTH) return;

    const existing = candidates.get(normalized);
    if (existing) {
      existing.explicit = existing.explicit || explicit;
      return;
    }

    candidates.set(normalized, {
      text: cleaned,
      normalized,
      explicit: Boolean(explicit)
    });
  };

  const boldPattern = /\*\*([^*]{2,80})\*\*/g;
  let match;
  while ((match = boldPattern.exec(text)) !== null) {
    addCandidate(match[1], true);
  }

  const ofPattern = /\b([A-Za-z]{1,12}|\d+|[IVX]{1,6})\s+of\s+([A-Za-z]{2,15})\b/gi;
  while ((match = ofPattern.exec(text)) !== null) {
    addCandidate(`${match[1]} of ${match[2]}`, true);
  }

  const thePattern = /\bThe\s+([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){0,2})\b/g;
  while ((match = thePattern.exec(text)) !== null) {
    addCandidate(`The ${match[1]}`, true);
  }

  const contextPattern = /\b(?:card|position|present|past|future|outcome|challenge|advice|anchor|theme|guidance|lesson|insight)\s*[:-]\s*([A-Za-z][A-Za-z\s']{2,50})/gi;
  while ((match = contextPattern.exec(text)) !== null) {
    addCandidate(match[1], true);
  }

  return Array.from(candidates.values());
}

function buildFuzzyAliasEntries(deckStyle = 'rws-1909') {
  if (fuzzyAliasCache.has(deckStyle)) {
    return fuzzyAliasCache.get(deckStyle);
  }

  const entries = [];
  const seen = new Set();
  const patterns = buildDeckAwarePatterns(deckStyle);

  patterns.forEach(({ name, canonical, isEpithet }) => {
    const normalized = normalizeForFuzzy(name);
    if (!normalized || normalized.length < FUZZY_MIN_LENGTH) return;
    const normalizedAlias = normalizeCardName(name);
    const key = `${canonical.toLowerCase()}::${normalized}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({
      alias: name,
      canonical,
      normalized,
      normalizedAlias,
      isEpithet
    });
  });

  fuzzyAliasCache.set(deckStyle, entries);
  return entries;
}

function buildFuzzyAliasEntriesForAliases(aliases = []) {
  const entries = [];
  const seen = new Set();

  aliases.forEach((alias) => {
    const normalized = normalizeForFuzzy(alias);
    if (!normalized || normalized.length < FUZZY_MIN_LENGTH) return;
    const normalizedAlias = normalizeCardName(alias);
    const key = `${normalizedAlias}::${normalized}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({
      alias,
      normalized,
      normalizedAlias,
      isEpithet: AMBIGUOUS_THOTH_EPITHETS.has(normalizedAlias)
    });
  });

  return entries;
}

function findBestFuzzyAliasMatch(candidate, aliasEntries) {
  if (!candidate?.normalized) return null;
  let best = null;

  aliasEntries.forEach((entry) => {
    if (!isFuzzyCandidateAllowed(candidate, entry)) return;
    const maxDistance = getFuzzyMaxDistance(entry.normalized.length);
    if (maxDistance === 0) return;
    if (Math.abs(candidate.normalized.length - entry.normalized.length) > maxDistance) return;

    const distance = levenshteinDistance(candidate.normalized, entry.normalized);
    if (distance <= maxDistance && (!best || distance < best.distance)) {
      best = { entry, distance };
    }
  });

  return best ? best.entry : null;
}

function hasFuzzyAliasMatch(candidates, aliasEntries) {
  if (!candidates.length || !aliasEntries.length) return false;
  return candidates.some(candidate => Boolean(findBestFuzzyAliasMatch(candidate, aliasEntries)));
}

// ============================================================================
// Spread Definitions
// ============================================================================

/**
 * Map of spread display names to their canonical keys and card counts.
 * Frozen to prevent accidental mutation.
 */
const SPREAD_DEFINITION_CELTIC = Object.freeze({ key: 'celtic', count: 10 });
const SPREAD_DEFINITION_THREE_CARD = Object.freeze({ key: 'threeCard', count: 3 });
const SPREAD_DEFINITION_FIVE_CARD = Object.freeze({ key: 'fiveCard', count: 5 });
const SPREAD_DEFINITION_SINGLE = Object.freeze({ key: 'single', count: 1 });
const SPREAD_DEFINITION_RELATIONSHIP = Object.freeze({
  key: 'relationship',
  count: RELATIONSHIP_SPREAD_MIN_CARDS,
  maxCount: RELATIONSHIP_SPREAD_MAX_CARDS
});
const SPREAD_DEFINITION_DECISION = Object.freeze({ key: 'decision', count: 5 });

export const SPREAD_NAME_MAP = Object.freeze({
  'Celtic Cross (Classic 10-Card)': SPREAD_DEFINITION_CELTIC,
  'Three-Card Story (Past · Present · Future)': SPREAD_DEFINITION_THREE_CARD,
  'Five-Card Clarity': SPREAD_DEFINITION_FIVE_CARD,
  'One-Card Insight': SPREAD_DEFINITION_SINGLE,
  'Relationship Snapshot': SPREAD_DEFINITION_RELATIONSHIP,
  'Decision / Two-Path': SPREAD_DEFINITION_DECISION
});

function normalizeSpreadIdentifier(value) {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

const SPREAD_ALIAS_MAP = Object.freeze({
  // Celtic Cross
  celtic: SPREAD_DEFINITION_CELTIC,
  celticcross: SPREAD_DEFINITION_CELTIC,
  celticcrossclassic10card: SPREAD_DEFINITION_CELTIC,

  // Three-card aliases (web + native)
  threecard: SPREAD_DEFINITION_THREE_CARD,
  threecardstory: SPREAD_DEFINITION_THREE_CARD,
  threecardstorypastpresentfuture: SPREAD_DEFINITION_THREE_CARD,

  // Five-card
  fivecard: SPREAD_DEFINITION_FIVE_CARD,
  fivecardclarity: SPREAD_DEFINITION_FIVE_CARD,

  // Single-card aliases (web + native "Daily Draw")
  single: SPREAD_DEFINITION_SINGLE,
  onecard: SPREAD_DEFINITION_SINGLE,
  onecardinsight: SPREAD_DEFINITION_SINGLE,
  dailydraw: SPREAD_DEFINITION_SINGLE,

  // Relationship
  relationship: SPREAD_DEFINITION_RELATIONSHIP,
  relationshipsnapshot: SPREAD_DEFINITION_RELATIONSHIP,

  // Decision
  decision: SPREAD_DEFINITION_DECISION,
  decisiontwopath: SPREAD_DEFINITION_DECISION,
  twopath: SPREAD_DEFINITION_DECISION
});

function getSpreadDefinitionByIdentifier(identifier) {
  if (typeof identifier !== 'string' || !identifier.trim()) {
    return null;
  }
  const byName = SPREAD_NAME_MAP[identifier];
  if (byName) {
    return byName;
  }
  const normalized = normalizeSpreadIdentifier(identifier);
  if (!normalized) {
    return null;
  }
  return SPREAD_ALIAS_MAP[normalized] || null;
}

/**
 * Get spread definition by display name.
 *
 * @param {string} spreadName - Display name of the spread
 * @returns {Object|null} Spread definition with key and count
 */
export function getSpreadDefinition(spreadName) {
  return getSpreadDefinitionByIdentifier(spreadName);
}

/**
 * Get canonical spread key from display name.
 *
 * @param {string} spreadName - Display name of the spread
 * @param {string|null} fallbackKey - Fallback key if spread not found
 * @returns {string} Canonical spread key
 */
export function getSpreadKey(spreadName, fallbackKey = null) {
  const def = getSpreadDefinitionByIdentifier(spreadName);
  if (def?.key) return def.key;
  const fallbackDef = getSpreadDefinitionByIdentifier(fallbackKey);
  if (fallbackDef?.key) return fallbackDef.key;
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
 * @returns {Object} { minCoverage, maxHallucinations, highWeightThreshold, minSpineCompletion }
 */
export function getQualityGateThresholds(spreadKey, cardCount) {
  const normalizedSpread = (spreadKey || 'general').toLowerCase();

  if (normalizedSpread === 'celtic') {
    return {
      minCoverage: 0.75,
      maxHallucinations: 2,
      highWeightThreshold: HIGH_WEIGHT_POSITION_THRESHOLD,
      minSpineCompletion: 0.6
    };
  }

  if (['relationship', 'decision', 'threecard', 'fivecard', 'single'].includes(normalizedSpread)) {
    return {
      minCoverage: 0.8,
      maxHallucinations: 1,
      highWeightThreshold: HIGH_WEIGHT_POSITION_THRESHOLD,
      minSpineCompletion: 0.75
    };
  }

  // Default: scale slightly by size; larger spreads allow a tiny bit more slack.
  const isLargeSpread = cardCount >= 8;
  return {
    minCoverage: isLargeSpread ? 0.75 : 0.8,
    maxHallucinations: isLargeSpread ? 2 : 1,
    highWeightThreshold: HIGH_WEIGHT_POSITION_THRESHOLD,
    minSpineCompletion: isLargeSpread ? 0.65 : 0.7
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
  const candidates = extractCardCandidates(text);

  const missingCards = cardsInfo
    .filter((card) => card && (typeof card.canonicalName === 'string' || typeof card.card === 'string'))
    .map((cardInfo) => cardInfo.canonicalName || cardInfo.card)
    .filter((name) => {
      if (!name) return true;

      // Look up full card object to build all valid aliases
      const fullCard = lookupCardByName(name);
      const aliasesToCheck = fullCard
        ? buildCardAliases(fullCard, deckStyle)
        : [name];

      // Card is present if ANY valid name/alias appears in the text
      const hasExactMatch = aliasesToCheck.some((alias) => {
        if (!alias) return false;
        const pattern = new RegExp(`\\b${escapeRegex(alias)}\\b`, 'i');
        return pattern.test(text);
      });

      if (hasExactMatch) return false;

      if (candidates.length > 0) {
        const aliasEntries = buildFuzzyAliasEntriesForAliases(aliasesToCheck);
        if (hasFuzzyAliasMatch(candidates, aliasEntries)) {
          return false;
        }
      }

      return true;
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
      .filter((card) => card && (typeof card.canonicalName === 'string' || typeof card.card === 'string'))
      .map((card) => {
        const sourceName = card.canonicalName || card.card;
        const canonical = canonicalCardKey(sourceName, deckStyle);
        return canonical || normalizeCardName(sourceName);
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

  const candidates = extractCardCandidates(text);
  if (candidates.length > 0) {
    const aliasEntries = buildFuzzyAliasEntries(deckStyle);
    candidates.forEach((candidate) => {
      const match = findBestFuzzyAliasMatch(candidate, aliasEntries);
      if (!match) return;

      const canonicalKey = match.canonical.toLowerCase();
      if (drawnKeys.has(canonicalKey)) return;
      if (seenCanonicals.has(canonicalKey)) return;

      seenCanonicals.add(canonicalKey);
      hallucinated.push(match.canonical);
    });
  }

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
  const metricsText = stripReflectionSections(text);
  const safeCards = Array.isArray(cardsInfo) ? cardsInfo : [];
  const spine = validateReadingNarrative(metricsText);
  const coverage = analyzeCardCoverage(metricsText, safeCards, deckStyle);
  const hallucinatedCards = detectHallucinatedCards(metricsText, safeCards, deckStyle);

  return {
    spine: {
      isValid: spine.isValid,
      totalSections: spine.totalSections || 0,
      completeSections: spine.completeSections || 0,
      incompleteSections: spine.incompleteSections || 0,
      cardSections: spine.cardSections || 0,
      cardComplete: spine.cardComplete || 0,
      cardIncomplete: spine.cardIncomplete || 0,
      structuralSections: spine.structuralSections || 0,
      suggestions: spine.suggestions || []
    },
    cardCount: safeCards.length,
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
        visualProfile: entry.visualProfile || null,
        orientation: typeof entry.orientation === 'string' ? entry.orientation : null,
        reasoning: typeof entry.reasoning === 'string' ? entry.reasoning : null,
        visualDetails: Array.isArray(entry.visualDetails) ? entry.visualDetails : null,
        mergeSource: typeof entry.mergeSource === 'string' ? entry.mergeSource : null,
        componentScores: entry.componentScores && typeof entry.componentScores === 'object'
          ? entry.componentScores
          : null
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
 * Handles both v1 and v2 schema payloads.
 *
 * @param {Object} env - Cloudflare environment bindings
 * @param {Object} payload - Metrics payload to persist
 */
export async function persistReadingMetrics(env, payload) {
  if (!env?.DB?.prepare) {
    return;
  }

  try {
    const storageMode = env?.METRICS_STORAGE_MODE;
    const sanitizedPayload = sanitizeMetricsPayload(payload, storageMode);

    // Extract card coverage handling both v1 and v2 schemas
    let cardCoverage, hallucinatedCards;
    if (isSchemaV2(payload)) {
      // v2: use helper functions
      const coverage = getNarrativeCoverage(payload);
      cardCoverage = coverage?.percentage ?? null;
      hallucinatedCards = coverage?.hallucinatedCards ?? null;
    } else {
      // v1: legacy paths
      cardCoverage = payload.narrativeOriginal?.cardCoverage ?? payload.narrative?.cardCoverage ?? null;
      hallucinatedCards = payload.narrativeOriginal?.hallucinatedCards ?? payload.narrative?.hallucinatedCards ?? null;
    }

    const hallucinationCount = Array.isArray(hallucinatedCards) ? hallucinatedCards.length : null;

    // Extract prompt version handling both schemas
    const promptVersion = getPromptVersion(payload);

    // Extract variant ID handling both schemas
    const variantId = isSchemaV2(payload)
      ? payload.experiment?.variantId
      : payload.variantId;

    await env.DB.prepare(`
      INSERT INTO eval_metrics (
        request_id, spread_key, deck_style, provider,
        card_coverage, hallucinated_cards, hallucination_count,
        reading_prompt_version, variant_id, payload
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(request_id) DO UPDATE SET
        updated_at = datetime('now'),
        spread_key = excluded.spread_key,
        deck_style = excluded.deck_style,
        provider = excluded.provider,
        card_coverage = excluded.card_coverage,
        hallucinated_cards = excluded.hallucinated_cards,
        hallucination_count = excluded.hallucination_count,
        reading_prompt_version = excluded.reading_prompt_version,
        variant_id = excluded.variant_id,
        payload = excluded.payload
    `).bind(
      payload.requestId,
      payload.spreadKey || null,
      payload.deckStyle || null,
      payload.provider || null,
      cardCoverage,
      hallucinatedCards ? JSON.stringify(hallucinatedCards) : null,
      hallucinationCount,
      promptVersion,
      variantId || null,
      JSON.stringify(sanitizedPayload)
    ).run();
  } catch (err) {
    console.warn(`[${payload.requestId}] Failed to persist reading metrics: ${err.message}`);
  }
}
