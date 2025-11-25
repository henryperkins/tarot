// functions/lib/graphRAG.js
// GraphRAG (Graph-Enhanced Retrieval-Augmented Generation) for tarot readings
//
// This module implements a lightweight GraphRAG system that:
// 1. Takes graph keys from pattern detection (triads, dyads, journey stages)
// 2. Retrieves relevant passages from the curated knowledge base
// 3. Ranks and formats passages for injection into LLM prompts
//
// Architecture:
//   graphKeys → retrievePassages() → ranked passages → formatForPrompt()
//
// This is a **prototype** implementation using deterministic retrieval.
// Future enhancements could add:
// - Semantic similarity via embeddings
// - Dynamic passage generation
// - User feedback loop for passage quality

import {
  getPassagesForPattern,
  getKnowledgeBaseStats
} from './knowledgeBase.js';

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
 * @returns {boolean} True if GraphRAG should be used
 */
export function isGraphRAGEnabled() {
  if (typeof process === 'undefined' || !process.env) {
    return false;
  }

  // Check GRAPHRAG_ENABLED first (preferred), fall back to legacy KNOWLEDGE_GRAPH_ENABLED
  const envValue = process.env.GRAPHRAG_ENABLED ?? process.env.KNOWLEDGE_GRAPH_ENABLED;

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
