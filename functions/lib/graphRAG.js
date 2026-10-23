import { collectPassageCandidates, selectPassageCandidates, passageContextMatch, isValidPassageLimit, scoreKeywordRelevance, retrievalQueryTerms, resolveRetrievalMode } from './graphRAGCandidates.js';
export { resolveRetrievalMode } from './graphRAGCandidates.js';
import { projectPassageForDeck } from './graphRAGProjection.js';
// functions/lib/graphRAG.js
// GraphRAG (Graph-Enhanced Retrieval-Augmented Generation) for tarot readings
//
// This module implements a lightweight GraphRAG system that:
// 1. Takes graph keys from pattern detection (triads, dyads, journey stages)
// 2. Retrieves relevant passages from the curated knowledge base
// 3. Ranks and formats passages for injection into LLM prompts
// 4. Scores passage relevance using keyword + semantic similarity
//
// Architecture:
//   graphKeys → retrievePassages() → scored passages → quality filter → formatForPrompt()
//
// Quality filtering enhancements:
// - Keyword overlap scoring (fast, cheap)
// - Semantic similarity via Workers AI embeddings (optional, requires env.AI)
// - Deduplication of similar passages
// - Relevance threshold filtering

import {
  getKnowledgeBaseStats
} from './knowledgeBase.js';
import {
  cosineSimilarity,
  embedTextsWithMetadata,
  isEmbeddingProviderAvailable,
  isSemanticEmbedding
} from './embeddings.js';
import { getPassageSource } from '../../shared/passageSource.js';

/**
 * Determine the number of passages to retrieve based on spread complexity
 * and subscription tier. Centralized here so prompts and server-side
 * memoization stay in sync.
 *
 * Tier semantics:
 * - free  → concisely scoped context (roughly half of base passages)
 * - plus  → full base limits
 * - pro   → full base limits (future: could increase beyond base)
 *
 * Callers that are not yet tier-aware can omit the tier argument; it will
 * default to paid/full depth to preserve existing behavior.
 *
 * @param {string} spreadKey
 * @param {string} [tier='plus'] - 'free' | 'plus' | 'pro'
 * @returns {number}
 */
export function getPassageCountForSpread(spreadKey, tier = 'plus') {
  const limits = {
    single: 1,        // One-card = 1 passage (focused)
    threeCard: 2,     // Simple spread = 2 passages
    fiveCard: 3,      // Medium spread = 3 passages
    celtic: 5,        // Complex spread = 5 passages (rich context needed)
    decision: 3,      // Decision spread = 3 passages
    relationship: 2,  // Relationship = 2 passages
    general: 3        // Default fallback
  };

  const base = limits[spreadKey] || limits.general;
  const normalizedTier = typeof tier === 'string' && tier.trim()
    ? tier.toLowerCase()
    : 'plus';

  // Free users receive a slimmer GraphRAG block for more concise readings
  // while still preserving at least one passage for context.
  if (normalizedTier === 'free') {
    return Math.max(1, Math.floor(base / 2));
  }

  // Plus/Pro currently share the same base limits. This can be expanded
  // later (e.g., pro → base * 2) without touching call sites.
  return base;
}

/**
 * Retrieve relevant passages based on detected graph patterns
 *
 * @param {Object} graphKeys - Graph keys from buildGraphContext()
 * @param {Object} [options]
 * @param {number} [options.maxPassages=3] - Maximum passages to return
 * @param {boolean} [options.includeMetadata=false] - Include pattern metadata
 * @param {string} [options.questionContext] - Detected question context for passage selection
 * @returns {Array<Object>} Ranked passages with priority and metadata
 *
 * @example
 * const graphKeys = {
 *   completeTriadIds: ['death-temperance-star'],
 *   foolsJourneyStageKey: 'integration'
 * };
 * const passages = retrievePassages(graphKeys, { maxPassages: 3 });
 */
export function retrievePassages(graphKeys, options = {}) {
  const maxPassages = options.maxPassages === undefined ? 3 : options.maxPassages;
  if (!isValidPassageLimit(maxPassages)) return [];
  const candidates = collectPassageCandidates(graphKeys, options);
  const disabled = options.env?.DISABLE_QUALITY_FILTERING === 'true' || options.env?.DISABLE_QUALITY_FILTERING === true;
  const userQuery = typeof options.userQuery === 'string' ? options.userQuery : '';
  const keywordQuery = typeof options.keywordQuery === 'string' ? options.keywordQuery : userQuery;
  const mode = resolveRetrievalMode({ qualityFilteringDisabled: disabled, keywordQuery });
  const scored = candidates.map(passage => ({
    ...passage,
    ...(mode === 'keyword' ? { relevance: scoreKeywordRelevance(passage.promptText, keywordQuery), relevanceScore: scoreKeywordRelevance(passage.promptText, keywordQuery) } : {}),
    _qualityFilteringDisabled: disabled,
    _semanticScoringAttempted: false,
    _semanticScoringSucceeded: false,
    _contextMatch: passageContextMatch(passage, options.questionContext),
    _priorityOnly: mode !== 'keyword'
  }));
  Object.defineProperty(scored, 'retrievalStats', { value: {
    ...candidates.retrievalStats, candidatesScored: mode === 'keyword' ? scored.length : 0,
    retrievalMode: mode, scoringMethod: mode,
    semanticScoringAttempted: false, semanticScoringUsed: false,
    semanticScoringFallbackReason: disabled ? 'quality-filtering-disabled' : null,
    embeddingBatchCount: 0, embeddingCacheHits: 0
  } });
  return selectPassageCandidates(scored, { ...options, maxPassages, qualityFilteringDisabled: disabled });
}

/**
 * Format retrieved passages for injection into LLM prompts
 *
 * @param {Array<Object>} passages - Retrieved passages from retrievePassages()
 * @param {Object} [options]
 * @param {boolean} [options.includeSource=true] - Show passage sources
 * @param {boolean} [options.markdown=true] - Format as markdown
 * @returns {string} Formatted passages ready for prompt injection
 *
 * @example
 * const formatted = formatPassagesForPrompt(passages);
 * // Returns formatted markdown with section header and passages
 */
export function formatPassagesForPrompt(passages, options = {}) {
  const includeSource = options.includeSource !== false;
  const markdown = options.markdown !== false;
  const includeVisualAnchors = options.includeVisualAnchors !== false;

  if (!Array.isArray(passages) || passages.length === 0) {
    return '';
  }

  const projected = passages.map((passage) => projectPassageForDeck(passage, options.deckStyle || passage?.projectedDeck || 'rws-1909')).filter(Boolean);
  if (!projected.length) return '';
  const lines = [];

  if (markdown) {
    lines.push('**Retrieved Wisdom from Tarot Tradition:**');
    lines.push('');
  } else {
    lines.push('Retrieved Wisdom from Tarot Tradition:');
    lines.push('');
  }

  projected.forEach((passage, index) => {
    const number = index + 1;

    // Title line
    if (passage.title) {
      if (markdown) {
        lines.push(`${number}. **${passage.title}**`);
      } else {
        lines.push(`${number}. ${passage.title}`);
      }
    } else if (passage.theme) {
      if (markdown) {
        lines.push(`${number}. **${passage.theme}**`);
      } else {
        lines.push(`${number}. ${passage.theme}`);
      }
    }

    // Kept only by the relevance floor: qualify it before the model reads it
    if (passage.belowRelevanceThreshold === true) {
      const indent = '  ';
      if (markdown) {
        lines.push(`${indent}*Weak match to the question: kept as background on this spread's cards, not as evidence about the querent.*`);
      } else {
        lines.push(`${indent}[Weak match to the question: background on this spread's cards, not evidence about the querent]`);
      }
    }

    const source = getPassageSource(passage);
    lines.push(`  Source tradition: ${source.label}.`);
    if (passage.cardNames?.length) lines.push(`  Matched cards: ${passage.cardNames.join(', ')}.`);
    if (passage.projectionVersion) lines.push(`  Projection version: ${passage.projectionVersion}; human editorial status: ${passage.projectionReviewStatus || 'pending'}.`);
    if (passage.sourceUrls?.length) lines.push(`  Source provenance (background research, not quotations): ${passage.sourceUrls.join(', ')}.`);
    if (passage.crossDeckReference) {
      lines.push('  Cross-deck reference: archetypal meaning is background; its imagery is not evidence of the selected deck.');
    }

    // Passage text
    if (passage.promptText) {
      const indent = '  ';
      if (markdown) {
        lines.push(`${indent}"${passage.promptText}"`);
      } else {
        lines.push(`${indent}${passage.promptText}`);
      }
    }

    // Visual anchors - integrate into prompt for imagery grounding
    if (includeVisualAnchors && passage.promptVisualAnchors && passage.promptVisualAnchors.length > 0) {
      const indent = '  ';
      const anchorText = passage.promptVisualAnchors.slice(0, 5).join(', ');
      if (markdown) {
        lines.push(`${indent}*Visual anchors: ${anchorText}*`);
      } else {
        lines.push(`${indent}[Visual: ${anchorText}]`);
      }
    }

    // Source attribution
    if (includeSource && passage.source) {
      const indent = '  ';
      if (markdown) {
        lines.push(`${indent}— ${passage.source}`);
      } else {
        lines.push(`${indent}(Source: ${passage.source})`);
      }
    }

    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Build a retrieval summary for debugging/telemetry
 *
 * @param {Object} graphKeys - Graph keys from buildGraphContext()
 * @param {Array<Object>} passages - Retrieved passages
 * @returns {Object} Summary of retrieval results
 */
export function buildRetrievalSummary(graphKeys, passages) {
  const summary = {
    ...(passages?.retrievalStats || {}),
    graphKeysProvided: !!graphKeys,
    patternsDetected: {
      completeTriads: graphKeys?.completeTriadIds?.length || 0,
      partialTriads: (graphKeys?.triadIds?.length || 0) - (graphKeys?.completeTriadIds?.length || 0),
      foolsJourneyStage: graphKeys?.foolsJourneyStageKey || null,
      totalMajors: typeof graphKeys?.totalMajors === 'number' ? graphKeys.totalMajors : 0,
      singleMajor: Number.isInteger(graphKeys?.singleMajorNumber) ? 1 : 0,
      highDyads: graphKeys?.dyadPairs?.filter((d) => d.significance === 'high').length || 0,
      mediumHighDyads: graphKeys?.dyadPairs?.filter((d) => d.significance === 'medium-high').length || 0,
      mediumDyads: graphKeys?.dyadPairs?.filter((d) => d.significance === 'medium').length || 0,
      courtLineages: graphKeys?.courtLineages?.length || 0,
      strongSuitProgressions:
        graphKeys?.suitProgressions?.filter((p) => p.significance === 'strong-progression')
          .length || 0,
      emergingSuitProgressions:
        graphKeys?.suitProgressions?.filter((p) => p.significance === 'emerging-progression')
          .length || 0
    },
    passagesRetrieved: passages?.length || 0,
    passagesByType: passages?.reduce((acc, p) => {
      acc[p.type] = (acc[p.type] || 0) + 1;
      return acc;
    }, {}),
    passagesByPriority: passages?.reduce((acc, p) => {
      const key = `priority${p.priority}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  };

  return summary;
}

/**
 * Check if GraphRAG is enabled via environment
 *
 * @param {Object} [env] - Environment object (e.g., Cloudflare Worker env or process.env)
 * @returns {boolean} True if GraphRAG should be used
 */
export function isGraphRAGEnabled(env) {
  // Prefer provided env (for Workers), fall back to process.env (for Node.js)
  let effectiveEnv = env;
  
  if (!effectiveEnv) {
    if (typeof process !== 'undefined' && process.env) {
      effectiveEnv = process.env;
    } else {
      // No env available - default to disabled to avoid unexpected activation
      return false;
    }
  }

  // Check GRAPHRAG_ENABLED first (preferred), fall back to legacy KNOWLEDGE_GRAPH_ENABLED
  const envValue = effectiveEnv.GRAPHRAG_ENABLED ?? effectiveEnv.KNOWLEDGE_GRAPH_ENABLED;

  if (typeof envValue === 'boolean') {
    return envValue;
  }

  if (typeof envValue === 'number') {
    return envValue > 0;
  }

  if (typeof envValue === 'string') {
    const normalized = envValue.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
      return true;
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
      return false;
    }
  }

  // Default: disabled unless explicitly enabled
  return false;
}

/**
 * Get knowledge base statistics for monitoring
 *
 * @returns {Object} Knowledge base coverage stats
 */
export function getKnowledgeBaseInfo() {
  return getKnowledgeBaseStats();
}

// ============================================================================
// QUALITY FILTERING ENHANCEMENTS
// ============================================================================

// Passage text sent for embedding; truncated for efficiency.
const MAX_PASSAGE_EMBEDDING_CHARS = 8000;

/**
 * Score passage relevance against user query.
 * Combines fast keyword matching with optional semantic similarity.
 *
 * @param {string} passage - The passage text
 * @param {string} userQuery - User's question
 * @param {Object} [options] - Scoring options
 * @param {number} [options.keywordWeight=0.3] - Weight for keyword score
 * @param {number} [options.semanticWeight=0.7] - Weight for semantic score
 * @param {boolean} [options.enableSemanticScoring=false] - Use embeddings API
 * @param {Object} [options.env] - Worker environment with the AI binding
 * @param {{query: Object, passage: Object}} [options.embeddings] - Precomputed
 *   embedTextsWithMetadata() results; skips the per-passage embedding request
 * @returns {Promise<number>} Relevance score 0-1
 *
 * @example
 * const score = await scorePassageRelevance(
 *   "The Fool represents new beginnings...",
 *   "What does this new chapter hold for me?",
 *   { enableSemanticScoring: true }
 * );
 * // Returns ~0.75 (high relevance)
 */
export async function scorePassageRelevance(passage, userQuery, options = {}) {
  const {
    keywordWeight = 0.3,
    semanticWeight = 0.7,
    semanticStatus = null
  } = options;

  if (!userQuery || !passage) {
    return 0; // No content overlap can be measured
  }

  const queryText = typeof userQuery === 'string' ? userQuery : '';
  const passageText = typeof passage === 'string' ? passage : '';

  if (!queryText.trim() || !passageText.trim()) {
    return 0;
  }

  const keywordScore = scoreKeywordRelevance(passageText, typeof options.keywordQuery === 'string' ? options.keywordQuery : queryText);

  // Semantic similarity (requires embeddings API)
  let semanticScore = 0.5; // Default to neutral if semantic scoring is disabled
  if (options.enableSemanticScoring) {
    if (semanticStatus) {
      semanticStatus.attempted = true;
      semanticStatus.succeeded = false;
    }
    try {
      const [queryEmbed, passageEmbed] = options.embeddings
        ? [options.embeddings.query, options.embeddings.passage]
        : await embedTextsWithMetadata(
          [queryText, passageText.slice(0, MAX_PASSAGE_EMBEDDING_CHARS)],
          { env: options.env }
        );
      if (!isValidSemanticVector(queryEmbed) || !isValidSemanticVector(passageEmbed, queryEmbed?.embedding?.length)) {
        return keywordScore;
      }
      semanticScore = cosineSimilarity(queryEmbed.embedding, passageEmbed.embedding);
      if (semanticStatus) {
        semanticStatus.succeeded = true;
      }
    } catch (_err) {
      console.warn('[GraphRAG] Semantic scoring failed');
      if (semanticStatus) {
        semanticStatus.succeeded = false;
      }
      // Fall back to keyword-only scoring
      return keywordScore;
    }
  }

  return options.enableSemanticScoring ? keywordScore * keywordWeight + semanticScore * semanticWeight : keywordScore;
}

/**
 * Remove passages with high content overlap.
 * Uses a simple fingerprint-based approach for efficiency.
 *
 * @param {Array<Object>} passages - Passages to deduplicate
 * @param {Object} [options] - Deduplication options
 * @param {number} [options.fingerprintLength=100] - Characters to use for fingerprint
 * @returns {Array<Object>} Deduplicated passages
 *
 * @example
 * const unique = deduplicatePassages(passages);
 */
export function deduplicatePassages(passages, _options = {}) {

  if (!Array.isArray(passages) || passages.length === 0) {
    return [];
  }

  const seen = new Set();

  return passages.filter((passage) => {
    if (!passage || typeof passage.text !== 'string') {
      return true; // Keep passages without text (shouldn't happen but be safe)
    }

    // Generate content fingerprint (normalized first N chars)
    const fingerprint = (passage.promptText || passage.text)
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

    if (seen.has(fingerprint)) {
      return false; // Duplicate, filter out
    }

    seen.add(fingerprint);
    return true;
  });
}

/**
 * Rank passages for prompt injection, prioritizing semantic relevance when available.
 * Falls back to keyword overlap, then priority ordering.
 *
 * @param {Array<Object>} passages
 * @param {Object} [options]
 * @param {number} [options.limit] - Optional limit for returned passages
 * @returns {{passages: Array<Object>, strategy: string}}
 */
export function rankPassagesForPrompt(passages, options = {}) {
  if (!Array.isArray(passages) || passages.length === 0) {
    return { passages: [], strategy: 'none' };
  }

  const limit = Math.min(
    Math.max(1, options.limit || passages.length),
    passages.length
  );

  const scoreField = determineScoreField(passages);
  const ranked = [...passages]
    .sort((a, b) => comparePassagesForPrompt(a, b, scoreField))
    .slice(0, limit);

  return { passages: ranked, strategy: describeScoringMethod(passages) };
}

function determineScoreField(passages) {
  if (passages.some((p) => typeof p?.relevanceScore === 'number')) {
    return 'relevanceScore';
  }
  if (passages.some((p) => typeof p?.relevance === 'number')) {
    return 'relevance';
  }
  return 'priority';
}

/**
 * Name the scoring method that actually produced the passages' relevance.
 * relevanceScore is set by keyword fallback as well as by embeddings, so only
 * per-passage provenance shows that semantic scoring ran; 'mixed' means some
 * scores are semantic and some keyword-only, on different scales.
 *
 * @param {Array<Object>} passages
 * @returns {'semantic'|'mixed'|'keyword'|'priority'|'none'}
 */
export function describeScoringMethod(passages) {
  if (!Array.isArray(passages) || passages.length === 0) return 'none';
  if (passages.some((passage) => passage?._qualityFilteringDisabled)) return 'bypassed';
  if (passages.retrievalStats?.scoringMethod) return passages.retrievalStats.scoringMethod;

  const scored = passages.filter((p) => typeof p?.relevanceScore === 'number');
  if (scored.length > 0) {
    const semanticCount = scored.filter((p) => p._semanticScoringSucceeded === true).length;
    if (semanticCount === 0) return 'keyword';
    return semanticCount === scored.length ? 'semantic' : 'mixed';
  }

  return passages.some((p) => typeof p?.relevance === 'number') ? 'keyword' : 'priority';
}

function getPrimaryScore(passage, scoreField) {
  if (scoreField === 'relevanceScore') {
    return typeof passage.relevanceScore === 'number' ? passage.relevanceScore : 0;
  }
  if (scoreField === 'relevance') {
    return typeof passage.relevance === 'number' ? passage.relevance : 0;
  }

  // Priority: lower numbers are higher priority, so invert for comparison
  const priority = typeof passage.priority === 'number' ? passage.priority : Infinity;
  return priority === Infinity ? 0 : 1 / (1 + priority);
}

function comparePassagesForPrompt(a, b, scoreField) {
  const scoreA = getPrimaryScore(a, scoreField);
  const scoreB = getPrimaryScore(b, scoreField);
  if (scoreA !== scoreB) {
    return scoreB - scoreA;
  }

  const contextA = a._contextMatch || 0;
  const contextB = b._contextMatch || 0;
  if (contextA !== contextB) return contextB - contextA;

  const priorityA = typeof a.priority === 'number' ? a.priority : Infinity;
  const priorityB = typeof b.priority === 'number' ? b.priority : Infinity;
  if (priorityA !== priorityB) {
    return priorityA - priorityB;
  }

  const identityA = a.candidateId || '';
  const identityB = b.candidateId || '';
  return identityA < identityB ? -1 : identityA > identityB ? 1 : 0;
}

/**
 * Enhanced retrieval with quality filtering.
 * Builds on retrievePassages() but adds:
 * - Relevance scoring (keyword + semantic)
 * - Quality threshold filtering
 * - Deduplication
 *
 * Semantic scoring is enabled by default when the Workers AI binding (env.AI) is
 * present. Pass enableSemanticScoring: false to explicitly disable it.
 *
 * @param {Object} graphKeys - Graph keys from buildGraphContext()
 * @param {Object} [options] - Retrieval options
 * @param {number} [options.maxPassages=5] - Maximum passages to return
 * @param {string} [options.userQuery=''] - User's question for relevance scoring
 * @param {string} [options.questionContext] - Detected question context for passage selection
 * @param {number} [options.minRelevanceScore=0.3] - Minimum relevance to include
 * @param {boolean} [options.enableDeduplication=true] - Remove similar passages
 * @param {boolean|null} [options.enableSemanticScoring] - Use embeddings API (auto-detected if omitted or null)
 * @param {Object} [options.env] - Environment variables for API calls
 * @returns {Promise<Array<Object>>} Quality-filtered, scored passages
 *
 * @example
 * // Semantic scoring auto-enabled when API is configured
 * const passages = await retrievePassagesWithQuality(
 *   themes.knowledgeGraph.graphKeys,
 *   {
 *     maxPassages: 5,
 *     userQuery: "What does this new chapter hold?",
 *     env: context.env  // Pass env to enable auto-detection
 *   }
 * );
 *
 * @example
 * // Explicitly disable semantic scoring for faster retrieval
 * const passages = await retrievePassagesWithQuality(
 *   themes.knowledgeGraph.graphKeys,
 *   {
 *     maxPassages: 5,
 *     userQuery: "What does this new chapter hold?",
 *     enableSemanticScoring: false
 *   }
 * );
 */
function isValidSemanticVector(result, dimensions = null) {
  const vector = result?.embedding;
  return isSemanticEmbedding(result) && Array.isArray(vector) && vector.length > 0
    && (dimensions === null || vector.length === dimensions)
    && vector.every(Number.isFinite)
    && Number.isFinite(vector.reduce((sum, value) => sum + value * value, 0))
    && vector.some((value) => value !== 0);
}

// Explicit whole-registry budget: overflow falls back for the complete eligible
// set, never to a truncated semantic shortlist. Registry qualification must
// validate this bound when approved enrichment changes the compiled corpus.
export const MAX_SEMANTIC_REGISTRY_PASSAGES = 1000;

export async function retrievePassagesWithQuality(graphKeys, options = {}) {
  const { maxPassages = 5, questionContext = '', minRelevanceScore = 0.3, enableDeduplication = true, env = null } = options;
  if (!isValidPassageLimit(maxPassages)) return [];
  const startedAt = Date.now();
  const userQuery = typeof options.userQuery === 'string' ? options.userQuery : '';
  const keywordQuery = typeof options.keywordQuery === 'string' ? options.keywordQuery : userQuery;
  const hasQuery = Boolean(userQuery.trim());
  const hasKeywordQuery = retrievalQueryTerms(keywordQuery).length > 0;
  const semanticRequested = options.enableSemanticScoring ?? isSemanticScoringAvailable(env);
  const disabled = env?.DISABLE_QUALITY_FILTERING === 'true' || env?.DISABLE_QUALITY_FILTERING === true;
  const mode = resolveRetrievalMode({ qualityFilteringDisabled: disabled, semanticRequested, keywordQuery });
  const candidates = collectPassageCandidates(graphKeys, { ...options, includeMetadata: true });
  const embeddingStats = {};
  const registryOverflow = candidates.retrievalStats.registryPassageCount > MAX_SEMANTIC_REGISTRY_PASSAGES;
  let embeddings = [];
  const attempted = Boolean(mode === 'semantic' && hasQuery && candidates.length && isSemanticScoringAvailable(env) && !registryOverflow);
  if (attempted) embeddings = await embedTextsWithMetadata([userQuery, ...candidates.map(entry => entry.promptText)], { env, stats: embeddingStats, deadline: startedAt + 3000, signal: options.signal });
  const valid = attempted && isValidSemanticVector(embeddings[0])
    && embeddings.length === candidates.length + 1
    && embeddings.slice(1).every(entry => isValidSemanticVector(entry, embeddings[0].embedding.length));
  const anyValid = attempted && embeddings.some(entry => isValidSemanticVector(entry));
  const fallback = disabled ? 'quality-filtering-disabled' : !semanticRequested ? null : !hasQuery ? 'no-query'
    : !candidates.length ? (candidates.retrievalStats.projectionRejected ? 'projection-rejected' : 'no-passages')
      : registryOverflow ? 'embeddings-registry-overflow' : !isSemanticScoringAvailable(env) ? 'embeddings-not-configured'
        : valid ? null : ['embeddings-timeout', 'embeddings-cancelled'].includes(embeddingStats.failureReason) ? embeddingStats.failureReason
          : anyValid ? 'embeddings-partial-failure' : embeddingStats.failureReason === 'embeddings-invalid-vector' ? 'embeddings-partial-failure' : embeddingStats.failureReason || 'embeddings-failed';
  const scoringMethod = disabled ? 'bypassed' : valid ? 'semantic' : hasKeywordQuery ? 'keyword' : 'priority';
  const scored = candidates.map((passage, index) => {
    const keywordScore = disabled || scoringMethod === 'priority' ? null : scoreKeywordRelevance(passage.promptText, keywordQuery);
    return {
      ...passage,
      ...(keywordScore === null ? {} : { relevance: keywordScore, relevanceScore: valid ? 0.3 * keywordScore + 0.7 * cosineSimilarity(embeddings[0].embedding, embeddings[index + 1].embedding) : keywordScore }),
      _qualityFilteringDisabled: disabled,
      _semanticScoringEnabled: Boolean(semanticRequested),
      _semanticScoringAttempted: attempted,
      _semanticScoringSucceeded: Boolean(valid),
      _contextMatch: passageContextMatch(passage, questionContext),
      _priorityOnly: scoringMethod === 'priority' || disabled
    };
  });
  Object.defineProperty(scored, 'retrievalStats', { value: {
    ...candidates.retrievalStats,
    candidatesScored: ['semantic', 'keyword'].includes(scoringMethod) ? scored.length : 0,
    retrievalMode: mode, scoringMethod,
    semanticScoringAttempted: attempted, semanticScoringUsed: Boolean(valid),
    semanticScoringFallbackReason: fallback,
    embeddingBatchCount: embeddingStats.batchCount || 0,
    embeddingCacheHits: embeddingStats.cacheHits || 0,
    embeddingInputCount: embeddingStats.inputCount || 0,
    embeddingInputCharacters: embeddingStats.inputCharacters || 0,
    embeddingCacheSizeBefore: embeddingStats.cacheSizeBefore || 0,
    embeddingCacheSizeAfter: embeddingStats.cacheSizeAfter || 0,
    embeddingCacheMaxSize: embeddingStats.cacheMaxSize || 100,
    embeddingPeakConcurrency: embeddingStats.peakConcurrency || 0,
    retrievalElapsedMs: Date.now() - startedAt
  } });
  return selectPassageCandidates(scored, { maxPassages, minRelevanceScore, enableDeduplication, qualityFilteringDisabled: disabled });
}

/**
 * Build enhanced retrieval summary including quality metrics.
 *
 * @param {Object} graphKeys - Graph keys from buildGraphContext()
 * @param {Array<Object>} passages - Retrieved passages with relevance scores
 * @returns {Object} Summary with quality metrics
 */
export function buildQualityRetrievalSummary(graphKeys, passages) {
  const baseSummary = buildRetrievalSummary(graphKeys, passages);

  // Add quality metrics
  const qualityMetrics = {
    averageRelevance: 0,
    minRelevance: 0,
    maxRelevance: 0,
    belowRelevanceThresholdPassages: 0,
    semanticScoringUsed: false,
    semanticScoringAttempted: passages?.retrievalStats?.semanticScoringAttempted === true
  };

  if (Array.isArray(passages) && passages.length > 0) {
    const scores = passages
      .map((p) => p.relevanceScore)
      .filter((s) => typeof s === 'number' && !Number.isNaN(s));

    if (scores.length > 0) {
      qualityMetrics.averageRelevance =
        scores.reduce((sum, s) => sum + s, 0) / scores.length;
      qualityMetrics.minRelevance = Math.min(...scores);
      qualityMetrics.maxRelevance = Math.max(...scores);
    }

    qualityMetrics.belowRelevanceThresholdPassages = passages.filter(
      (p) => p?.belowRelevanceThreshold === true
    ).length;

    // Check if semantic scoring was enabled for any passage retrieval
    // Uses the status flags set by retrievePassagesWithQuality
    qualityMetrics.semanticScoringAttempted = passages.some(
      (p) => p._semanticScoringAttempted === true
    );
    qualityMetrics.semanticScoringUsed = passages.some(
      (p) => p._semanticScoringSucceeded === true
    );
  }

  return {
    ...baseSummary,
    qualityMetrics
  };
}

/**
 * Check if semantic scoring is available (Workers AI binding present).
 *
 * @param {Object} [env] - Worker environment
 * @returns {boolean} True if semantic scoring can be used
 */
export function isSemanticScoringAvailable(env) {
  return isEmbeddingProviderAvailable(env);
}
