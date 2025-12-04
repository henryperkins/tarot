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
// - Semantic similarity via embeddings (optional, requires API)
// - Deduplication of similar passages
// - Relevance threshold filtering

import {
  getPassagesForPattern,
  getKnowledgeBaseStats
} from './knowledgeBase.js';
import { cosineSimilarity, embedText } from './embeddings.js';

/**
 * Determine the number of passages to retrieve based on spread complexity.
 * Centralized here so prompts and server-side memoization stay in sync.
 *
 * @param {string} spreadKey
 * @returns {number}
 */
export function getPassageCountForSpread(spreadKey) {
  const limits = {
    single: 1,        // One-card = 1 passage (focused)
    threeCard: 2,     // Simple spread = 2 passages
    fiveCard: 3,      // Medium spread = 3 passages
    celtic: 5,        // Complex spread = 5 passages (rich context needed)
    decision: 3,      // Decision spread = 3 passages
    relationship: 2,  // Relationship = 2 passages
    general: 3        // Default fallback
  };

  return limits[spreadKey] || limits.general;
}

/**
 * Retrieve relevant passages based on detected graph patterns
 *
 * @param {Object} graphKeys - Graph keys from buildGraphContext()
 * @param {Object} [options]
 * @param {number} [options.maxPassages=3] - Maximum passages to return
 * @param {boolean} [options.includeMetadata=false] - Include pattern metadata
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
  const maxPassages = options.maxPassages || 3;
  const includeMetadata = options.includeMetadata || false;

  if (!graphKeys || typeof graphKeys !== 'object') {
    return [];
  }

  const passages = [];

  // Priority 1: Complete triads (highest narrative value)
  // Only take first passage per triad to avoid duplicate titles in UI
  if (Array.isArray(graphKeys.completeTriadIds) && graphKeys.completeTriadIds.length > 0) {
    graphKeys.completeTriadIds.forEach((triadId) => {
      const entry = getPassagesForPattern('triad', triadId);
      if (entry && entry.passages && entry.passages.length > 0) {
        const passage = entry.passages[0];
        passages.push({
          priority: 1,
          type: 'triad',
          patternId: triadId,
          title: entry.title,
          theme: entry.theme,
          ...passage,
          ...(includeMetadata ? { metadata: { triadId, isComplete: true } } : {})
        });
      }
    });
  }

  // Priority 2: Fool's Journey stage (developmental context)
  // Only take first passage per stage to avoid duplicate titles in UI
  if (graphKeys.foolsJourneyStageKey) {
    const entry = getPassagesForPattern('fools-journey', graphKeys.foolsJourneyStageKey);
    if (entry && entry.passages && entry.passages.length > 0) {
      const passage = entry.passages[0];
      passages.push({
        priority: 2,
        type: 'fools-journey',
        patternId: graphKeys.foolsJourneyStageKey,
        title: entry.title,
        theme: entry.theme,
        stage: entry.stage,
        ...passage,
        ...(includeMetadata
          ? { metadata: { stageKey: graphKeys.foolsJourneyStageKey } }
          : {})
      });
    }
  }

  // Priority 3: High-significance dyads (powerful two-card synergies)
  // Only take first passage per dyad to avoid duplicate titles in UI
  if (Array.isArray(graphKeys.dyadPairs) && graphKeys.dyadPairs.length > 0) {
    graphKeys.dyadPairs
      .filter((dyad) => dyad.significance === 'high')
      .forEach((dyad) => {
        const dyadKey = dyad.cards.join('-');
        const entry = getPassagesForPattern('dyad', dyadKey);
        if (entry && entry.passages && entry.passages.length > 0) {
          const passage = entry.passages[0];
          passages.push({
            priority: 3,
            type: 'dyad',
            patternId: dyadKey,
            theme: entry.theme,
            cardNumbers: dyad.cards,
            cardNames: entry.names,
            ...passage,
            ...(includeMetadata
              ? { metadata: { cards: dyad.cards, category: dyad.category } }
              : {})
          });
        }
      });
  }

  // Priority 4: Strong suit progressions (Minor Arcana developmental arcs)
  // Only take first passage per progression to avoid duplicate titles in UI
  if (Array.isArray(graphKeys.suitProgressions) && graphKeys.suitProgressions.length > 0) {
    graphKeys.suitProgressions
      .filter((prog) => prog.significance === 'strong-progression')
      .forEach((prog) => {
        const progKey = `${prog.suit}:${prog.stage}`;
        const entry = getPassagesForPattern('suit-progression', progKey);
        if (entry && entry.passages && entry.passages.length > 0) {
          const passage = entry.passages[0];
          passages.push({
            priority: 4,
            type: 'suit-progression',
            patternId: progKey,
            title: entry.title,
            suit: prog.suit,
            stage: prog.stage,
            ...passage,
            ...(includeMetadata ? { metadata: { suit: prog.suit, stage: prog.stage } } : {})
          });
        }
      });
  }

  // Sort by priority (lower number = higher priority) and relevance to user query
  const keywords = (options.userQuery || '').toLowerCase().match(/\w+/g) || [];
  const significantKeywords = keywords.filter(w => w.length > 3 && !['what', 'when', 'where', 'which', 'this', 'that', 'have', 'from', 'with', 'about', 'card', 'reading'].includes(w));

  passages.forEach(p => {
    p.relevance = 0;
    const text = (p.text + ' ' + (p.title || '') + ' ' + (p.theme || '')).toLowerCase();
    significantKeywords.forEach(kw => {
      if (text.includes(kw)) p.relevance += 1;
    });
  });

  const ranked = passages
    .sort((a, b) => {
      // Boost priority by 2.0 per keyword match (lower score is better)
      const scoreA = a.priority - (a.relevance * 2.0);
      const scoreB = b.priority - (b.relevance * 2.0);
      return scoreA - scoreB;
    })
    .slice(0, maxPassages);

  return ranked;
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

  if (!Array.isArray(passages) || passages.length === 0) {
    return '';
  }

  const lines = [];

  if (markdown) {
    lines.push('**Retrieved Wisdom from Tarot Tradition:**');
    lines.push('');
  } else {
    lines.push('Retrieved Wisdom from Tarot Tradition:');
    lines.push('');
  }

  passages.forEach((passage, index) => {
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

    // Passage text
    if (passage.text) {
      const indent = '   ';
      if (markdown) {
        lines.push(`${indent}"${passage.text}"`);
      } else {
        lines.push(`${indent}${passage.text}`);
      }
    }

    // Source attribution
    if (includeSource && passage.source) {
      const indent = '   ';
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
    graphKeysProvided: !!graphKeys,
    patternsDetected: {
      completeTriads: graphKeys?.completeTriadIds?.length || 0,
      partialTriads: (graphKeys?.triadIds?.length || 0) - (graphKeys?.completeTriadIds?.length || 0),
      foolsJourneyStage: graphKeys?.foolsJourneyStageKey || null,
      highDyads: graphKeys?.dyadPairs?.filter((d) => d.significance === 'high').length || 0,
      strongSuitProgressions:
        graphKeys?.suitProgressions?.filter((p) => p.significance === 'strong-progression')
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
      // No env available - default to enabled
      return true;
    }
  }

  // Check GRAPHRAG_ENABLED first (preferred), fall back to legacy KNOWLEDGE_GRAPH_ENABLED
  const envValue = effectiveEnv.GRAPHRAG_ENABLED ?? effectiveEnv.KNOWLEDGE_GRAPH_ENABLED;

  // Explicitly disabled
  if (envValue === 'false' || envValue === '0') {
    return false;
  }

  // Explicitly enabled
  if (envValue === 'true' || envValue === '1') {
    return true;
  }

  // Default: enabled (opt-out rather than opt-in for prototype)
  return true;
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
 * @param {Object} [options.env] - Environment variables for API calls
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
  const { keywordWeight = 0.3, semanticWeight = 0.7 } = options;

  if (!userQuery || !passage) {
    return 0.5; // Default neutral score
  }

  const queryText = typeof userQuery === 'string' ? userQuery : '';
  const passageText = typeof passage === 'string' ? passage : '';

  if (!queryText.trim() || !passageText.trim()) {
    return 0.5;
  }

  // Keyword overlap scoring (fast, cheap)
  const queryTerms = queryText
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 3);
  const passageLower = passageText.toLowerCase();
  const keywordMatches = queryTerms.filter((term) =>
    passageLower.includes(term)
  );
  const keywordScore =
    queryTerms.length > 0 ? keywordMatches.length / queryTerms.length : 0;

  // Semantic similarity (requires embeddings API)
  let semanticScore = 0.5; // Default to neutral if semantic scoring disabled/fails
  if (options.enableSemanticScoring) {
    try {
      const [queryEmbed, passageEmbed] = await Promise.all([
        embedText(queryText, { env: options.env }),
        embedText(passageText.slice(0, 500), { env: options.env }) // Truncate for efficiency
      ]);
      semanticScore = cosineSimilarity(queryEmbed, passageEmbed);
    } catch (err) {
      console.warn('[GraphRAG] Semantic scoring failed:', err.message);
      // Fall back to keyword-only scoring
      return keywordScore;
    }
  }

  return keywordScore * keywordWeight + semanticScore * semanticWeight;
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
export function deduplicatePassages(passages, options = {}) {
  const fingerprintLength = options.fingerprintLength || 100;

  if (!Array.isArray(passages) || passages.length === 0) {
    return [];
  }

  const seen = new Set();

  return passages.filter((passage) => {
    if (!passage || typeof passage.text !== 'string') {
      return true; // Keep passages without text (shouldn't happen but be safe)
    }

    // Generate content fingerprint (normalized first N chars)
    const fingerprint = passage.text
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, fingerprintLength);

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

  const strategy = determineRankingStrategy(passages);
  const ranked = [...passages]
    .sort((a, b) => comparePassagesForPrompt(a, b, strategy))
    .slice(0, limit);

  return { passages: ranked, strategy };
}

function determineRankingStrategy(passages) {
  if (passages.some((p) => typeof p?.relevanceScore === 'number')) {
    return 'semantic';
  }
  if (passages.some((p) => typeof p?.relevance === 'number')) {
    return 'keyword';
  }
  return 'priority';
}

function getPrimaryScore(passage, strategy) {
  if (strategy === 'semantic') {
    return typeof passage.relevanceScore === 'number' ? passage.relevanceScore : 0;
  }
  if (strategy === 'keyword') {
    return typeof passage.relevance === 'number' ? passage.relevance : 0;
  }

  // Priority: lower numbers are higher priority, so invert for comparison
  const priority = typeof passage.priority === 'number' ? passage.priority : Infinity;
  return priority === Infinity ? 0 : 1 / (1 + priority);
}

function comparePassagesForPrompt(a, b, strategy) {
  const scoreA = getPrimaryScore(a, strategy);
  const scoreB = getPrimaryScore(b, strategy);
  if (scoreA !== scoreB) {
    return scoreB - scoreA;
  }

  const keywordA = typeof a.relevance === 'number' ? a.relevance : 0;
  const keywordB = typeof b.relevance === 'number' ? b.relevance : 0;
  if (keywordA !== keywordB) {
    return keywordB - keywordA;
  }

  const priorityA = typeof a.priority === 'number' ? a.priority : Infinity;
  const priorityB = typeof b.priority === 'number' ? b.priority : Infinity;
  if (priorityA !== priorityB) {
    return priorityA - priorityB;
  }

  return 0;
}

/**
 * Enhanced retrieval with quality filtering.
 * Builds on retrievePassages() but adds:
 * - Relevance scoring (keyword + semantic)
 * - Quality threshold filtering
 * - Deduplication
 *
 * @param {Object} graphKeys - Graph keys from buildGraphContext()
 * @param {Object} [options] - Retrieval options
 * @param {number} [options.maxPassages=5] - Maximum passages to return
 * @param {string} [options.userQuery=''] - User's question for relevance scoring
 * @param {number} [options.minRelevanceScore=0.3] - Minimum relevance to include
 * @param {boolean} [options.enableDeduplication=true] - Remove similar passages
 * @param {boolean} [options.enableSemanticScoring=false] - Use embeddings API
 * @param {Object} [options.env] - Environment variables for API calls
 * @returns {Promise<Array<Object>>} Quality-filtered, scored passages
 *
 * @example
 * const passages = await retrievePassagesWithQuality(
 *   themes.knowledgeGraph.graphKeys,
 *   {
 *     maxPassages: 5,
 *     userQuery: "What does this new chapter hold?",
 *     minRelevanceScore: 0.35,
 *     enableSemanticScoring: true
 *   }
 * );
 */
export async function retrievePassagesWithQuality(graphKeys, options = {}) {
  const {
    maxPassages = 5,
    userQuery = '',
    minRelevanceScore = 0.3,
    enableDeduplication = true,
    enableSemanticScoring = false,
    env = null
  } = options;

  // Check if quality filtering is disabled via env
  const disableQualityFiltering = env?.DISABLE_PROMPT_SLIMMING === 'true' ||
    env?.DISABLE_PROMPT_SLIMMING === true;

  // Get raw passages (retrieve 2x to allow for filtering, unless filtering disabled)
  const rawPassages = retrievePassages(graphKeys, {
    maxPassages: disableQualityFiltering ? maxPassages : maxPassages * 2,
    userQuery,
    includeMetadata: true
  });

  if (!rawPassages || rawPassages.length === 0) {
    return [];
  }

  // If quality filtering is disabled, return raw passages directly
  if (disableQualityFiltering) {
    return rawPassages.map(p => ({
      ...p,
      relevanceScore: 1.0, // Mark as fully relevant (no filtering applied)
      _qualityFilteringDisabled: true
    }));
  }

  // Score each passage for relevance
  const scoredPassages = await Promise.all(
    rawPassages.map(async (passage) => {
      const relevanceScore = await scorePassageRelevance(
        passage.text,
        userQuery,
        {
          enableSemanticScoring,
          env
        }
      );
      return {
        ...passage,
        relevanceScore,
        // Track whether semantic scoring was enabled for this retrieval
        _semanticScoringEnabled: enableSemanticScoring
      };
    })
  );

  // Filter by quality threshold
  let filtered = scoredPassages.filter(
    (p) => p.relevanceScore >= minRelevanceScore
  );

  // Deduplicate similar passages
  if (enableDeduplication) {
    filtered = deduplicatePassages(filtered);
  }

  // Sort by relevance score (highest first) and take top N
  const ranked = filtered
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, maxPassages);

  return ranked;
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
    semanticScoringUsed: false
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

    // Check if semantic scoring was enabled for any passage retrieval
    // Uses the _semanticScoringEnabled flag set by retrievePassagesWithQuality
    qualityMetrics.semanticScoringUsed = passages.some(
      (p) => p._semanticScoringEnabled === true
    );
  }

  return {
    ...baseSummary,
    qualityMetrics
  };
}

/**
 * Check if semantic scoring is available (API configured).
 *
 * @param {Object} [env] - Environment variables. Pass null to explicitly check without env.
 * @returns {boolean} True if semantic scoring can be used
 */
export function isSemanticScoringAvailable(env) {
  // If null is explicitly passed, don't fall back to process.env
  if (env === null) {
    return false;
  }
  
  const effectiveEnv = env || (typeof process !== 'undefined' && process.env ? process.env : {});
  return Boolean(effectiveEnv?.AZURE_OPENAI_ENDPOINT && effectiveEnv?.AZURE_OPENAI_API_KEY);
}
