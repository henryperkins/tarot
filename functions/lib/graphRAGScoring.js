export const DEFAULT_RELEVANCE_THRESHOLD = 0.3;
export const LEXICAL_CORROBORATION_WEIGHT = 0.3;
export const RELEVANCE_SCORING_POLICY_ID = 'semantic-primary-corroborated-v1';

/**
 * Proposed semantic-primary relevance composition with bounded lexical corroboration:
 *   score = s + 0.3 * k * (1 - s)
 * where k is lexical overlap in [0, 1] and s is finite cosine similarity in [-1, 1].
 * When semanticScore is null or non-finite, returns the lexical score k.
 *
 * @param {Object} params
 * @param {number} params.keywordScore
 * @param {number|null} [params.semanticScore=null]
 * @returns {number}
 */
export function composeRelevanceScore({ keywordScore = 0, semanticScore = null } = {}) {
  const k = Number.isFinite(keywordScore) ? Math.max(0, Math.min(1, keywordScore)) : 0;
  if (semanticScore === null || semanticScore === undefined || !Number.isFinite(semanticScore)) {
    return k;
  }
  const s = Math.max(-1, Math.min(1, semanticScore));
  return s + LEXICAL_CORROBORATION_WEIGHT * k * (1 - s);
}

/**
 * Legacy linear combination retained for explicit custom-weight callers and
 * baseline comparison in verifyGraphRAGRelevance.js.
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
