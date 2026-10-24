// Graph-aware context helper for tarot spreads
//
// This module centralizes how we derive archetypal pattern context from the
// tarot knowledge graph. It is intentionally small and declarative so that
// higher-level consumers (spread analysis, narrative builders, LLM prompts)
// can depend on a stable shape when asking for "graph context" rather than
// re-implementing detection logic.
//
// NOTE: This is *not* a full GraphRAG implementation – it is a lightweight
// wrapper over the existing rule-based pattern detectors in knowledgeGraph.js.
// It can be extended in the future to attach richer retrieval metadata
// (e.g., external passages keyed by pattern id) without changing callers.

import { groupGraphCardIdentities } from './graphCardMembership.js';
import { detectAllPatterns, getPriorityPatternNarratives } from './knowledgeGraph.js';

function buildGraphKeys(patterns, cardsInfo, deckStyle) {
    if (!patterns || typeof patterns !== 'object') {
        return null;
    }

    const majorCards = groupGraphCardIdentities(cardsInfo, { deckStyle }).members.map(member => member.card).filter((card) => Number.isInteger(card?.number)
        && card.number >= 0 && card.number <= 21);
    const majorNumbers = [...new Set(majorCards.map((card) => card.number))].sort((a, b) => a - b);

    const keys = {
        totalMajors: majorNumbers.length,
        majorNumbers
    };

    // Fool's Journey: expose both the human-friendly stage label and the
    // underlying key used in FOOLS_JOURNEY so retrieval/training can use
    // stable identifiers.
    if (patterns.foolsJourney) {
        keys.foolsJourneyStageKey = patterns.foolsJourney.stageKey || null;
        keys.foolsJourneyStage = patterns.foolsJourney.stage || null;
        keys.foolsJourneySignificance = patterns.foolsJourney.significance || null;
        if (keys.totalMajors === 1) {
            const singleMajor = Array.isArray(patterns.foolsJourney.cards)
                ? patterns.foolsJourney.cards[0]
                : null;
            if (singleMajor && typeof singleMajor.number === 'number') {
                keys.singleMajorNumber = singleMajor.number;
                const displayName = Array.isArray(patterns.foolsJourney.displayNames)
                    ? patterns.foolsJourney.displayNames[0]
                    : null;
                keys.singleMajorName = displayName || singleMajor.name || null;
            }
        }
    }

    // Triads: stable ids plus completeness for GraphRAG and evaluation.
    if (Array.isArray(patterns.triads) && patterns.triads.length > 0) {
        keys.triadIds = patterns.triads
            .map((triad) => triad.id)
            .filter(Boolean);
        keys.completeTriadIds = patterns.triads
            .filter((triad) => triad.isComplete)
            .map((triad) => triad.id)
            .filter(Boolean);
    } else {
        keys.triadIds = [];
        keys.completeTriadIds = [];
    }

    keys.partialTriads = (patterns.triads || [])
        .filter((triad) => !triad.isComplete)
        .map((triad) => ({
            id: triad.id,
            matchedCards: [...triad.matchedCards],
            missingCards: [...triad.missingCards]
        }));

    // Dyads: capture numeric card pairs plus semantic category and significance.
    if (Array.isArray(patterns.dyads) && patterns.dyads.length > 0) {
        keys.dyadPairs = patterns.dyads.map((dyad) => ({
            cards: dyad.cards,
            category: dyad.category || null,
            significance: dyad.significance || null
        }));
    } else {
        keys.dyadPairs = [];
    }

    // Suit progressions: suit + stage signature for Minor Arcana arcs.
    if (Array.isArray(patterns.suitProgressions) && patterns.suitProgressions.length > 0) {
        keys.suitProgressions = patterns.suitProgressions.map((prog) => ({
            suit: prog.suit,
            stage: prog.stage,
            significance: prog.significance,
            matchedCardKeys: groupGraphCardIdentities(prog.stageCards, { deckStyle }).members.map(member => member.canonicalKey),
            matchedCardIndices: [...prog.matchedCardIndices]
        }));
    } else {
        keys.suitProgressions = [];
    }

    // Court lineages: suit + significance (council vs alliance).
    if (Array.isArray(patterns.courtLineages) && patterns.courtLineages.length > 0) {
        keys.courtLineages = patterns.courtLineages.map((lineage) => ({
            suit: lineage.suit,
            significance: lineage.significance,
            matchedCardKeys: groupGraphCardIdentities(lineage.cards, { deckStyle }).members.map(member => member.canonicalKey),
            matchedCardIndices: [...lineage.matchedCardIndices]
        }));
    } else {
        keys.courtLineages = [];
    }

    // Deck-specific Thoth and Marseille signals.
    if (patterns.thothEpithets) {
        if (Array.isArray(patterns.thothEpithets.suitHighlights) && patterns.thothEpithets.suitHighlights.length > 0) {
            keys.thothSuits = patterns.thothEpithets.suitHighlights.map((h) => h.suit);
        } else if (Array.isArray(patterns.thothEpithets.entries) && patterns.thothEpithets.entries.length > 0) {
            keys.thothEntries = patterns.thothEpithets.entries.map((entry) => entry.card);
        }
    }

    if (patterns.marseillePip?.numerologyClusters?.length) {
        keys.marseilleRanks = patterns.marseillePip.numerologyClusters.map((cluster) => cluster.rankValue);
    }

    return keys;
}

/**
 * Build archetypal graph context for a spread.
 *
 * @param {Array<Object>} cardsInfo - Spread cards (as passed to analyzeSpreadThemes)
 * @param {Object} [options]
 * @param {string} [options.deckStyle='rws-1909'] - Deck style key used for
 *   deck-aware naming and pattern selection.
 * @returns {Object|null} An object with the detected `patterns`,
 *   `narrativeHighlights`, and stable `graphKeys`, or null for empty input.
 *   Nonempty spreads retain graph facts even without a pattern.
 */
export function buildGraphContext(cardsInfo, options = {}) {
    const deckStyle = options.deckStyle || 'rws-1909';

    if (!Array.isArray(cardsInfo) || cardsInfo.length === 0) {
        return null;
    }

    const patterns = detectAllPatterns(cardsInfo, { deckStyle }) || {};

    const narrativeHighlights = getPriorityPatternNarratives(patterns, deckStyle) || [];
    const graphKeys = buildGraphKeys(patterns, cardsInfo, deckStyle);

    return {
        patterns,
        narrativeHighlights,
        graphKeys
    };
}
