export const DEFAULT_RELEVANCE_THRESHOLD = 0.3;
export const RELEVANCE_SCORING_POLICY_ID = 'legacy-weighted-v1';
export const RELEVANCE_SCORING_FORMULA = '0.3 * k + 0.7 * s';

/**
 * Legacy default restored after real relevance qualification rejected the proposed
 * semantic-primary policy. F3b remains unresolved; do not infer semantic recall
 * qualification from this rollback.
 *   score = 0.3 * k + 0.7 * s
 * where k is lexical overlap in [0, 1] and s is finite cosine similarity in [-1, 1].
 * When semanticScore is null or non-finite, returns the lexical score k.
 *
 * @param {Object} params
 * @param {number} params.keywordScore
 * @param {number|null} [params.semanticScore=null]
 * @returns {number}
 */
export function composeRelevanceScore({ keywordScore = 0, semanticScore = null } = {}) {
  return composeLegacyWeightedRelevanceScore({ keywordScore, semanticScore });
}

/**
 * Shared linear combination for the default and evaluator baseline comparison.
 * Explicit custom-weight callers retain their existing weighted behavior.
 *
 * @param {Object} params
 * @param {number} params.keywordScore
 * @param {number|null} [params.semanticScore=null]
 * @param {number} [params.keywordWeight=0.3]
 * @param {number} [params.semanticWeight=0.7]
 * @returns {number}
 */
export function composeLegacyWeightedRelevanceScore({
  keywordScore = 0,
  semanticScore = null,
  keywordWeight = 0.3,
  semanticWeight = 0.7
} = {}) {
  const k = Number.isFinite(keywordScore) ? Math.max(0, Math.min(1, keywordScore)) : 0;
  if (semanticScore === null || semanticScore === undefined || !Number.isFinite(semanticScore)) {
    return k;
  }
  const s = Math.max(-1, Math.min(1, semanticScore));
  return k * keywordWeight + s * semanticWeight;
}
