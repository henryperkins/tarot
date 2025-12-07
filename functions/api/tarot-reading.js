/**
 * Cloudflare Pages Function for generating a personalized tarot reading.
 *
 * Enhanced with authentic position-relationship analysis, elemental dignities,
 * and spread-specific narrative construction.
 *
 * Delegates narrative synthesis to Azure OpenAI GPT-5.1 via the Responses API
 * when AZURE_OPENAI_API_KEY / AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_GPT5_MODEL are configured.
 * Falls back to local deterministic composer with full analysis.
 */

// Import analysis and narrative building libraries
import {
  analyzeSpreadThemes,
  analyzeCelticCross,
  analyzeThreeCard,
  analyzeFiveCard,
  analyzeRelationship,
  analyzeDecision
} from '../lib/spreadAnalysis.js';

import {
  buildCelticCrossReading,
  buildThreeCardReading,
  buildFiveCardReading,
  buildRelationshipReading,
  buildDecisionReading,
  buildSingleCardReading,
  buildEnhancedClaudePrompt,
  buildPositionCardText,
  buildElementalRemedies,
  shouldOfferElementalRemedies,
  formatReversalLens,
  computeRemedyRotationIndex
} from '../lib/narrativeBuilder.js';
import { enhanceSection, validateReadingNarrative } from '../lib/narrativeSpine.js';
import { inferContext } from '../lib/contextDetection.js';
import { parseMinorName } from '../lib/minorMeta.js';
import { jsonResponse, readJsonBody } from '../lib/utils.js';
import { canonicalizeCardName, canonicalCardKey } from '../../shared/vision/cardNameMapping.js';
import { safeParseReadingRequest } from '../../shared/contracts/readingSchema.js';
import { verifyVisionProof } from '../lib/visionProof.js';
import {
  buildPromptEngineeringPayload,
  shouldPersistPrompts,
  redactPII
} from '../lib/promptEngineering.js';
import {
  scheduleEvaluation,
  runSyncEvaluationGate,
  generateSafeFallbackReading
} from '../lib/evaluation.js';
import { MAJOR_ARCANA } from '../../src/data/majorArcana.js';
import { MINOR_ARCANA } from '../../src/data/minorArcana.js';
import {
  fetchEphemerisContext,
  fetchEphemerisForecast,
  matchTransitsToCards,
  getEphemerisSummary
} from '../lib/ephemerisIntegration.js';
import { deriveEmotionalTone } from '../../src/data/emotionMapping.js';
import { normalizeVisionLabel } from '../lib/visionLabels.js';
import { getToneStyle, buildPersonalizedClosing, getDepthProfile } from '../lib/narrative/styleHelpers.js';
import { buildOpening } from '../lib/narrative/helpers.js';
import { detectCrisisSignals } from '../lib/safetyChecks.js';
import { collectGraphRAGAlerts } from '../lib/graphRAGAlerts.js';
import {
  escapeRegex,
  hasExplicitCardContext,
  normalizeCardName,
  AMBIGUOUS_CARD_NAMES,
  TAROT_TERMINOLOGY_EXCLUSIONS
} from '../lib/cardContextDetection.js';
import { getUserFromRequest } from '../lib/auth.js';

// Detect if question asks about future timeframe
function detectForecastTimeframe(userQuestion) {
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

const SPREAD_NAME_MAP = {
  'Celtic Cross (Classic 10-Card)': { key: 'celtic', count: 10 },
  'Three-Card Story (Past · Present · Future)': { key: 'threeCard', count: 3 },
  'Five-Card Clarity': { key: 'fiveCard', count: 5 },
  'One-Card Insight': { key: 'single', count: 1 },
  'Relationship Snapshot': { key: 'relationship', count: 3 },
  'Decision / Two-Path': { key: 'decision', count: 5 }
};

const CARD_NAME_PATTERNS = [...MAJOR_ARCANA, ...MINOR_ARCANA]
  .map((card) => card.name)
  .map((name) => ({
    name,
    normalized: normalizeCardName(name),
    pattern: new RegExp(`\\b${escapeRegex(name)}\\b`, 'i')
  }));

const CARD_NAMES_REQUIRING_CARD_CASE = new Set(
  MAJOR_ARCANA
    .map((card) => normalizeCardName(card.name))
    .filter((name) => name.startsWith('the ') || name === 'wheel of fortune')
);
const CARD_NAME_STOP_WORDS = new Set(['the', 'of']);

function trimForTelemetry(text = '', limit = 500) {
  if (!text || typeof text !== 'string') return '';
  const trimmed = text.trim();
  return trimmed.length > limit ? `${trimmed.slice(0, limit)}...` : trimmed;
}

function getSpreadDefinition(spreadName) {
  return SPREAD_NAME_MAP[spreadName] || null;
}

function getExpectedCardCount(spreadName) {
  const def = getSpreadDefinition(spreadName);
  return def?.count ?? null;
}

function getSpreadKey(spreadName) {
  const def = getSpreadDefinition(spreadName);
  return def?.key || 'general';
}

function requiresHighReasoningEffort(modelName = '') {
  const normalized = modelName.toLowerCase();
  return normalized.includes('gpt-5-pro') || normalized.includes('gpt-5.1');
}

const NARRATIVE_BACKEND_ORDER = ['azure-gpt5', 'claude-sonnet45', 'local-composer'];

const NARRATIVE_BACKENDS = {
  'azure-gpt5': {
    id: 'azure-gpt5',
    label: 'Azure GPT-5 Responses',
    isAvailable: (env) => Boolean(env?.AZURE_OPENAI_API_KEY && env?.AZURE_OPENAI_ENDPOINT && env?.AZURE_OPENAI_GPT5_MODEL)
  },
  'claude-sonnet45': {
    id: 'claude-sonnet45',
    label: 'Claude Opus 4.5 (Azure Foundry)',
    // Uses Azure AI Foundry Anthropic endpoint - may use separate API key
    isAvailable: (env) => Boolean(
      (env?.AZURE_ANTHROPIC_API_KEY || env?.AZURE_OPENAI_API_KEY) &&
      env?.AZURE_ANTHROPIC_ENDPOINT
    )
  },
  'local-composer': {
    id: 'local-composer',
    label: 'Local Narrative Composer',
    isAvailable: () => true
  }
};

function getAvailableNarrativeBackends(env) {
  return NARRATIVE_BACKEND_ORDER
    .map((id) => {
      const backend = NARRATIVE_BACKENDS[id];
      if (!backend) return null;
      if (!backend.isAvailable(env)) return null;
      return backend;
    })
    .filter(Boolean);
}

function normalizeBooleanFlag(value) {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null) return false;
  return String(value).toLowerCase() === 'true';
}

function shouldLogLLMPrompts(env) {
  if (!env) return false;

  // SECURITY: Block prompt logging in production to prevent PII leaks
  // Production is detected via the Pages production branch or explicit prod env flags
  const normalizedBranch = (env.CF_PAGES_BRANCH || '').toLowerCase();
  const prodBranches = new Set(['main', 'master']);
  if (env.CF_PAGES_BRANCH_PRODUCTION) {
    prodBranches.add(String(env.CF_PAGES_BRANCH_PRODUCTION).toLowerCase());
  }
  const isProdBranch = normalizedBranch && prodBranches.has(normalizedBranch);

  const isProd =
    isProdBranch ||
    env.NODE_ENV === 'production' ||
    env.ENVIRONMENT === 'production';

  if (isProd) {
    return false;
  }

  if (env.LOG_LLM_PROMPTS !== undefined) return normalizeBooleanFlag(env.LOG_LLM_PROMPTS);
  if (env.DEBUG_LLM_PROMPTS !== undefined) return normalizeBooleanFlag(env.DEBUG_LLM_PROMPTS);
  if (env.DEBUG_PROMPTS !== undefined) return normalizeBooleanFlag(env.DEBUG_PROMPTS);
  return false;
}

function shouldLogNarrativeEnhancements(env) {
  if (!env) return false;
  if (env.LOG_NARRATIVE_ENHANCEMENTS !== undefined) {
    return normalizeBooleanFlag(env.LOG_NARRATIVE_ENHANCEMENTS);
  }
  if (env.DEBUG_NARRATIVE_ENHANCEMENTS !== undefined) {
    return normalizeBooleanFlag(env.DEBUG_NARRATIVE_ENHANCEMENTS);
  }
  return false;
}

function shouldLogEnhancementTelemetry(env) {
  if (!env) return false;
  if (env.LOG_ENHANCEMENT_TELEMETRY !== undefined) {
    return normalizeBooleanFlag(env.LOG_ENHANCEMENT_TELEMETRY);
  }
  if (env.DEBUG_ENHANCEMENT_TELEMETRY !== undefined) {
    return normalizeBooleanFlag(env.DEBUG_ENHANCEMENT_TELEMETRY);
  }
  return false;
}

/**
 * Determine if semantic scoring should be enabled for GraphRAG retrieval.
 * Defaults to true if the embeddings API is configured, but can be
 * explicitly disabled via environment variable.
 *
 * @param {Object} env - Environment variables
 * @returns {boolean|null} - true/false for explicit config, null for auto-detect
 */
function getSemanticScoringConfig(env) {
  if (!env) return null;

  // Check explicit override
  if (env.ENABLE_SEMANTIC_SCORING !== undefined) {
    return normalizeBooleanFlag(env.ENABLE_SEMANTIC_SCORING);
  }
  if (env.GRAPHRAG_SEMANTIC_SCORING !== undefined) {
    return normalizeBooleanFlag(env.GRAPHRAG_SEMANTIC_SCORING);
  }

  // Return null to let auto-detection based on API availability
  return null;
}

function summarizeNarrativeEnhancements(sections = []) {
  if (!Array.isArray(sections) || sections.length === 0) {
    return null;
  }

  const summary = {
    totalSections: sections.length,
    enhancedSections: 0,
    enhancementCounts: {},
    sectionTypes: {},
    sectionNames: [],
    missingCounts: {},
    totalEnhancements: 0,
    sections: []
  };

  sections.forEach((section, index) => {
    const metadata = section?.metadata || {};
    const validation = section?.validation || {};
    const type =
      metadata.type ||
      metadata.section ||
      `section-${index + 1}`;
    const name =
      metadata.name ||
      metadata.label ||
      metadata.title ||
      type;

    const enhanced = Boolean(validation?.enhanced);
    const enhancements = Array.isArray(validation?.enhancements)
      ? validation.enhancements
      : [];
    const missing = Array.isArray(validation?.missing)
      ? validation.missing
      : [];
    const present = validation?.present || {};

    if (!summary.sectionTypes[type]) {
      summary.sectionTypes[type] = { total: 0, enhanced: 0 };
    }
    summary.sectionTypes[type].total += 1;
    if (enhanced) {
      summary.enhancedSections += 1;
      summary.sectionTypes[type].enhanced += 1;
    }

    enhancements.forEach((tag) => {
      if (!tag) return;
      summary.enhancementCounts[tag] =
        (summary.enhancementCounts[tag] || 0) + 1;
    });

    summary.totalEnhancements += enhancements.length;
    summary.sectionNames.push(name);

    missing.forEach((key) => {
      if (!key) return;
      summary.missingCounts[key] = (summary.missingCounts[key] || 0) + 1;
    });

    summary.sections.push({
      type,
      name,
      enhanced,
      enhancements,
      missing,
      present
    });
  });

  return summary;
}

export { summarizeNarrativeEnhancements };

function maybeLogNarrativeEnhancements(env, requestId, provider, summary) {
  if (!shouldLogNarrativeEnhancements(env) || !summary) return;
  console.log(`[${requestId}] [${provider}] Narrative enhancement summary:`, summary);
}

function redactPromptSegment(text, personalization) {
  if (!text || typeof text !== 'string') return text;
  const displayName = personalization?.displayName;
  if (!displayName || typeof displayName !== 'string') return text;
  const trimmed = displayName.trim();
  if (!trimmed) return text;
  try {
    const matcher = new RegExp(escapeRegex(trimmed), 'gi');
    return text.replace(matcher, '[REDACTED_NAME]');
  } catch {
    return text;
  }
}

function maybeLogPromptPayload(env, requestId, backendLabel, systemPrompt, userPrompt, promptMeta, options = {}) {
  if (!shouldLogLLMPrompts(env)) return;

  // SECURITY: Use comprehensive PII redaction for all prompt logging
  // This includes email, phone, SSN, credit card, dates, URLs, IP addresses,
  // and any user-provided display name
  const personalization = options.personalization || null;
  const redactionOptions = {
    displayName: personalization?.displayName
  };

  const redactedSystem = redactPII(systemPrompt, redactionOptions);
  const redactedUser = redactPII(userPrompt, redactionOptions);

  console.log(`[${requestId}] [${backendLabel}] === SYSTEM PROMPT BEGIN ===`);
  console.log(redactedSystem);
  console.log(`[${requestId}] [${backendLabel}] === SYSTEM PROMPT END ===`);

  console.log(`[${requestId}] [${backendLabel}] === USER PROMPT BEGIN ===`);
  console.log(redactedUser);
  console.log(`[${requestId}] [${backendLabel}] === USER PROMPT END ===`);

  // Only log estimated tokens when slimming is enabled (estimation is skipped otherwise)
  // Actual token counts are logged from llmUsage after API response
  if (promptMeta?.estimatedTokens) {
    const { total, system, user, budget } = promptMeta.estimatedTokens;
    const budgetNote = budget ? ` / budget ${budget}` : '';
    console.log(`[${requestId}] [${backendLabel}] Estimated tokens (slimming enabled): total ${total} (system ${system} + user ${user})${budgetNote}`);
  }
}

function maybeLogEnhancementTelemetry(env, requestId, telemetry) {
  if (!shouldLogEnhancementTelemetry(env)) return;
  if (!telemetry) return;

  const summary = telemetry.summary || telemetry;
  console.log(
    `[${requestId}] [enhancement-telemetry] sections=${summary.totalSections || 0}, enhanced=${summary.enhancedSections || 0}, tags=${summary.totalEnhancements || 0}`
  );

  if (summary.enhancementCounts && Object.keys(summary.enhancementCounts).length > 0) {
    console.log(`[${requestId}] [enhancement-telemetry] enhancementCounts`, summary.enhancementCounts);
  }
}

export const onRequestGet = async ({ env }) => {
  // Health check endpoint
  return jsonResponse({
    status: 'ok',
    provider: env?.AZURE_OPENAI_GPT5_MODEL ? 'azure-gpt5' : 'local',
    timestamp: new Date().toISOString()
  });
};

export const onRequestPost = async ({ request, env, waitUntil }) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID ? crypto.randomUUID() : `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  console.log(`[${requestId}] === TAROT READING REQUEST START ===`);

  try {
    console.log(`[${requestId}] Reading request body...`);
    const payload = await readJsonBody(request);
    const schemaResult = safeParseReadingRequest(payload);
    if (!schemaResult.success) {
      console.error(`[${requestId}] Schema validation failed: ${schemaResult.error}`);
      return jsonResponse(
        { error: schemaResult.error || 'Invalid reading request payload.' },
        { status: 400 }
      );
    }

    const normalizedPayload = schemaResult.data;
    const {
      spreadInfo,
      cardsInfo,
      userQuestion,
      reflectionsText,
      reversalFrameworkOverride,
      visionProof,
      deckStyle: requestDeckStyle,
      personalization
    } = normalizedPayload;
    const deckStyle = requestDeckStyle || spreadInfo?.deckStyle || 'rws-1909';

    console.log(`[${requestId}] Payload parsed:`, {
      spreadName: spreadInfo?.name,
      cardCount: cardsInfo?.length,
      hasQuestion: !!userQuestion,
      hasReflections: !!reflectionsText,
      reversalOverride: reversalFrameworkOverride,
      deckStyle,
      hasVisionProof: !!visionProof,
      hasPersonalization: Boolean(personalization)
    });

    const validationError = validatePayload(normalizedPayload);
    if (validationError) {
      console.error(`[${requestId}] Validation failed:`, validationError);
      return jsonResponse(
        { error: validationError },
        { status: 400 }
      );
    }
    console.log(`[${requestId}] Payload validation passed`);

    // Vision validation is OPTIONAL - used for research/development purposes only
    let sanitizedVisionInsights = [];
    let visionMetrics = null;

    if (!visionProof) {
      console.log(`[${requestId}] No vision proof provided (research mode disabled). Proceeding with standard reading.`);
    } else {
      // Research mode: Verify vision proof and collect telemetry
      console.log(`[${requestId}] Vision proof provided - validating for research telemetry...`);

      let verifiedProof;
      try {
        verifiedProof = await verifyVisionProof(visionProof, env?.VISION_PROOF_SECRET);
      } catch (err) {
        console.warn(`[${requestId}] Vision proof verification failed: ${err.message}`);
        const status = /expired/i.test(err.message) ? 409 : 400;
        return jsonResponse(
          { error: err.message || 'Vision validation proof invalid. Please re-upload your photos.' },
          { status }
        );
      }

      if (verifiedProof.deckStyle && verifiedProof.deckStyle !== deckStyle) {
        console.warn(`[${requestId}] Vision proof deck mismatch. proof=${verifiedProof.deckStyle}, request=${deckStyle}`);
      }

      sanitizedVisionInsights = annotateVisionInsights(verifiedProof.insights, cardsInfo, deckStyle);

      if (sanitizedVisionInsights.length === 0) {
        console.warn(`[${requestId}] Vision proof did not contain recognizable cards. Proceeding without vision data.`);
      } else {
        const avgConfidence = sanitizedVisionInsights.reduce((sum, item) => sum + (item.confidence ?? 0), 0) / sanitizedVisionInsights.length;
        const mismatchedDetections = sanitizedVisionInsights.filter((item) => item.matchesDrawnCard === false);
        visionMetrics = buildVisionMetrics(sanitizedVisionInsights, avgConfidence, mismatchedDetections.length);
        console.log(`[${requestId}] Vision proof verified: ${sanitizedVisionInsights.length} uploads, avg confidence ${(avgConfidence * 100).toFixed(1)}%.`);

        if (mismatchedDetections.length > 0) {
          console.warn(`[${requestId}] Vision uploads that do not match selected cards:`, mismatchedDetections.map((item) => ({ label: item.label, predictedCard: item.predictedCard, confidence: item.confidence })));
          // In research mode, log mismatches but don't block the reading
          console.log(`[${requestId}] Research mode: Continuing despite vision mismatches for data collection.`);
        }
      }
    }


    // Get user subscription tier for feature gating
    const user = await getUserFromRequest(request, env);
    const subscriptionTier = user?.subscription_tier || 'free';
    console.log(`[${requestId}] User subscription tier: ${subscriptionTier}`);

    // STEP 1: Comprehensive spread analysis
    console.log(`[${requestId}] Starting spread analysis...`);
    const analysisStart = Date.now();
    const analysis = await performSpreadAnalysis(spreadInfo, cardsInfo, {
      reversalFrameworkOverride,
      deckStyle,
      userQuestion,
      subscriptionTier
    }, requestId, env);
    const analysisTime = Date.now() - analysisStart;
    console.log(`[${requestId}] Spread analysis completed in ${analysisTime}ms:`, {
      spreadKey: analysis.spreadKey,
      hasSpreadAnalysis: !!analysis.spreadAnalysis,
      reversalCount: analysis.themes?.reversalCount,
      reversalFramework: analysis.themes?.reversalFramework
    });

    const contextDiagnostics = [];
    const context = inferContext(userQuestion, analysis.spreadKey, {
      onUnknown: (message) => contextDiagnostics.push(message)
    });
    console.log(`[${requestId}] Context inferred: ${context}`);

    const crisisCheck = detectCrisisSignals([userQuestion, reflectionsText].filter(Boolean).join(' '));
    if (crisisCheck.matched) {
      const crisisReason = `crisis_${crisisCheck.categories.join('_') || 'safety'}`;
      const crisisMessage = `Crisis/health safety gate triggered (${crisisCheck.categories.join(', ') || 'unclassified'})`;
      contextDiagnostics.push(crisisMessage);
      console.warn(`[${requestId}] ${crisisMessage}; matches: ${crisisCheck.matches.join('; ')}`);

      const graphRAGStats = analysis.graphRAGPayload?.retrievalSummary || null;
      const narrativeMetrics = {
        spine: { isValid: false, totalSections: 0, completeSections: 0, incompleteSections: 0, suggestions: [] },
        cardCoverage: 0,
        missingCards: (cardsInfo || []).map((c) => c?.card).filter(Boolean),
        hallucinatedCards: []
      };

      const timestamp = new Date().toISOString();
      const metricsPayload = {
        requestId,
        timestamp,
        provider: 'safe-fallback',
        deckStyle,
        spreadKey: analysis.spreadKey,
        context,
        vision: null,
        narrative: narrativeMetrics,
        narrativeEnhancements: null,
        graphRAG: graphRAGStats,
        promptMeta: null,
        enhancementTelemetry: null,
        contextDiagnostics: {
          messages: contextDiagnostics,
          count: contextDiagnostics.length
        },
        promptEngineering: null,
        llmUsage: null,
        evalGate: { ran: false, blocked: true, reason: crisisReason }
      };

      await persistReadingMetrics(env, metricsPayload);

      const emotionalTone = deriveEmotionalTone(analysis.themes);

      return jsonResponse({
        reading: generateSafeFallbackReading({
          spreadKey: analysis.spreadKey,
          cardCount: cardsInfo.length,
          reason: crisisReason
        }),
        provider: 'safe-fallback',
        requestId,
        themes: analysis.themes,
        emotionalTone,
        context,
        contextDiagnostics,
        narrativeMetrics,
        graphRAG: graphRAGStats,
        spreadAnalysis: {
          version: '1.0.0',
          spreadKey: analysis.spreadKey,
          ...(analysis.spreadAnalysis || {})
        },
        gateBlocked: true,
        gateReason: crisisReason
      });
    }

    // STEP 2: Generate reading via configured narrative backends
    const narrativePayload = {
      spreadInfo,
      cardsInfo,
      userQuestion,
      reflectionsText,
      analysis,
      context,
      contextDiagnostics,
      visionInsights: sanitizedVisionInsights,
      deckStyle,
      personalization: personalization || null,
      subscriptionTier,
      narrativeEnhancements: [],
      graphRAGPayload: analysis.graphRAGPayload || null,
      promptMeta: null
    };

    let reading = null;
    let provider = 'local-composer';
    let acceptedQualityMetrics = null; // Store metrics from successful backend to avoid recomputation
    const backendErrors = [];
    const candidateBackends = getAvailableNarrativeBackends(env);
    const backendsToTry = candidateBackends.length ? candidateBackends : [NARRATIVE_BACKENDS['local-composer']];

    // Track captured prompts for engineering persistence
    let capturedPrompts = null;
    let capturedUsage = null;

    for (const backend of backendsToTry) {
      const attemptStart = Date.now();
      console.log(`[${requestId}] Attempting narrative backend ${backend.id} (${backend.label})...`);
      narrativePayload.narrativeEnhancements = [];
      narrativePayload.promptMeta = null;
      try {
        const backendResult = await runNarrativeBackend(backend.id, env, narrativePayload, requestId);

        // Extract reading and prompts from result
        const result = typeof backendResult === 'object' && backendResult.reading
          ? backendResult.reading
          : backendResult;

        if (!result || !result.toString().trim()) {
          throw new Error('Backend returned empty narrative.');
        }

        // Capture prompts if available
        if (typeof backendResult === 'object' && backendResult.prompts) {
          capturedPrompts = backendResult.prompts;
          capturedUsage = backendResult.usage;
        }

        const graphRAGAlerts = collectGraphRAGAlerts(narrativePayload.promptMeta || {});
        if (graphRAGAlerts.length) {
          graphRAGAlerts.forEach((msg) => console.warn(`[${requestId}] [${backend.id}] ${msg}`));
          narrativePayload.contextDiagnostics = Array.from(new Set([...(narrativePayload.contextDiagnostics || []), ...graphRAGAlerts]));
        }

        // Quality gate: validate narrative structure and content before accepting
        const qualityMetrics = buildNarrativeMetrics(result, cardsInfo, deckStyle);
        const qualityIssues = [];

        // Check for hallucinated cards (allow up to 2 for natural LLM comparisons)
        // Only fail if excessive hallucinations suggest model is off-track
        const maxAllowedHallucinations = Math.max(2, Math.floor(cardsInfo.length / 2));
        if (qualityMetrics.hallucinatedCards && qualityMetrics.hallucinatedCards.length > maxAllowedHallucinations) {
          qualityIssues.push(`excessive hallucinated cards (${qualityMetrics.hallucinatedCards.length}): ${qualityMetrics.hallucinatedCards.join(', ')}`);
        } else if (qualityMetrics.hallucinatedCards?.length > 0) {
          // Log but don't fail for minor hallucinations (comparisons/examples)
          console.log(`[${requestId}] Minor hallucinations (allowed): ${qualityMetrics.hallucinatedCards.join(', ')}`);
        }

        // Check card coverage (at least 50% of cards should be mentioned)
        if (qualityMetrics.cardCoverage < 0.5) {
          qualityIssues.push(`low card coverage: ${(qualityMetrics.cardCoverage * 100).toFixed(0)}%`);
        }

        // Enforce spine completeness beyond mere section presence
        const spine = qualityMetrics.spine || null;
        if (spine && spine.totalSections > 0 && spine.isValid === false) {
          qualityIssues.push(`incomplete spine (${spine.completeSections || 0}/${spine.totalSections})`);
        }

        // Check narrative has at least one section (basic structure validation)
        if (qualityMetrics.spine && qualityMetrics.spine.totalSections === 0) {
          qualityIssues.push('no narrative sections detected');
        }

        if (qualityIssues.length > 0) {
          console.warn(`[${requestId}] Backend ${backend.id} failed quality gate: ${qualityIssues.join('; ')}`);
          throw new Error(`Narrative failed quality checks: ${qualityIssues.join('; ')}`);
        }

        reading = result;
        provider = backend.id;
        acceptedQualityMetrics = qualityMetrics; // Store for reuse in response
        console.log(`[${requestId}] Backend ${backend.id} succeeded in ${Date.now() - attemptStart}ms, reading length: ${reading.length}, coverage: ${(qualityMetrics.cardCoverage * 100).toFixed(0)}%`);
        break;
      } catch (err) {
        backendErrors.push({ backend: backend.id, error: err.message });
        console.error(`[${requestId}] Backend ${backend.id} failed:`, err.message);
      }
    }

    if (!reading) {
      console.error(`[${requestId}] All narrative backends failed.`, backendErrors);
      return jsonResponse(
        { error: 'All narrative providers are currently unavailable. Please try again shortly.' },
        { status: 503 }
      );
    }

    // STEP 3: Return structured response with server-centric analysis
    // - spreadAnalysis: canonical source for patterns/highlights
    // - themes: shared thematic summary
    // Frontend should trust these when present, and only fall back locally if missing.
    const totalTime = Date.now() - startTime;
    console.log(`[${requestId}] Request completed successfully in ${totalTime}ms using provider: ${provider}`);
    console.log(`[${requestId}] === TAROT READING REQUEST END ===`);

    const narrativeEnhancementSummary = summarizeNarrativeEnhancements(
      Array.isArray(narrativePayload.narrativeEnhancements)
        ? narrativePayload.narrativeEnhancements
        : []
    );
    maybeLogNarrativeEnhancements(env, requestId, provider, narrativeEnhancementSummary);
    const enhancementSections = (narrativePayload.narrativeEnhancements || []).map((section, index) => ({
      name: section?.metadata?.name || section?.metadata?.type || `section-${index + 1}`,
      type: section?.metadata?.type || null,
      text: trimForTelemetry(section?.text, 500),
      validation: section?.validation || null
    }));

    const enhancementTelemetry = narrativeEnhancementSummary
      ? { summary: narrativeEnhancementSummary, sections: enhancementSections }
      : null;

    const promptMeta = narrativePayload.promptMeta || null;
    const promptTokens = promptMeta?.estimatedTokens || null;
    const promptSlimming = promptMeta?.slimmingSteps || [];
    const graphRAGStats = analysis.graphRAGPayload?.retrievalSummary || null;
    const diagnosticsPayload = {
      messages: contextDiagnostics,
      count: contextDiagnostics.length
    };

    // Reuse quality metrics from the successful backend (computed during quality gate)
    // to avoid redundant computation
    const baseNarrativeMetrics = acceptedQualityMetrics || buildNarrativeMetrics(reading, cardsInfo, deckStyle);
    const narrativeMetrics = {
      ...baseNarrativeMetrics,
      enhancementTelemetry,
      promptTokens,
      promptSlimming,
      graphRAG: graphRAGStats,
      contextDiagnostics: diagnosticsPayload
    };

    // EVALUATION GATE: When EVAL_GATE_ENABLED=true, run synchronous evaluation
    // and block harmful readings before they reach the user
    let evalGateResult = null;
    let wasGateBlocked = false;

    const evalParams = {
      reading,
      userQuestion,
      cardsInfo,
      spreadKey: analysis.spreadKey,
      requestId
    };

    const gateResult = await runSyncEvaluationGate(
      env,
      evalParams,
      baseNarrativeMetrics
    );

    evalGateResult = gateResult;

    if (!gateResult.passed) {
      // Gate blocked the reading - generate safe fallback
      wasGateBlocked = true;
      console.warn(`[${requestId}] Evaluation gate blocked reading, using safe fallback`);

      reading = generateSafeFallbackReading({
        spreadKey: analysis.spreadKey,
        cardCount: cardsInfo.length,
        reason: gateResult.gateResult?.reason
      });
      provider = 'safe-fallback';

      // Log the blocked event for monitoring
      if (env.METRICS_DB?.put) {
        try {
          const blockEvent = {
            type: 'gate_block',
            requestId,
            timestamp: new Date().toISOString(),
            reason: gateResult.gateResult?.reason,
            spreadKey: analysis.spreadKey,
            evalMode: gateResult.evalResult?.mode || 'model',
            evalLatencyMs: gateResult.latencyMs,
            scores: gateResult.evalResult?.scores
          };
          await env.METRICS_DB.put(`block:${requestId}`, JSON.stringify(blockEvent), {
            metadata: {
              type: 'gate_block',
              reason: gateResult.gateResult?.reason,
              timestamp: blockEvent.timestamp
            }
          });
        } catch (err) {
          console.warn(`[${requestId}] Failed to log gate block event: ${err.message}`);
        }
      }
    }

    // Build prompt engineering payload if prompts were captured
    let promptEngineering = null;
    if (capturedPrompts && shouldPersistPrompts(env)) {
      try {
        promptEngineering = await buildPromptEngineeringPayload({
          systemPrompt: capturedPrompts.system,
          userPrompt: capturedPrompts.user,
          response: reading,
          redactionOptions: {
            displayName: personalization?.displayName
          }
        });
      } catch (err) {
        console.warn(`[${requestId}] Failed to build prompt engineering payload: ${err.message}`);
      }
    }

    const timestamp = new Date().toISOString();

    // Token counts: use actual values from API response (authoritative)
    // promptMeta.estimatedTokens is only present when slimming is enabled
    const tokens = capturedUsage ? {
      input: capturedUsage.input_tokens,
      output: capturedUsage.output_tokens,
      total: capturedUsage.total_tokens || (capturedUsage.input_tokens + capturedUsage.output_tokens),
      source: 'api'  // Authoritative: from model's native tokenizer
    } : null;

    const metricsPayload = {
      requestId,
      timestamp,
      provider,
      deckStyle,
      spreadKey: analysis.spreadKey,
      context,
      // Token usage from API response (authoritative - uses model's native tokenizer)
      tokens,
      vision: visionMetrics,
      narrative: narrativeMetrics,
      narrativeEnhancements: narrativeEnhancementSummary,
      graphRAG: graphRAGStats,
      // promptMeta.estimatedTokens only present when ENABLE_PROMPT_SLIMMING=true
      promptMeta,
      enhancementTelemetry,
      contextDiagnostics: diagnosticsPayload,
      promptEngineering,
      // Raw API usage data (kept for backwards compatibility)
      llmUsage: capturedUsage,
      // Gate evaluation result (if gate was run)
      evalGate: evalGateResult ? {
        ran: true,
        passed: evalGateResult.passed,
        reason: evalGateResult.gateResult?.reason,
        latencyMs: evalGateResult.latencyMs,
        blocked: wasGateBlocked
      } : { ran: false }
    };

    await persistReadingMetrics(env, metricsPayload);

    const gateEval = evalGateResult?.evalResult || null;
    const allowAsyncRetry = gateEval
      ? (gateEval.mode === 'heuristic' || gateEval.error)
      : false;

    scheduleEvaluation(
      env,
      evalParams,
      metricsPayload,
      {
        waitUntil,
        precomputedEvalResult: gateEval,
        allowAsyncRetry
      }
    );

    maybeLogEnhancementTelemetry(env, requestId, enhancementTelemetry);

    // Derive emotional tone from GraphRAG patterns for TTS
    const emotionalTone = deriveEmotionalTone(analysis.themes);

    return jsonResponse({
      reading,
      provider,
      requestId,
      backendErrors: backendErrors.length > 0 ? backendErrors : undefined,
      themes: analysis.themes,
      emotionalTone,
      context,
      contextDiagnostics,
      narrativeMetrics,
      graphRAG: graphRAGStats,
      spreadAnalysis: {
        // Normalize top-level metadata for all spreads
        version: '1.0.0',
        spreadKey: analysis.spreadKey,
        // For spreads where analyzeX already returns normalized shape, prefer it directly
        ...(analysis.spreadAnalysis || {})
      },
      // Include gate status when reading was blocked and replaced
      ...(wasGateBlocked ? {
        gateBlocked: true,
        gateReason: evalGateResult?.gateResult?.reason
      } : {})
    });
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[${requestId}] FATAL ERROR after ${totalTime}ms:`, {
      error: error.message,
      stack: error.stack,
      name: error.name
    });
    console.log(`[${requestId}] === TAROT READING REQUEST END (ERROR) ===`);

    return jsonResponse(
      { error: 'Failed to generate reading.' },
      { status: 500 }
    );
  }
};

/**
 * Perform comprehensive spread analysis
 * Returns themes, spread-specific relationships, and elemental insights
 */
async function performSpreadAnalysis(spreadInfo, cardsInfo, options = {}, requestId = 'unknown', env = null) {
  // Guard against malformed input (defensive: validatePayload should have run already)
  if (!spreadInfo || !Array.isArray(cardsInfo) || cardsInfo.length === 0) {
    console.warn(`[${requestId}] performSpreadAnalysis: missing or invalid spreadInfo/cardsInfo, falling back to generic themes only.`);
    return {
      themes: { suitCounts: {}, elementCounts: {}, reversalCount: 0, reversalFramework: 'contextual', reversalDescription: { name: 'Context-Dependent', description: 'Reversed cards are interpreted individually based on context.', guidance: 'Read each reversal in light of its position and relationships.' } },
      spreadAnalysis: null,
      spreadKey: 'general'
    };
  }

  // Pass env through to options for API access in semantic scoring
  if (env && !options.env) {
    options.env = env;
  }

  // Apply semantic scoring config from environment
  const semanticScoringConfig = env ? getSemanticScoringConfig(env) : null;
  if (semanticScoringConfig !== null && options.enableSemanticScoring === undefined) {
    options.enableSemanticScoring = semanticScoringConfig;
  }

  // Theme analysis (suits, elements, majors, reversals)
  let themes;
  try {
    console.log(`[${requestId}] Analyzing spread themes...`);
    themes = await analyzeSpreadThemes(cardsInfo, {
      reversalFrameworkOverride: options.reversalFrameworkOverride,
      deckStyle: options.deckStyle,
      userQuestion: options.userQuestion
    });
    console.log(`[${requestId}] Theme analysis complete:`, {
      suitCounts: themes.suitCounts,
      elementCounts: themes.elementCounts,
      reversalCount: themes.reversalCount,
      framework: themes.reversalFramework
    });
  } catch (err) {
    console.error(`[${requestId}] performSpreadAnalysis: analyzeSpreadThemes failed, using minimal fallback themes.`, err);
    themes = {
      suitCounts: {},
      elementCounts: {},
      reversalCount: 0,
      reversalFramework: 'contextual',
      reversalDescription: {
        name: 'Context-Dependent',
        description: 'Reversed cards are interpreted individually based on context.',
        guidance: 'Read each reversal by listening to its position and neighboring cards.'
      }
    };
  }

  // Spread-specific position-relationship analysis
  let spreadAnalysis = null;
  let spreadKey = 'general';
  let graphRAGPayload = null;

  try {
    spreadKey = getSpreadKey(spreadInfo.name);
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

  // Memoize GraphRAG retrieval once so prompts for multiple backends reuse it
  try {
    const graphKeys = themes?.knowledgeGraph?.graphKeys;
    if (graphKeys) {
      const {
        isGraphRAGEnabled,
        retrievePassages,
        retrievePassagesWithQuality,
        formatPassagesForPrompt,
        buildRetrievalSummary,
        buildQualityRetrievalSummary,
        getPassageCountForSpread,
        isSemanticScoringAvailable
      } = await import('../lib/graphRAG.js');

      const semanticAvailable = isSemanticScoringAvailable(options.env);
      const requestedSemanticScoring =
        options.enableSemanticScoring === true ||
        (options.enableSemanticScoring === undefined && semanticAvailable);
      const enableSemanticScoring = requestedSemanticScoring && semanticAvailable;

      const attachGraphRAGPlaceholder = (reason) => {
        const patternsDetected = {
          completeTriads: graphKeys?.completeTriadIds?.length || 0,
          partialTriads:
            (graphKeys?.triadIds?.length || 0) -
            (graphKeys?.completeTriadIds?.length || 0),
          foolsJourneyStage: graphKeys?.foolsJourneyStageKey || null,
          highDyads: graphKeys?.dyadPairs?.filter((d) => d.significance === 'high').length || 0,
          strongSuitProgressions:
            graphKeys?.suitProgressions?.filter((p) => p.significance === 'strong-progression').length || 0
        };

        graphRAGPayload = {
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
            reason
          },
          maxPassages: 0,
          initialPassageCount: 0,
          rankingStrategy: null,
          enableSemanticScoring,
          qualityMetrics: null,
          semanticScoringRequested: requestedSemanticScoring,
          semanticScoringUsed: false,
          semanticScoringFallback: requestedSemanticScoring
        };

        themes.knowledgeGraph = themes.knowledgeGraph || { graphKeys: graphKeys || null };
        themes.knowledgeGraph.graphRAGPayload = graphRAGPayload;
      };

      if (requestedSemanticScoring && !semanticAvailable) {
        console.warn(
          `[${requestId}] Semantic scoring requested but embeddings are unavailable (missing AZURE_OPENAI_ENDPOINT/API_KEY); falling back to keyword scoring.`
        );
      }

      if (!isGraphRAGEnabled(options.env)) {
        attachGraphRAGPlaceholder('graphrag-disabled-env');
      } else {
        // Pass subscription tier for tier-aware passage limits
        const tier = options.subscriptionTier || 'free';
        const maxPassages = getPassageCountForSpread(spreadKey || 'general', tier);
        console.log(`[${requestId}] GraphRAG passage limit: ${maxPassages} (tier: ${tier})`);

        let passages;
        let retrievalSummary;

        if (enableSemanticScoring) {
          // Use quality-aware retrieval with relevance scoring
          console.log(`[${requestId}] Using quality-aware GraphRAG retrieval with semantic scoring`);
          passages = await retrievePassagesWithQuality(graphKeys, {
            maxPassages,
            userQuery: options.userQuestion,
            minRelevanceScore: 0.3,
            enableDeduplication: true,
            enableSemanticScoring: true,
            env: options.env
          });
          retrievalSummary = buildQualityRetrievalSummary(graphKeys, passages);

          // Log average relevance for monitoring
          if (retrievalSummary.qualityMetrics?.averageRelevance) {
            console.log(
              `[${requestId}] GraphRAG quality: ${passages.length} passages, avg relevance: ${(retrievalSummary.qualityMetrics.averageRelevance * 100).toFixed(1)}%`
            );
          }
        } else {
          // Fall back to standard retrieval (keyword-only)
          passages = retrievePassages(graphKeys, {
            maxPassages,
            userQuery: options.userQuestion
          });
          retrievalSummary = buildRetrievalSummary(graphKeys, passages);
        }

        const semanticScoringRequested = requestedSemanticScoring;
        const semanticScoringUsed = retrievalSummary?.qualityMetrics?.semanticScoringUsed === true;
        const semanticScoringFallback = semanticScoringRequested && !semanticScoringUsed;

        retrievalSummary = {
          ...retrievalSummary,
          semanticScoringRequested,
          semanticScoringUsed,
          semanticScoringFallback
        };

        const formattedBlock = formatPassagesForPrompt(passages, {
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
          semanticScoringRequested,
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
      graphRAGPayload = {
        passages: [],
        formattedBlock: null,
        retrievalSummary: {
          graphKeysProvided: false,
          patternsDetected: {
            completeTriads: 0,
            partialTriads: 0,
            foolsJourneyStage: null,
            highDyads: 0,
            strongSuitProgressions: 0
          },
          passagesRetrieved: 0,
          passagesByType: {},
          passagesByPriority: {},
          semanticScoringRequested: options.enableSemanticScoring === true,
          semanticScoringUsed: false,
          semanticScoringFallback: options.enableSemanticScoring === true,
          reason: 'missing-graph-keys'
        },
        maxPassages: 0,
        initialPassageCount: 0,
        rankingStrategy: null,
        enableSemanticScoring: Boolean(options.enableSemanticScoring),
        qualityMetrics: null,
        semanticScoringRequested: options.enableSemanticScoring === true,
        semanticScoringUsed: false,
        semanticScoringFallback: options.enableSemanticScoring === true
      };
      themes.knowledgeGraph = themes.knowledgeGraph || { graphKeys: null };
      themes.knowledgeGraph.graphRAGPayload = graphRAGPayload;
      console.warn(`[${requestId}] GraphRAG skipped: no graph patterns detected for this spread.`);
    }
  } catch (err) {
    console.warn(`[${requestId}] performSpreadAnalysis: GraphRAG memoization failed: ${err.message}`);
  }

  // Ephemeris integration: fetch real-time astrological context
  let ephemerisContext = null;
  let transitResonances = [];
  let ephemerisForecast = null;

  try {
    console.log(`[${requestId}] Fetching ephemeris context...`);
    ephemerisContext = await fetchEphemerisContext();

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

/**
 * Validates the baseline structure expected by the tarot-reading endpoint.
 */
export function validatePayload({ spreadInfo, cardsInfo }) {
  if (!spreadInfo || typeof spreadInfo.name !== 'string') {
    return 'Missing spread information.';
  }

  if (!Array.isArray(cardsInfo) || cardsInfo.length === 0) {
    return 'No cards were provided for the reading.';
  }

  const expectedCount = getExpectedCardCount(spreadInfo.name);
  if (expectedCount !== null && cardsInfo.length !== expectedCount) {
    return `Spread "${spreadInfo.name}" expects ${expectedCount} cards, but received ${cardsInfo.length}.`;
  }

  const hasInvalidCard = cardsInfo.some(card => {
    if (typeof card !== 'object' || card === null) return true;
    const requiredFields = ['position', 'card', 'orientation', 'meaning'];
    return requiredFields.some(field => {
      const value = card[field];
      return typeof value !== 'string' || !value.trim();
    });
  });

  if (hasInvalidCard) {
    return 'One or more cards are missing required details.';
  }

  // Warn (without rejecting) if Minor Arcana cards are missing suit/rank metadata.
  const minorMetadataIssues = [];
  cardsInfo.forEach((card, index) => {
    if (!card || typeof card.card !== 'string') return;
    const parsed = parseMinorName(card.card);
    if (!parsed) return; // Not a Minor Arcana title (likely Major)

    const hasSuit = typeof card.suit === 'string' && card.suit.trim().length > 0;
    const hasRank = typeof card.rank === 'string' && card.rank.trim().length > 0;
    const hasRankValue = typeof card.rankValue === 'number';

    if (hasSuit && hasRank && hasRankValue) {
      return;
    }

    const missing = [];
    if (!hasSuit) missing.push('suit');
    if (!hasRank) missing.push('rank');
    if (!hasRankValue) missing.push('rankValue');

    minorMetadataIssues.push(
      `${card.card} @ position ${index + 1} missing ${missing.join(', ')}`
    );
  });

  if (minorMetadataIssues.length > 0) {
    console.warn(
      '[validatePayload] Minor Arcana metadata incomplete; falling back to string parsing which may degrade nuance:',
      minorMetadataIssues.join(' | ')
    );
  }

  return null;
}

/**
 * Generate reading using Azure OpenAI GPT-5/5.1 via Responses API
 *
 * The Responses API is the recommended API for GPT-5 family models, bringing together
 * the best capabilities from chat completions and assistants API.
 *
 * API Reference: https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/responses
 */
async function generateWithAzureGPT5Responses(env, payload, requestId = 'unknown') {
  const { spreadInfo, cardsInfo, userQuestion, reflectionsText, analysis, context, visionInsights, contextDiagnostics = [] } = payload;

  // Track prompts for engineering analysis
  let capturedSystemPrompt = '';
  let capturedUserPrompt = '';
  // Normalize endpoint: strip trailing slashes and any existing /openai/v1 path
  // to avoid double-pathing when constructing the full URL
  const rawEndpoint = env.AZURE_OPENAI_ENDPOINT || '';
  const endpoint = rawEndpoint
    .replace(/\/+$/, '')                    // Remove trailing slashes
    .replace(/\/openai\/v1\/?$/, '')        // Remove /openai/v1 suffix if present
    .replace(/\/openai\/?$/, '');           // Remove /openai suffix if present
  const apiKey = env.AZURE_OPENAI_API_KEY;
  const deploymentName = env.AZURE_OPENAI_GPT5_MODEL; // Azure deployment name (often mirrors the base model name)
  // Responses API requires v1 path format - use dedicated Responses version binding
  // (same pattern as functions/lib/azureResponses.js)
  const apiVersion = env.AZURE_OPENAI_RESPONSES_API_VERSION || env.AZURE_OPENAI_API_VERSION || 'v1';
  const deckStyle = spreadInfo?.deckStyle || analysis?.themes?.deckStyle || cardsInfo?.[0]?.deckStyle || 'rws-1909';

  console.log(`[${requestId}] Building Azure GPT-5 prompts...`);
  console.log(`[${requestId}] Azure config: endpoint=${endpoint ? 'set' : 'missing'}, apiKey=${apiKey ? 'set' : 'missing'}, model=${deploymentName}, apiVersion=${apiVersion}`);

  // Determine semantic scoring configuration
  const semanticScoringConfig = getSemanticScoringConfig(env);
  const enableSemanticScoring = semanticScoringConfig !== null
    ? semanticScoringConfig
    : analysis.graphRAGPayload?.enableSemanticScoring ?? null;

  // Build enhanced prompts using narrative builder
  const { systemPrompt, userPrompt, promptMeta, contextDiagnostics: promptDiagnostics } = buildEnhancedClaudePrompt({
    spreadInfo,
    cardsInfo,
    userQuestion,
    reflectionsText,
    themes: analysis.themes,
    spreadAnalysis: analysis.spreadAnalysis,
    context,
    visionInsights,
    deckStyle,
    graphRAGPayload: analysis.graphRAGPayload,
    ephemerisContext: analysis.ephemerisContext,
    ephemerisForecast: analysis.ephemerisForecast,
    transitResonances: analysis.transitResonances,
    budgetTarget: 'azure',
    contextDiagnostics,
    promptBudgetEnv: env,
    personalization: payload.personalization,
    enableSemanticScoring,
    subscriptionTier: payload.subscriptionTier
  });

  if (promptMeta) {
    payload.promptMeta = promptMeta;
  }

  if (Array.isArray(promptDiagnostics) && promptDiagnostics.length) {
    payload.contextDiagnostics = Array.from(new Set([...(payload.contextDiagnostics || []), ...promptDiagnostics]));
  }

  // Capture prompts for persistence
  capturedSystemPrompt = systemPrompt;
  capturedUserPrompt = userPrompt;

  console.log(`[${requestId}] System prompt length: ${systemPrompt.length}, User prompt length: ${userPrompt.length}`);
  maybeLogPromptPayload(
    env,
    requestId,
    'azure-gpt5',
    systemPrompt,
    userPrompt,
    promptMeta,
    { personalization: payload.personalization }
  );

  // Azure OpenAI Responses API endpoint format (v1 API):
  // POST {endpoint}/openai/v1/responses?api-version=v1
  // Model is passed in the request body, NOT in the URL path
  const url = `${endpoint}/openai/v1/responses?api-version=${encodeURIComponent(apiVersion)}`;

  // Log endpoint normalization for debugging
  if (rawEndpoint !== endpoint) {
    console.log(`[${requestId}] Endpoint normalized: "${rawEndpoint}" -> "${endpoint}"`);
  }
  console.log(`[${requestId}] Making Azure GPT-5 Responses API request to: ${url}`);
  console.log(`[${requestId}] Using deployment: ${deploymentName}, api-version: ${apiVersion}`);

  // Dynamic reasoning effort based on model capabilities
  // - gpt-5-pro, gpt-5.1: Use 'high' reasoning effort for best results
  // - gpt-5-codex: supports low/medium/high (not minimal)
  // - gpt-5: supports low/medium/high
  // - Other GPT-5 family models: support low/medium/high
  let reasoningEffort = 'medium'; // Default for most models
  if (deploymentName && requiresHighReasoningEffort(deploymentName)) {
    reasoningEffort = 'high';
    console.log(`[${requestId}] Detected ${deploymentName} deployment, using 'high' reasoning effort`);
  }

  // Responses API uses a different structure than Chat Completions
  // System prompts go in "instructions", user content in "input"
  // Note: Responses API does NOT support temperature parameter
  const requestBody = {
    model: deploymentName,
    instructions: systemPrompt,
    input: userPrompt,
    // max_output_tokens: 3000, // Removed to allow full model context length
    reasoning: {
      effort: reasoningEffort // Dynamically set based on model
    },
    text: {
      verbosity: 'medium' // low, medium, or high - controls output conciseness
    }
  };

  console.log(`[${requestId}] Request config:`, {
    deployment: deploymentName,
    max_output_tokens: requestBody.max_output_tokens,
    reasoning_effort: requestBody.reasoning.effort,
    verbosity: requestBody.text.verbosity
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'content-type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  console.log(`[${requestId}] Azure Responses API response status: ${response.status}`);

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    console.error(`[${requestId}] Azure Responses API error response:`, errText);
    throw new Error(`Azure OpenAI GPT-5 Responses API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  console.log(`[${requestId}] Azure Responses API raw response:`, JSON.stringify(data, null, 2));
  console.log(`[${requestId}] Azure Responses API response received:`, {
    id: data.id,
    model: data.model,
    status: data.status,
    outputCount: data.output?.length,
    usage: data.usage
  });

  // Responses API returns output as an array of output items
  // Extract text from message output items
  let content = '';
  if (data.output && Array.isArray(data.output)) {
    for (const item of data.output) {
      // Handle message output type
      if (item.type === 'message' && item.content) {
        for (const contentItem of item.content) {
          if (contentItem.type === 'output_text' && contentItem.text) {
            content += contentItem.text;
          }
        }
      }
    }
  }

  // Fallback: try output_text property (some models use this)
  if (!content && data.output_text) {
    content = data.output_text;
  }

  if (!content || typeof content !== 'string' || !content.trim()) {
    console.error(`[${requestId}] Empty or invalid response from Azure GPT-5:`, {
      hasOutput: !!data.output,
      outputLength: data.output?.length,
      status: data.status
    });
    throw new Error('Empty response from Azure OpenAI GPT-5 Responses API');
  }

  console.log(`[${requestId}] Generated reading length: ${content.length} characters`);
  console.log(`[${requestId}] Token usage:`, {
    input_tokens: data.usage?.input_tokens,
    output_tokens: data.usage?.output_tokens,
    reasoning_tokens: data.usage?.output_tokens_details?.reasoning_tokens,
    total_tokens: data.usage?.total_tokens
  });

  // Return reading with captured prompts for engineering analysis
  return {
    reading: content.trim(),
    prompts: {
      system: capturedSystemPrompt,
      user: capturedUserPrompt
    },
    usage: data.usage
  };
}

/**
 * Enhanced Claude Sonnet 4.5 generation with position-relationship analysis
 */
async function generateWithClaudeSonnet45Enhanced(env, payload, requestId = 'unknown') {
  const { spreadInfo, cardsInfo, userQuestion, reflectionsText, analysis, context, visionInsights, contextDiagnostics = [] } = payload;

  // Track prompts for engineering analysis
  let capturedSystemPrompt = '';
  let capturedUserPrompt = '';

  // Azure AI Foundry Anthropic endpoint
  // API key: prefer AZURE_ANTHROPIC_API_KEY, fall back to AZURE_OPENAI_API_KEY
  const apiKey = env.AZURE_ANTHROPIC_API_KEY || env.AZURE_OPENAI_API_KEY;
  // Base URL should be: https://<resource>.services.ai.azure.com/anthropic
  // We append /v1/messages if not already present
  const baseEndpoint = env.AZURE_ANTHROPIC_ENDPOINT || '';
  const apiUrl = baseEndpoint.endsWith('/v1/messages')
    ? baseEndpoint
    : `${baseEndpoint.replace(/\/$/, '')}/v1/messages`;
  // Model = deployment name in Foundry (e.g., 'claude-opus-4-5' or custom)
  const model = env.AZURE_ANTHROPIC_MODEL || 'claude-opus-4-5';

  console.log(`[${requestId}] Azure Foundry Claude config: endpoint=${baseEndpoint ? 'set' : 'missing'}, apiKey=${apiKey ? 'set' : 'missing'}, model=${model}`);
  const deckStyle = spreadInfo?.deckStyle || analysis?.themes?.deckStyle || cardsInfo?.[0]?.deckStyle || 'rws-1909';

  // Determine semantic scoring configuration
  const semanticScoringConfig = getSemanticScoringConfig(env);
  const enableSemanticScoring = semanticScoringConfig !== null
    ? semanticScoringConfig
    : analysis.graphRAGPayload?.enableSemanticScoring ?? null;

  // Build enhanced prompts using narrative builder
  const { systemPrompt, userPrompt, promptMeta, contextDiagnostics: promptDiagnostics } = buildEnhancedClaudePrompt({
    spreadInfo,
    cardsInfo,
    userQuestion,
    reflectionsText,
    themes: analysis.themes,
    spreadAnalysis: analysis.spreadAnalysis,
    context,
    visionInsights,
    deckStyle,
    graphRAGPayload: analysis.graphRAGPayload,
    ephemerisContext: analysis.ephemerisContext,
    ephemerisForecast: analysis.ephemerisForecast,
    transitResonances: analysis.transitResonances,
    budgetTarget: 'claude',
    contextDiagnostics,
    promptBudgetEnv: env,
    personalization: payload.personalization,
    enableSemanticScoring,
    subscriptionTier: payload.subscriptionTier
  });

  // Capture prompts for persistence
  capturedSystemPrompt = systemPrompt;
  capturedUserPrompt = userPrompt;

  if (promptMeta) {
    payload.promptMeta = promptMeta;
  }

  if (Array.isArray(promptDiagnostics) && promptDiagnostics.length) {
    payload.contextDiagnostics = Array.from(new Set([...(payload.contextDiagnostics || []), ...promptDiagnostics]));
  }

  maybeLogPromptPayload(
    env,
    requestId,
    'claude-sonnet45',
    systemPrompt,
    userPrompt,
    promptMeta,
    { personalization: payload.personalization }
  );

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,  // Azure Foundry Anthropic uses 'x-api-key' header
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192, // Increased to allow full narrative generation without arbitrary limits
      temperature: 0.75,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ]
    })
  });

  console.log(`[${requestId}] Azure Foundry Claude response status: ${response.status}`);

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Azure Anthropic proxy error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  console.log(`[${requestId}] Azure Foundry Claude raw response:`, JSON.stringify(data, null, 2));
  const content = Array.isArray(data.content)
    ? data.content.map(part => part.text || '').join('').trim()
    : (data.content?.toString?.() || '').trim();

  if (!content) {
    throw new Error('Empty response from Azure Claude Opus 4.5');
  }

  // Return reading with captured prompts for engineering analysis
  return {
    reading: content,
    prompts: {
      system: capturedSystemPrompt,
      user: capturedUserPrompt
    },
    usage: data.usage
  };
}

const SPREAD_READING_BUILDERS = {
  celtic: ({ spreadAnalysis, cardsInfo, userQuestion, reflectionsText, themes, context }, options = {}) =>
    spreadAnalysis
      ? buildCelticCrossReading({
        cardsInfo,
        userQuestion,
        reflectionsText,
        celticAnalysis: spreadAnalysis,
        themes,
        context
      }, options)
      : null,
  threeCard: ({ spreadAnalysis, cardsInfo, userQuestion, reflectionsText, themes, context }, options = {}) =>
    spreadAnalysis
      ? buildThreeCardReading({
        cardsInfo,
        userQuestion,
        reflectionsText,
        threeCardAnalysis: spreadAnalysis,
        themes,
        context
      }, options)
      : null,
  fiveCard: ({ spreadAnalysis, cardsInfo, userQuestion, reflectionsText, themes, context }, options = {}) =>
    spreadAnalysis
      ? buildFiveCardReading({
        cardsInfo,
        userQuestion,
        reflectionsText,
        fiveCardAnalysis: spreadAnalysis,
        themes,
        context
      }, options)
      : null,
  relationship: ({ cardsInfo, userQuestion, reflectionsText, themes, context }, options = {}) =>
    buildRelationshipReading({ cardsInfo, userQuestion, reflectionsText, themes, context }, options),
  decision: ({ cardsInfo, userQuestion, reflectionsText, themes, context }, options = {}) =>
    buildDecisionReading({ cardsInfo, userQuestion, reflectionsText, themes, context }, options),
  single: ({ cardsInfo, userQuestion, reflectionsText, themes, context }, options = {}) =>
    buildSingleCardReading({ cardsInfo, userQuestion, reflectionsText, themes, context }, options)
};

/**
 * Enhanced local composer with spread-specific narrative construction
 */
async function composeReadingEnhanced(payload) {
  const {
    spreadInfo,
    cardsInfo,
    userQuestion,
    reflectionsText,
    analysis,
    context,
    personalization = null
  } = payload;
  const { themes, spreadAnalysis, spreadKey } = analysis;
  const collectedSections = [];

  const readingText = await generateReadingFromAnalysis(
    {
      spreadKey,
      spreadAnalysis,
      cardsInfo,
      userQuestion,
      reflectionsText,
      themes,
      spreadInfo,
      context
    },
    {
      personalization,
      collectValidation: (section) => {
        if (!section) return;
        collectedSections.push({
          text: section.text || '',
          metadata: section.metadata || {},
          validation: section.validation || null
        });
      }
    }
  );

  payload.narrativeEnhancements = collectedSections;

  if (!payload.promptMeta) {
    payload.promptMeta = {
      backend: 'local-composer',
      estimatedTokens: null,
      slimmingSteps: []
    };
  }

  // Return reading with null prompts (local composer doesn't use LLM prompts)
  return {
    reading: readingText,
    prompts: null,
    usage: null
  };
}

async function runNarrativeBackend(backendId, env, payload, requestId) {
  switch (backendId) {
    case 'azure-gpt5':
      return generateWithAzureGPT5Responses(env, payload, requestId);
    case 'claude-sonnet45':
      return generateWithClaudeSonnet45Enhanced(env, payload, requestId);
    case 'local-composer':
    default:
      return composeReadingEnhanced(payload);
  }
}

async function generateReadingFromAnalysis(
  { spreadKey, spreadAnalysis, cardsInfo, userQuestion, reflectionsText, themes, spreadInfo, context },
  options = {}
) {
  const builder = SPREAD_READING_BUILDERS[spreadKey];

  if (builder) {
    const result = await builder({
      spreadAnalysis,
      cardsInfo,
      userQuestion,
      reflectionsText,
      themes,
      spreadInfo,
      context
    }, options);

    if (typeof result === 'string' && result.trim()) {
      return result;
    }
  }

  return buildGenericReading(
    {
      spreadInfo,
      cardsInfo,
      userQuestion,
      reflectionsText,
      themes,
      context
    },
    options
  );
}

/**
 * Generic enhanced reading builder (for spreads without specific builders yet)
 */
function buildGenericReading(
  { spreadInfo, cardsInfo, userQuestion, reflectionsText, themes, context },
  options = {}
) {
  const { collectValidation, personalization = null } = options;
  const spreadName = spreadInfo?.name?.trim() || 'your chosen spread';
  const entries = [];
  const safeCards = Array.isArray(cardsInfo) ? cardsInfo : [];
  const remedyRotationIndex = computeRemedyRotationIndex({
    cardsInfo: safeCards,
    userQuestion,
    spreadInfo
  });
  const tone = getToneStyle(personalization?.readingTone);
  const depthProfile = getDepthProfile(personalization?.preferredSpreadDepth);

  // Opening
  const composedOpening = buildOpening(spreadName, userQuestion, context, { personalization });
  const openingText = depthProfile?.openingPreface
    ? `${depthProfile.openingPreface}\n\n${composedOpening}`.trim()
    : composedOpening;

  entries.push({
    text: openingText,
    metadata: { type: 'opening', cards: safeCards.length > 0 ? [safeCards[0]] : [] }
  });

  // Cards section
  let cardsSection = buildCardsSection(safeCards, context, {
    detailLevel: depthProfile?.cardDetail,
    heading: depthProfile?.cardsHeading,
    note: depthProfile?.cardsNote
  });
  if (tone.challengeFraming) {
    cardsSection += `\n\nTreat any friction or challenge as a ${tone.challengeFraming}; the spread is highlighting choices, not fixed fate.`;
  }
  entries.push({
    text: cardsSection,
    metadata: { type: 'cards', cards: safeCards }
  });

  // Reflections
  if (reflectionsText && reflectionsText.trim()) {
    entries.push({
      text: `**Your Reflections**\n\n${reflectionsText.trim()}\n\nYour intuitive impressions add personal meaning to this reading.`,
      metadata: { type: 'reflections' }
    });
  }

  // Synthesis with enhanced themes
  const finalCard = safeCards.length > 0 ? safeCards[safeCards.length - 1] : null;
  entries.push({
    text: buildEnhancedSynthesis(safeCards, themes, userQuestion, context, {
      rotationIndex: remedyRotationIndex,
      depthProfile
    }),
    metadata: { type: 'synthesis', cards: finalCard ? [finalCard] : [] }
  });

  const enhancedSections = entries
    .map(({ text, metadata }) => {
      const result = enhanceSection(text, metadata || {});
      if (!result || !result.text) {
        return null;
      }
      const sectionRecord = {
        text: result.text,
        metadata: metadata || {},
        validation: result.validation || null
      };
      if (typeof collectValidation === 'function') {
        collectValidation(sectionRecord);
      }
      return sectionRecord;
    })
    .filter(Boolean);

  const readingBody = enhancedSections.map((section) => section.text).join('\n\n');
  const closing = buildPersonalizedClosing(personalization);
  const bodyWithClosing = closing ? `${readingBody}\n\n${closing}` : readingBody;
  return appendGenericReversalReminder(bodyWithClosing, safeCards, themes);
}

function annotateVisionInsights(proofInsights, cardsInfo = [], deckStyle = 'rws-1909') {
  if (!Array.isArray(proofInsights) || proofInsights.length === 0) {
    return [];
  }

  const normalizedDeck = deckStyle || 'rws-1909';
  const drawnNames = new Set(
    (cardsInfo || [])
      .map((card) => canonicalCardKey(card?.card || card?.name, normalizedDeck))
      .filter(Boolean)
  );

  return proofInsights
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => {
      const predictedCard = canonicalizeCardName(entry.predictedCard || entry.card, normalizedDeck);
      if (!predictedCard) {
        return null;
      }

      const predictedKey = canonicalCardKey(predictedCard, normalizedDeck);
      const matchesDrawnCard = drawnNames.size > 0
        ? (predictedKey ? drawnNames.has(predictedKey) : null)
        : null;

      const matches = Array.isArray(entry.matches)
        ? entry.matches
          .map((match) => {
            const card = canonicalizeCardName(match?.card || match?.cardName, normalizedDeck);
            if (!card) return null;
            return {
              ...match,
              card
            };
          })
          .filter(Boolean)
          .slice(0, 3)
        : [];

      return {
        label: normalizeVisionLabel(entry.label),
        predictedCard,
        confidence: typeof entry.confidence === 'number' ? entry.confidence : null,
        basis: typeof entry.basis === 'string' ? entry.basis : null,
        matchesDrawnCard,
        matches,
        attention: entry.attention || null,
        symbolVerification: entry.symbolVerification || null,
        visualProfile: entry.visualProfile || null
      };
    })
    .filter(Boolean)
    .slice(0, 10);
}

/**
 * Build cards section with reversal framework awareness
 */
function buildCardsSection(cardsInfo, context, options = {}) {
  const safeCards = Array.isArray(cardsInfo) ? cardsInfo : [];
  const normalizedDetail = typeof options.detailLevel === 'string' ? options.detailLevel : 'standard';
  const heading = options.heading
    || (normalizedDetail === 'concise'
      ? '**Quick Card Highlights**'
      : normalizedDetail === 'expansive'
        ? '**Layered Card Weaving**'
        : '**The Cards Speak**');

  const lines = safeCards.map((card, index) => {
    const position = (card?.position || '').trim() || `Card ${index + 1}`;
    let description = buildPositionCardText(card, position, { context });
    if (normalizedDetail === 'concise') {
      description = condenseDescriptionForDepth(description);
    } else if (normalizedDetail === 'expansive') {
      const reflectionPrompt = buildDepthReflectionPrompt(card, position);
      if (reflectionPrompt) {
        description = `${description}\n*Deep dive: ${reflectionPrompt}*`;
      }
    }
    return `**${position}**\n${description}`;
  });

  let section = `${heading}\n\n${lines.join('\n\n')}`;
  if (options.note) {
    section += `\n\n${options.note}`;
  }
  return section;
}

function condenseDescriptionForDepth(text, sentenceCount = 2) {
  if (!text || typeof text !== 'string') {
    return text;
  }
  const segments = text.match(/[^.!?]+[.!?]?/g);
  if (!segments || segments.length <= sentenceCount) {
    return text;
  }
  return segments.slice(0, sentenceCount).join(' ').trim();
}

function buildDepthReflectionPrompt(card, position) {
  if (!card) return '';
  const cardName = typeof card.card === 'string' && card.card.trim() ? card.card.trim() : 'this card';
  const orientation = typeof card.orientation === 'string' && card.orientation.trim() ? ` ${card.orientation.trim()}` : '';
  const focus = (position || 'this position').toLowerCase();
  return `Journal on how ${cardName}${orientation} wants you to engage with ${focus}.`;
}

/**
 * Format meaning for position context
 */
/**
 * Enhanced synthesis with rich theme analysis
 */
function buildEnhancedSynthesis(cardsInfo, themes, userQuestion, context, options = {}) {
  const safeCards = Array.isArray(cardsInfo) ? cardsInfo : [];
  const depthProfile = options.depthProfile || null;
  const heading = depthProfile?.key === 'short'
    ? '**Quick Trajectory**'
    : depthProfile?.key === 'deep'
      ? '**Deep Synthesis & Guidance**'
      : '**Synthesis & Guidance**';
  let section = `${heading}\n\n`;
  const rotationIndex = Number.isFinite(options.rotationIndex)
    ? Math.abs(Math.floor(options.rotationIndex))
    : 0;

  if (context && context !== 'general') {
    const contextMap = {
      love: 'relationships and heart-centered experience',
      career: 'career, vocation, and material pathways',
      self: 'personal growth and inner landscape',
      spiritual: 'spiritual practice and meaning-making'
    };
    const descriptor = contextMap[context] || 'your life as a whole';
    section += `Focus: Interpreting the spread through the lens of ${descriptor}.\n\n`;
  }

  // Suit focus
  if (themes.suitFocus) {
    section += `${themes.suitFocus}\n\n`;
  }

  // Timing profile (soft, non-deterministic)
  if (themes.timingProfile === 'near-term-tilt') {
    section += `Pace: These influences are likely to move or clarify in the nearer term, assuming you stay engaged with them.\n\n`;
  } else if (themes.timingProfile === 'longer-arc-tilt') {
    section += `Pace: This reading leans toward a slower-burn, structural arc that unfolds over a longer chapter, not overnight.\n\n`;
  } else if (themes.timingProfile === 'developing-arc') {
    section += `Pace: Themes here describe an unfolding chapter—neither instant nor distant, but evolving as you work with them.\n\n`;
  }

  // Archetype level
  if (themes.archetypeDescription) {
    section += `${themes.archetypeDescription}\n\n`;
  }

  // Elemental balance with actionable remedies
  if (themes.elementalBalance) {
    section += `Elemental context: ${themes.elementalBalance}\n\n`;

    // Add elemental remedies if imbalanced
    if (shouldOfferElementalRemedies(themes.elementCounts, safeCards.length)) {
      const remedies = buildElementalRemedies(themes.elementCounts, safeCards.length, context, {
        rotationIndex
      });
      if (remedies) {
        section += `${remedies}\n\n`;
      }
    }
  }

  // Lifecycle stage
  if (themes.lifecycleStage) {
    section += `The cards speak to ${themes.lifecycleStage}.\n\n`;
  }

  // Actionable guidance
  const personalAnchor = userQuestion?.trim()
    ? 'Take the next small, intentional step that honors both your intuition and the practical realities at hand.'
    : 'Carry this insight gently into your next steps, allowing space for new awareness to bloom.';

  section += `${personalAnchor}\n\n`;

  // Free will reminder
  section += `Remember: These cards show a trajectory based on current patterns. Your awareness, choices, and actions shape what unfolds. You are co-creating this path.`;

  if (depthProfile?.synthesisReminder) {
    section += `\n\n${depthProfile.synthesisReminder}`;
  }

  return section;
}

function appendGenericReversalReminder(readingText, cardsInfo, themes) {
  if (!readingText) return readingText;

  const hasReversed = Array.isArray(cardsInfo) && cardsInfo.some(card =>
    (card?.orientation || '').toLowerCase() === 'reversed'
  );

  if (!hasReversed || !themes?.reversalDescription) {
    return readingText;
  }

  const lens = formatReversalLens(themes, { includeExamples: false, includeReminder: false });
  const guidanceLine = Array.isArray(lens.lines)
    ? lens.lines.find((line) => line.toLowerCase().includes('guidance'))
    : null;
  const reminderText = guidanceLine
    ? guidanceLine.replace(/^[-\s]*/, '').trim()
    : (themes.reversalDescription.guidance
      ? `Guidance: ${themes.reversalDescription.guidance}`
      : `Reversal lens: ${themes.reversalDescription.name}`);

  const reminder = `*Reversal lens reminder: ${reminderText}*`;
  if (readingText.includes(reminder)) {
    return readingText;
  }

  return `${readingText}\n\n${reminder}`;
}

function buildVisionMetrics(insights, avgConfidence, mismatchCount) {
  const safeInsights = Array.isArray(insights) ? insights : [];
  const symbolStats = safeInsights
    .filter((entry) => entry && entry.symbolVerification)
    .map((entry) => ({
      card: entry.predictedCard,
      matchRate: typeof entry.symbolVerification.matchRate === 'number' ? entry.symbolVerification.matchRate : null,
      missingSymbols: Array.isArray(entry.symbolVerification.missingSymbols)
        ? entry.symbolVerification.missingSymbols
        : [],
      unexpectedDetections: Array.isArray(entry.symbolVerification.unexpectedDetections)
        ? entry.symbolVerification.unexpectedDetections
        : [],
      expectedCount: entry.symbolVerification.expectedCount ?? null,
      detectedCount: entry.symbolVerification.detectedCount ?? null
    }));

  return {
    uploads: safeInsights.length,
    avgConfidence: Number.isFinite(avgConfidence) ? avgConfidence : null,
    mismatchCount,
    symbolStats
  };
}

function buildNarrativeMetrics(readingText, cardsInfo, deckStyle = 'rws-1909') {
  const text = typeof readingText === 'string' ? readingText : '';
  const safeCards = Array.isArray(cardsInfo) ? cardsInfo : [];
  const spine = validateReadingNarrative(text);
  const coverage = analyzeCardCoverage(text, safeCards);
  const hallucinatedCards = detectHallucinatedCards(text, safeCards, deckStyle);

  return {
    spine: {
      isValid: spine.isValid,
      totalSections: spine.totalSections || 0,
      completeSections: spine.completeSections || 0,
      incompleteSections: spine.incompleteSections || 0,
      suggestions: spine.suggestions || []
    },
    cardCoverage: coverage.coverage,
    missingCards: coverage.missingCards,
    hallucinatedCards
  };
}

function analyzeCardCoverage(readingText, cardsInfo = []) {
  if (!Array.isArray(cardsInfo) || cardsInfo.length === 0) {
    return { coverage: 1, missingCards: [] };
  }

  const text = typeof readingText === 'string' ? readingText : '';
  const missingCards = cardsInfo
    .filter((card) => card && typeof card.card === 'string')
    .map((card) => card.card)
    .filter((name) => {
      if (!name) return true;
      const pattern = new RegExp(escapeRegex(name), 'i');
      return !pattern.test(text);
    });

  const presentCount = cardsInfo.length - missingCards.length;
  const coverage = cardsInfo.length ? presentCount / cardsInfo.length : 1;
  return { coverage, missingCards };
}

function looksLikeCardNameCase(matchText) {
  if (!matchText || typeof matchText !== 'string') return false;
  if (matchText === matchText.toUpperCase()) return true;

  const words = matchText.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return false;

  const significantWords = words.filter((word) => !CARD_NAME_STOP_WORDS.has(word.toLowerCase()));
  if (!significantWords.length) return false;

  return significantWords.every((word) => /^[A-Z]/.test(word));
}

function detectHallucinatedCards(readingText, cardsInfo = [], deckStyle = 'rws-1909') {
  if (!readingText) return [];

  let text = typeof readingText === 'string' ? readingText : '';
  const safeCards = Array.isArray(cardsInfo) ? cardsInfo : [];

  // Remove tarot terminology phrases that reference card names but aren't card references
  // e.g., "Fool's Journey" refers to the archetypal journey, not The Fool card
  TAROT_TERMINOLOGY_EXCLUSIONS.forEach(pattern => {
    text = text.replace(pattern, '[TERMINOLOGY]');
  });

  // Track both canonical deck-aware keys and normalized literal names for drawn cards.
  const drawnKeys = new Set(
    safeCards
      .filter((card) => card && typeof card.card === 'string')
      .map((card) => {
        const canonical = canonicalCardKey(card.card, deckStyle);
        return canonical || normalizeCardName(card.card);
      })
      .filter(Boolean)
  );

  const hallucinated = [];

  CARD_NAME_PATTERNS.forEach(({ name, normalized, pattern }) => {
    const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
    const matches = Array.from(text.matchAll(new RegExp(pattern.source, flags)));
    if (!matches.length) {
      return;
    }

    const hasContext = hasExplicitCardContext(text, name);
    const requiresCardCase = CARD_NAMES_REQUIRING_CARD_CASE.has(normalized);
    const hasCardCase = requiresCardCase
      ? matches.some((match) => looksLikeCardNameCase(match[0]))
      : true;

    // For names that are also common vocabulary (Justice, Strength, Temperance, Death, Judgement),
    // only treat them as card mentions when there is explicit card-like context in the text.
    if (AMBIGUOUS_CARD_NAMES.has(normalized) && !hasContext) {
      return;
    }

    if (requiresCardCase && !hasContext && !hasCardCase) {
      return;
    }

    const canonical = canonicalCardKey(name, deckStyle);
    const key = canonical || normalized;

    if (!drawnKeys.has(key)) {
      hallucinated.push(name);
    }
  });

  // De-duplicate while preserving insertion order
  return [...new Set(hallucinated)];
}

async function persistReadingMetrics(env, payload) {
  if (!env?.METRICS_DB?.put) {
    return;
  }

  try {
    const key = `reading:${payload.requestId}`;
    await env.METRICS_DB.put(key, JSON.stringify(payload), {
      metadata: {
        provider: payload.provider,
        spreadKey: payload.spreadKey,
        deckStyle: payload.deckStyle,
        timestamp: payload.timestamp
      }
    });
  } catch (err) {
    console.warn(`[${payload.requestId}] Failed to persist reading metrics: ${err.message}`);
  }
}
