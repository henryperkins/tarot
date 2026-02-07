/**
 * Narrative Backend Dispatch and Generation
 *
 * Manages the fallback chain of narrative generation backends:
 * 1. azure-gpt5 - Azure OpenAI GPT-5 via Responses API
 * 2. claude-opus45 - Claude Opus 4.5 via Azure AI Foundry
 * 3. local-composer - Deterministic local narrative builder
 *
 * Extracted from tarot-reading.js to maintain <900 line limit.
 */

import { fetchWithRetry } from './retryWithBackoff.js';
import { buildEnhancedClaudePrompt } from './narrativeBuilder.js';
import {
  buildCelticCrossReading,
  buildThreeCardReading,
  buildFiveCardReading,
  buildRelationshipReading,
  buildDecisionReading,
  buildSingleCardReading,
  buildPositionCardText,
  buildElementalRemedies,
  shouldOfferElementalRemedies,
  formatReversalLens,
  computeRemedyRotationIndex
} from './narrativeBuilder.js';
import { enhanceSection } from './narrativeSpine.js';
import { callAzureResponses, getReasoningEffort, getTextVerbosity } from './azureResponses.js';
import {
  buildReasoningAwareOpening,
  buildReasoningSynthesis,
  buildReadingWithReasoning
} from './narrative/reasoningIntegration.js';
import { getToneStyle, buildPersonalizedClosing, getDepthProfile } from './narrative/styleHelpers.js';
import { buildOpening } from './narrative/helpers.js';
import { formatPassagesForPrompt } from './graphRAG.js';
import { redactPII } from './promptEngineering.js';
import {
  resolveSemanticScoring,
  shouldLogLLMPrompts,
  maybeLogPromptPayload,
  trimForTelemetry
} from './readingTelemetry.js';
import { withSpan } from './tracingSpans.js';

// ============================================================================
// Backend Registry
// ============================================================================

/**
 * Ordered list of backend IDs to try (first available wins).
 * Frozen to prevent accidental mutation.
 */
export const NARRATIVE_BACKEND_ORDER = Object.freeze(['azure-gpt5', 'claude-opus45', 'local-composer']);

/**
 * Backend definitions with availability checks.
 * Frozen to prevent accidental mutation.
 */
export const NARRATIVE_BACKENDS = Object.freeze({
  'azure-gpt5': Object.freeze({
    id: 'azure-gpt5',
    label: 'Azure GPT-5 Responses',
    isAvailable: (env) => Boolean(env?.AZURE_OPENAI_API_KEY && env?.AZURE_OPENAI_ENDPOINT && env?.AZURE_OPENAI_GPT5_MODEL)
  }),
  'claude-opus45': Object.freeze({
    id: 'claude-opus45',
    label: 'Claude Opus 4.5 (Azure Foundry)',
    // Uses Azure AI Foundry Anthropic endpoint - may use separate API key
    isAvailable: (env) => Boolean(
      (env?.AZURE_ANTHROPIC_API_KEY || env?.AZURE_OPENAI_API_KEY) &&
      env?.AZURE_ANTHROPIC_ENDPOINT
    )
  }),
  'local-composer': Object.freeze({
    id: 'local-composer',
    label: 'Local Narrative Composer',
    isAvailable: () => true
  })
});

/**
 * Get list of available narrative backends for the current environment.
 *
 * @param {Object} env - Cloudflare environment bindings
 * @returns {Array} Array of available backend objects
 */
export function getAvailableNarrativeBackends(env) {
  return NARRATIVE_BACKEND_ORDER
    .map((id) => {
      const backend = NARRATIVE_BACKENDS[id];
      if (!backend) return null;
      if (!backend.isAvailable(env)) return null;
      return backend;
    })
    .filter(Boolean);
}

// ============================================================================
// Spread Reading Builders (for local composer)
// ============================================================================

/**
 * Map of spread keys to their builder functions.
 */
const SPREAD_READING_BUILDERS = {
  celtic: ({ spreadAnalysis, cardsInfo, userQuestion, reflectionsText, themes, context, spreadInfo }, options = {}) =>
    spreadAnalysis
      ? buildCelticCrossReading({
        cardsInfo,
        userQuestion,
        reflectionsText,
        celticAnalysis: spreadAnalysis,
        themes,
        context,
        spreadInfo
      }, options)
      : null,
  threeCard: ({ spreadAnalysis, cardsInfo, userQuestion, reflectionsText, themes, context, spreadInfo }, options = {}) =>
    spreadAnalysis
      ? buildThreeCardReading({
        cardsInfo,
        userQuestion,
        reflectionsText,
        threeCardAnalysis: spreadAnalysis,
        themes,
        context,
        spreadInfo
      }, options)
      : null,
  fiveCard: ({ spreadAnalysis, cardsInfo, userQuestion, reflectionsText, themes, context, spreadInfo }, options = {}) =>
    spreadAnalysis
      ? buildFiveCardReading({
        cardsInfo,
        userQuestion,
        reflectionsText,
        fiveCardAnalysis: spreadAnalysis,
        themes,
        context,
        spreadInfo
      }, options)
      : null,
  relationship: ({ spreadAnalysis, cardsInfo, userQuestion, reflectionsText, themes, context, spreadInfo }, options = {}) =>
    buildRelationshipReading({ spreadAnalysis, cardsInfo, userQuestion, reflectionsText, themes, context, spreadInfo }, options),
  decision: ({ spreadAnalysis, cardsInfo, userQuestion, reflectionsText, themes, context, spreadInfo }, options = {}) =>
    buildDecisionReading({ spreadAnalysis, cardsInfo, userQuestion, reflectionsText, themes, context, spreadInfo }, options),
  single: ({ spreadAnalysis, cardsInfo, userQuestion, reflectionsText, themes, context, spreadInfo }, options = {}) =>
    buildSingleCardReading({ spreadAnalysis, cardsInfo, userQuestion, reflectionsText, themes, context, spreadInfo }, options)
};

// ============================================================================
// Azure GPT-5 Backend
// ============================================================================

/**
 * Build prompts for Azure GPT-5 backend.
 *
 * @param {Object} env - Environment bindings
 * @param {Object} payload - Reading payload
 * @param {string} requestId - Request ID for logging
 * @returns {Object} { systemPrompt, userPrompt, promptMeta }
 */
export function buildAzureGPT5Prompts(env, payload, requestId = 'unknown') {
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

  // Resolve semantic scoring: env override takes priority, then graphRAG payload setting
  const enableSemanticScoring = resolveSemanticScoring(
    env,
    analysis.graphRAGPayload?.enableSemanticScoring ?? null
  );

  const effectiveGraphRAGPayload =
    analysis?.graphRAGPayload ||
    payload?.graphRAGPayload ||
    analysis?.themes?.knowledgeGraph?.graphRAGPayload ||
    null;

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
    graphRAGPayload: effectiveGraphRAGPayload,
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

/**
 * Generate reading using Azure OpenAI GPT-5 via Responses API.
 *
 * @param {Object} env - Environment bindings
 * @param {Object} payload - Reading payload
 * @param {string} requestId - Request ID for logging
 * @returns {Promise<Object>} { reading, prompts, usage }
 */
export async function generateWithAzureGPT5Responses(env, payload, requestId = 'unknown') {
  const deploymentName = env.AZURE_OPENAI_GPT5_MODEL;
  const { systemPrompt, userPrompt, promptMeta } = buildAzureGPT5Prompts(env, payload, requestId);

  // Determine reasoning effort based on model
  const reasoningEffort = getReasoningEffort(env, deploymentName);
  const verbosity = getTextVerbosity(env, deploymentName);
  if (reasoningEffort === 'high') {
    console.log(`[${requestId}] Detected ${deploymentName} deployment, using 'high' reasoning effort`);
  }

  console.log(`[${requestId}] Request config:`, {
    deployment: deploymentName,
    max_output_tokens: 'unlimited',
    reasoning_effort: reasoningEffort,
    verbosity
  });

  // Call Azure Responses API using consolidated helper
  const result = await callAzureResponses(env, {
    instructions: systemPrompt,
    input: userPrompt,
    maxTokens: null,          // No limit for full readings
    reasoningEffort,          // Env override or model default
    reasoningSummary: 'auto', // Get reasoning summary in response
    verbosity,
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
  if (result.reasoningSummary) {
    console.log(`[${requestId}] Reasoning summary available: ${result.reasoningSummary.length} chars`);
  }

  // Return reading with captured prompts for engineering analysis
  return {
    reading: result.text,
    reasoningSummary: result.reasoningSummary || null,
    prompts: {
      system: systemPrompt,
      user: userPrompt
    },
    usage: result.usage,
    promptMeta
  };
}

// ============================================================================
// Claude Opus 4.5 Backend (via Azure AI Foundry)
// ============================================================================

/**
 * Generate reading using Claude Opus 4.5 via Azure AI Foundry.
 *
 * @param {Object} env - Environment bindings
 * @param {Object} payload - Reading payload
 * @param {string} requestId - Request ID for logging
 * @returns {Promise<Object>} { reading, prompts, usage }
 */
export async function generateWithClaudeOpus45(env, payload, requestId = 'unknown') {
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

  const deckStyle = spreadInfo?.deckStyle || analysis?.themes?.deckStyle || cardsInfo?.[0]?.deckStyle || 'rws-1909';

  // Resolve semantic scoring: env override takes priority, then graphRAG payload setting
  const enableSemanticScoring = resolveSemanticScoring(
    env,
    analysis.graphRAGPayload?.enableSemanticScoring ?? null
  );

  const effectiveGraphRAGPayload =
    analysis?.graphRAGPayload ||
    payload?.graphRAGPayload ||
    analysis?.themes?.knowledgeGraph?.graphRAGPayload ||
    null;

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
    graphRAGPayload: effectiveGraphRAGPayload,
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
    'claude-opus45',
    systemPrompt,
    userPrompt,
    promptMeta,
    { personalization: payload.personalization }
  );

  const response = await fetchWithRetry(
    // Use retry logic with exponential backoff for Claude API
    apiUrl,
    {
      method: 'POST',
      headers: {
        'x-api-key': apiKey, // Azure Foundry Anthropic uses 'x-api-key' header
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
    },
    'claude-opus45',
    requestId,
    {
      maxRetries: 3,
      baseDelayMs: 1000,
      timeoutMs: 120000 // 2 minutes for long readings
    }
  );

  const data = await response.json();
  const content = Array.isArray(data.content)
    ? data.content.map(part => part.text || '').join('').trim()
    : (data.content?.toString?.() || '').trim();

  if (shouldLogLLMPrompts(env)) {
    const redactionOptions = { displayName: payload?.personalization?.displayName };
    const redactedContent = redactPII(content, redactionOptions);
    console.log(
      `[${requestId}] Azure Foundry Claude response (redacted):`,
      JSON.stringify({
        id: data.id,
        model: data.model || model,
        usage: data.usage,
        textPreview: trimForTelemetry(redactedContent, 1200)
      }, null, 2)
    );
  }

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

// ============================================================================
// Local Composer Backend
// ============================================================================

/**
 * Generate reading from spread analysis using appropriate builder.
 *
 * @param {Object} params - Analysis parameters
 * @param {Object} options - Builder options
 * @returns {Promise<string>} Generated reading text
 */
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
 * Condense text to specified sentence count for concise depth profile.
 */
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

/**
 * Build reflection prompt for expansive depth profile.
 */
function buildDepthReflectionPrompt(card, position) {
  if (!card) return '';
  const cardName = typeof card.card === 'string' && card.card.trim() ? card.card.trim() : 'this card';
  const orientation = typeof card.orientation === 'string' && card.orientation.trim() ? ` ${card.orientation.trim()}` : '';
  const focus = (position || 'this position').toLowerCase();
  return `Journal on how ${cardName}${orientation} wants you to engage with ${focus}.`;
}

/**
 * Build cards section with reversal framework awareness.
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

/**
 * Enhanced synthesis with rich theme analysis.
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

/**
 * Append reversal reminder if spread contains reversed cards.
 */
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

/**
 * Generic enhanced reading builder (for spreads without specific builders).
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
  const baseSynthesis = buildEnhancedSynthesis(safeCards, themes, userQuestion, context, {
    rotationIndex: remedyRotationIndex,
    depthProfile
  });
  const synthesisText = reasoning
    ? buildReasoningSynthesis(safeCards, reasoning, themes, userQuestion, context, {
      baseSynthesis
    })
    : baseSynthesis;
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

/**
 * Enhanced local composer with spread-specific narrative construction.
 *
 * @param {Object} payload - Reading payload
 * @returns {Promise<Object>} { reading, prompts, usage }
 */
export async function composeReadingEnhanced(payload) {
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

  const composerOptions = {
    personalization,
    proseMode: true,
    collectValidation: (section) => {
      if (!section) return;
      collectedSections.push({
        text: section.text || '',
        metadata: section.metadata || {},
        validation: section.validation || null
      });
    }
  };

  const readingResult = await buildReadingWithReasoning(
    {
      spreadInfo,
      spreadKey,
      cardsInfo,
      userQuestion,
      reflectionsText,
      themes,
      context
    },
    async (enhancedPayload, reasoningOptions = {}) => {
      const mergedOptions = {
        ...composerOptions,
        ...reasoningOptions,
        reasoning: enhancedPayload.reasoning || reasoningOptions.reasoning || null
      };
      return generateReadingFromAnalysis(
        {
          spreadKey,
          spreadAnalysis,
          cardsInfo: enhancedPayload.cardsInfo,
          userQuestion: enhancedPayload.userQuestion,
          reflectionsText: enhancedPayload.reflectionsText,
          themes: enhancedPayload.themes,
          spreadInfo: enhancedPayload.spreadInfo,
          context: enhancedPayload.context
        },
        mergedOptions
      );
    },
    composerOptions
  );
  const readingText = typeof readingResult === 'string'
    ? readingResult
    : (readingResult?.reading || '');

  if (readingResult?.reasoning && typeof readingResult.reasoning === 'object') {
    payload.reasoningMeta = readingResult.reasoning;
  }

  payload.narrativeEnhancements = collectedSections;

  // Ensure promptMeta exists for telemetry
  if (!payload.promptMeta) {
    payload.promptMeta = {
      backend: 'local-composer',
      estimatedTokens: null,
      slimmingSteps: []
    };
  }

  // Incorporate GraphRAG passages if available
  let finalReadingText = readingText;
  const graphRAGPayload = analysis.graphRAGPayload || payload.graphRAGPayload;
  if (graphRAGPayload?.passages?.length > 0) {
    const formattedPassages = formatPassagesForPrompt(graphRAGPayload.passages, {
      includeSource: true,
      markdown: true
    });
    if (formattedPassages) {
      finalReadingText = readingText + '\n\n## Traditional Wisdom\n\n' + formattedPassages;
      
      // Update promptMeta with GraphRAG injection telemetry
      const retrievalSummary = graphRAGPayload.retrievalSummary || {};
      payload.promptMeta.graphRAG = {
        ...retrievalSummary,
        includedInPrompt: true,
        injectedIntoPrompt: true,
        passagesProvided: graphRAGPayload.initialPassageCount || graphRAGPayload.passages.length,
        passagesUsedInPrompt: graphRAGPayload.passages.length,
        disabledByEnv: false,
        skippedReason: null
      };
    }
  }

  // Return reading with null prompts (local composer doesn't use LLM prompts)
  return {
    reading: finalReadingText,
    prompts: null,
    usage: null
  };
}

// ============================================================================
// Backend Dispatch
// ============================================================================

/**
 * Run a specific narrative backend.
 *
 * @param {string} backendId - Backend identifier
 * @param {Object} env - Environment bindings
 * @param {Object} payload - Reading payload
 * @param {string} requestId - Request ID for logging
 * @returns {Promise<Object>} { reading, prompts, usage }
 */
export async function runNarrativeBackend(backendId, env, payload, requestId) {
  return withSpan(`tarot.narrative.${backendId}`, {
    'tarot.request_id': requestId,
    'tarot.narrative.backend': backendId,
    'tarot.spread': payload?.analysis?.spreadKey || 'unknown',
  }, async (span) => {
    let result;
    switch (backendId) {
      case 'azure-gpt5':
        result = await generateWithAzureGPT5Responses(env, payload, requestId);
        break;
      case 'claude-opus45':
        result = await generateWithClaudeOpus45(env, payload, requestId);
        break;
      case 'local-composer':
      default:
        result = await composeReadingEnhanced(payload);
        break;
    }
    const reading = typeof result === 'object' && result.reading ? result.reading : result;
    if (span) {
      span.setAttribute('tarot.narrative.length', typeof reading === 'string' ? reading.length : 0);
    }
    return result;
  });
}
