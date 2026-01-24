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

// Core imports
import { inferContext } from '../lib/contextDetection.js';
import { parseMinorName } from '../lib/minorMeta.js';
import { jsonResponse, readJsonBody } from '../lib/utils.js';
import { safeParseReadingRequest } from '../../shared/contracts/readingSchema.js';
import { verifyVisionProof } from '../lib/visionProof.js';
import {
  buildPromptEngineeringPayload,
  shouldPersistPrompts
} from '../lib/promptEngineering.js';
import {
  scheduleEvaluation,
  buildHeuristicScores,
  checkEvalGate,
  runSyncEvaluationGate,
  generateSafeFallbackReading
} from '../lib/evaluation.js';
import { deriveEmotionalTone } from '../../src/data/emotionMapping.js';
import { getPositionWeight } from '../lib/positionWeights.js';
import { detectCrisisSignals } from '../lib/safetyChecks.js';
import { applyGraphRAGAlerts } from '../lib/graphRAGAlerts.js';
import { getUserFromRequest } from '../lib/auth.js';
import { enforceApiCallLimit } from '../lib/apiUsage.js';
import { buildTierLimitedPayload, getSubscriptionContext } from '../lib/entitlements.js';
import { canonicalCardKey, canonicalizeCardName } from '../../shared/vision/cardNameMapping.js';
import {
  loadActiveExperiments,
  getABAssignment,
  getVariantPromptOverrides,
  recordExperimentAssignment
} from '../lib/abTesting.js';
import { getReasoningEffort, getTextVerbosity } from '../lib/azureResponses.js';
import {
  callAzureResponsesStream,
  transformAzureStream,
  createSSEResponse,
  createSSEErrorResponse
} from '../lib/azureResponsesStream.js';
import {
  releaseReadingReservation,
  enforceReadingLimit
} from '../lib/readingLimits.js';
import {
  createReadingStream,
  wrapReadingStreamWithMetadata,
  collectSSEStreamText
} from '../lib/readingStream.js';
import {
  isEvalGateEnabled,
  isAzureTokenStreamingEnabled,
  allowStreamingWithEvalGate,
  summarizeNarrativeEnhancements,
  maybeLogNarrativeEnhancements,
  maybeLogEnhancementTelemetry,
  trimForTelemetry,
  resolveGraphRAGStats,
  normalizeBooleanFlag
} from '../lib/readingTelemetry.js';
import {
  NARRATIVE_BACKENDS,
  getAvailableNarrativeBackends,
  buildAzureGPT5Prompts,
  runNarrativeBackend
} from '../lib/narrativeBackends.js';
import {
  getSpreadDefinition,
  getSpreadKey,
  getQualityGateThresholds,
  buildNarrativeMetrics,
  annotateVisionInsights,
  buildVisionMetrics,
  persistReadingMetrics
} from '../lib/readingQuality.js';
import { buildMetricsPayload } from '../lib/telemetrySchema.js';
import {
  performSpreadAnalysis,
  buildEphemerisClientPayload,
  buildSpreadAnalysisPayload
} from '../lib/spreadAnalysisOrchestrator.js';

function evaluateQualityGate({ readingText, cardsInfo, deckStyle, analysis, requestId }) {
  const text = typeof readingText === 'string' ? readingText : '';
  const safeCards = Array.isArray(cardsInfo) ? cardsInfo : [];
  const spreadKey = analysis?.spreadKey || null;
  const qualityMetrics = buildNarrativeMetrics(text, safeCards, deckStyle);
  const qualityIssues = [];

  const { minCoverage, maxHallucinations, highWeightThreshold } = getQualityGateThresholds(
    spreadKey,
    safeCards.length
  );

  if (qualityMetrics.hallucinatedCards && qualityMetrics.hallucinatedCards.length > maxHallucinations) {
    qualityIssues.push(
      `excessive hallucinated cards (${qualityMetrics.hallucinatedCards.length} > ${maxHallucinations} allowed): ${qualityMetrics.hallucinatedCards.join(', ')}`
    );
  } else if (qualityMetrics.hallucinatedCards?.length > 0 && requestId) {
    console.log(
      `[${requestId}] Minor hallucinations (allowed): ${qualityMetrics.hallucinatedCards.join(', ')}`
    );
  }

  if (qualityMetrics.cardCoverage < minCoverage) {
    qualityIssues.push(
      `low card coverage: ${(qualityMetrics.cardCoverage * 100).toFixed(0)}% (min ${(minCoverage * 100).toFixed(0)}%)`
    );
  }

  const missingKeySet = new Set();
  const missingNameSet = new Set();
  (qualityMetrics.missingCards || []).forEach((missing) => {
    if (!missing) return;
    const missingKey = canonicalCardKey(missing, deckStyle);
    if (missingKey) missingKeySet.add(missingKey);
    missingNameSet.add(String(missing).toLowerCase());
  });
  const highWeightMisses = safeCards.reduce((acc, card, index) => {
    if (!card) return acc;
    const weight = getPositionWeight(spreadKey, index) || 0;
    if (weight < highWeightThreshold) return acc;
    const cardKey = card.canonicalKey || canonicalCardKey(card.canonicalName || card.card, deckStyle);
    const cardName = (card.canonicalName || card.card || '').toLowerCase();
    const isMissing = (cardKey && missingKeySet.has(cardKey)) ||
      (cardName && missingNameSet.has(cardName));
    if (isMissing) {
      acc.push(card.canonicalName || card.card);
    }
    return acc;
  }, []);
  if (highWeightMisses.length > 0) {
    qualityIssues.push(`missing high-weight positions: ${highWeightMisses.join(', ')}`);
  }

  const spine = qualityMetrics.spine || null;
  const MIN_SPINE_COMPLETION = 0.5;
  if (spine) {
    const cardSections = typeof spine.cardSections === 'number'
      ? spine.cardSections
      : spine.totalSections;
    const cardComplete = typeof spine.cardComplete === 'number'
      ? spine.cardComplete
      : spine.completeSections;
    if (cardSections > 0) {
      const spineRatio = (cardComplete || 0) / cardSections;
      if (spineRatio < MIN_SPINE_COMPLETION) {
        qualityIssues.push(
          `incomplete spine (${cardComplete || 0}/${cardSections} card sections, need ${Math.ceil(MIN_SPINE_COMPLETION * 100)}%)`
        );
      }
    }
  }

  if (qualityMetrics.spine && qualityMetrics.spine.totalSections === 0) {
    qualityIssues.push('no narrative sections detected');
  }

  return { qualityMetrics, qualityIssues, thresholds: { minCoverage, maxHallucinations, highWeightThreshold } };
}

async function finalizeReading({
  env,
  requestId,
  startTime,
  reading,
  provider,
  deckStyle,
  analysis,
  narrativePayload,
  contextDiagnostics,
  cardsInfo,
  userQuestion,
  reflectionsText,
  context,
  visionMetrics,
  abAssignment,
  capturedPrompts,
  capturedUsage,
  capturedReasoningSummary = null,
  waitUntil,
  personalization,
  backendErrors = [],
  acceptedQualityMetrics = null,
  allowGateBlocking = true,
  gateOverride = null,
  gateNotice = null
}) {
  const originalReading = reading;
  const originalProvider = provider;
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
  const graphRAGStats = resolveGraphRAGStats(analysis, promptMeta);
  const finalContextDiagnostics = Array.isArray(narrativePayload.contextDiagnostics)
    ? narrativePayload.contextDiagnostics
    : contextDiagnostics;
  const diagnosticsPayload = {
    messages: finalContextDiagnostics,
    count: finalContextDiagnostics.length
  };

  let evalGateResult = null;
  let wasGateBlocked = false;
  let finalReading = originalReading;
  let finalProvider = originalProvider;

  const baseNarrativeMetrics = acceptedQualityMetrics || buildNarrativeMetrics(originalReading, cardsInfo, deckStyle);
  let finalNarrativeMetrics = baseNarrativeMetrics;

  const evalParams = {
    reading: originalReading,
    userQuestion,
    cardsInfo,
    spreadKey: analysis.spreadKey,
    requestId,
    displayName: personalization?.displayName,
    narrativeMetrics: baseNarrativeMetrics
  };

  const gateResult = gateOverride?.blocked
    ? {
      passed: false,
      evalResult: gateOverride.evalResult || null,
      gateResult: { reason: gateOverride.reason || 'stream_safety' },
      latencyMs: gateOverride.latencyMs || 0
    }
    : await runSyncEvaluationGate(
      env,
      evalParams,
      baseNarrativeMetrics
    );

  evalGateResult = gateResult;

  if (!gateResult.passed) {
    wasGateBlocked = true;
    if (allowGateBlocking) {
      const gateLabel = gateOverride?.blocked ? 'Safety scan' : 'Evaluation gate';
      console.warn(`[${requestId}] ${gateLabel} blocked reading, using safe fallback`);

      finalReading = generateSafeFallbackReading({
        spreadKey: analysis.spreadKey,
        cardCount: cardsInfo.length,
        reason: gateResult.gateResult?.reason
      });
      finalProvider = 'safe-fallback';
      finalNarrativeMetrics = buildNarrativeMetrics(finalReading, cardsInfo, deckStyle);

      if (env.DB?.prepare) {
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
          // Insert minimal row with block info; persistReadingMetrics will update with full payload
          await env.DB.prepare(`
            INSERT INTO eval_metrics (
              request_id, spread_key, blocked, block_reason,
              eval_mode, overall_score, safety_flag, payload
            ) VALUES (?, ?, 1, ?, ?, ?, ?, ?)
            ON CONFLICT(request_id) DO UPDATE SET
              updated_at = datetime('now'),
              blocked = 1,
              block_reason = excluded.block_reason,
              eval_mode = excluded.eval_mode,
              overall_score = excluded.overall_score,
              safety_flag = excluded.safety_flag
          `).bind(
            requestId,
            analysis.spreadKey || null,
            gateResult.gateResult?.reason || null,
            gateResult.evalResult?.mode || 'model',
            gateResult.evalResult?.scores?.overall ?? null,
            gateResult.evalResult?.scores?.safety_flag ? 1 : 0,
            JSON.stringify(blockEvent)
          ).run();
        } catch (err) {
          console.warn(`[${requestId}] Failed to log gate block event: ${err.message}`);
        }
      }
    } else {
      console.warn(`[${requestId}] Evaluation gate would have blocked streaming response (${gateResult.gateResult?.reason || 'unknown'})`);
    }
  }

  // Build clean narrative metrics (spine + coverage only, no duplicated fields)
  const narrativeMetrics = {
    ...finalNarrativeMetrics
  };

  let promptEngineering = null;
  if (capturedPrompts && shouldPersistPrompts(env)) {
    try {
      const skipPIIRedaction = env.SKIP_PII_REDACTION === 'true' || env.SKIP_PII_REDACTION === true;
      promptEngineering = await buildPromptEngineeringPayload({
        systemPrompt: capturedPrompts.system,
        userPrompt: capturedPrompts.user,
        response: finalReading,
        userQuestion,
        reflectionsText,
        redactionOptions: {
          displayName: personalization?.displayName
        },
        skipPIIRedaction
      });
    } catch (err) {
      console.warn(`[${requestId}] Failed to build prompt engineering payload: ${err.message}`);
    }
  }

  const timestamp = new Date().toISOString();

  // Build deduplicated metrics payload using schema v2
  // Note: context is accessed via promptMeta.context (not passed separately)
  const metricsPayload = buildMetricsPayload({
    requestId,
    timestamp,
    provider: finalProvider,
    spreadKey: analysis.spreadKey,
    deckStyle,
    promptMeta,
    graphRAGStats,
    narrativeMetrics: wasGateBlocked && allowGateBlocking ? baseNarrativeMetrics : finalNarrativeMetrics,
    visionMetrics,
    abAssignment,
    capturedUsage,
    evalGateResult,
    wasGateBlocked,
    backendErrors,
    enhancementTelemetry,
    diagnostics: diagnosticsPayload
  });

  // Add prompt engineering payload if persisting prompts
  if (promptEngineering) {
    metricsPayload.promptEngineering = promptEngineering;
  }

  // Add gate block details if blocked
  if (wasGateBlocked && allowGateBlocking) {
    metricsPayload.evalOriginalPreview = trimForTelemetry(originalReading, 2000);
    metricsPayload.evalProviderOriginal = originalProvider;
  }

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

  const emotionalTone = deriveEmotionalTone(analysis.themes);

  const responseGateStatus = (allowGateBlocking && wasGateBlocked)
    ? {
      gateBlocked: true,
      gateReason: evalGateResult?.gateResult?.reason
    }
    : (gateNotice?.blocked ? {
      gateBlocked: true,
      gateReason: gateNotice.reason || null
    } : {});

  const responsePayload = {
    reading: finalReading,
    reasoningSummary: capturedReasoningSummary || undefined,
    provider: finalProvider,
    requestId,
    backendErrors: backendErrors.length > 0 ? backendErrors : undefined,
    themes: analysis.themes,
    emotionalTone,
    ephemeris: buildEphemerisClientPayload(analysis.ephemerisContext),
    context,
    contextDiagnostics: finalContextDiagnostics,
    narrativeMetrics,
    graphRAG: graphRAGStats,
    spreadAnalysis: buildSpreadAnalysisPayload(analysis),
    ...responseGateStatus
  };

  return {
    responsePayload,
    evalGateResult,
    wasGateBlocked
  };
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
  let readingReservation = null;
  const url = new URL(request.url);
  const acceptHeader = request.headers.get('accept') || '';
  const useStreaming = url.searchParams.get('stream') === 'true' || acceptHeader.includes('text/event-stream');

  console.log(`[${requestId}] === TAROT READING REQUEST START ===`);
  if (useStreaming) {
    console.log(`[${requestId}] Streaming response requested`);
  }

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
      cardsInfo: rawCardsInfo,
      userQuestion,
      reflectionsText,
      reversalFrameworkOverride,
      visionProof,
      deckStyle: requestDeckStyle,
      personalization,
      location: rawLocation,
      persistLocationToJournal: _persistLocationToJournal // Used by journal endpoint, not reading
    } = normalizedPayload;
    const deckStyle = requestDeckStyle || spreadInfo?.deckStyle || 'rws-1909';
    const cardsInfo = rawCardsInfo.map((card) => {
      const canonicalName = card?.canonicalName ||
        canonicalizeCardName(card?.card, deckStyle) ||
        card?.card ||
        null;
      const canonicalKey = card?.canonicalKey ||
        canonicalCardKey(canonicalName || card?.card, deckStyle) ||
        null;
      return {
        ...card,
        canonicalName,
        canonicalKey
      };
    });

    // Sanitize location: validate ranges, strip excess fields, keep only needed data
    let sanitizedLocation = null;
    if (rawLocation?.latitude != null && rawLocation?.longitude != null) {
      const lat = rawLocation.latitude;
      const lon = rawLocation.longitude;
      if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        sanitizedLocation = {
          latitude: lat,
          longitude: lon,
          timezone: rawLocation.timezone || null,
          source: rawLocation.source || 'browser'
        };
      }
    }

    console.log(`[${requestId}] Payload parsed:`, {
      spreadName: spreadInfo?.name,
      cardCount: cardsInfo?.length,
      hasQuestion: !!userQuestion,
      hasReflections: !!reflectionsText,
      reversalOverride: reversalFrameworkOverride,
      deckStyle,
      hasVisionProof: !!visionProof,
      hasPersonalization: Boolean(personalization),
      hasLocation: Boolean(sanitizedLocation),
      locationTimezone: sanitizedLocation?.timezone || null
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

    const contextDiagnostics = [];

    const user = await getUserFromRequest(request, env);
    const subscription = getSubscriptionContext(user);
    const subscriptionTier = subscription.effectiveTier;

    console.log(`[${requestId}] Subscription context:`, {
      tier: subscription.tier,
      status: subscription.status,
      effectiveTier: subscriptionTier,
      authProvider: user?.auth_provider || 'session_or_anonymous'
    });

    const crisisCheck = detectCrisisSignals([userQuestion, reflectionsText].filter(Boolean).join(' '));
    if (crisisCheck.matched) {
      console.warn(`[${requestId}] Crisis signals detected: ${crisisCheck.categories.join(', ')}`, {
        userId: user?.id || null,
        authProvider: user?.auth_provider || 'anonymous'
      });
      const crisisSpreadKey = getSpreadKey(spreadInfo.name, spreadInfo?.key || 'custom');
      const crisisMetrics = {
        requestId,
        timestamp: new Date().toISOString(),
        provider: 'safety-gate',
        deckStyle,
        spreadKey: crisisSpreadKey,
        narrative: { cardCount: cardsInfo.length },
        evalGate: {
          ran: false,
          blocked: true,
          reason: 'crisis_gate'
        },
        gateBlocked: true,
        gateReason: 'crisis_gate',
        crisisCategories: crisisCheck.categories
      };
      const persistPromise = persistReadingMetrics(env, crisisMetrics);
      if (typeof waitUntil === 'function') {
        waitUntil(persistPromise);
      } else {
        await persistPromise;
      }
      return jsonResponse({
        reading: `I can hear that you're going through something really difficult right now. What you're describing deserves more support than a tarot reading can offer.

Please consider reaching out to someone who can really be there for you:
- **Crisis Text Line**: Text HOME to 741741
- **National Suicide Prevention Lifeline**: 988 (US)
- **International Association for Suicide Prevention**: https://www.iasp.info/resources/Crisis_Centres/

Your cards will be here when you're ready. Right now, please take care of yourself.`,
        provider: 'safety-gate',
        requestId,
        gateBlocked: true,
        gateReason: 'crisis_gate',
        crisisCategories: crisisCheck.categories
      });
    }

    const spreadDefinition = getSpreadDefinition(spreadInfo.name);
    const requestedSpreadKey = getSpreadKey(spreadInfo.name, spreadInfo?.key || 'custom');
    const isCustomSpread = !spreadDefinition;
    const spreadsConfig = subscription.config?.spreads;
    const spreadAllowed = spreadsConfig === 'all' ||
      spreadsConfig === 'all+custom' ||
      (Array.isArray(spreadsConfig) && (
        spreadsConfig.includes(requestedSpreadKey) ||
        (isCustomSpread && spreadsConfig.includes('custom'))
      ));

    if (!spreadAllowed) {
      const entitlementKey = isCustomSpread ? 'custom' : requestedSpreadKey;
      const requiredTier = ['relationship', 'decision', 'celtic'].includes(entitlementKey) ? 'plus' : 'pro';
      return jsonResponse(
        buildTierLimitedPayload({
          message: `The "${spreadInfo.name}" spread requires an active ${requiredTier === 'plus' ? 'Plus' : 'Pro'} subscription`,
          user,
          requiredTier
        }),
        { status: 403 }
      );
    }

    if (!spreadDefinition && spreadsConfig !== 'all' && spreadsConfig !== 'all+custom' &&
      !(Array.isArray(spreadsConfig) && spreadsConfig.includes('custom'))) {
      return jsonResponse(
        { error: `Unknown spread "${spreadInfo.name}". Please update your app and try again.` },
        { status: 400 }
      );
    }

    if (spreadDefinition) {
      const providedKey = typeof spreadInfo.key === 'string' ? spreadInfo.key.trim() : '';
      if (providedKey && providedKey !== spreadDefinition.key) {
        return jsonResponse(
          { error: `Spread "${spreadInfo.name}" did not match its expected key. Please refresh and try again.` },
          { status: 400 }
        );
      }
      // Note: Card count validation is handled by validatePayload() above
    }

    // API key usage is Pro-only and subject to API call limits.
    if (user?.auth_provider === 'api_key') {
      const apiLimit = await enforceApiCallLimit(env, user);
      if (!apiLimit.allowed) {
        return jsonResponse(apiLimit.payload, { status: apiLimit.status });
      }
    }

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


    // Enforce reading limits before expensive processing
    const readingLimitResult = await enforceReadingLimit(env, request, user, subscription, requestId);
    if (!readingLimitResult.allowed) {
      console.log(`[${requestId}] Reading limit exceeded: ${readingLimitResult.used}/${readingLimitResult.limit}`);
      return jsonResponse({
        error: readingLimitResult.message,
        tierLimited: true,
        currentTier: subscriptionTier,
        accountTier: subscription.tier,
        currentStatus: subscription.status,
        effectiveTier: subscriptionTier,
        limit: readingLimitResult.limit,
        used: readingLimitResult.used,
        resetAt: readingLimitResult.resetAt
      }, { status: 429 });
    }
    readingReservation = readingLimitResult.reservation || null;

    // STEP 1: Comprehensive spread analysis
    console.log(`[${requestId}] Starting spread analysis...`);
    const analysisStart = Date.now();
    const analysis = await performSpreadAnalysis(spreadInfo, cardsInfo, {
      reversalFrameworkOverride,
      deckStyle,
      userQuestion,
      subscriptionTier,
      location: sanitizedLocation
    }, requestId, env);
    const analysisTime = Date.now() - analysisStart;
    console.log(`[${requestId}] Spread analysis completed in ${analysisTime}ms:`, {
      spreadKey: analysis.spreadKey,
      hasSpreadAnalysis: !!analysis.spreadAnalysis,
      reversalCount: analysis.themes?.reversalCount,
      reversalFramework: analysis.themes?.reversalFramework
    });

    const context = inferContext(userQuestion, analysis.spreadKey, {
      onUnknown: (message) => contextDiagnostics.push(message)
    });
    console.log(`[${requestId}] Context inferred: ${context}`);

    // A/B Testing: Load active experiments (assignment happens per provider attempt)
    let abAssignment = null;
    let activeExperiments = [];
    if (env.AB_TESTING_ENABLED === 'true' && env.DB) {
      try {
        activeExperiments = await loadActiveExperiments(env.DB);
      } catch (abErr) {
        console.warn(`[${requestId}] A/B testing experiment load failed: ${abErr.message}`);
      }
    }

    // STEP 2: Generate reading via configured narrative backends
    const baseContextDiagnostics = Array.isArray(contextDiagnostics) ? [...contextDiagnostics] : [];
    const narrativePayload = {
      spreadInfo,
      cardsInfo,
      userQuestion,
      reflectionsText,
      analysis,
      context,
      contextDiagnostics: [...baseContextDiagnostics],
      visionInsights: sanitizedVisionInsights,
      deckStyle,
      personalization: personalization || null,
      subscriptionTier,
      narrativeEnhancements: [],
      graphRAGPayload: analysis.graphRAGPayload || null,
      promptMeta: null
    };

    const backendErrors = [];

    const tokenStreamingEnabled = isAzureTokenStreamingEnabled(env);
    const evalGateEnabled = isEvalGateEnabled(env);
    const allowStreamingGateBypass = allowStreamingWithEvalGate(env);
    // Default on to preserve safety buffering when eval gate is disabled.
    const safetyScanStreamingEnabled = env?.STREAMING_SAFETY_SCAN_ENABLED === undefined
      ? true
      : normalizeBooleanFlag(env?.STREAMING_SAFETY_SCAN_ENABLED);
    const qualityGateStreamingEnabled = env?.STREAMING_QUALITY_GATE_ENABLED === undefined
      ? true
      : normalizeBooleanFlag(env?.STREAMING_QUALITY_GATE_ENABLED);
    const azureStreamingAvailable = Boolean(NARRATIVE_BACKENDS['azure-gpt5']?.isAvailable(env));
    const wantsAzureStreaming = useStreaming && tokenStreamingEnabled && azureStreamingAvailable;
    const canUseAzureStreaming = wantsAzureStreaming && allowStreamingGateBypass;
    const shouldGateStreaming = canUseAzureStreaming && evalGateEnabled;
    const shouldSafetyScanStreaming = canUseAzureStreaming && !evalGateEnabled && safetyScanStreamingEnabled;
    const shouldQualityGateStreaming = canUseAzureStreaming && qualityGateStreamingEnabled;
    const shouldBufferStreaming = canUseAzureStreaming && (
      shouldGateStreaming || shouldSafetyScanStreaming || shouldQualityGateStreaming
    );

    if (useStreaming && tokenStreamingEnabled && !allowStreamingGateBypass) {
      const reason = evalGateEnabled
        ? 'eval gate is enabled'
        : 'ALLOW_UNGATED_STREAMING/ALLOW_STREAMING_WITH_EVAL_GATE is false';
      console.warn(`[${requestId}] Token streaming disabled (${reason}); falling back to buffered streaming.`);
    } else if (useStreaming && tokenStreamingEnabled && evalGateEnabled && allowStreamingGateBypass) {
      console.warn(`[${requestId}] Token streaming enabled with eval gate; buffering output before streaming to enforce gate + quality checks.`);
    } else if (useStreaming && tokenStreamingEnabled && !evalGateEnabled && allowStreamingGateBypass && safetyScanStreamingEnabled) {
      console.warn(`[${requestId}] Token streaming enabled without eval gate; buffering output for safety scan + quality checks (STREAMING_SAFETY_SCAN_ENABLED).`);
    } else if (useStreaming && tokenStreamingEnabled && allowStreamingGateBypass && !evalGateEnabled && !safetyScanStreamingEnabled && qualityGateStreamingEnabled) {
      console.warn(`[${requestId}] Token streaming enabled without eval gate; buffering output for quality checks.`);
    } else if (useStreaming && tokenStreamingEnabled && allowStreamingGateBypass && !evalGateEnabled && !safetyScanStreamingEnabled && !qualityGateStreamingEnabled) {
      console.log(`[${requestId}] Token streaming enabled; sending live SSE without safety/quality buffer.`);
    }

    if (useStreaming && tokenStreamingEnabled && !azureStreamingAvailable) {
      console.warn(`[${requestId}] Token streaming requested but Azure GPT-5 is unavailable; falling back to buffered streaming.`);
    }

    let streamingFallback = false;
    let streamingGateNotice = null;

    if (canUseAzureStreaming) {
      const streamProvider = 'azure-gpt5';

      // A/B Testing: assign per-provider so targeting is accurate
      const attemptAssignment = activeExperiments.length
        ? getABAssignment(requestId, activeExperiments, {
          spreadKey: analysis.spreadKey,
          provider: streamProvider
        })
        : null;
      narrativePayload.abAssignment = attemptAssignment;
      narrativePayload.variantPromptOverrides = attemptAssignment
        ? getVariantPromptOverrides(attemptAssignment.variantId)
        : null;

      if (attemptAssignment) {
        abAssignment = attemptAssignment;
        console.log(`[${requestId}] A/B assignment: ${abAssignment.experimentId} → ${abAssignment.variantId} (provider: ${streamProvider})`);
        const recordPromise = recordExperimentAssignment(env.DB, abAssignment.experimentId);
        if (typeof waitUntil === 'function') {
          waitUntil(recordPromise);
        }
      }

      let systemPrompt = null;
      let userPrompt = null;
      try {
        ({ systemPrompt, userPrompt } = buildAzureGPT5Prompts(env, narrativePayload, requestId));
      } catch (promptError) {
        console.warn(`[${requestId}] Streaming prompt build failed: ${promptError.message}`);
        backendErrors.push({ backend: streamProvider, error: promptError.message, details: promptError.details || null });
        streamingFallback = true;
      }

      if (!streamingFallback) {
        applyGraphRAGAlerts(narrativePayload, requestId, streamProvider);

        const reasoningEffort = getReasoningEffort(env, env.AZURE_OPENAI_GPT5_MODEL);
        const verbosity = getTextVerbosity(env, env.AZURE_OPENAI_GPT5_MODEL);
        if (reasoningEffort === 'high') {
          console.log(`[${requestId}] Detected ${env.AZURE_OPENAI_GPT5_MODEL} deployment, using 'high' reasoning effort`);
        }

        console.log(`[${requestId}] Streaming request config:`, {
          deployment: env.AZURE_OPENAI_GPT5_MODEL,
          max_output_tokens: 'unlimited',
          reasoning_effort: reasoningEffort,
          reasoning_summary: 'auto',
          verbosity,
          stream: true
        });

        const capturedPrompts = {
          system: systemPrompt,
          user: userPrompt
        };

        try {
        const azureStream = await callAzureResponsesStream(env, {
          instructions: systemPrompt,
          input: userPrompt,
          maxTokens: null,
          reasoningEffort,
          reasoningSummary: 'auto',
          verbosity
        });

        const transformedStream = transformAzureStream(azureStream);

        if (shouldBufferStreaming) {
          // Buffer streamed output so the eval gate can block before we emit SSE.
          const collected = await collectSSEStreamText(transformedStream);
          if (collected.error || collected.sawError) {
            console.error(`[${requestId}] Streaming error: ${collected.error || 'unknown'}`);
            await releaseReadingReservation(env, readingReservation);
            return createSSEErrorResponse('Failed to generate reading.', 503);
          }

          const finalText = (collected.fullText || '').trim();
          if (!finalText) {
            console.warn(`[${requestId}] Streaming completed with empty reading text - releasing quota`);
            await releaseReadingReservation(env, readingReservation);
            return createSSEErrorResponse('Failed to generate reading.', 503);
          }

          const { qualityMetrics, qualityIssues } = evaluateQualityGate({
            readingText: finalText,
            cardsInfo,
            deckStyle,
            analysis,
            requestId
          });

          if (qualityIssues.length > 0) {
            console.warn(`[${requestId}] Streaming backend ${streamProvider} failed quality gate: ${qualityIssues.join('; ')}`);
            backendErrors.push({
              backend: streamProvider,
              error: `Narrative failed quality checks: ${qualityIssues.join('; ')}`,
              qualityIssues
            });
            streamingFallback = true;
            streamingGateNotice = {
              blocked: true,
              reason: 'quality_gate_streaming'
            };
          }

          if (streamingFallback) {
            console.warn(`[${requestId}] Streaming quality gate failed; falling back to buffered backends.`);
            // fall through to non-streaming backend loop
          } else {
            let gateOverride = null;
            if (shouldSafetyScanStreaming) {
              const safetyEval = buildHeuristicScores(
                qualityMetrics,
                analysis.spreadKey,
                { readingText: finalText, cardCount: cardsInfo.length }
              );
              const safetyGate = checkEvalGate(safetyEval);
              if (safetyGate.shouldBlock) {
                gateOverride = {
                  blocked: true,
                  reason: safetyGate.reason,
                  evalResult: safetyEval
                };
                console.warn(`[${requestId}] Streaming safety scan blocked output (${safetyGate.reason})`);
              }
            }

            const { responsePayload } = await finalizeReading({
              env,
              requestId,
              startTime,
              reading: finalText,
              provider: streamProvider,
              deckStyle,
              analysis,
              narrativePayload,
              contextDiagnostics,
              cardsInfo,
              userQuestion,
              reflectionsText,
              context,
              visionMetrics,
              abAssignment,
              capturedPrompts,
              capturedUsage: null,
              waitUntil,
              personalization,
              backendErrors: [],
              acceptedQualityMetrics: qualityMetrics,
              allowGateBlocking: true,
              gateOverride
            });

            return createSSEResponse(createReadingStream(responsePayload));
          }
        }

        if (streamingFallback) {
          // Skip live streaming when we need to fall back to buffered backends.
        } else if (!shouldBufferStreaming) {
          // Use promptMeta.graphRAG directly (set by buildAzureGPT5Prompts)
          const graphRAGStats = narrativePayload.promptMeta?.graphRAG || null;
          const finalContextDiagnostics = Array.isArray(narrativePayload.contextDiagnostics)
            ? narrativePayload.contextDiagnostics
            : contextDiagnostics;
          const emotionalTone = deriveEmotionalTone(analysis.themes);

          const streamMeta = {
            requestId,
            provider: streamProvider,
            themes: analysis.themes,
            emotionalTone,
            ephemeris: buildEphemerisClientPayload(analysis.ephemerisContext),
            context,
            contextDiagnostics: finalContextDiagnostics,
            graphRAG: graphRAGStats,
            spreadAnalysis: buildSpreadAnalysisPayload(analysis),
            gateBlocked: false,
            gateReason: null,
            backendErrors: null
          };

          const wrappedStream = wrapReadingStreamWithMetadata(transformedStream, {
            meta: streamMeta,
            ctx: { waitUntil },
            onComplete: async (fullText) => {
              const finalText = (fullText || '').trim();
              if (!finalText) {
                console.warn(`[${requestId}] Streaming completed with empty reading text - releasing quota`);
                // Release the reading reservation so user doesn't lose a quota slot for an empty response
                // This can happen if Azure returns only tool calls, errors, or empty content
                await releaseReadingReservation(env, readingReservation);
                return;
              }

              await finalizeReading({
                env,
                requestId,
                startTime,
                reading: finalText,
                provider: streamProvider,
                deckStyle,
                analysis,
                narrativePayload,
                contextDiagnostics,
                cardsInfo,
                userQuestion,
                reflectionsText,
                context,
                visionMetrics,
                abAssignment,
                capturedPrompts,
                capturedUsage: null,
                waitUntil,
                personalization,
                backendErrors: [],
                acceptedQualityMetrics: null,
                allowGateBlocking: false
              });
            },
            onError: async () => {
              await releaseReadingReservation(env, readingReservation);
            }
          });

          return createSSEResponse(wrappedStream);
        }
        } catch (streamError) {
          console.error(`[${requestId}] Streaming error: ${streamError.message}`);
          // Release the reading reservation - user shouldn't lose quota for failed streaming
          await releaseReadingReservation(env, readingReservation);
          return createSSEErrorResponse('Failed to generate reading.', 503);
        }
      }
    }

    let reading = null;
    let provider = 'local-composer';
    let acceptedQualityMetrics = null; // Store metrics from successful backend to avoid recomputation
    const candidateBackends = getAvailableNarrativeBackends(env);
    const backendsToTry = candidateBackends.length ? candidateBackends : [NARRATIVE_BACKENDS['local-composer']];

    // Track captured prompts for engineering persistence
    let capturedPrompts = null;
    let capturedUsage = null;
    let capturedReasoningSummary = null;

    for (const backend of backendsToTry) {
      const attemptStart = Date.now();
      console.log(`[${requestId}] Attempting narrative backend ${backend.id} (${backend.label})...`);
      narrativePayload.narrativeEnhancements = [];
      narrativePayload.promptMeta = null;
      // Reset diagnostics each attempt to avoid carrying alerts across backends
      narrativePayload.contextDiagnostics = [...baseContextDiagnostics];
      // A/B Testing: assign per-provider so targeting is accurate
      const attemptAssignment = activeExperiments.length
        ? getABAssignment(requestId, activeExperiments, {
          spreadKey: analysis.spreadKey,
          provider: backend.id
        })
        : null;
      narrativePayload.abAssignment = attemptAssignment;
      narrativePayload.variantPromptOverrides = attemptAssignment
        ? getVariantPromptOverrides(attemptAssignment.variantId)
        : null;
      try {
        const backendResult = await runNarrativeBackend(backend.id, env, narrativePayload, requestId);

        // Extract reading and prompts from result
        const result = typeof backendResult === 'object' && backendResult.reading
          ? backendResult.reading
          : backendResult;

        if (!result || !result.toString().trim()) {
          throw new Error('Backend returned empty narrative.');
        }

        // Capture prompt/usage for this attempt, but only associate it with the request
        // AFTER the quality gate passes (prevents persisting prompts from a backend that we reject).
        const attemptPrompts = (typeof backendResult === 'object' && backendResult.prompts)
          ? backendResult.prompts
          : null;
        const attemptUsage = (typeof backendResult === 'object' && backendResult.usage)
          ? backendResult.usage
          : null;
        const attemptReasoningSummary = (typeof backendResult === 'object' && backendResult.reasoningSummary)
          ? backendResult.reasoningSummary
          : null;
        // Capture promptMeta for truncation telemetry
        if (typeof backendResult === 'object' && backendResult.promptMeta) {
          narrativePayload.promptMeta = backendResult.promptMeta;
        }

        applyGraphRAGAlerts(narrativePayload, requestId, backend.id);

        // Quality gate: validate narrative structure and content before accepting
        const { qualityMetrics, qualityIssues } = evaluateQualityGate({
          readingText: result,
          cardsInfo,
          deckStyle,
          analysis,
          requestId
        });

        if (qualityIssues.length > 0) {
          console.warn(`[${requestId}] Backend ${backend.id} failed quality gate: ${qualityIssues.join('; ')}`);
          const qualityError = new Error(`Narrative failed quality checks: ${qualityIssues.join('; ')}`);
          qualityError.qualityIssues = qualityIssues;
          throw qualityError;
        }

        // Associate captured prompts/usage with the accepted backend attempt only.
        capturedPrompts = attemptPrompts;
        capturedUsage = attemptUsage;
        capturedReasoningSummary = attemptReasoningSummary;

        reading = result;
        provider = backend.id;
        acceptedQualityMetrics = qualityMetrics; // Store for reuse in response
        if (attemptAssignment) {
          abAssignment = attemptAssignment;
          console.log(`[${requestId}] A/B assignment: ${abAssignment.experimentId} → ${abAssignment.variantId} (provider: ${backend.id})`);
          const recordPromise = recordExperimentAssignment(env.DB, abAssignment.experimentId);
          if (typeof waitUntil === 'function') {
            waitUntil(recordPromise);
          }
        }
        console.log(`[${requestId}] Backend ${backend.id} succeeded in ${Date.now() - attemptStart}ms, reading length: ${reading.length}, coverage: ${(qualityMetrics.cardCoverage * 100).toFixed(0)}%`);
        break;
      } catch (err) {
        const errorEntry = { backend: backend.id, error: err.message };
        if (Array.isArray(err.qualityIssues) && err.qualityIssues.length > 0) {
          errorEntry.qualityIssues = err.qualityIssues;
        }
        backendErrors.push(errorEntry);
        console.error(`[${requestId}] Backend ${backend.id} failed:`, err.message);
      }
    }

    if (!reading) {
      console.error(`[${requestId}] All narrative backends failed.`, backendErrors);
      // Release the reading reservation - user shouldn't lose quota when all backends fail
      await releaseReadingReservation(env, readingReservation);
      return jsonResponse(
        { error: 'All narrative providers are currently unavailable. Please try again shortly.' },
        { status: 503 }
      );
    }

    let gateOverride = null;
    if (useStreaming && !evalGateEnabled && safetyScanStreamingEnabled) {
      const safetyEval = buildHeuristicScores(
        acceptedQualityMetrics || buildNarrativeMetrics(reading, cardsInfo, deckStyle),
        analysis.spreadKey,
        { readingText: reading, cardCount: cardsInfo.length }
      );
      const safetyGate = checkEvalGate(safetyEval);
      if (safetyGate.shouldBlock) {
        gateOverride = {
          blocked: true,
          reason: safetyGate.reason,
          evalResult: safetyEval
        };
        console.warn(`[${requestId}] Streaming safety scan blocked buffered backend output (${safetyGate.reason})`);
      }
    }

    const { responsePayload } = await finalizeReading({
      env,
      requestId,
      startTime,
      reading,
      provider,
      deckStyle,
      analysis,
      narrativePayload,
      contextDiagnostics,
      cardsInfo,
      userQuestion,
      reflectionsText,
      context,
      visionMetrics,
      abAssignment,
      capturedPrompts,
      capturedUsage,
      capturedReasoningSummary,
      waitUntil,
      personalization,
      backendErrors,
      acceptedQualityMetrics,
      gateNotice: streamingGateNotice,
      allowGateBlocking: true,
      gateOverride
    });

    if (useStreaming) {
      return createSSEResponse(createReadingStream(responsePayload));
    }

    return jsonResponse(responsePayload);
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[${requestId}] FATAL ERROR after ${totalTime}ms:`, {
      error: error.message,
      stack: error.stack,
      name: error.name,
      details: error.details || null
    });
    await releaseReadingReservation(env, readingReservation);
    console.log(`[${requestId}] === TAROT READING REQUEST END (ERROR) ===`);

    if (error?.message === 'PROMPT_SAFETY_BUDGET_EXCEEDED') {
      return jsonResponse({
        error: 'prompt_budget_exceeded',
        message: 'Unable to generate reading with current configuration.',
        details: error.details || null
      }, { status: 500 });
    }

    if (useStreaming) {
      return createSSEErrorResponse('Failed to generate reading.', 500);
    }

    return jsonResponse(
      { error: 'Failed to generate reading.' },
      { status: 500 }
    );
  }
};

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

  // Validate spread card count for known spreads
  const spreadDefinition = getSpreadDefinition(spreadInfo.name);
  if (spreadDefinition && typeof spreadDefinition.count === 'number') {
    if (cardsInfo.length !== spreadDefinition.count) {
      return `Spread "${spreadInfo.name}" expects ${spreadDefinition.count} cards, but received ${cardsInfo.length}.`;
    }
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
