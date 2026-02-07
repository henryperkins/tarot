/**
 * Spread Analysis Orchestration
 *
 * Coordinates the comprehensive spread analysis pipeline:
 * 1. Theme analysis (suits, elements, reversals)
 * 2. Spread-specific position analysis
 * 3. GraphRAG passage retrieval
 * 4. Ephemeris integration
 *
 * Extracted from tarot-reading.js to maintain <900 line limit.
 */

import {
  analyzeSpreadThemes,
  analyzeCelticCross,
  analyzeThreeCard,
  analyzeFiveCard,
  analyzeRelationship,
  analyzeDecision
} from './spreadAnalysis.js';
import {
  fetchEphemerisContext,
  fetchEphemerisForecast,
  matchTransitsToCards,
  getEphemerisSummary
} from './ephemerisIntegration.js';
import { getSpreadKey } from './readingQuality.js';
import { resolveSemanticScoring } from './readingTelemetry.js';
import * as graphRAG from './graphRAG.js';
import { inferGraphRAGContext } from './contextDetection.js';
import { withSpan } from './tracingSpans.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Default fallback themes when analysis fails or input is invalid.
 */
const FALLBACK_THEMES = {
  suitCounts: {},
  elementCounts: {},
  reversalCount: 0,
  reversalFramework: 'contextual',
  reversalDescription: {
    name: 'Context-Dependent',
    description: 'Reversed cards are interpreted individually based on context.',
    guidance: 'Read each reversal in light of its position and relationships.'
  }
};

// ============================================================================
// Forecast Timeframe Detection
// ============================================================================

/**
 * Detect if user question asks about a future timeframe.
 *
 * Returns the number of forecast days to fetch based on temporal keywords:
 * - Season-level: 90 days
 * - Month-level: 30 days
 * - Week-level: 14 days
 *
 * @param {string} userQuestion - User's question text
 * @returns {number|null} Number of forecast days or null
 */
export function detectForecastTimeframe(userQuestion) {
  if (!userQuestion) return null;
  const q = userQuestion.toLowerCase();

  // Season-level (90 days)
  if (q.includes('season') || q.includes('next few months') ||
    q.includes('coming months') || q.includes('quarter')) {
    return 90;
  }

  // Month-level (30 days)
  if (q.includes('month') || q.includes('30 days') ||
    q.includes('next weeks') || q.includes('coming weeks')) {
    return 30;
  }

  // Week-level (14 days)
  if (q.includes('week') || q.includes('next few days')) {
    return 14;
  }

  return null;
}

// ============================================================================
// Ephemeris Client Payload
// ============================================================================

/**
 * Build a minimal, UI-friendly ephemeris payload.
 *
 * We intentionally do NOT ship full planet/aspect arrays to keep payload size small.
 *
 * @param {Object} ephemerisContext - Full ephemeris context from API
 * @returns {Object} Minimal client payload
 */
export function buildEphemerisClientPayload(ephemerisContext) {
  if (!ephemerisContext?.available) {
    return {
      available: false,
      error: ephemerisContext?.error || null,
      locationUsed: false
    };
  }

  const moon = ephemerisContext.moonPhase || null;
  const locationContext = ephemerisContext.locationContext || {};

  return {
    available: true,
    timestamp: ephemerisContext.timestamp || null,
    source: ephemerisContext.source || null,
    summary: getEphemerisSummary(ephemerisContext),
    moonPhase: moon ? {
      phaseName: moon.phaseName || null,
      illumination: typeof moon.illumination === 'number' ? moon.illumination : null,
      sign: moon.sign || null,
      isWaxing: typeof moon.isWaxing === 'boolean' ? moon.isWaxing : null,
      interpretation: moon.interpretation || null
    } : null,
    locationUsed: Boolean(locationContext.locationUsed),
    timezone: locationContext.timezone || 'UTC'
  };
}

/**
 * Build the client-facing spreadAnalysis payload.
 *
 * Standardizes the spread analysis structure with version info.
 * Used in response payloads for readings and streaming metadata.
 *
 * @param {Object} analysis - Analysis result from performSpreadAnalysis
 * @returns {Object} Client-facing spread analysis payload
 */
export function buildSpreadAnalysisPayload(analysis) {
  return {
    version: '1.0.0',
    spreadKey: analysis?.spreadKey || 'general',
    ...(analysis?.spreadAnalysis || {})
  };
}

// ============================================================================
// GraphRAG Placeholder Builder
// ============================================================================

/**
 * Build a placeholder GraphRAG payload when retrieval is disabled or fails.
 *
 * @param {Object} graphKeys - Graph pattern keys from theme analysis
 * @param {boolean} requestedSemanticScoring - Whether semantic scoring was requested
 * @param {boolean} enableSemanticScoring - Whether semantic scoring is available
 * @param {string} reason - Reason for placeholder (e.g., 'graphrag-disabled-env')
 * @returns {Object} Placeholder GraphRAG payload
 */
function buildGraphRAGPlaceholder(graphKeys, requestedSemanticScoring, enableSemanticScoring, reason) {
  const patternsDetected = {
    completeTriads: graphKeys?.completeTriadIds?.length || 0,
    partialTriads:
      (graphKeys?.triadIds?.length || 0) -
      (graphKeys?.completeTriadIds?.length || 0),
    foolsJourneyStage: graphKeys?.foolsJourneyStageKey || null,
    totalMajors: typeof graphKeys?.totalMajors === 'number' ? graphKeys.totalMajors : 0,
    singleMajor: Number.isInteger(graphKeys?.singleMajorNumber) ? 1 : 0,
    highDyads: graphKeys?.dyadPairs?.filter((d) => d.significance === 'high').length || 0,
    mediumHighDyads: graphKeys?.dyadPairs?.filter((d) => d.significance === 'medium-high').length || 0,
    strongSuitProgressions:
      graphKeys?.suitProgressions?.filter((p) => p.significance === 'strong-progression').length || 0,
    emergingSuitProgressions:
      graphKeys?.suitProgressions?.filter((p) => p.significance === 'emerging-progression').length || 0
  };

  const qualityMetrics = {
    averageRelevance: 0,
    minRelevance: 0,
    maxRelevance: 0,
    semanticScoringUsed: false,
    semanticScoringAttempted: false
  };

  return {
    passages: [],
    formattedBlock: null,
    retrievalSummary: {
      graphKeysProvided: Boolean(graphKeys),
      patternsDetected,
      passagesRetrieved: 0,
      passagesByType: {},
      passagesByPriority: {},
      semanticScoringRequested: requestedSemanticScoring,
      semanticScoringUsed: false,
      semanticScoringFallback: requestedSemanticScoring,
      semanticScoringAttempted: false,
      qualityMetrics,
      reason
    },
    maxPassages: 0,
    initialPassageCount: 0,
    rankingStrategy: null,
    enableSemanticScoring,
    qualityMetrics,
    semanticScoringRequested: requestedSemanticScoring,
    semanticScoringUsed: false,
    semanticScoringFallback: requestedSemanticScoring,
    semanticScoringAttempted: false
  };
}

// ============================================================================
// Main Orchestration Function
// ============================================================================

/**
 * Perform comprehensive spread analysis.
 *
 * Returns themes, spread-specific relationships, GraphRAG passages,
 * and ephemeris context for use in narrative generation.
 *
 * @param {Object} spreadInfo - Spread metadata
 * @param {Array} cardsInfo - Array of drawn cards
 * @param {Object} options - Analysis options
 * @param {string} options.reversalFrameworkOverride - Force specific reversal framework
 * @param {string} options.deckStyle - Deck style for card interpretation
 * @param {string} options.userQuestion - User's question text
 * @param {string} options.subscriptionTier - User's subscription tier
 * @param {Object} options.location - User's location for ephemeris
 * @param {boolean} options.enableSemanticScoring - Enable semantic GraphRAG scoring
 * @param {string} requestId - Request ID for logging
 * @param {Object} env - Cloudflare environment bindings
 * @returns {Promise<Object>} Analysis result with themes, spreadAnalysis, graphRAGPayload, ephemeris
 */
export async function performSpreadAnalysis(spreadInfo, cardsInfo, options = {}, requestId = 'unknown', env = null) {
  return withSpan('tarot.spreadAnalysis', {
    'tarot.request_id': requestId,
    'tarot.spread': spreadInfo?.name || 'unknown',
    'tarot.card_count': cardsInfo?.length || 0,
    'tarot.deck_style': options?.deckStyle || 'rws-1909',
  }, (span) => (
    performSpreadAnalysisInner(spreadInfo, cardsInfo, options, requestId, env, span)
  ));
}

async function performSpreadAnalysisInner(
  spreadInfo,
  cardsInfo,
  options = {},
  requestId = 'unknown',
  env = null,
  span
) {
  // Guard against malformed input (defensive: validatePayload should have run already)
  if (!spreadInfo || !Array.isArray(cardsInfo) || cardsInfo.length === 0) {
    console.warn(`[${requestId}] performSpreadAnalysis: missing or invalid spreadInfo/cardsInfo, falling back to generic themes only.`);
    return {
      themes: { ...FALLBACK_THEMES },
      spreadAnalysis: null,
      spreadKey: 'general'
    };
  }

  // Pass env through to options for API access in semantic scoring
  if (env && !options.env) {
    options.env = env;
  }

  // Apply semantic scoring config from environment if not already specified.
  // Preserve `undefined` so downstream GraphRAG auto-detection can kick in.
  if (options.enableSemanticScoring === undefined) {
    const resolvedSemanticScoring = resolveSemanticScoring(env, undefined);
    if (resolvedSemanticScoring !== undefined) {
      options.enableSemanticScoring = resolvedSemanticScoring;
    }
  }
  if (options.enableSemanticScoring === null) {
    options.enableSemanticScoring = undefined;
  }

  // =========================================================================
  // Step 1: Theme Analysis (suits, elements, majors, reversals)
  // =========================================================================
  let themes;
  try {
    console.log(`[${requestId}] Analyzing spread themes...`);
    themes = await analyzeSpreadThemes(cardsInfo, {
      reversalFrameworkOverride: options.reversalFrameworkOverride,
      deckStyle: options.deckStyle,
      userQuestion: options.userQuestion,
      env: options.env
    });
    console.log(`[${requestId}] Theme analysis complete:`, {
      suitCounts: themes.suitCounts,
      elementCounts: themes.elementCounts,
      reversalCount: themes.reversalCount,
      framework: themes.reversalFramework
    });

    // Enable symbol annotations for premium tiers (plus/pro)
    // Adds archetype and key visual symbols to position text
    const tier = options.subscriptionTier || 'free';
    if (tier === 'plus' || tier === 'pro') {
      themes.includeSymbols = true;
    }
  } catch (err) {
    console.error(`[${requestId}] performSpreadAnalysis: analyzeSpreadThemes failed, using minimal fallback themes.`, err);
    themes = { ...FALLBACK_THEMES };
  }

  // =========================================================================
  // Step 2: Spread-Specific Position Analysis
  // =========================================================================
  let spreadAnalysis = null;
  let spreadKey = 'general';
  let graphRAGPayload = null;

  try {
    spreadKey = getSpreadKey(spreadInfo.name, spreadInfo?.key || 'custom');
    console.log(`[${requestId}] Spread key identified: ${spreadKey}`);

    if (spreadKey === 'celtic' && cardsInfo.length === 10) {
      console.log(`[${requestId}] Performing Celtic Cross analysis...`);
      spreadAnalysis = analyzeCelticCross(cardsInfo);
      console.log(`[${requestId}] Celtic Cross analysis complete`);
    } else if (spreadKey === 'threeCard' && cardsInfo.length === 3) {
      console.log(`[${requestId}] Performing Three-Card analysis...`);
      spreadAnalysis = analyzeThreeCard(cardsInfo);
      console.log(`[${requestId}] Three-Card analysis complete`);
    } else if (spreadKey === 'fiveCard' && cardsInfo.length === 5) {
      console.log(`[${requestId}] Performing Five-Card analysis...`);
      spreadAnalysis = analyzeFiveCard(cardsInfo);
      console.log(`[${requestId}] Five-Card analysis complete`);
    } else if (spreadKey === 'relationship' && cardsInfo.length >= 3) {
      console.log(`[${requestId}] Performing Relationship analysis...`);
      spreadAnalysis = analyzeRelationship(cardsInfo);
      console.log(`[${requestId}] Relationship analysis complete`);
    } else if (spreadKey === 'decision' && cardsInfo.length === 5) {
      console.log(`[${requestId}] Performing Decision analysis...`);
      spreadAnalysis = analyzeDecision(cardsInfo);
      console.log(`[${requestId}] Decision analysis complete`);
    } else {
      console.log(`[${requestId}] No specific analysis for spreadKey: ${spreadKey} with ${cardsInfo.length} cards`);
    }
  } catch (err) {
    console.error(`[${requestId}] performSpreadAnalysis: spread-specific analysis failed, continuing with themes only.`, err);
    spreadAnalysis = null;
    spreadKey = 'general';
  }

  // =========================================================================
  // Step 3: GraphRAG Passage Retrieval
  // =========================================================================
  try {
    const graphKeys = themes?.knowledgeGraph?.graphKeys;
    if (graphKeys) {
      const questionContext = inferGraphRAGContext(options.userQuestion, spreadKey);
      const semanticAvailable = graphRAG.isSemanticScoringAvailable(options.env);
      const semanticScoringSetting = options.enableSemanticScoring;
      const isAutoSemanticScoring = semanticScoringSetting === undefined || semanticScoringSetting === null;
      const requestedSemanticScoring =
        semanticScoringSetting === true ||
        (isAutoSemanticScoring && semanticAvailable);
      const enableSemanticScoring = requestedSemanticScoring && semanticAvailable;

      if (requestedSemanticScoring && !semanticAvailable) {
        console.warn(
          `[${requestId}] Semantic scoring requested but embeddings are unavailable (missing AZURE_OPENAI_ENDPOINT/API_KEY); falling back to keyword scoring.`
        );
      }

      if (!graphRAG.isGraphRAGEnabled(options.env)) {
        graphRAGPayload = buildGraphRAGPlaceholder(graphKeys, requestedSemanticScoring, enableSemanticScoring, 'graphrag-disabled-env');
        themes.knowledgeGraph = themes.knowledgeGraph || { graphKeys: graphKeys || null };
        themes.knowledgeGraph.graphRAGPayload = graphRAGPayload;
      } else {
        // Pass subscription tier for tier-aware passage limits
        const tier = options.subscriptionTier || 'free';
        const maxPassages = graphRAG.getPassageCountForSpread(spreadKey || 'general', tier);
        console.log(`[${requestId}] GraphRAG passage limit: ${maxPassages} (tier: ${tier})`);

        let passages;
        let retrievalSummary;

        if (enableSemanticScoring) {
          // Use quality-aware retrieval with relevance scoring
          console.log(`[${requestId}] Using quality-aware GraphRAG retrieval with semantic scoring`);
          passages = await graphRAG.retrievePassagesWithQuality(graphKeys, {
            maxPassages,
            userQuery: options.userQuestion,
            questionContext,
            minRelevanceScore: 0.3,
            enableDeduplication: true,
            enableSemanticScoring: true,
            env: options.env
          });
          retrievalSummary = graphRAG.buildQualityRetrievalSummary(graphKeys, passages);

          // Log average relevance for monitoring
          if (retrievalSummary.qualityMetrics?.averageRelevance) {
            console.log(
              `[${requestId}] GraphRAG quality: ${passages.length} passages, avg relevance: ${(retrievalSummary.qualityMetrics.averageRelevance * 100).toFixed(1)}%`
            );
          }
        } else {
          // Fall back to standard retrieval (keyword-only)
          passages = graphRAG.retrievePassages(graphKeys, {
            maxPassages,
            userQuery: options.userQuestion,
            questionContext
          });
          retrievalSummary = graphRAG.buildRetrievalSummary(graphKeys, passages);
        }

        const semanticScoringUsed = retrievalSummary?.qualityMetrics?.semanticScoringUsed === true;
        const semanticScoringFallback = requestedSemanticScoring && !semanticScoringUsed;

        retrievalSummary = {
          ...retrievalSummary,
          semanticScoringRequested: requestedSemanticScoring,
          semanticScoringUsed,
          semanticScoringFallback
        };

        const formattedBlock = graphRAG.formatPassagesForPrompt(passages, {
          includeSource: true,
          markdown: true
        });

        graphRAGPayload = {
          passages,
          formattedBlock,
          retrievalSummary,
          maxPassages,
          initialPassageCount: passages.length,
          rankingStrategy: enableSemanticScoring ? 'semantic' : 'keyword',
          enableSemanticScoring,
          qualityMetrics: retrievalSummary.qualityMetrics || null,
          semanticScoringRequested: requestedSemanticScoring,
          semanticScoringUsed,
          semanticScoringFallback
        };

        // Make memoized payload discoverable to downstream consumers
        themes.knowledgeGraph = {
          ...(themes.knowledgeGraph || {}),
          graphRAGPayload
        };
      }
    } else {
      // No patterns detected but includeGraphRAG was expected; attach placeholder telemetry
      const requestedSemanticScoring = options.enableSemanticScoring === true;
      graphRAGPayload = buildGraphRAGPlaceholder(
        null,
        requestedSemanticScoring,
        Boolean(options.enableSemanticScoring),
        'missing-graph-keys'
      );
      themes.knowledgeGraph = themes.knowledgeGraph || { graphKeys: null };
      themes.knowledgeGraph.graphRAGPayload = graphRAGPayload;
      console.warn(`[${requestId}] GraphRAG skipped: no graph patterns detected for this spread.`);
    }
  } catch (err) {
    console.warn(`[${requestId}] performSpreadAnalysis: GraphRAG memoization failed: ${err.message}`);
  }

  // =========================================================================
  // Step 4: Ephemeris Integration
  // =========================================================================
  let ephemerisContext = null;
  let transitResonances = [];
  let ephemerisForecast = null;

  try {
    console.log(`[${requestId}] Fetching ephemeris context...`);
    ephemerisContext = await fetchEphemerisContext(null, { location: options.location });

    if (ephemerisContext?.available) {
      console.log(`[${requestId}] Ephemeris context available:`, getEphemerisSummary(ephemerisContext));

      // Match current transits to drawn cards
      transitResonances = matchTransitsToCards(cardsInfo, ephemerisContext);
      if (transitResonances.length > 0) {
        console.log(`[${requestId}] Found ${transitResonances.length} transit resonance(s)`);
      }

      // Check if question asks about future timeframe
      const forecastDays = detectForecastTimeframe(options.userQuestion);
      if (forecastDays) {
        console.log(`[${requestId}] Detected future timeframe, fetching ${forecastDays}-day forecast...`);
        ephemerisForecast = await fetchEphemerisForecast(forecastDays);
        if (ephemerisForecast?.available) {
          console.log(`[${requestId}] Forecast available: ${ephemerisForecast.events?.length || 0} events`);
        }
      }
    } else {
      console.log(`[${requestId}] Ephemeris context not available (server may not be running)`);
    }
  } catch (err) {
    console.warn(`[${requestId}] performSpreadAnalysis: Ephemeris fetch failed: ${err.message}`);
    ephemerisContext = { available: false, error: err.message };
  }

  if (spreadKey) {
    span.setAttribute('tarot.spread_key', spreadKey);
  }

  return {
    themes,
    spreadAnalysis,
    spreadKey,
    graphRAGPayload,
    ephemerisContext,
    ephemerisForecast,
    transitResonances
  };
}
