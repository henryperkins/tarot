/**
 * Cloudflare Pages Function for generating a personalized tarot reading.
 *
 * Enhanced with authentic position-relationship analysis, elemental dignities,
 * and spread-specific narrative construction.
 *
 * Delegates narrative synthesis to Anthropic Claude Sonnet 4.5
 * (model: "claude-sonnet-4.5") when ANTHROPIC_API_KEY is configured.
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
  buildEnhancedClaudePrompt,
  buildPositionCardText
} from '../lib/narrativeBuilder.js';

export const onRequestPost = async ({ request, env }) => {
  try {
    const payload = await readRequestBody(request);
    const { spreadInfo, cardsInfo, userQuestion, reflectionsText } = payload;

    const validationError = validatePayload(payload);
    if (validationError) {
      return jsonResponse(
        { error: validationError },
        { status: 400 }
      );
    }

    // STEP 1: Comprehensive spread analysis
    const analysis = performSpreadAnalysis(spreadInfo, cardsInfo);

    // STEP 2: Generate reading (Claude or local)
    let reading;

    if (env && env.ANTHROPIC_API_KEY) {
      try {
        reading = await generateWithClaudeSonnet45Enhanced(env, {
          spreadInfo,
          cardsInfo,
          userQuestion,
          reflectionsText,
          analysis
        });
      } catch (err) {
        console.error('Anthropic Claude Sonnet 4.5 generation failed, falling back to local composer:', err);
      }
    }

    if (!reading) {
      reading = composeReadingEnhanced({
        spreadInfo,
        cardsInfo,
        userQuestion,
        reflectionsText,
        analysis
      });
    }

    return jsonResponse({
      reading,
      provider: reading && env && env.ANTHROPIC_API_KEY ? 'anthropic-claude-sonnet-4.5' : 'local'
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
function performSpreadAnalysis(spreadInfo, cardsInfo) {
  // Theme analysis (suits, elements, majors, reversals)
  const themes = analyzeSpreadThemes(cardsInfo);

  // Spread-specific position-relationship analysis
  let spreadAnalysis = null;
  const spreadKey = getSpreadKey(spreadInfo.name);

  if (spreadKey === 'celtic' && cardsInfo.length === 10) {
    spreadAnalysis = analyzeCelticCross(cardsInfo);
  } else if (spreadKey === 'threeCard' && cardsInfo.length === 3) {
    spreadAnalysis = analyzeThreeCard(cardsInfo);
  } else if (spreadKey === 'fiveCard' && cardsInfo.length === 5) {
    spreadAnalysis = analyzeFiveCard(cardsInfo);
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
async function generateWithClaudeSonnet45Enhanced(env, { spreadInfo, cardsInfo, userQuestion, reflectionsText, analysis }) {
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
    spreadAnalysis: analysis.spreadAnalysis
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

/**
 * Enhanced local composer with spread-specific narrative construction
 */
function composeReadingEnhanced({ spreadInfo, cardsInfo, userQuestion, reflectionsText, analysis }) {
  const { themes, spreadAnalysis, spreadKey } = analysis;

  // Use spread-specific builders when available
  if (spreadKey === 'celtic' && spreadAnalysis) {
    return buildCelticCrossReading({
      cardsInfo,
      userQuestion,
      reflectionsText,
      celticAnalysis: spreadAnalysis,
      themes
    });
  }

  if (spreadKey === 'threeCard' && spreadAnalysis) {
    return buildThreeCardReading({
      cardsInfo,
      userQuestion,
      reflectionsText,
      threeCardAnalysis: spreadAnalysis,
      themes
    });
  }

  // Fallback: Generic enhanced composer for other spreads
  return buildGenericReading({
    spreadInfo,
    cardsInfo,
    userQuestion,
    reflectionsText,
    themes
  });
}

/**
 * Generic enhanced reading builder (for spreads without specific builders yet)
 */
function buildGenericReading({ spreadInfo, cardsInfo, userQuestion, reflectionsText, themes }) {
  const spreadName = spreadInfo?.name?.trim() || 'your chosen spread';
  const sections = [];

  // Opening
  if (userQuestion && userQuestion.trim()) {
    sections.push(`Focusing on the ${spreadName.toLowerCase()}, I attune to your question: "${userQuestion.trim()}"\n\nThe cards respond with insight that honors both seen and unseen influences.`);
  } else {
    sections.push(`Focusing on the ${spreadName.toLowerCase()}, the cards speak to the energy most present for you right now.`);
  }

  // Cards section with reversal framework awareness
  const reversalNote = themes.reversalFramework !== 'none'
    ? `\n\n*Reading reversals through the lens of ${themes.reversalDescription.name}: ${themes.reversalDescription.description}*`
    : '';

  const cardsSection = buildCardsSection(cardsInfo, themes) + reversalNote;
  sections.push(cardsSection);

  // Reflections
  if (reflectionsText && reflectionsText.trim()) {
    sections.push(`**Your Reflections**\n\n${reflectionsText.trim()}\n\nYour intuitive impressions add personal meaning to this reading.`);
  }

  // Synthesis with enhanced themes
  sections.push(buildEnhancedSynthesis(cardsInfo, themes, userQuestion));

  return sections.filter(Boolean).join('\n\n');
}

/**
 * Build cards section with reversal framework awareness
 */
function buildCardsSection(cardsInfo, themes) {
  const options = themes?.reversalDescription ? { reversalDescription: themes.reversalDescription } : {};

  const lines = cardsInfo.map(card => {
    const position = (card.position || '').trim() || `Card ${cardsInfo.indexOf(card) + 1}`;
    const description = buildPositionCardText(card, position, options);
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
function buildEnhancedSynthesis(cardsInfo, themes, userQuestion) {
  let section = `**Synthesis & Guidance**\n\n`;

  // Suit focus
  if (themes.suitFocus) {
    section += `${themes.suitFocus}\n\n`;
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

function jsonResponse(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init.headers || {})
    }
  });
}
