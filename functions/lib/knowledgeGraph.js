// functions/lib/knowledgeGraph.js
// Pattern detection logic for archetypal multi-card combinations
// Version 1.0.0

import {
  FOOLS_JOURNEY,
  ARCHETYPAL_TRIADS,
  ARCHETYPAL_DYADS,
  SUIT_PROGRESSIONS,
  THOTH_MINOR_TITLES,
  MARSEILLE_NUMERICAL_THEMES,
  COURT_FAMILY_PATTERNS,
  DECK_STYLE_OVERRIDES
} from '../../src/data/knowledgeGraphData.js';
import { getDeckAlias } from '../../shared/vision/deckAssets.js';
import { canonicalizeCardName } from '../../shared/vision/cardNameMapping.js';
import { parseMinorName } from './minorMeta.js';

const COURT_RANK_LABELS = new Set([
  'Page',
  'Knight',
  'Queen',
  'King',
  'Princess',
  'Prince',
  'Valet',
  'Chevalier',
  'Reine',
  'Roi'
]);

const SUIT_ALIASES = {
  wands: 'Wands',
  wand: 'Wands',
  batons: 'Wands',
  baton: 'Wands',
  staves: 'Wands',
  staffs: 'Wands',
  clubs: 'Wands',
  cups: 'Cups',
  cup: 'Cups',
  coupes: 'Cups',
  chalices: 'Cups',
  swords: 'Swords',
  sword: 'Swords',
  epees: 'Swords',
  epee: 'Swords',
  blades: 'Swords',
  pentacles: 'Pentacles',
  pentacle: 'Pentacles',
  coins: 'Pentacles',
  coin: 'Pentacles',
  deniers: 'Pentacles',
  denier: 'Pentacles',
  disks: 'Pentacles',
  discs: 'Pentacles',
  disques: 'Pentacles'
};

function normalizeSuitToken(value) {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z]/gi, '')
    .toLowerCase();
}

function normalizeSuitName(value) {
  if (typeof value !== 'string') return null;
  if (['Wands', 'Cups', 'Swords', 'Pentacles'].includes(value)) {
    return value;
  }
  return SUIT_ALIASES[normalizeSuitToken(value)] || null;
}

function getDeckMeta(deckStyle = 'rws-1909') {
  return DECK_STYLE_OVERRIDES[deckStyle] || null;
}

function getCardLabel(card) {
  return card?.card || card?.name || card?.title || 'Unknown card';
}

function deckAwareSuitLabel(suit, deckStyle = 'rws-1909') {
  const meta = getDeckMeta(deckStyle);
  if (meta?.suitAliases?.[suit]) {
    return meta.suitAliases[suit];
  }
  return suit;
}

function deckAwareName(card, fallback, deckStyle = 'rws-1909') {
  const baseLabel = fallback || getCardLabel(card);
  const meta = getDeckMeta(deckStyle);

  if (meta) {
    if (typeof card?.number === 'number' && meta.majorAliases?.[card.number]) {
      const alias = meta.majorAliases[card.number];
      if (!alias) {
        return baseLabel;
      }
      if (deckStyle === 'rws-1909' || alias === baseLabel) {
        return alias;
      }
      return `${alias} (RWS: ${baseLabel})`;
    }

    if (card?.suit) {
      const suitAlias = meta.suitAliases?.[card.suit];
      const rankAlias = card.rank && meta.courtAliases?.[card.rank]
        ? meta.courtAliases[card.rank]
        : card.rank;

      if (card.rank && (suitAlias || rankAlias !== card.rank)) {
        const aliased = `${rankAlias} of ${suitAlias || card.suit}`;
        if (deckStyle === 'rws-1909' || aliased === baseLabel) {
          return aliased;
        }
        return `${aliased} (RWS: ${baseLabel})`;
      }

      if (!card.rank && suitAlias && typeof baseLabel === 'string') {
        const updated = baseLabel.replace(card.suit, suitAlias);
        if (updated !== baseLabel) {
          return deckStyle === 'rws-1909' ? updated : `${updated} (RWS: ${baseLabel})`;
        }
      }
    }
  }

  if (!deckStyle || deckStyle === 'rws-1909') {
    return baseLabel;
  }

  const alias = getDeckAlias(card, deckStyle);
  if (!alias || alias === baseLabel) {
    return baseLabel;
  }
  return baseLabel ? `${alias} (RWS: ${baseLabel})` : alias;
}

function deckAwareCourtRank(card, deckStyle = 'rws-1909') {
  const rank = (card?.rank || '').trim();
  if (!rank) return 'Court';
  const meta = getDeckMeta(deckStyle);
  if (!meta?.courtAliases) return rank;
  if (meta.courtAliases[rank]) {
    return meta.courtAliases[rank];
  }
  const alreadyAlias = Object.values(meta.courtAliases).includes(rank);
  return alreadyAlias ? rank : meta.courtAliases[rank] || rank;
}

function resolveSuit(card) {
  const normalizedSuit = normalizeSuitName(card?.suit);
  if (normalizedSuit) return normalizedSuit;
  const parsed = parseMinorName(card?.card || card?.name || '');
  if (parsed?.suit) return parsed.suit;

  const rawName = String(card?.card || card?.name || '');
  const normalizedName = normalizeSuitToken(rawName);
  for (const [token, suit] of Object.entries(SUIT_ALIASES)) {
    if (normalizedName.includes(token)) {
      return suit;
    }
  }

  return null;
}

function isCourtCard(card) {
  if (!card) return false;
  if (typeof card.rankValue === 'number' && card.rankValue >= 11 && card.rankValue <= 14) {
    return true;
  }
  const rank = (card.rank || '').trim();
  if (rank && COURT_RANK_LABELS.has(rank)) {
    return true;
  }
  const parsed = parseMinorName(card.card || card.name || '');
  return parsed ? COURT_RANK_LABELS.has(parsed.rank) : false;
}

/**
 * Detect which stage of the Fool's Journey dominates this spread
 *
 * Analyzes Major Arcana cards (0-21) and determines which of the three
 * journey stages (initiation/integration/culmination) is most represented.
 *
 * @param {Array<Object>} cards - Array of card objects with number property
 * @returns {Object|null} Dominant journey stage with metadata, or null if <2 Majors
 * @example
 * const cards = [
 *   { number: 0, name: 'The Fool' },
 *   { number: 1, name: 'The Magician' },
 *   { number: 7, name: 'The Chariot' }
 * ];
 * const stage = detectFoolsJourneyStage(cards);
 * // Returns: { stage: 'initiation', cardCount: 3, theme: '...', ... }
 */
export function detectFoolsJourneyStage(cards, options = {}) {
  const deckStyle = options.deckStyle || 'rws-1909';
  // Filter to Major Arcana only
  const majorCards = cards.filter(
    (c) => typeof c.number === 'number' && c.number >= 0 && c.number <= 21
  );

  // Need at least 1 Major to provide any archetypal context
  if (majorCards.length < 1) return null;

  const stages = { initiation: [], integration: [], culmination: [] };

  // Categorize each Major card into its journey stage
  majorCards.forEach((card) => {
    if (card.number <= 7) {
      stages.initiation.push(card);
    } else if (card.number <= 14) {
      stages.integration.push(card);
    } else {
      stages.culmination.push(card);
    }
  });

  // Find the dominant stage (most cards) and reject ties to avoid false certainty.
  const stageEntries = Object.entries(stages).sort((a, b) => b[1].length - a[1].length);
  const dominant = stageEntries[0];
  const stageKey = dominant[0];
  const stageCards = dominant[1];
  const dominantCount = stageCards.length;

  if (dominantCount === 0) return null;

  const tiedDominantStages = stageEntries.filter(([, list]) => list.length === dominantCount);
  if (tiedDominantStages.length > 1) {
    return null;
  }

  // Determine significance level:
  // - 'strong': 3+ cards in one stage (clear thematic cluster)
  // - 'moderate': 2 cards in one stage (notable pattern)
  // - 'minimal': 1 card (basic archetypal presence, useful for enrichment)
  let significance = 'minimal';
  if (stageCards.length >= 3) {
    significance = 'strong';
  } else if (stageCards.length >= 2 || majorCards.length >= 2) {
    significance = 'moderate';
  }

  // Return enriched stage data
  // IMPORTANT: Spread FOOLS_JOURNEY data FIRST, then override with actual spread data
  return {
    stageKey,
    ...FOOLS_JOURNEY[stageKey],
    // Override with actual detected data from this spread:
    cardCount: stageCards.length,
    cards: stageCards, // Actual cards from spread (not static reference)
    totalMajors: majorCards.length,
    significance,
    displayNames: stageCards.map((card) => deckAwareName(card, getCardLabel(card), deckStyle))
  };
}

/**
 * Detect archetypal triads (complete and partial)
 *
 * Scans for complete 3-card triads and partial 2-card combinations.
 * Complete triads receive highest priority; partials are supporting.
 *
 * @param {Array<Object>} cards - Array of card objects with number property
 * @returns {Array<Object>} Detected triads sorted by completeness
 * @example
 * const cards = [
 *   { number: 13, name: 'Death' },
 *   { number: 14, name: 'Temperance' },
 *   { number: 17, name: 'The Star' }
 * ];
 * const triads = detectArchetypalTriads(cards);
 * // Returns: [{ id: 'death-temperance-star', isComplete: true, ... }]
 */
export function detectArchetypalTriads(cards, options = {}) {
  const deckStyle = options.deckStyle || 'rws-1909';
  // Extract Major Arcana numbers
  const numbers = cards
    .filter((c) => typeof c.number === 'number' && c.number >= 0 && c.number <= 21)
    .map((c) => c.number);

  if (numbers.length < 2) return [];

  const detected = [];

  ARCHETYPAL_TRIADS.forEach((triad) => {
    // Find which cards from this triad are present
    const matches = triad.cards.filter((num) => numbers.includes(num));

    if (matches.length >= 2) {
      const completeness = matches.length / triad.cards.length;
      const isComplete = matches.length === 3;

      // Generate narrative based on which cards are present
      let narrative = triad.description;
      if (!isComplete) {
        // Build partial narrative key
        const pairKey = matches
          .map((n) => {
            const index = triad.cards.indexOf(n);
            return triad.names[index].toLowerCase().replace(/^the /, '');
          })
          .sort()
          .join('-');

        narrative = triad.partialNarrative[pairKey] || triad.description;
      }

      detected.push({
        id: triad.id,
        theme: triad.theme,
        matchedCards: matches,
        matchedNames: matches.map((n) => {
          const index = triad.cards.indexOf(n);
          const fallbackName = triad.names[index];
          const card = cards.find((c) => c.number === n);
          return deckAwareName(card, fallbackName, deckStyle);
        }),
        completeness: Math.round(completeness * 100),
        isComplete,
        narrative: isComplete ? triad.narrative : narrative,
        fullDescription: triad.description,
        contexts: triad.contexts,
        significance: isComplete ? 'complete-triad' : 'partial-triad',
        strength: isComplete ? 'major' : 'supporting'
      });
    }
  });

  // Sort by completeness (complete triads first)
  return detected.sort((a, b) => {
    if (a.isComplete !== b.isComplete) return a.isComplete ? -1 : 1;
    return b.matchedCards.length - a.matchedCards.length;
  });
}

/**
 * Detect archetypal dyads (two-card combinations)
 *
 * Scans for powerful two-card synergies. Categorized by significance
 * (high/medium-high/medium) for priority ranking.
 *
 * @param {Array<Object>} cards - Array of card objects with number property
 * @returns {Array<Object>} Detected dyads sorted by significance
 * @example
 * const cards = [
 *   { number: 13, name: 'Death' },
 *   { number: 17, name: 'The Star' }
 * ];
 * const dyads = detectArchetypalDyads(cards);
 * // Returns: [{ cards: [13, 17], theme: 'Transformation clearing into hope', ... }]
 */
export function detectArchetypalDyads(cards, options = {}) {
  const deckStyle = options.deckStyle || 'rws-1909';
  // Extract Major Arcana numbers
  const numbers = cards
    .filter((c) => typeof c.number === 'number' && c.number >= 0 && c.number <= 21)
    .map((c) => c.number);

  if (numbers.length < 2) return [];

  const detected = [];

  ARCHETYPAL_DYADS.forEach((dyad) => {
    // Check if both cards of this dyad are present
    if (dyad.cards.every((num) => numbers.includes(num))) {
      const names = dyad.cards.map((num, index) => {
        const fallback = dyad.names[index];
        const card = cards.find((c) => c.number === num);
        return deckAwareName(card, fallback, deckStyle);
      });

      detected.push({
        cards: dyad.cards,
        names,
        theme: dyad.theme,
        category: dyad.category,
        description: dyad.description,
        narrative: dyad.narrative,
        significance: dyad.significance
      });
    }
  });

  // Sort by significance (high > medium-high > medium)
  const significanceOrder = { high: 3, 'medium-high': 2, medium: 1 };
  return detected.sort(
    (a, b) =>
      (significanceOrder[b.significance] || 0) -
      (significanceOrder[a.significance] || 0)
  );
}

/**
 * Detect Minor Arcana suit progressions (three-stage arcs within each suit)
 *
 * @param {Array<Object>} cards - Spread cards containing suit and rank metadata
 * @returns {Array<Object>} Detected suit progressions with dominance + significance
 */
export function detectSuitProgressions(cards, options = {}) {
  const deckStyle = options.deckStyle || 'rws-1909';
  if (!Array.isArray(cards) || cards.length < 2) return [];

  const minorCards = cards
    .map((card) => {
      if (!card) return null;
      const suit = resolveSuit(card);
      const rankValue = normalizeRankValue(card);
      if (!suit || typeof rankValue !== 'number' || rankValue < 1 || rankValue > 10) {
        return null;
      }
      return {
        ...card,
        suit,
        rankValue
      };
    })
    .filter(Boolean);

  if (minorCards.length < 2) return [];

  const groupedBySuit = minorCards.reduce((acc, card) => {
    if (!acc[card.suit]) acc[card.suit] = [];
    acc[card.suit].push(card);
    return acc;
  }, {});

  const detected = [];

  Object.entries(groupedBySuit).forEach(([suit, suitCards]) => {
    if (!Array.isArray(suitCards) || suitCards.length < 2) return;
    const progression = SUIT_PROGRESSIONS[suit];
    if (!progression) return;

    const stageBuckets = {
      beginning: [],
      challenge: [],
      mastery: []
    };

    suitCards.forEach((card) => {
      if (progression.beginning.ranks.includes(card.rankValue)) {
        stageBuckets.beginning.push(card);
      } else if (progression.challenge.ranks.includes(card.rankValue)) {
        stageBuckets.challenge.push(card);
      } else if (progression.mastery.ranks.includes(card.rankValue)) {
        stageBuckets.mastery.push(card);
      }
    });

    const dominantStageEntry = Object.entries(stageBuckets)
      .sort((a, b) => b[1].length - a[1].length)
      .find(([, stageCards]) => stageCards.length >= 2);

    if (!dominantStageEntry) return;

    const [stageKey, stageCards] = dominantStageEntry;
    const stageData = progression[stageKey];
    if (!stageData) return;

    detected.push({
      suit,
      displaySuit: deckAwareSuitLabel(suit, deckStyle),
      element: progression.element,
      domain: progression.domain,
      stage: stageKey,
      theme: stageData.theme,
      narrative: stageData.narrative,
      readingSignificance: stageData.readingSignificance,
      cardCount: suitCards.length,
      stageCardCount: stageCards.length,
      cards: suitCards,
      stageCards,
      ranks: suitCards.map((c) => c.rankValue).sort((a, b) => a - b),
      stageRanks: stageCards.map((c) => c.rankValue).sort((a, b) => a - b),
      distribution: {
        beginning: stageBuckets.beginning.length,
        challenge: stageBuckets.challenge.length,
        mastery: stageBuckets.mastery.length
      },
      significance: stageCards.length >= 3 ? 'strong-progression' : 'emerging-progression'
    });
  });

  return detected;
}

function detectCourtLineages(cards, options = {}) {
  if (!Array.isArray(cards) || cards.length < 2) {
    return [];
  }

  const deckStyle = options.deckStyle || 'rws-1909';
  const courtCards = cards.filter((card) => isCourtCard(card));
  if (courtCards.length < 2) {
    return [];
  }

  const suitBuckets = new Map();
  courtCards.forEach((card) => {
    const suit = resolveSuit(card);
    if (!suit) return;
    if (!suitBuckets.has(suit)) {
      suitBuckets.set(suit, []);
    }
    suitBuckets.get(suit).push(card);
  });

  const patterns = [];
  suitBuckets.forEach((list, suit) => {
    if (!Array.isArray(list) || list.length < 2) {
      return;
    }
    const lineage = COURT_FAMILY_PATTERNS[suit] || {};
    const significance = list.length >= 3 ? 'council' : 'alliance';
    const stageNarrative = significance === 'council' ? lineage.trioNarrative : lineage.duoNarrative;
    const deckNote = lineage.deckNotes?.[deckStyle] || getDeckMeta(deckStyle)?.courtNotes || '';
    const narrative = [stageNarrative, deckNote].filter(Boolean).join(' ').trim();
    const sorted = list
      .slice()
      .sort((a, b) => (a.rankValue ?? Number.MAX_SAFE_INTEGER) - (b.rankValue ?? Number.MAX_SAFE_INTEGER));
    patterns.push({
      suit,
      displaySuit: deckAwareSuitLabel(suit, deckStyle),
      theme: lineage.theme || `${suit} court lineage`,
      element: lineage.element || null,
      significance,
      count: list.length,
      cards: sorted,
      ranks: sorted.map((card) => deckAwareCourtRank(card, deckStyle)),
      narrative: narrative || `Multiple ${deckAwareSuitLabel(suit, deckStyle)} court cards are collaborating.`
    });
  });

  return patterns.sort((a, b) => b.count - a.count);
}

function detectThothEpithets(cards, options = {}) {
  const deckStyle = options.deckStyle || 'rws-1909';
  if (deckStyle !== 'thoth-a1' || !Array.isArray(cards)) {
    return null;
  }

  const entries = [];
  const suitMap = new Map();

  cards.forEach((card) => {
    const rawLabel = (card?.card || card?.name || '').trim();
    if (!rawLabel) return;
    const canonicalLabel = canonicalizeCardName(rawLabel, deckStyle) || rawLabel;
    const info = THOTH_MINOR_TITLES[canonicalLabel] || THOTH_MINOR_TITLES[rawLabel];
    if (!info) return;

    const entry = {
      card: deckAwareName(card, canonicalLabel, deckStyle),
      title: info.title,
      suit: info.suit || card.suit || 'Minor',
      rank: info.rank || card.rankValue || null,
      astrology: info.astrology || null,
      description: info.description || ''
    };
    entries.push(entry);

    const suitKey = entry.suit;
    if (!suitMap.has(suitKey)) {
      suitMap.set(suitKey, []);
    }
    suitMap.get(suitKey).push({
      entry,
      originalCard: card
    });
  });

  if (entries.length === 0) {
    return null;
  }

  const suitHighlights = [];
  suitMap.forEach((list, suit) => {
    if (list.length < 2) return;
    suitHighlights.push({
      suit,
      titles: list.map((item) => item.entry.title),
      description: buildThothSuitNarrative(suit, list.map((item) => item.entry)),
      cards: list.map((item) => item.originalCard)
    });
  });

  return {
    entries,
    suitHighlights
  };
}

function buildThothSuitNarrative(suit, entries) {
  const snippets = entries
    .map((entry) => `${entry.title}${entry.astrology ? ` (${entry.astrology})` : ''}`)
    .join(' → ');
  const color = entries
    .map((entry) => entry.description)
    .filter(Boolean)
    .slice(0, 2)
    .join(' | ');
  return `${suit} current flows through ${snippets}, pointing to ${color || 'a defined energetic storyline'}.`;
}

function detectMarseillePipPatterns(cards, options = {}) {
  const deckStyle = options.deckStyle || 'rws-1909';
  if (deckStyle !== 'marseille-classic' || !Array.isArray(cards)) {
    return null;
  }

  const rankBuckets = new Map();
  cards.forEach((card) => {
    const rankValue = normalizeRankValue(card);
    if (!rankValue || !MARSEILLE_NUMERICAL_THEMES[rankValue]) return;
    if (!rankBuckets.has(rankValue)) {
      rankBuckets.set(rankValue, []);
    }
    rankBuckets.get(rankValue).push(card);
  });

  const numerologyClusters = [];
  rankBuckets.forEach((list, rank) => {
    if (list.length < 2) return;
    const theme = MARSEILLE_NUMERICAL_THEMES[rank];
    numerologyClusters.push({
      rankValue: rank,
      keyword: theme.keyword,
      description: theme.description,
      geometry: theme.geometry,
      cards: list
    });
  });

  if (!numerologyClusters.length) {
    return null;
  }

  return { numerologyClusters };
}

function normalizeRankValue(card) {
  if (typeof card?.rankValue === 'number') {
    return card.rankValue;
  }
  const parsed = parseMinorName(card?.card || card?.name || '');
  if (!parsed) return null;
  const pipValues = {
    Ace: 1,
    Two: 2,
    Three: 3,
    Four: 4,
    Five: 5,
    Six: 6,
    Seven: 7,
    Eight: 8,
    Nine: 9,
    Ten: 10
  };
  return pipValues[parsed.rank] || null;
}

/**
 * Master function: Detect all archetypal patterns
 *
 * Runs all detection functions and returns comprehensive pattern analysis.
 * Gracefully handles errors in individual detectors.
 *
 * @param {Array<Object>} cards - Array of card objects
 * @returns {Object|null} All detected patterns, or null if none found
 * @example
 * const patterns = detectAllPatterns(cardsInfo);
 * // Returns: { foolsJourney, triads, dyads }
 */
export function detectAllPatterns(cards, options = {}) {
  if (!cards || !Array.isArray(cards) || cards.length === 0) {
    return null;
  }

  const patterns = {};
  let hasAnyPattern = false;

  // Detect Fool's Journey stage
  try {
    const journey = detectFoolsJourneyStage(cards, options);
    if (journey) {
      patterns.foolsJourney = journey;
      hasAnyPattern = true;
    }
  } catch (err) {
    console.error('Fool\'s Journey detection failed:', err);
  }

  // Detect triads
  try {
    const triads = detectArchetypalTriads(cards, options);
    if (triads.length > 0) {
      patterns.triads = triads;
      hasAnyPattern = true;
    }
  } catch (err) {
    console.error('Triad detection failed:', err);
  }

  // Detect dyads
  try {
    const dyads = detectArchetypalDyads(cards, options);
    if (dyads.length > 0) {
      patterns.dyads = dyads;
      hasAnyPattern = true;
    }
  } catch (err) {
    console.error('Dyad detection failed:', err);
  }

  // Detect suit progressions
  try {
    const suitProgressions = detectSuitProgressions(cards, options);
    if (suitProgressions.length > 0) {
      patterns.suitProgressions = suitProgressions;
      hasAnyPattern = true;
    }
  } catch (err) {
    console.error('Suit progression detection failed:', err);
  }

  // Detect court lineages
  try {
    const courtLineages = detectCourtLineages(cards, options);
    if (courtLineages.length > 0) {
      patterns.courtLineages = courtLineages;
      hasAnyPattern = true;
    }
  } catch (err) {
    console.error('Court lineage detection failed:', err);
  }

  // Deck-specific Thoth epithets
  try {
    const thoth = detectThothEpithets(cards, options);
    if (thoth) {
      patterns.thothEpithets = thoth;
      hasAnyPattern = true;
    }
  } catch (err) {
    console.error('Thoth epithet detection failed:', err);
  }

  // Deck-specific Marseille numerology
  try {
    const marseille = detectMarseillePipPatterns(cards, options);
    if (marseille) {
      patterns.marseillePip = marseille;
      hasAnyPattern = true;
    }
  } catch (err) {
    console.error('Marseille pip detection failed:', err);
  }

  return hasAnyPattern ? patterns : null;
}

/**
 * Get priority pattern narratives for reading synthesis
 *
 * Selects top 3-5 most significant patterns and formats them for inclusion
 * in reading narratives. Enforces priority hierarchy:
 * 1. Complete triads (major)
 * 2. Strong Fool's Journey (3+ cards)
 * 3. High-significance dyads
 * 4. Partial triads (supporting)
 * 5. Medium dyads
 *
 * @param {Object} patterns - Output from detectAllPatterns()
 * @returns {Array<Object>} Priority-ranked narrative highlights (max 5)
 * @example
 * const highlights = getPriorityPatternNarratives(patterns);
 * // Returns: [{ priority: 1, type: 'complete-triad', text: '...', cards: [...] }, ...]
 */
export function getPriorityPatternNarratives(patterns, deckStyle = 'rws-1909') {
  if (!patterns) return [];

  const narratives = [];
  const stageDisplay = {
    beginning: 'Beginning',
    challenge: 'Challenge',
    mastery: 'Mastery'
  };

  // Priority 1: Complete triads
  if (patterns.triads) {
    patterns.triads
      .filter((t) => t.isComplete)
      .forEach((triad) => {
        narratives.push({
          priority: 1,
          type: 'complete-triad',
          text: `**${triad.theme}** ${triad.matchedNames.join(', ')} form a complete narrative arc—${triad.narrative}`,
          cards: triad.matchedCards,
          id: triad.id
        });
      });
  }

  // Priority 2: Strong Fool's Journey (3+ cards in one stage)
  if (patterns.foolsJourney && patterns.foolsJourney.significance === 'strong') {
    const journey = patterns.foolsJourney;
    const journeyNames = Array.isArray(journey.displayNames) && journey.displayNames.length > 0
      ? ` (${journey.displayNames.join(', ')})`
      : '';
    narratives.push({
      priority: 2,
      type: 'fools-journey',
      text: `**Fool's Journey — ${journey.stage.charAt(0).toUpperCase() + journey.stage.slice(1)}** ${journey.cardCount} cards from this stage${journeyNames} suggest ${journey.readingSignificance.toLowerCase()}.`,
      cards: journey.cards.map((c) => c.number),
      stage: journey.stage
    });
  }

  // Priority 4: Moderate Fool's Journey (2 cards in stage or 2+ total Majors)
  if (patterns.foolsJourney && patterns.foolsJourney.significance === 'moderate') {
    const journey = patterns.foolsJourney;
    const journeyNames = Array.isArray(journey.displayNames) && journey.displayNames.length > 0
      ? ` (${journey.displayNames.join(', ')})`
      : '';
    narratives.push({
      priority: 4,
      type: 'fools-journey',
      text: `**Fool's Journey — ${journey.stage.charAt(0).toUpperCase() + journey.stage.slice(1)}** ${journey.cardCount} card${journey.cardCount > 1 ? 's' : ''} from this stage${journeyNames} suggest ${journey.readingSignificance.toLowerCase()}.`,
      cards: journey.cards.map((c) => c.number),
      stage: journey.stage
    });
  }

  // Priority 6: Minimal Fool's Journey (single Major provides basic archetypal context)
  if (patterns.foolsJourney && patterns.foolsJourney.significance === 'minimal') {
    const journey = patterns.foolsJourney;
    const journeyNames = Array.isArray(journey.displayNames) && journey.displayNames.length > 0
      ? journey.displayNames.join(', ')
      : '';
    narratives.push({
      priority: 6,
      type: 'fools-journey-minimal',
      text: `**${journeyNames}** appears in the ${journey.stage} stage of the Fool's Journey, touching on themes of ${journey.theme.toLowerCase()}.`,
      cards: journey.cards.map((c) => c.number),
      stage: journey.stage
    });
  }

  // Priority 3: Strong suit progressions (3+ cards in a stage)
  if (patterns.suitProgressions) {
    patterns.suitProgressions
      .filter((p) => p.significance === 'strong-progression')
      .sort((a, b) => b.stageCardCount - a.stageCardCount)
      .slice(0, 2)
      .forEach((prog) => {
        const suitLabel = prog.displaySuit || prog.suit;
        const label = `${suitLabel} ${stageDisplay[prog.stage] || prog.stage}`;
        const cardList = prog.stageCards
          .map((c) => deckAwareName(c, getCardLabel(c), deckStyle))
          .join(', ');
        const themeDescriptor = typeof prog.theme === 'string'
          ? prog.theme.toLowerCase()
          : 'this stage';
        const significanceText = prog.readingSignificance ? `${prog.readingSignificance} ` : '';
        const stageNarrative = prog.narrative || '';
        narratives.push({
          priority: 3,
          type: 'suit-progression',
          text: `**${label}** ${cardList} highlight the ${themeDescriptor} arc of this suit. ${significanceText}${stageNarrative}`.trim(),
          cards: prog.stageCards.map((card) => card.number ?? card.rankValue ?? null),
          suit: prog.suit,
          stage: prog.stage
        });
      });
  }

  // Court lineages (deck-aware court clusters)
  if (patterns.courtLineages) {
    patterns.courtLineages
      .slice(0, 2)
      .forEach((lineage) => {
        const cardList = lineage.cards
          .map((card) => deckAwareName(card, getCardLabel(card), deckStyle))
          .join(', ');
        const heading = lineage.significance === 'council' ? 'court council' : 'court alliance';
        const summary = lineage.narrative || lineage.theme;
        narratives.push({
          priority: lineage.significance === 'council' ? 3 : 4,
          type: 'court-lineage',
          text: `**${lineage.displaySuit} ${heading}** ${cardList} — ${summary}`.trim(),
          cards: lineage.cards.map((card) => card.number ?? card.rankValue ?? null),
          suit: lineage.suit
        });
      });
  }

  // Deck-specific: Thoth suit clusters or epithets
  if (patterns.thothEpithets?.suitHighlights?.length) {
    patterns.thothEpithets.suitHighlights
      .slice(0, 2)
      .forEach((highlight) => {
        const cardList = highlight.cards
          .map((card) => deckAwareName(card, getCardLabel(card), deckStyle))
          .join(', ');
        narratives.push({
          priority: 3,
          type: 'thoth-suit',
          text: `**Thoth ${highlight.suit} Titles** ${highlight.description} Cards: ${cardList}.`,
          cards: highlight.cards.map((card) => card.number ?? card.rankValue ?? null)
        });
      });
  } else if (patterns.thothEpithets?.entries?.length) {
    patterns.thothEpithets.entries
      .slice(0, 2)
      .forEach((entry) => {
        narratives.push({
          priority: 4,
          type: 'thoth-epithet',
          text: `**${entry.card} → ${entry.title}** ${entry.description}${entry.astrology ? ` (${entry.astrology})` : ''}.`,
          cards: [entry.rank]
        });
      });
  }

  // Priority 3: High-significance dyads
  if (patterns.dyads) {
    patterns.dyads
      .filter((d) => d.significance === 'high')
      .slice(0, 2) // Max 2 high dyads
      .forEach((dyad) => {
        narratives.push({
          priority: 4,
          type: 'high-dyad',
          text: `**${dyad.names.join(' + ')}** ${dyad.narrative}`,
          cards: dyad.cards,
          category: dyad.category
        });
      });
  }

  // Priority 4: Partial triads (if we have space)
  if (narratives.length < 4 && patterns.triads) {
    patterns.triads
      .filter((t) => !t.isComplete)
      .slice(0, 1) // Max 1 partial
      .forEach((triad) => {
        narratives.push({
          priority: 5,
          type: 'partial-triad',
          text: `**${triad.theme} (partial)** ${triad.matchedNames.join(' + ')}—${triad.narrative}`,
          cards: triad.matchedCards,
          id: triad.id
        });
      });
  }

  // Priority 5/6: Emerging suit progressions (2-card signals)
  if (narratives.length < 5 && patterns.suitProgressions) {
    patterns.suitProgressions
      .filter((p) => p.significance === 'emerging-progression')
      .sort((a, b) => b.stageCardCount - a.stageCardCount)
      .slice(0, 1)
      .forEach((prog) => {
        const suitLabel = prog.displaySuit || prog.suit;
        const label = `${suitLabel} ${stageDisplay[prog.stage] || prog.stage} (emerging)`;
        const cardList = prog.stageCards
          .map((c) => deckAwareName(c, getCardLabel(c), deckStyle))
          .join(' + ');
        const insight = prog.readingSignificance || prog.narrative || '';
        narratives.push({
          priority: 6,
          type: 'emerging-suit-progression',
          text: `**${label}** ${cardList} hint that ${insight}`,
          cards: prog.stageCards.map((card) => card.number ?? card.rankValue ?? null),
          suit: prog.suit,
          stage: prog.stage
        });
      });
  }

  // Deck-specific: Marseille numerology clusters
  if (patterns.marseillePip?.numerologyClusters?.length) {
    patterns.marseillePip.numerologyClusters
      .sort((a, b) => b.cards.length - a.cards.length)
      .slice(0, 2)
      .forEach((cluster) => {
        const cardList = cluster.cards
          .map((card) => deckAwareName(card, getCardLabel(card), deckStyle))
          .join(', ');
        narratives.push({
          priority: 6,
          type: 'marseille-numerology',
          text: `**Pip ${cluster.rankValue} — ${cluster.keyword}** ${cluster.description} (Geometry: ${cluster.geometry}). Cards: ${cardList}.`,
          cards: cluster.cards.map((card) => card.rankValue ?? card.number ?? null)
        });
      });
  }

  // Priority 5: Medium-high dyads (if we have space)
  if (narratives.length < 5 && patterns.dyads) {
    patterns.dyads
      .filter((d) => d.significance === 'medium-high')
      .slice(0, 1) // Max 1 medium-high
      .forEach((dyad) => {
        narratives.push({
          priority: 7,
          type: 'medium-high-dyad',
          text: `**${dyad.names.join(' + ')}** ${dyad.narrative}`,
          cards: dyad.cards,
          category: dyad.category
        });
      });
  }

  // Sort by priority and limit to top 5
  return narratives.sort((a, b) => a.priority - b.priority).slice(0, 5);
}
