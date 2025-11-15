// functions/lib/knowledgeGraph.js
// Pattern detection logic for archetypal multi-card combinations
// Version 1.0.0

import {
  FOOLS_JOURNEY,
  ARCHETYPAL_TRIADS,
  ARCHETYPAL_DYADS
} from '../../src/data/knowledgeGraphData.js';

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
export function detectFoolsJourneyStage(cards) {
  // Filter to Major Arcana only
  const majorCards = cards.filter(
    (c) => typeof c.number === 'number' && c.number >= 0 && c.number <= 21
  );

  // Need at least 2 Majors to detect a meaningful pattern
  if (majorCards.length < 2) return null;

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

  // Find the dominant stage (most cards)
  const dominant = Object.entries(stages).sort(
    (a, b) => b[1].length - a[1].length
  )[0];

  const stageKey = dominant[0];
  const stageCards = dominant[1];

  // If no clear dominance (all stages tied), return null
  if (stageCards.length === 0) return null;

  // Return enriched stage data
  // IMPORTANT: Spread FOOLS_JOURNEY data FIRST, then override with actual spread data
  return {
    ...FOOLS_JOURNEY[stageKey],
    // Override with actual detected data from this spread:
    cardCount: stageCards.length,
    cards: stageCards, // Actual cards from spread (not static reference)
    totalMajors: majorCards.length,
    significance: stageCards.length >= 3 ? 'strong' : 'moderate'
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
export function detectArchetypalTriads(cards) {
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
          return triad.names[index];
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
export function detectArchetypalDyads(cards) {
  // Extract Major Arcana numbers
  const numbers = cards
    .filter((c) => typeof c.number === 'number' && c.number >= 0 && c.number <= 21)
    .map((c) => c.number);

  if (numbers.length < 2) return [];

  const detected = [];

  ARCHETYPAL_DYADS.forEach((dyad) => {
    // Check if both cards of this dyad are present
    if (dyad.cards.every((num) => numbers.includes(num))) {
      detected.push({
        cards: dyad.cards,
        names: dyad.names,
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
export function detectAllPatterns(cards) {
  if (!cards || !Array.isArray(cards) || cards.length === 0) {
    return null;
  }

  const patterns = {};
  let hasAnyPattern = false;

  // Detect Fool's Journey stage
  try {
    const journey = detectFoolsJourneyStage(cards);
    if (journey) {
      patterns.foolsJourney = journey;
      hasAnyPattern = true;
    }
  } catch (err) {
    console.error('Fool\'s Journey detection failed:', err);
  }

  // Detect triads
  try {
    const triads = detectArchetypalTriads(cards);
    if (triads.length > 0) {
      patterns.triads = triads;
      hasAnyPattern = true;
    }
  } catch (err) {
    console.error('Triad detection failed:', err);
  }

  // Detect dyads
  try {
    const dyads = detectArchetypalDyads(cards);
    if (dyads.length > 0) {
      patterns.dyads = dyads;
      hasAnyPattern = true;
    }
  } catch (err) {
    console.error('Dyad detection failed:', err);
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
export function getPriorityPatternNarratives(patterns) {
  if (!patterns) return [];

  const narratives = [];

  // Priority 1: Complete triads
  if (patterns.triads) {
    patterns.triads
      .filter((t) => t.isComplete)
      .forEach((triad) => {
        narratives.push({
          priority: 1,
          type: 'complete-triad',
          text: `**${triad.theme}:** ${triad.matchedNames.join(', ')} form a complete narrative arc—${triad.narrative}`,
          cards: triad.matchedCards,
          id: triad.id
        });
      });
  }

  // Priority 2: Strong Fool's Journey (3+ cards in one stage)
  if (patterns.foolsJourney && patterns.foolsJourney.significance === 'strong') {
    const journey = patterns.foolsJourney;
    narratives.push({
      priority: 2,
      type: 'fools-journey',
      text: `**Fool's Journey — ${journey.stage.charAt(0).toUpperCase() + journey.stage.slice(1)}:** ${journey.cardCount} cards from this stage suggest ${journey.readingSignificance.toLowerCase()}.`,
      cards: journey.cards.map((c) => c.number),
      stage: journey.stage
    });
  }

  // Priority 3: High-significance dyads
  if (patterns.dyads) {
    patterns.dyads
      .filter((d) => d.significance === 'high')
      .slice(0, 2) // Max 2 high dyads
      .forEach((dyad) => {
        narratives.push({
          priority: 3,
          type: 'high-dyad',
          text: `**${dyad.names.join(' + ')}:** ${dyad.narrative}`,
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
          priority: 4,
          type: 'partial-triad',
          text: `**${triad.theme} (partial):** ${triad.matchedNames.join(' + ')}—${triad.narrative}`,
          cards: triad.matchedCards,
          id: triad.id
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
          priority: 5,
          type: 'medium-high-dyad',
          text: `**${dyad.names.join(' + ')}:** ${dyad.narrative}`,
          cards: dyad.cards,
          category: dyad.category
        });
      });
  }

  // Sort by priority and limit to top 5
  return narratives.sort((a, b) => a.priority - b.priority).slice(0, 5);
}
