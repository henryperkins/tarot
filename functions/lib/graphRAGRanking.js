import { composeRelevanceScore } from './graphRAGScoring.js';

export const PATTERN_RANKING_POLICY_ID = 'pattern-semantic-v1';

const validCosine = value => Number.isFinite(value) && value >= -1 && value <= 1;

/**
 * Context admission chooses the prose; semantic affinity identifies its pattern.
 * A multilingual query can recognize a pattern through a specialized variant
 * even when the context vocabulary cannot authorize that variant's wording.
 * Only already-qualified passages receive this ranking hint. Their own scores,
 * threshold, context gate, Major lexical safeguard and weak floor stay intact.
 * patternKey includes authenticated membership and deck, not just a title.
 */
export function rankQualifiedPatterns(qualified, scored) {
  if (!scored.length || !scored.every(p => p._semanticScoringSucceeded === true
    && !p._priorityOnly && !p._qualityFilteringDisabled && validCosine(p._semanticScore))) {
    return qualified;
  }
  const affinity = new Map();
  for (const passage of scored) {
    affinity.set(passage.patternKey, Math.max(affinity.get(passage.patternKey) ?? -1, passage._semanticScore));
  }
  return qualified.map(passage => ({
    ...passage,
    _patternSemanticScore: affinity.get(passage.patternKey)
  }));
}

/** Reuse selection ordering when prompt-budget fitting retains fewer passages. */
export function getPassageRankingScore(passage) {
  if (passage?._semanticScoringSucceeded === true && !passage._priorityOnly
    && !passage._qualityFilteringDisabled && !passage.belowRelevanceThreshold
    && validCosine(passage._semanticScore) && validCosine(passage._patternSemanticScore)
    && passage._patternSemanticScore >= passage._semanticScore
    && Number.isFinite(passage.relevance) && Number.isFinite(passage.relevanceScore)) {
    return composeRelevanceScore({ keywordScore: passage.relevance, semanticScore: passage._patternSemanticScore });
  }
  return Number.isFinite(passage?.relevanceScore) ? passage.relevanceScore : 0;
}
