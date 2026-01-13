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
import { buildOpening, setProseMode } from '../lib/narrative/helpers.js';
import { buildReadingReasoning } from '../lib/narrative/reasoning.js';
import {
  buildReasoningAwareOpening,
  buildReasoningSynthesis
} from '../lib/narrative/reasoningIntegration.js';
import { getPositionWeight } from '../lib/positionWeights.js';
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
import { getClientIdentifier } from '../lib/clientId.js';
import { enforceApiCallLimit } from '../lib/apiUsage.js';
import { buildTierLimitedPayload, getSubscriptionContext } from '../lib/entitlements.js';
import {
  loadActiveExperiments,
  getABAssignment,
  getVariantPromptOverrides,
  recordExperimentAssignment
} from '../lib/abTesting.js';
import {
  decrementUsageCounter,
  getMonthKeyUtc,
  getResetAtUtc,
  getUsageRow,
  incrementUsageCounter
} from '../lib/usageTracking.js';
import {
  callAzureResponses,
  getReasoningEffort
} from '../lib/azureResponses.js';
import {
  callAzureResponsesStream,
  transformAzureStream,
  createSSEResponse,
  createSSEErrorResponse
} from '../lib/azureResponsesStream.js';

// ============================================================================
// Reading Limit Enforcement
// ============================================================================

const READINGS_MONTHLY_KEY_PREFIX = 'readings-monthly';
const READINGS_MONTHLY_TTL_SECONDS = 35 * 24 * 60 * 60;

async function releaseReadingReservation(env, reservation) {
  if (!reservation) return;

  try {
    if (reservation.type === 'd1') {
      await decrementUsageCounter(env.DB, {
        userId: reservation.userId,
        month: reservation.month,
        counter: 'readings',
        nowMs: Date.now()
      });
      return;
    }

    if (reservation.type === 'kv') {
      const store = env?.RATELIMIT;
      if (!store) return;

      const existing = await store.get(reservation.key);
      const currentCount = existing ? Number(existing) || 0 : 0;
      const next = Math.max(0, currentCount - 1);

      await store.put(reservation.key, String(next), {
        expirationTtl: READINGS_MONTHLY_TTL_SECONDS
      });
    }
  } catch (error) {
    console.warn('Failed to release reading reservation:', error?.message || error);
  }
}

async function enforceReadingLimit(env, request, user, subscription, requestId) {
  const limit = subscription?.config?.monthlyReadings ?? 5;
  const now = new Date();
  const month = getMonthKeyUtc(now);
  const resetAt = getResetAtUtc(now);

  // Authenticated users: use D1 tracking (also tracks unlimited tiers for usage meter).
  if (user?.id && env?.DB) {
    try {
      const nowMs = Date.now();

      if (limit === Infinity) {
        await incrementUsageCounter(env.DB, {
          userId: user.id,
          month,
          counter: 'readings',
          nowMs
        });
        const row = await getUsageRow(env.DB, user.id, month);
        return {
          allowed: true,
          used: row?.readings_count || 0,
          limit: null,
          resetAt,
          reservation: { type: 'd1', userId: user.id, month }
        };
      }

      const incrementResult = await incrementUsageCounter(env.DB, {
        userId: user.id,
        month,
        counter: 'readings',
        limit,
        nowMs
      });

      if (incrementResult.changed === 0) {
        const row = await getUsageRow(env.DB, user.id, month);
        const used = row?.readings_count || limit;
        return {
          allowed: false,
          used,
          limit,
          resetAt,
          message: `You've reached your monthly reading limit (${limit}). Upgrade for more readings.`
        };
      }

      const row = await getUsageRow(env.DB, user.id, month);
      const used = row?.readings_count || 0;
      console.log(`[${requestId}] Reading usage: ${used}/${limit} (${subscription?.effectiveTier || subscription?.tier || 'free'})`);

      return {
        allowed: true,
        used,
        limit,
        resetAt,
        reservation: { type: 'd1', userId: user.id, month }
      };
    } catch (error) {
      console.error(`[${requestId}] Usage tracking error (allowing request):`, error.message);
      return { allowed: true, used: 0, limit: limit === Infinity ? null : limit, resetAt };
    }
  }

  // Anonymous users: enforce IP-based monthly quota in KV when available.
  if (limit !== Infinity && env?.RATELIMIT) {
    try {
      const clientId = getClientIdentifier(request);
      const key = `${READINGS_MONTHLY_KEY_PREFIX}:${clientId}:${month}`;
      const existing = await env.RATELIMIT.get(key);
      const currentCount = existing ? Number(existing) || 0 : 0;

      if (currentCount >= limit) {
        return {
          allowed: false,
          used: currentCount,
          limit,
          resetAt,
          message: `You've reached your monthly reading limit (${limit}). Upgrade for more readings.`
        };
      }

      const nextCount = currentCount + 1;
      await env.RATELIMIT.put(key, String(nextCount), {
        expirationTtl: READINGS_MONTHLY_TTL_SECONDS
      });

      return {
        allowed: true,
        used: nextCount,
        limit,
        resetAt,
        reservation: { type: 'kv', key }
      };
    } catch (error) {
      console.warn(`[${requestId}] Guest usage tracking failed, allowing request:`, error?.message || error);
    }
  }

  return { allowed: true, used: 0, limit: limit === Infinity ? null : limit, resetAt };
}

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

// Return a minimal, UI-friendly ephemeris payload.
// We intentionally do NOT ship full planet/aspect arrays to keep payload size small.
function buildEphemerisClientPayload(ephemerisContext) {
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

function getSpreadKey(spreadName) {
  const def = getSpreadDefinition(spreadName);
  return def?.key || 'general';
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

const HIGH_WEIGHT_POSITION_THRESHOLD = 0.75;

function getQualityGateThresholds(spreadKey, cardCount) {
  const normalizedSpread = (spreadKey || 'general').toLowerCase();
  if (normalizedSpread === 'celtic') {
    return { minCoverage: 0.75, maxHallucinations: 2, highWeightThreshold: HIGH_WEIGHT_POSITION_THRESHOLD };
  }

  if (['relationship', 'decision', 'threecard', 'fivecard', 'single'].includes(normalizedSpread)) {
    return { minCoverage: 0.8, maxHallucinations: 1, highWeightThreshold: HIGH_WEIGHT_POSITION_THRESHOLD };
  }

  // Default: scale slightly by size; larger spreads allow a tiny bit more slack.
  const isLargeSpread = cardCount >= 8;
  return {
    minCoverage: isLargeSpread ? 0.75 : 0.8,
    maxHallucinations: isLargeSpread ? 2 : 1,
    highWeightThreshold: HIGH_WEIGHT_POSITION_THRESHOLD
  };
}

function normalizeBooleanFlag(value) {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null) return false;
  return String(value).toLowerCase() === 'true';
}

function isEvalGateEnabled(env) {
  return normalizeBooleanFlag(env?.EVAL_ENABLED) && normalizeBooleanFlag(env?.EVAL_GATE_ENABLED);
}

function isAzureTokenStreamingEnabled(env) {
  if (!env) return false;
  if (env.AZURE_OPENAI_STREAMING_ENABLED !== undefined) {
    return normalizeBooleanFlag(env.AZURE_OPENAI_STREAMING_ENABLED);
  }
  if (env.ENABLE_AZURE_TOKEN_STREAMING !== undefined) {
    return normalizeBooleanFlag(env.ENABLE_AZURE_TOKEN_STREAMING);
  }
  return false;
}

function allowStreamingWithEvalGate(env) {
  if (!env) return false;
  if (env.ALLOW_STREAMING_WITH_EVAL_GATE !== undefined) {
    return normalizeBooleanFlag(env.ALLOW_STREAMING_WITH_EVAL_GATE);
  }
  if (env.ALLOW_UNGATED_STREAMING !== undefined) {
    return normalizeBooleanFlag(env.ALLOW_UNGATED_STREAMING);
  }
  return false;
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
 *
 * Semantic scoring is enabled by default when the embeddings API is configured
 * (AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY). This function only handles
 * explicit env var overrides; auto-detection happens in the calling code.
 *
 * @param {Object} env - Environment variables
 * @returns {boolean|null} - true/false for explicit env var config, null for auto-detect
 */
function getSemanticScoringConfig(env) {
  if (!env) return null;

  // Check explicit override via environment variables
  // These allow operators to force-enable or force-disable semantic scoring
  if (env.ENABLE_SEMANTIC_SCORING !== undefined) {
    return normalizeBooleanFlag(env.ENABLE_SEMANTIC_SCORING);
  }
  if (env.GRAPHRAG_SEMANTIC_SCORING !== undefined) {
    return normalizeBooleanFlag(env.GRAPHRAG_SEMANTIC_SCORING);
  }

  // Return null to enable auto-detection based on API availability
  // Auto-detection logic: if AZURE_OPENAI_ENDPOINT + API_KEY are set, semantic scoring is enabled
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

function formatSSEEvent(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function chunkTextForStreaming(text, chunkSize = 160) {
  if (!text || typeof text !== 'string') return [];
  const size = Number.isFinite(chunkSize) && chunkSize > 0 ? Math.floor(chunkSize) : 160;
  const chunks = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

function createReadingStream(responsePayload, options = {}) {
  const encoder = new TextEncoder();
  const readingText = typeof responsePayload?.reading === 'string' ? responsePayload.reading : '';
  const chunks = chunkTextForStreaming(readingText, options.chunkSize);
  const meta = {
    requestId: responsePayload?.requestId || null,
    provider: responsePayload?.provider || null,
    themes: responsePayload?.themes || null,
    emotionalTone: responsePayload?.emotionalTone || null,
    ephemeris: responsePayload?.ephemeris || null,
    context: responsePayload?.context || null,
    contextDiagnostics: responsePayload?.contextDiagnostics || [],
    graphRAG: responsePayload?.graphRAG || null,
    spreadAnalysis: responsePayload?.spreadAnalysis || null,
    gateBlocked: responsePayload?.gateBlocked || false,
    gateReason: responsePayload?.gateReason || null,
    backendErrors: responsePayload?.backendErrors || null
  };
  const donePayload = {
    fullText: readingText,
    provider: responsePayload?.provider || null,
    requestId: responsePayload?.requestId || null,
    gateBlocked: responsePayload?.gateBlocked || false,
    gateReason: responsePayload?.gateReason || null
  };
  const streamEvents = [
    formatSSEEvent('meta', meta),
    ...chunks.map((chunk) => formatSSEEvent('delta', { text: chunk })),
    formatSSEEvent('done', donePayload)
  ];
  let index = 0;

  return new ReadableStream({
    pull(controller) {
      if (index >= streamEvents.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(streamEvents[index]));
      index += 1;
    }
  });
}

function wrapReadingStreamWithMetadata(stream, { meta, ctx, onComplete }) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  let fullText = '';
  let sawError = false;
  // Buffer for SSE events that may be split across chunks
  let sseBuffer = '';

  // Helper to process complete SSE events from buffer
  function processCompleteEvents(buffer, isFinal = false) {
    const events = buffer.split(/\r?\n\r?\n/);
    // Keep the last element as potential incomplete event (unless final)
    const remainder = isFinal ? '' : (events.pop() || '');

    for (const eventBlock of events) {
      if (!eventBlock.trim()) continue;

      const lines = eventBlock.split(/\r?\n/);
      let eventType = '';
      let eventData = '';

      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          eventData = line.slice(5).trim();
        }
      }

      // Check for error events
      if (eventType === 'error') {
        sawError = true;
      }

      // Extract text from delta events
      if (eventType === 'delta' && eventData) {
        try {
          const data = JSON.parse(eventData);
          if (data.text) {
            fullText += data.text;
          }
        } catch {
          // Ignore parse errors
        }
      }
    }

    return remainder;
  }

  return new ReadableStream({
    async start(controller) {
      const metaEvent = formatSSEEvent('meta', meta);
      controller.enqueue(encoder.encode(metaEvent));

      const reader = stream.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            // Process any remaining buffered content
            if (sseBuffer.length > 0) {
              processCompleteEvents(sseBuffer, true);
            }

            if (!sawError && onComplete) {
              const trackingPromise = onComplete(fullText).catch(err => {
                console.warn('[wrapReadingStreamWithMetadata] onComplete error:', err.message);
              });
              if (ctx?.waitUntil) {
                ctx.waitUntil(trackingPromise);
              }
            } else if (sawError) {
              console.log('[wrapReadingStreamWithMetadata] Skipping completion due to error event');
            }
            controller.close();
            break;
          }

          // Decode the chunk and add to buffer
          const chunk = decoder.decode(value, { stream: true });
          sseBuffer += chunk;

          // Process complete SSE events, keeping any trailing incomplete event
          // This handles events that span multiple chunks (common on slow networks)
          sseBuffer = processCompleteEvents(sseBuffer, false);

          // Pass through the chunk unchanged to the client
          controller.enqueue(value);
        }
      } catch (error) {
        console.error('[wrapReadingStreamWithMetadata] Stream error:', error.message);

        const errorEvent = formatSSEEvent('error', { message: error.message });
        controller.enqueue(encoder.encode(errorEvent));
        controller.close();
      } finally {
        reader.releaseLock();
      }
    }
  });
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
  context,
  visionMetrics,
  abAssignment,
  capturedPrompts,
  capturedUsage,
  waitUntil,
  personalization,
  backendErrors = [],
  acceptedQualityMetrics = null,
  allowGateBlocking = true
}) {
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
  const finalContextDiagnostics = Array.isArray(narrativePayload.contextDiagnostics)
    ? narrativePayload.contextDiagnostics
    : contextDiagnostics;
  const diagnosticsPayload = {
    messages: finalContextDiagnostics,
    count: finalContextDiagnostics.length
  };

  const baseNarrativeMetrics = acceptedQualityMetrics || buildNarrativeMetrics(reading, cardsInfo, deckStyle);
  const narrativeMetrics = {
    ...baseNarrativeMetrics,
    enhancementTelemetry,
    promptTokens,
    promptSlimming,
    graphRAG: graphRAGStats,
    contextDiagnostics: diagnosticsPayload
  };

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
    wasGateBlocked = true;
    if (allowGateBlocking) {
      console.warn(`[${requestId}] Evaluation gate blocked reading, using safe fallback`);

      reading = generateSafeFallbackReading({
        spreadKey: analysis.spreadKey,
        cardCount: cardsInfo.length,
        reason: gateResult.gateResult?.reason
      });
      provider = 'safe-fallback';

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
    } else {
      console.warn(`[${requestId}] Evaluation gate would have blocked streaming response (${gateResult.gateResult?.reason || 'unknown'})`);
    }
  }

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

  const tokens = capturedUsage ? {
    input: capturedUsage.input_tokens,
    output: capturedUsage.output_tokens,
    total: capturedUsage.total_tokens || (capturedUsage.input_tokens + capturedUsage.output_tokens),
    source: 'api'
  } : null;

  const metricsPayload = {
    requestId,
    timestamp,
    provider,
    deckStyle,
    spreadKey: analysis.spreadKey,
    context,
    readingPromptVersion: promptMeta?.readingPromptVersion || null,
    variantId: abAssignment?.variantId || null,
    experimentId: abAssignment?.experimentId || null,
    tokens,
    vision: visionMetrics,
    narrative: narrativeMetrics,
    narrativeEnhancements: narrativeEnhancementSummary,
    graphRAG: graphRAGStats,
    promptMeta,
    enhancementTelemetry,
    contextDiagnostics: diagnosticsPayload,
    promptEngineering,
    llmUsage: capturedUsage,
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

  const emotionalTone = deriveEmotionalTone(analysis.themes);

  const responsePayload = {
    reading,
    provider,
    requestId,
    backendErrors: backendErrors.length > 0 ? backendErrors : undefined,
    themes: analysis.themes,
    emotionalTone,
    ephemeris: buildEphemerisClientPayload(analysis.ephemerisContext),
    context,
    contextDiagnostics: finalContextDiagnostics,
    narrativeMetrics,
    graphRAG: graphRAGStats,
    spreadAnalysis: {
      version: '1.0.0',
      spreadKey: analysis.spreadKey,
      ...(analysis.spreadAnalysis || {})
    },
    ...(allowGateBlocking && wasGateBlocked ? {
      gateBlocked: true,
      gateReason: evalGateResult?.gateResult?.reason
    } : {})
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
      cardsInfo,
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

    const user = await getUserFromRequest(request, env);
    const subscription = getSubscriptionContext(user);
    const subscriptionTier = subscription.effectiveTier;

    console.log(`[${requestId}] Subscription context:`, {
      tier: subscription.tier,
      status: subscription.status,
      effectiveTier: subscriptionTier,
      authProvider: user?.auth_provider || 'session_or_anonymous'
    });

    const requestedSpreadKey = getSpreadKey(spreadInfo.name);
    const spreadsConfig = subscription.config?.spreads;
    const spreadAllowed = spreadsConfig === 'all' ||
      spreadsConfig === 'all+custom' ||
      (Array.isArray(spreadsConfig) && spreadsConfig.includes(requestedSpreadKey));

    if (!spreadAllowed) {
      const requiredTier = ['relationship', 'decision', 'celtic'].includes(requestedSpreadKey) ? 'plus' : 'pro';
      return jsonResponse(
        buildTierLimitedPayload({
          message: `The "${spreadInfo.name}" spread requires an active ${requiredTier === 'plus' ? 'Plus' : 'Pro'} subscription`,
          user,
          requiredTier
        }),
        { status: 403 }
      );
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

    const contextDiagnostics = [];
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
        ephemeris: buildEphemerisClientPayload(analysis.ephemerisContext),
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

    const tokenStreamingEnabled = isAzureTokenStreamingEnabled(env);
    const evalGateEnabled = isEvalGateEnabled(env);
    const allowStreamingGateBypass = allowStreamingWithEvalGate(env);
    const azureStreamingAvailable = Boolean(NARRATIVE_BACKENDS['azure-gpt5']?.isAvailable(env));
    const canUseAzureStreaming = useStreaming &&
      tokenStreamingEnabled &&
      azureStreamingAvailable &&
      (!evalGateEnabled || allowStreamingGateBypass);

    if (useStreaming && tokenStreamingEnabled && evalGateEnabled && !allowStreamingGateBypass) {
      console.warn(`[${requestId}] Token streaming disabled while eval gate is enabled; falling back to buffered streaming.`);
    }

    if (useStreaming && tokenStreamingEnabled && !azureStreamingAvailable) {
      console.warn(`[${requestId}] Token streaming requested but Azure GPT-5 is unavailable; falling back to buffered streaming.`);
    }

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

      const { systemPrompt, userPrompt } = buildAzureGPT5Prompts(env, narrativePayload, requestId);
      const graphRAGAlerts = collectGraphRAGAlerts(narrativePayload.promptMeta || {});
      if (graphRAGAlerts.length) {
        graphRAGAlerts.forEach((msg) => console.warn(`[${requestId}] [${streamProvider}] ${msg}`));
        narrativePayload.contextDiagnostics = Array.from(new Set([...(narrativePayload.contextDiagnostics || []), ...graphRAGAlerts]));
      }

      const reasoningEffort = getReasoningEffort(env.AZURE_OPENAI_GPT5_MODEL);
      if (reasoningEffort === 'high') {
        console.log(`[${requestId}] Detected ${env.AZURE_OPENAI_GPT5_MODEL} deployment, using 'high' reasoning effort`);
      }

      console.log(`[${requestId}] Streaming request config:`, {
        deployment: env.AZURE_OPENAI_GPT5_MODEL,
        max_output_tokens: 'unlimited',
        reasoning_effort: reasoningEffort,
        reasoning_summary: 'auto',
        verbosity: 'medium',
        stream: true
      });

      try {
        const azureStream = await callAzureResponsesStream(env, {
          instructions: systemPrompt,
          input: userPrompt,
          maxTokens: null,
          reasoningEffort,
          reasoningSummary: 'auto',
          verbosity: 'medium'
        });

        const transformedStream = transformAzureStream(azureStream);

        const graphRAGStats = analysis.graphRAGPayload?.retrievalSummary || null;
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
          spreadAnalysis: {
            version: '1.0.0',
            spreadKey: analysis.spreadKey,
            ...(analysis.spreadAnalysis || {})
          },
          gateBlocked: false,
          gateReason: null,
          backendErrors: null
        };

        const capturedPrompts = {
          system: systemPrompt,
          user: userPrompt
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
          }
        });

        return createSSEResponse(wrappedStream);
      } catch (streamError) {
        console.error(`[${requestId}] Streaming error: ${streamError.message}`);
        // Release the reading reservation - user shouldn't lose quota for failed streaming
        await releaseReadingReservation(env, readingReservation);
        return createSSEErrorResponse('Failed to generate reading.', 503);
      }
    }

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

        const graphRAGAlerts = collectGraphRAGAlerts(narrativePayload.promptMeta || {});
        if (graphRAGAlerts.length) {
          graphRAGAlerts.forEach((msg) => console.warn(`[${requestId}] [${backend.id}] ${msg}`));
          narrativePayload.contextDiagnostics = Array.from(new Set([...(narrativePayload.contextDiagnostics || []), ...graphRAGAlerts]));
        }

        // Quality gate: validate narrative structure and content before accepting
        const qualityMetrics = buildNarrativeMetrics(result, cardsInfo, deckStyle);
        const qualityIssues = [];

        const { minCoverage, maxHallucinations, highWeightThreshold } = getQualityGateThresholds(
          analysis.spreadKey,
          cardsInfo.length
        );

        // Check for hallucinated cards with spread-aware limits
        if (qualityMetrics.hallucinatedCards && qualityMetrics.hallucinatedCards.length > maxHallucinations) {
          qualityIssues.push(`excessive hallucinated cards (${qualityMetrics.hallucinatedCards.length} > ${maxHallucinations} allowed): ${qualityMetrics.hallucinatedCards.join(', ')}`);
        } else if (qualityMetrics.hallucinatedCards?.length > 0) {
          console.log(`[${requestId}] Minor hallucinations (allowed): ${qualityMetrics.hallucinatedCards.join(', ')}`);
        }

        // Check card coverage with higher bar for small/medium spreads
        if (qualityMetrics.cardCoverage < minCoverage) {
          qualityIssues.push(`low card coverage: ${(qualityMetrics.cardCoverage * 100).toFixed(0)}% (min ${(minCoverage * 100).toFixed(0)}%)`);
        }

        // Require high-weight positions to be covered explicitly
        const missingSet = new Set(qualityMetrics.missingCards || []);
        const highWeightMisses = (cardsInfo || []).reduce((acc, card, index) => {
          if (!card || !card.card) return acc;
          const weight = getPositionWeight(analysis.spreadKey, index) || 0;
          if (weight >= highWeightThreshold && missingSet.has(card.card)) {
            acc.push(card.card);
          }
          return acc;
        }, []);
        if (highWeightMisses.length > 0) {
          qualityIssues.push(`missing high-weight positions: ${highWeightMisses.join(', ')}`);
        }

        // Enforce spine completeness beyond mere section presence
        // The prompt instructs the LLM to "LOOSELY follow" the spine structure, and explicitly
        // says the Opening should have "felt experience BEFORE introducing frameworks".
        // Spine labels (**WHAT**, **WHY**, **WHAT'S NEXT**) are specified for "card sections",
        // not structural sections like Opening, Gentle Next Steps, and Closing.
        // Therefore, we require 50% of sections to be complete (typically 2-3 card sections
        // out of 5 total), not 100%.
        const spine = qualityMetrics.spine || null;
        const MIN_SPINE_COMPLETION = 0.5;
        if (spine && spine.totalSections > 0) {
          const spineRatio = (spine.completeSections || 0) / spine.totalSections;
          if (spineRatio < MIN_SPINE_COMPLETION) {
            qualityIssues.push(`incomplete spine (${spine.completeSections || 0}/${spine.totalSections}, need ${Math.ceil(MIN_SPINE_COMPLETION * 100)}%)`);
          }
        }

        // Check narrative has at least one section (basic structure validation)
        if (qualityMetrics.spine && qualityMetrics.spine.totalSections === 0) {
          qualityIssues.push('no narrative sections detected');
        }

        if (qualityIssues.length > 0) {
          console.warn(`[${requestId}] Backend ${backend.id} failed quality gate: ${qualityIssues.join('; ')}`);
          throw new Error(`Narrative failed quality checks: ${qualityIssues.join('; ')}`);
        }

        // Associate captured prompts/usage with the accepted backend attempt only.
        capturedPrompts = attemptPrompts;
        capturedUsage = attemptUsage;

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
        backendErrors.push({ backend: backend.id, error: err.message });
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
      context,
      visionMetrics,
      abAssignment,
      capturedPrompts,
      capturedUsage,
      waitUntil,
      personalization,
      backendErrors,
      acceptedQualityMetrics,
      allowGateBlocking: true
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
      name: error.name
    });
    await releaseReadingReservation(env, readingReservation);
    console.log(`[${requestId}] === TAROT READING REQUEST END (ERROR) ===`);

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

    // Enable symbol annotations for premium tiers (plus/pro)
    // Adds archetype and key visual symbols to position text
    const tier = options.subscriptionTier || 'free';
    if (tier === 'plus' || tier === 'pro') {
      themes.includeSymbols = true;
    }
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

  const def = getSpreadDefinition(spreadInfo.name);
  if (!def) {
    return `Unknown spread "${spreadInfo.name}". Please update your app and try again.`;
  }

  const providedKey = typeof spreadInfo.key === 'string' ? spreadInfo.key.trim() : '';
  if (providedKey && providedKey !== def.key) {
    return `Spread "${spreadInfo.name}" did not match its expected key. Please refresh and try again.`;
  }

  if (typeof def.count === 'number' && cardsInfo.length !== def.count) {
    return `Spread "${spreadInfo.name}" expects ${def.count} cards, but received ${cardsInfo.length}.`;
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
 * Uses the consolidated callAzureResponses helper for API interaction.
 * API Reference: https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/responses
 */
function buildAzureGPT5Prompts(env, payload, requestId = 'unknown') {
  const {
    spreadInfo,
    cardsInfo,
    userQuestion,
    reflectionsText,
    analysis,
    context,
    visionInsights,
    contextDiagnostics = []
  } = payload;

  const deckStyle = spreadInfo?.deckStyle || analysis?.themes?.deckStyle || cardsInfo?.[0]?.deckStyle || 'rws-1909';

  console.log(`[${requestId}] Building Azure GPT-5 prompts...`);

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
    subscriptionTier: payload.subscriptionTier,
    variantOverrides: payload.variantPromptOverrides
  });

  if (promptMeta) {
    payload.promptMeta = promptMeta;
  }

  if (Array.isArray(promptDiagnostics) && promptDiagnostics.length) {
    payload.contextDiagnostics = Array.from(new Set([...(payload.contextDiagnostics || []), ...promptDiagnostics]));
  }

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

  return {
    systemPrompt,
    userPrompt,
    promptMeta
  };
}

async function generateWithAzureGPT5Responses(env, payload, requestId = 'unknown') {
  const deploymentName = env.AZURE_OPENAI_GPT5_MODEL;
  const { systemPrompt, userPrompt } = buildAzureGPT5Prompts(env, payload, requestId);

  // Determine reasoning effort based on model
  const reasoningEffort = getReasoningEffort(deploymentName);
  if (reasoningEffort === 'high') {
    console.log(`[${requestId}] Detected ${deploymentName} deployment, using 'high' reasoning effort`);
  }

  console.log(`[${requestId}] Request config:`, {
    deployment: deploymentName,
    max_output_tokens: 'unlimited',
    reasoning_effort: reasoningEffort,
    verbosity: 'medium'
  });

  // Call Azure Responses API using consolidated helper
  const result = await callAzureResponses(env, {
    instructions: systemPrompt,
    input: userPrompt,
    maxTokens: null,          // No limit for full readings
    reasoningEffort,          // Default to 'medium' to balance latency and cost
    reasoningSummary: 'auto', // Get reasoning summary in response
    verbosity: 'medium',
    returnFullResponse: true  // Get usage data
  });

  console.log(`[${requestId}] Generated reading length: ${result.text.length} characters`);
  if (result.usage) {
    console.log(`[${requestId}] Token usage:`, {
      input_tokens: result.usage.input_tokens,
      output_tokens: result.usage.output_tokens,
      reasoning_tokens: result.usage.output_tokens_details?.reasoning_tokens,
      total_tokens: result.usage.total_tokens
    });
  }

  // Return reading with captured prompts for engineering analysis
  return {
    reading: result.text,
    prompts: {
      system: systemPrompt,
      user: userPrompt
    },
    usage: result.usage
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
    subscriptionTier: payload.subscriptionTier,
    variantOverrides: payload.variantPromptOverrides
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

  // Build reasoning chain for cross-card coherence
  const reasoning = buildReadingReasoning(
    cardsInfo,
    userQuestion,
    context,
    themes,
    spreadKey
  );

  // Enable prose mode for local composer output (removes technical metadata)
  setProseMode(true);

  let readingText;
  try {
    readingText = await generateReadingFromAnalysis(
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
        reasoning,
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
  } finally {
    // Always reset prose mode to default after generation
    setProseMode(false);
  }
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
  const { collectValidation, personalization = null, reasoning = null } = options;
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

  // Use reasoning-aware opening if available
  const composedOpening = reasoning
    ? buildReasoningAwareOpening(spreadName, userQuestion, context, reasoning, { personalization })
    : buildOpening(spreadName, userQuestion, context, { personalization });
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

  // Use reasoning synthesis if available, otherwise fall back to enhanced synthesis
  const finalCard = safeCards.length > 0 ? safeCards[safeCards.length - 1] : null;
  const synthesisText = reasoning
    ? buildReasoningSynthesis(safeCards, reasoning, themes, userQuestion, context)
    : buildEnhancedSynthesis(safeCards, themes, userQuestion, context, {
        rotationIndex: remedyRotationIndex,
        depthProfile
      });
  entries.push({
    text: synthesisText,
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
