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
  formatReversalLens
} from '../lib/narrativeBuilder.js';
import { enhanceSection, validateReadingNarrative } from '../lib/narrativeSpine.js';
import { inferContext } from '../lib/contextDetection.js';
import { parseMinorName } from '../lib/minorMeta.js';
import { jsonResponse, readJsonBody } from '../lib/utils.js';
import { canonicalizeCardName, canonicalCardKey } from '../../shared/vision/cardNameMapping.js';
import { safeParseReadingRequest } from '../../shared/contracts/readingSchema.js';
import { verifyVisionProof } from '../lib/visionProof.js';
import { MAJOR_ARCANA } from '../../src/data/majorArcana.js';
import { MINOR_ARCANA } from '../../src/data/minorArcana.js';
import {
  fetchEphemerisContext,
  fetchEphemerisForecast,
  matchTransitsToCards,
  getEphemerisSummary
} from '../lib/ephemerisIntegration.js';
import { deriveEmotionalTone } from '../../src/data/emotionMapping.js';

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

function escapeRegex(text = '') {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeCardName(value = '') {
  return value.trim().toLowerCase();
}

const CARD_NAME_PATTERNS = [...MAJOR_ARCANA, ...MINOR_ARCANA]
  .map((card) => card.name)
  .map((name) => ({
    name,
    normalized: normalizeCardName(name),
    pattern: new RegExp(`\\b${escapeRegex(name)}\\b`, 'i')
  }));

// Card names that are also common vocabulary and prone to false positives
// when scanning free-form narrative text.
const AMBIGUOUS_CARD_NORMALIZED = new Set([
  'justice',
  'strength',
  'temperance',
  'death',
  'judgement'
]);

/**
 * Require explicit "card-like" context around ambiguous names so that phrases like
 * "restore a sense of justice in how you negotiate" do not count as hallucinated
 * mentions of the Justice card.
 *
 * Detects card mentions via:
 * - Explicit card reference: "Justice card", "the Death card"
 * - Major Arcana context: "Justice (Major Arcana)", "Major Arcana: Death"
 * - Archetypal framing: "The Death archetype", "Strength archetype"
 * - Orientation markers: "Death reversed", "Justice upright"
 * - Markdown formatting: "**Death**", "**Justice**" (bold card names)
 * - Position labels: "Present: Death", "Card 1: Justice", "Outcome — Death"
 */
function hasExplicitCardContext(text = '', name = '') {
  if (!text || !name) return false;

  const namePattern = escapeRegex(name);

  const patterns = [
    // "Justice card", "Death card", "the Strength card", etc.
    new RegExp(`\\b(?:the\\s+)?${namePattern}\\s+card\\b`, 'i'),

    // "Justice (Major Arcana)", "Major Arcana Justice", "Major Arcana: Death"
    new RegExp(`\\b${namePattern}\\b[^\\n]{0,40}\\bmajor arcana\\b`, 'i'),
    new RegExp(`\\bmajor arcana\\b[^\\n]{0,40}\\b${namePattern}\\b`, 'i'),

    // "The Death archetype", "Strength archetype", "archetype of Death"
    new RegExp(`\\b(?:the\\s+)?${namePattern}\\s+archetype\\b`, 'i'),
    new RegExp(`\\barchetype\\s+(?:of\\s+)?(?:the\\s+)?${namePattern}\\b`, 'i'),

    // "Death reversed", "Justice upright", "Strength (reversed)"
    new RegExp(`\\b${namePattern}\\s+(?:reversed|upright)\\b`, 'i'),
    new RegExp(`\\b${namePattern}\\s*\\(\\s*(?:reversed|upright)\\s*\\)`, 'i'),

    // Markdown bold formatting: "**Death**", "**Justice**"
    new RegExp(`\\*\\*${namePattern}\\*\\*`, 'i'),

    // Position labels: "Present: Death", "Card 1: Justice", "Outcome — Death"
    // Common position words followed by colon/dash and the card name
    new RegExp(`\\b(?:present|past|future|challenge|outcome|advice|anchor|core|heart|theme|guidance|position|card\\s*\\d+)\\s*[:\\-–—]\\s*(?:the\\s+)?${namePattern}\\b`, 'i'),

    // Card name followed by position context: "Death in the Present position"
    new RegExp(`\\b${namePattern}\\s+(?:in\\s+(?:the\\s+)?)?(?:present|past|future|challenge|outcome|advice|anchor)\\s+position\\b`, 'i')
  ];

  return patterns.some((regex) => regex.test(text));
}

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
    label: 'Claude Sonnet 4.5',
    isAvailable: (env) => Boolean(env?.ANTHROPIC_API_KEY)
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

function maybeLogPromptPayload(env, requestId, backendLabel, systemPrompt, userPrompt, promptMeta) {
  if (!shouldLogLLMPrompts(env)) return;

  console.log(`[${requestId}] [${backendLabel}] === SYSTEM PROMPT BEGIN ===`);
  console.log(systemPrompt);
  console.log(`[${requestId}] [${backendLabel}] === SYSTEM PROMPT END ===`);

  console.log(`[${requestId}] [${backendLabel}] === USER PROMPT BEGIN ===`);
  console.log(userPrompt);
  console.log(`[${requestId}] [${backendLabel}] === USER PROMPT END ===`);

  if (promptMeta?.estimatedTokens) {
    const { total, system, user, budget } = promptMeta.estimatedTokens;
    const budgetNote = budget ? ` / budget ${budget}` : '';
    console.log(`[${requestId}] [${backendLabel}] Estimated tokens: total ${total} (system ${system} + user ${user})${budgetNote}`);
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

export const onRequestPost = async ({ request, env }) => {
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
      deckStyle: requestDeckStyle
    } = normalizedPayload;
    const deckStyle = requestDeckStyle || spreadInfo?.deckStyle || 'rws-1909';

    console.log(`[${requestId}] Payload parsed:`, {
      spreadName: spreadInfo?.name,
      cardCount: cardsInfo?.length,
      hasQuestion: !!userQuestion,
      hasReflections: !!reflectionsText,
      reversalOverride: reversalFrameworkOverride,
      deckStyle,
      hasVisionProof: !!visionProof
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


    // STEP 1: Comprehensive spread analysis
    console.log(`[${requestId}] Starting spread analysis...`);
    const analysisStart = Date.now();
    const analysis = await performSpreadAnalysis(spreadInfo, cardsInfo, {
      reversalFrameworkOverride,
      deckStyle,
      userQuestion
    }, requestId);
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

    for (const backend of backendsToTry) {
      const attemptStart = Date.now();
      console.log(`[${requestId}] Attempting narrative backend ${backend.id} (${backend.label})...`);
      narrativePayload.narrativeEnhancements = [];
      narrativePayload.promptMeta = null;
      try {
        const result = await runNarrativeBackend(backend.id, env, narrativePayload, requestId);
        if (!result || !result.toString().trim()) {
          throw new Error('Backend returned empty narrative.');
        }

        // Quality gate: validate narrative structure and content before accepting
        const qualityMetrics = buildNarrativeMetrics(result, cardsInfo, deckStyle);
        const qualityIssues = [];

        // Check for hallucinated cards (strict: any hallucination fails)
        if (qualityMetrics.hallucinatedCards && qualityMetrics.hallucinatedCards.length > 0) {
          qualityIssues.push(`hallucinated cards: ${qualityMetrics.hallucinatedCards.join(', ')}`);
        }

        // Check card coverage (at least 50% of cards should be mentioned)
        if (qualityMetrics.cardCoverage < 0.5) {
          qualityIssues.push(`low card coverage: ${(qualityMetrics.cardCoverage * 100).toFixed(0)}%`);
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

    await persistReadingMetrics(env, {
      requestId,
      timestamp: new Date().toISOString(),
      provider,
      deckStyle,
      spreadKey: analysis.spreadKey,
      context,
      vision: visionMetrics,
      narrative: narrativeMetrics,
      narrativeEnhancements: narrativeEnhancementSummary,
      graphRAG: graphRAGStats,
      promptMeta,
      enhancementTelemetry,
      contextDiagnostics: diagnosticsPayload
    });

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
      }
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
async function performSpreadAnalysis(spreadInfo, cardsInfo, options = {}, requestId = 'unknown') {
  // Guard against malformed input (defensive: validatePayload should have run already)
  if (!spreadInfo || !Array.isArray(cardsInfo) || cardsInfo.length === 0) {
    console.warn(`[${requestId}] performSpreadAnalysis: missing or invalid spreadInfo/cardsInfo, falling back to generic themes only.`);
    return {
      themes: { suitCounts: {}, elementCounts: {}, reversalCount: 0, reversalFramework: 'contextual', reversalDescription: { name: 'Context-Dependent', description: 'Reversed cards are interpreted individually based on context.', guidance: 'Read each reversal in light of its position and relationships.' } },
      spreadAnalysis: null,
      spreadKey: 'general'
    };
  }

  // Theme analysis (suits, elements, majors, reversals)
  let themes;
  try {
    console.log(`[${requestId}] Analyzing spread themes...`);
    themes = await analyzeSpreadThemes(cardsInfo, {
      reversalFrameworkOverride: options.reversalFrameworkOverride
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
        formatPassagesForPrompt,
        buildRetrievalSummary,
        getPassageCountForSpread
      } = await import('../lib/graphRAG.js');

      if (isGraphRAGEnabled()) {
        const maxPassages = getPassageCountForSpread(spreadKey || 'general');
        const passages = retrievePassages(graphKeys, {
          maxPassages,
          userQuery: options.userQuestion
        });

        const formattedBlock = formatPassagesForPrompt(passages, {
          includeSource: true,
          markdown: true
        });

        const retrievalSummary = buildRetrievalSummary(graphKeys, passages);

        graphRAGPayload = {
          passages,
          formattedBlock,
          retrievalSummary,
          maxPassages
        };

        // Make memoized payload discoverable to downstream consumers
        themes.knowledgeGraph = {
          ...(themes.knowledgeGraph || {}),
          graphRAGPayload
        };
      }
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
    contextDiagnostics
  });

  if (promptMeta) {
    payload.promptMeta = promptMeta;
  }

  if (Array.isArray(promptDiagnostics) && promptDiagnostics.length) {
    payload.contextDiagnostics = Array.from(new Set([...(payload.contextDiagnostics || []), ...promptDiagnostics]));
  }

  console.log(`[${requestId}] System prompt length: ${systemPrompt.length}, User prompt length: ${userPrompt.length}`);
  maybeLogPromptPayload(env, requestId, 'azure-gpt5', systemPrompt, userPrompt, promptMeta);

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

  return content.trim();
}

/**
 * Enhanced Claude Sonnet 4.5 generation with position-relationship analysis
 */
async function generateWithClaudeSonnet45Enhanced(env, payload, requestId = 'unknown') {
  const { spreadInfo, cardsInfo, userQuestion, reflectionsText, analysis, context, visionInsights, contextDiagnostics = [] } = payload;
  const apiKey = env.ANTHROPIC_API_KEY;
  const apiUrl = env.ANTHROPIC_API_URL || 'https://api.anthropic.com/v1/messages';
  const model = 'claude-sonnet-4-5';
  const deckStyle = spreadInfo?.deckStyle || analysis?.themes?.deckStyle || cardsInfo?.[0]?.deckStyle || 'rws-1909';

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
    contextDiagnostics
  });

  if (promptMeta) {
    payload.promptMeta = promptMeta;
  }

  if (Array.isArray(promptDiagnostics) && promptDiagnostics.length) {
    payload.contextDiagnostics = Array.from(new Set([...(payload.contextDiagnostics || []), ...promptDiagnostics]));
  }

  maybeLogPromptPayload(env, requestId, 'claude-sonnet45', systemPrompt, userPrompt, promptMeta);

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192, // Increased to allow full narrative generation without arbitrary limits
      temperature: 0.7,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ]
    })
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Anthropic API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const content = Array.isArray(data.content)
    ? data.content.map(part => part.text || '').join('').trim()
    : (data.content?.toString?.() || '').trim();

  if (!content) {
    throw new Error('Empty response from Anthropic Claude Sonnet 4.5');
  }

  return content;
}

const SPREAD_READING_BUILDERS = {
  celtic: ({ spreadAnalysis, cardsInfo, userQuestion, reflectionsText, themes, context }) =>
    spreadAnalysis
      ? buildCelticCrossReading({
          cardsInfo,
          userQuestion,
          reflectionsText,
          celticAnalysis: spreadAnalysis,
          themes,
          context
        })
      : null,
  threeCard: ({ spreadAnalysis, cardsInfo, userQuestion, reflectionsText, themes, context }) =>
    spreadAnalysis
      ? buildThreeCardReading({
          cardsInfo,
          userQuestion,
          reflectionsText,
          threeCardAnalysis: spreadAnalysis,
          themes,
          context
        })
      : null,
  fiveCard: ({ spreadAnalysis, cardsInfo, userQuestion, reflectionsText, themes, context }) =>
    spreadAnalysis
      ? buildFiveCardReading({
          cardsInfo,
          userQuestion,
          reflectionsText,
          fiveCardAnalysis: spreadAnalysis,
          themes,
          context
        })
      : null,
  relationship: ({ cardsInfo, userQuestion, reflectionsText, themes, context }) =>
    buildRelationshipReading({ cardsInfo, userQuestion, reflectionsText, themes, context }),
  decision: ({ cardsInfo, userQuestion, reflectionsText, themes, context }) =>
    buildDecisionReading({ cardsInfo, userQuestion, reflectionsText, themes, context }),
  single: ({ cardsInfo, userQuestion, reflectionsText, themes, context }) =>
    buildSingleCardReading({ cardsInfo, userQuestion, reflectionsText, themes, context })
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
    context
  } = payload;
  const { themes, spreadAnalysis, spreadKey } = analysis;
  const collectedSections = [];

  const reading = await generateReadingFromAnalysis(
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

  return reading;
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
  const { collectValidation } = options;
  const spreadName = spreadInfo?.name?.trim() || 'your chosen spread';
  const entries = [];
  const safeCards = Array.isArray(cardsInfo) ? cardsInfo : [];

  // Opening
  const openingText = userQuestion && userQuestion.trim()
    ? `Focusing on the ${spreadName.toLowerCase()}, I attune to your question: "${userQuestion.trim()}"\n\nThe cards respond with insight that honors both seen and unseen influences.`
    : `Focusing on the ${spreadName.toLowerCase()}, the cards speak to the energy most present for you right now.`;

  entries.push({
    text: openingText,
    metadata: { type: 'opening', cards: safeCards.length > 0 ? [safeCards[0]] : [] }
  });

  // Cards section
  entries.push({
    text: buildCardsSection(safeCards, context),
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
    text: buildEnhancedSynthesis(safeCards, themes, userQuestion, context),
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
  return appendGenericReversalReminder(readingBody, safeCards, themes);
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
        label: typeof entry.label === 'string' ? entry.label : 'uploaded-image',
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
function buildCardsSection(cardsInfo, context) {
  const lines = cardsInfo.map(card => {
    const position = (card.position || '').trim() || `Card ${cardsInfo.indexOf(card) + 1}`;
    const description = buildPositionCardText(card, position, { context });
    return `**${position}**\n${description}`;
  });

  return `**The Cards Speak**\n\n${lines.join('\n\n')}`;
}

/**
 * Format meaning for position context
 */
/**
 * Enhanced synthesis with rich theme analysis
 */
function buildEnhancedSynthesis(cardsInfo, themes, userQuestion, context) {
  const safeCards = Array.isArray(cardsInfo) ? cardsInfo : [];
  let section = `**Synthesis & Guidance**\n\n`;

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
      const remedies = buildElementalRemedies(themes.elementCounts, safeCards.length, context);
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

function detectHallucinatedCards(readingText, cardsInfo = [], deckStyle = 'rws-1909') {
  if (!readingText) return [];

  const text = typeof readingText === 'string' ? readingText : '';
  const safeCards = Array.isArray(cardsInfo) ? cardsInfo : [];

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
    if (!pattern.test(text)) {
      return;
    }

    // For names that are also common vocabulary (Justice, Strength, Temperance, Death, Judgement),
    // only treat them as card mentions when there is explicit card-like context in the text.
    if (AMBIGUOUS_CARD_NORMALIZED.has(normalized) && !hasExplicitCardContext(text, name)) {
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
