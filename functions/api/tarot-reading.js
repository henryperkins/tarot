/**
 * Cloudflare Pages Function for generating a personalized tarot reading.
 *
 * Enhanced with authentic position-relationship analysis, elemental dignities,
 * and spread-specific narrative construction.
 *
 * Delegates narrative synthesis to Azure OpenAI GPT-5 via the Responses API
 * when AZURE_OPENAI_API_KEY / AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_GPT5_MODEL are configured.
 * Falls back to local deterministic composer with full analysis.
 */

// Import analysis and narrative building libraries
import {
  analyzeSpreadThemes,
  analyzeCelticCross,
  analyzeThreeCard,
  analyzeFiveCard
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

export const onRequestGet = async ({ env }) => {
  // Health check endpoint
  return jsonResponse({
    status: 'ok',
    provider: env?.AZURE_OPENAI_GPT5_MODEL ? 'azure-gpt5' : 'local',
    timestamp: new Date().toISOString()
  });
};

export const onRequestPost = async ({ request, env }) => {
  try {
    const payload = await readRequestBody(request);
    const { spreadInfo, cardsInfo, userQuestion, reflectionsText, reversalFrameworkOverride } = payload;

    const validationError = validatePayload(payload);
    if (validationError) {
      return jsonResponse(
        { error: validationError },
        { status: 400 }
      );
    }

    // STEP 1: Comprehensive spread analysis
    const analysis = await performSpreadAnalysis(spreadInfo, cardsInfo, {
      reversalFrameworkOverride
    });

    const context = inferContext(userQuestion, analysis.spreadKey);

    // STEP 2: Generate reading (Azure GPT-5 via Responses API or local)
    let reading;
    let usedAzureGPT5 = false;

    if (env && env.AZURE_OPENAI_API_KEY && env.AZURE_OPENAI_ENDPOINT && env.AZURE_OPENAI_GPT5_MODEL) {
      try {
        reading = await generateWithAzureGPT5Responses(env, {
          spreadInfo,
          cardsInfo,
          userQuestion,
          reflectionsText,
          analysis,
          context
        });
        usedAzureGPT5 = true;
      } catch (err) {
        console.error('Azure OpenAI GPT-5 Responses API generation failed, falling back to local composer:', err);
      }
    }

    if (!reading) {
      // Local fallback with validation; never return empty silently
      reading = composeReadingEnhanced({
        spreadInfo,
        cardsInfo,
        userQuestion,
        reflectionsText,
        analysis,
        context
      });

      if (!reading || !reading.toString().trim()) {
        console.error('composeReadingEnhanced returned empty reading; returning structured error.');
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
    return jsonResponse({
      reading,
      provider: usedClaude ? 'anthropic-claude-sonnet-4.5' : 'local',
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
    console.error('tarot-reading function error:', error);
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
async function performSpreadAnalysis(spreadInfo, cardsInfo, options = {}) {
  // Guard against malformed input (defensive: validatePayload should have run already)
  if (!spreadInfo || !Array.isArray(cardsInfo) || cardsInfo.length === 0) {
    console.warn('performSpreadAnalysis: missing or invalid spreadInfo/cardsInfo, falling back to generic themes only.');
    return {
      themes: { suitCounts: {}, elementCounts: {}, reversalCount: 0, reversalFramework: 'contextual', reversalDescription: { name: 'Context-Dependent', description: 'Reversed cards are interpreted individually based on context.', guidance: 'Read each reversal in light of its position and relationships.' } },
      spreadAnalysis: null,
      spreadKey: 'general'
    };
  }

  // Theme analysis (suits, elements, majors, reversals)
  let themes;
  try {
    themes = await analyzeSpreadThemes(cardsInfo, {
      reversalFrameworkOverride: options.reversalFrameworkOverride
    });
  } catch (err) {
    console.error('performSpreadAnalysis: analyzeSpreadThemes failed, using minimal fallback themes.', err);
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

    if (spreadKey === 'celtic' && cardsInfo.length === 10) {
      spreadAnalysis = analyzeCelticCross(cardsInfo);
    } else if (spreadKey === 'threeCard' && cardsInfo.length === 3) {
      spreadAnalysis = analyzeThreeCard(cardsInfo);
    } else if (spreadKey === 'fiveCard' && cardsInfo.length === 5) {
      spreadAnalysis = analyzeFiveCard(cardsInfo);
    }
  } catch (err) {
    console.error('performSpreadAnalysis: spread-specific analysis failed, continuing with themes only.', err);
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
 * Get spread key from spread name
 */
function getSpreadKey(spreadName) {
  const map = {
    'Celtic Cross (Classic 10-Card)': 'celtic',
    'Three-Card Story (Past · Present · Future)': 'threeCard',
    'Five-Card Clarity': 'fiveCard',
    'One-Card Insight': 'single',
    'Relationship Snapshot': 'relationship',
    'Decision / Two-Path': 'decision'
  };
  return map[spreadName] || 'general';
}

/**
 * Reads JSON payload from the incoming request, handling empty or invalid bodies gracefully.
 */
async function readRequestBody(request) {
  if (request.headers.get('content-length') === '0') {
    return {};
  }

  const text = await request.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON payload.');
  }
}

/**
 * Validates the baseline structure expected by the tarot-reading endpoint.
 */
function validatePayload({ spreadInfo, cardsInfo }) {
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

  return null;
}

/**
 * Enhanced Claude Sonnet 4.5 generation with position-relationship analysis
 */
async function generateWithClaudeSonnet45Enhanced(env, { spreadInfo, cardsInfo, userQuestion, reflectionsText, analysis, context }) {
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
    context
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

function jsonResponse(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init.headers || {})
    }
  });
}
