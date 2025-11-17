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
  buildPositionCardText
} from '../lib/narrativeBuilder.js';
import { enhanceSection } from '../lib/narrativeSpine.js';
import { inferContext } from '../lib/contextDetection.js';
import { parseMinorName } from '../lib/minorMeta.js';
import { jsonResponse, readJsonBody } from '../lib/utils.js';
import { canonicalizeCardName, canonicalCardKey } from '../../shared/vision/cardNameMapping.js';
import { verifyVisionProof } from '../lib/visionProof.js';

const SPREAD_NAME_MAP = {
  'Celtic Cross (Classic 10-Card)': { key: 'celtic', count: 10 },
  'Three-Card Story (Past · Present · Future)': { key: 'threeCard', count: 3 },
  'Five-Card Clarity': { key: 'fiveCard', count: 5 },
  'One-Card Insight': { key: 'single', count: 1 },
  'Relationship Snapshot': { key: 'relationship', count: 3 },
  'Decision / Two-Path': { key: 'decision', count: 5 }
};

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
    const {
      spreadInfo,
      cardsInfo,
      userQuestion,
      reflectionsText,
      reversalFrameworkOverride,
      visionProof,
      deckStyle: requestDeckStyle
    } = payload;
    const deckStyle = requestDeckStyle || 'rws-1909';

    console.log(`[${requestId}] Payload parsed:`, {
      spreadName: spreadInfo?.name,
      cardCount: cardsInfo?.length,
      hasQuestion: !!userQuestion,
      hasReflections: !!reflectionsText,
      reversalOverride: reversalFrameworkOverride,
      deckStyle,
      hasVisionProof: !!visionProof
    });

    const validationError = validatePayload(payload);
    if (validationError) {
      console.error(`[${requestId}] Validation failed:`, validationError);
      return jsonResponse(
        { error: validationError },
        { status: 400 }
      );
    }
    console.log(`[${requestId}] Payload validation passed`);

    if (!visionProof) {
      console.warn(`[${requestId}] Vision proof missing; rejecting request.`);
      return jsonResponse(
        { error: 'Vision validation proof missing. Please upload and confirm your card photos before requesting a reading.' },
        { status: 400 }
      );
    }

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

    const sanitizedVisionInsights = annotateVisionInsights(verifiedProof.insights, cardsInfo, deckStyle);
    if (sanitizedVisionInsights.length === 0) {
      console.warn(`[${requestId}] Vision proof did not contain recognizable cards; rejecting request.`);
      return jsonResponse(
        { error: 'Vision validation requires at least one confirmed card photo before requesting a reading.' },
        { status: 400 }
      );
    }

    const avgConfidence = sanitizedVisionInsights.reduce((sum, item) => sum + (item.confidence ?? 0), 0) / sanitizedVisionInsights.length;
    const mismatchedDetections = sanitizedVisionInsights.filter((item) => item.matchesDrawnCard === false);
    console.log(`[${requestId}] Vision proof verified: ${sanitizedVisionInsights.length} uploads, avg confidence ${(avgConfidence * 100).toFixed(1)}%.`);

    if (mismatchedDetections.length > 0) {
      console.warn(`[${requestId}] Vision uploads that do not match selected cards:`, mismatchedDetections.map((item) => ({ label: item.label, predictedCard: item.predictedCard, confidence: item.confidence })));
      return jsonResponse(
        { error: 'Vision validation detected mismatched cards. Please confirm your photo uploads before requesting a reading.' },
        { status: 409 }
      );
    }


    // STEP 1: Comprehensive spread analysis
    console.log(`[${requestId}] Starting spread analysis...`);
    const analysisStart = Date.now();
    const analysis = await performSpreadAnalysis(spreadInfo, cardsInfo, {
      reversalFrameworkOverride,
      deckStyle
    }, requestId);
    const analysisTime = Date.now() - analysisStart;
    console.log(`[${requestId}] Spread analysis completed in ${analysisTime}ms:`, {
      spreadKey: analysis.spreadKey,
      hasSpreadAnalysis: !!analysis.spreadAnalysis,
      reversalCount: analysis.themes?.reversalCount,
      reversalFramework: analysis.themes?.reversalFramework
    });

    const context = inferContext(userQuestion, analysis.spreadKey);
    console.log(`[${requestId}] Context inferred: ${context}`);

    // STEP 2: Generate reading (Azure GPT-5 via Responses API or local)
    let reading;
    let usedAzureGPT = false;

    if (env && env.AZURE_OPENAI_API_KEY && env.AZURE_OPENAI_ENDPOINT && env.AZURE_OPENAI_GPT5_MODEL) {
      console.log(`[${requestId}] Azure OpenAI GPT-5 credentials found, attempting generation...`);
      console.log(`[${requestId}] Azure config:`, {
        endpoint: env.AZURE_OPENAI_ENDPOINT,
        model: env.AZURE_OPENAI_GPT5_MODEL,
        hasApiKey: !!env.AZURE_OPENAI_API_KEY
      });

      const azureStart = Date.now();
      try {
        reading = await generateWithAzureGPT5Responses(env, {
          spreadInfo,
          cardsInfo,
          userQuestion,
          reflectionsText,
          analysis,
          context,
          visionInsights: sanitizedVisionInsights
        }, requestId);
        const azureTime = Date.now() - azureStart;
        console.log(`[${requestId}] Azure GPT-5 generation successful in ${azureTime}ms, reading length: ${reading?.length || 0}`);
        usedAzureGPT = true;
      } catch (err) {
        const azureTime = Date.now() - azureStart;
        console.error(`[${requestId}] Azure OpenAI GPT-5 generation failed after ${azureTime}ms, falling back to local composer:`, {
          error: err.message,
          stack: err.stack
        });
      }
    } else {
      console.log(`[${requestId}] Azure OpenAI GPT-5 credentials not configured, using local composer`, {
        hasApiKey: !!env?.AZURE_OPENAI_API_KEY,
        hasEndpoint: !!env?.AZURE_OPENAI_ENDPOINT,
        hasModel: !!env?.AZURE_OPENAI_GPT5_MODEL
      });
    }

    if (!reading) {
      console.log(`[${requestId}] Generating reading with local composer...`);
      const localStart = Date.now();
      // Local fallback with validation; never return empty silently
      reading = composeReadingEnhanced({
        spreadInfo,
        cardsInfo,
        userQuestion,
        reflectionsText,
        analysis,
        context
      });
      const localTime = Date.now() - localStart;
      console.log(`[${requestId}] Local composer completed in ${localTime}ms, reading length: ${reading?.length || 0}`);

      if (!reading || !reading.toString().trim()) {
        console.error(`[${requestId}] composeReadingEnhanced returned empty reading; returning structured error.`);
        return jsonResponse(
          { error: 'Analysis failed to produce a narrative. Please retry your reading.' },
          { status: 500 }
        );
      }
    }

    // STEP 3: Return structured response with server-centric analysis
    // - spreadAnalysis: canonical source for patterns/highlights
    // - themes: shared thematic summary
    // Frontend should trust these when present, and only fall back locally if missing.
    const totalTime = Date.now() - startTime;
    const provider = usedAzureGPT ? 'azure-gpt5' : 'local';

    console.log(`[${requestId}] Request completed successfully in ${totalTime}ms using provider: ${provider}`);
    console.log(`[${requestId}] === TAROT READING REQUEST END ===`);

    return jsonResponse({
      reading,
      provider,
      requestId,
      themes: analysis.themes,
      context,
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

  return {
    themes,
    spreadAnalysis,
    spreadKey
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
async function generateWithAzureGPT5Responses(env, { spreadInfo, cardsInfo, userQuestion, reflectionsText, analysis, context, visionInsights }, requestId = 'unknown') {
  const endpoint = env.AZURE_OPENAI_ENDPOINT.replace(/\/+$/, '');
  const apiKey = env.AZURE_OPENAI_API_KEY;
  const deploymentName = env.AZURE_OPENAI_GPT5_MODEL; // Azure deployment name (often mirrors the base model name)
  // Responses API requires v1 path format with 'preview' API version
  const apiVersion = env.AZURE_OPENAI_API_VERSION || 'preview';

  console.log(`[${requestId}] Building Azure GPT-5 prompts...`);

  // Build enhanced prompts using narrative builder
  const { systemPrompt, userPrompt } = buildEnhancedClaudePrompt({
    spreadInfo,
    cardsInfo,
    userQuestion,
    reflectionsText,
    themes: analysis.themes,
    spreadAnalysis: analysis.spreadAnalysis,
    context,
    visionInsights,
    deckStyle
  });

  console.log(`[${requestId}] System prompt length: ${systemPrompt.length}, User prompt length: ${userPrompt.length}`);

  // Azure OpenAI Responses API endpoint format (v1 API):
  // POST {endpoint}/openai/v1/responses?api-version=preview
  // Model is passed in the request body, NOT in the URL path
  const url = `${endpoint}/openai/v1/responses?api-version=${encodeURIComponent(apiVersion)}`;

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
    max_output_tokens: 3000,
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
async function generateWithClaudeSonnet45Enhanced(env, { spreadInfo, cardsInfo, userQuestion, reflectionsText, analysis, context, visionInsights }) {
  const apiKey = env.ANTHROPIC_API_KEY;
  const apiUrl = env.ANTHROPIC_API_URL || 'https://api.anthropic.com/v1/messages';
  const model = 'claude-sonnet-4-5';

  // Build enhanced prompts using narrative builder
  const { systemPrompt, userPrompt } = buildEnhancedClaudePrompt({
    spreadInfo,
    cardsInfo,
    userQuestion,
    reflectionsText,
    themes: analysis.themes,
    spreadAnalysis: analysis.spreadAnalysis,
    context,
    visionInsights
  });

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model,
      max_tokens: 1200, // Increased for richer narratives
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
function composeReadingEnhanced({ spreadInfo, cardsInfo, userQuestion, reflectionsText, analysis, context }) {
  const { themes, spreadAnalysis, spreadKey } = analysis;

  return generateReadingFromAnalysis({
    spreadKey,
    spreadAnalysis,
    cardsInfo,
    userQuestion,
    reflectionsText,
    themes,
    spreadInfo,
    context
  });
}

function generateReadingFromAnalysis({ spreadKey, spreadAnalysis, cardsInfo, userQuestion, reflectionsText, themes, spreadInfo, context }) {
  const builder = SPREAD_READING_BUILDERS[spreadKey];

  if (builder) {
    const result = builder({
      spreadAnalysis,
      cardsInfo,
      userQuestion,
      reflectionsText,
      themes,
      spreadInfo,
      context
    });

    if (typeof result === 'string' && result.trim()) {
      return result;
    }
  }

  return buildGenericReading({
    spreadInfo,
    cardsInfo,
    userQuestion,
    reflectionsText,
    themes,
    context
  });
}

/**
 * Generic enhanced reading builder (for spreads without specific builders yet)
 */
function buildGenericReading({ spreadInfo, cardsInfo, userQuestion, reflectionsText, themes, context }) {
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

  const sections = entries
    .map(({ text, metadata }) => enhanceSection(text, metadata).text)
    .filter(Boolean);

  const readingBody = sections.join('\n\n');
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
        symbolVerification: entry.symbolVerification || null
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

  // Elemental balance
  if (themes.elementalBalance) {
    section += `Elemental context: ${themes.elementalBalance}\n\n`;
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

  const reminder = `*Reversal lens reminder: Within the ${themes.reversalDescription.name} lens, ${themes.reversalDescription.guidance}*`;
  if (readingText.includes(reminder)) {
    return readingText;
  }

  return `${readingText}\n\n${reminder}`;
}
