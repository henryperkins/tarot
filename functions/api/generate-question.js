import { callAzureResponses, ensureAzureConfig } from '../lib/azureResponses.js';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function sanitizeSnippet(value, fallback) {
  if (!value || typeof value !== 'string') return fallback;
  return value.trim();
}

function ensureQuestionMark(text) {
  if (!text) return '';
  return text.trim().endsWith('?') ? text.trim() : `${text.trim()}?`;
}

/**
 * FNV-1a hash function (matches deck.js implementation)
 */
function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Deterministic variant picker using seed.
 * Same seed + same list = same result.
 */
function pickDeterministic(list, seed) {
  if (!Array.isArray(list) || list.length === 0) return '';
  const numericSeed = typeof seed === 'string' ? hashString(seed) : (seed >>> 0);
  return list[numericSeed % list.length];
}

/**
 * Legacy picker with time-based randomization (non-deterministic).
 * Used when no seed is provided.
 */
function pick(list, seed = '') {
  if (!Array.isArray(list) || list.length === 0) return '';
  const mixed = seed ? Math.abs(hashString(`${seed}|${Math.random()}|${Date.now()}`)) : Math.floor(Math.random() * list.length);
  return list[mixed % list.length];
}

/**
 * Crafts a creative question from prompt and metadata.
 *
 * @param {string} prompt - The prompt text
 * @param {Object} metadata - Question metadata including seed
 * @returns {string} Generated question text
 */
function craftQuestionFromPrompt(prompt, metadata = {}) {
  const focusMatch = prompt.match(/about (.+?) for the/i);
  const timeframeMatch = prompt.match(/for the (.+?)(?:\.|$)/i);
  const depthMatch = prompt.match(/depth is (.+?)(?:\.|$)/i);

  const focus = sanitizeSnippet(metadata.focus || metadata.customFocus || (focusMatch ? focusMatch[1] : ''), 'this area of my life');
  const timeframePhrase = sanitizeSnippet(metadata.timeframePhrase || (timeframeMatch ? timeframeMatch[1] : ''), '');
  const depthLabel = sanitizeSnippet(metadata.depth || (depthMatch ? depthMatch[1] : ''), 'Focused guidance');
  const topicLabel = sanitizeSnippet(metadata.topic, 'this chapter');
  const pattern = inferPattern(metadata.pattern, depthLabel);
  const closing = sanitizeSnippet(metadata.closing, '') || inferClosing(pattern, depthLabel);

  const focusWithTimeframe = timeframePhrase
    ? `${focus} ${timeframePhrase}`.replace(/\s+/g, ' ').trim()
    : focus;

  const closingSuffix = pattern === 'transform'
    ? (closing ? ` so I can ${closing}` : '')
    : (closing ? ` ${closing}` : '');

  const supportVariants = [
    `How can I better support ${focusWithTimeframe}${closingSuffix}`,
    `What would help me tend to ${focusWithTimeframe}${closingSuffix}`,
    `Where should I focus to steady ${focusWithTimeframe}${closingSuffix}`,
    `What support will help me honor ${focusWithTimeframe}${closingSuffix}`,
    `How can I hold space for ${focusWithTimeframe}${closingSuffix}`,
    `How can I show up for ${focusWithTimeframe}${closingSuffix}`,
    `What would nourish ${focusWithTimeframe}${closingSuffix}`
  ];

  const navigateVariants = [
    `How can I navigate ${focusWithTimeframe}${closingSuffix}`,
    `How can I stay aligned with ${focusWithTimeframe}${closingSuffix}`,
    `What next step would move ${focus} forward${timeframePhrase ? ` ${timeframePhrase}` : ''}${closingSuffix}`,
    `What should I prioritize to move through ${focusWithTimeframe}${closingSuffix}`,
    `Where should I direct my energy to navigate ${focusWithTimeframe}${closingSuffix}`,
    `How can I make progress with ${focus}${timeframePhrase ? ` ${timeframePhrase}` : ''}${closingSuffix}`,
    `What would help me navigate ${focusWithTimeframe} with ease${closingSuffix}`
  ];

  const lessonVariants = [
    `What deeper lesson is ${focus} offering${timeframePhrase ? ` ${timeframePhrase}` : ''}${closingSuffix}`,
    `How can I interpret ${focusWithTimeframe} as guidance${closingSuffix}`,
    `What am I being shown about ${focusWithTimeframe}${closingSuffix}`,
    `Where is ${focus} inviting me to grow${timeframePhrase ? ` ${timeframePhrase}` : ''}${closingSuffix}`,
    `How does ${focusWithTimeframe} reflect my bigger story${closingSuffix}`,
    `What insight sits beneath ${focusWithTimeframe}${closingSuffix}`
  ];

  const transformVariants = [
    `How can I transform ${focusWithTimeframe}${closingSuffix}`,
    `What needs to shift within ${focusWithTimeframe}${closingSuffix}`,
    `What would renewal look like for ${focusWithTimeframe}${closingSuffix}`,
    `How might I nurture ${focusWithTimeframe}${closingSuffix}`,
    `What must I release to renew ${focusWithTimeframe}${closingSuffix}`,
    `How can I support the transformation of ${focusWithTimeframe}${closingSuffix}`,
    `Where is ${focusWithTimeframe} ready for change${closingSuffix}`
  ];

  const variantsByPattern = {
    support: supportVariants,
    navigate: navigateVariants,
    lesson: lessonVariants,
    transform: transformVariants
  };

  const variants = variantsByPattern[pattern] || [`How can I explore ${focusWithTimeframe}${closingSuffix}`];

  const seed = metadata.seed;
  const hasSeed = seed !== null && seed !== undefined;
  const picker = hasSeed ? pickDeterministic : pick;
  const pickerSeed = hasSeed
    ? `${seed}|${focusWithTimeframe}|${depthLabel}|${pattern}`
    : `${focusWithTimeframe}|${depthLabel}|${topicLabel}|${pattern}`;

  const question = picker(variants, pickerSeed);
  return ensureQuestionMark(question);
}

function inferPattern(patternValue, depthLabel = '') {
  const normalized = (patternValue || '').toLowerCase();
  if (['support', 'navigate', 'lesson', 'transform'].includes(normalized)) {
    return normalized;
  }
  const depth = depthLabel.toLowerCase();
  if (depth.includes('pulse')) return 'support';
  if (depth.includes('guided')) return 'navigate';
  if (depth.includes('lesson')) return 'lesson';
  if (depth.includes('deep')) return 'transform';
  return 'navigate';
}

function inferClosing(pattern, depthLabel = '') {
  if (pattern === 'support') return 'with calm awareness';
  if (pattern === 'navigate') return 'with confidence';
  if (pattern === 'lesson') return '';
  if (pattern === 'transform') return 'honor my growth';

  const depth = depthLabel.toLowerCase();
  if (depth.includes('pulse')) return 'with calm awareness';
  if (depth.includes('guided')) return 'with confidence';
  if (depth.includes('deep')) return 'honor my growth';
  return '';
}

function buildAzureQuestionPrompt(prompt, metadata = {}) {
  const focusMatch = prompt.match(/about (.+?) for the/i);
  const timeframeMatch = prompt.match(/for the (.+?)(?:\.|$)/i);
  const depthMatch = prompt.match(/depth is (.+?)(?:\.|$)/i);

  const focus = sanitizeSnippet(metadata.focus || metadata.customFocus || (focusMatch ? focusMatch[1] : ''), 'this area of my life');
  const timeframe = sanitizeSnippet(metadata.timeframePhrase || (timeframeMatch ? timeframeMatch[1] : ''), 'the current moment');
  const depthLabel = sanitizeSnippet(metadata.depth || (depthMatch ? depthMatch[1] : ''), 'Focused guidance');
  const topicLabel = sanitizeSnippet(metadata.topic, 'this chapter');
  const pattern = inferPattern(metadata.pattern, depthLabel);
  const closing = sanitizeSnippet(metadata.closing, '') || inferClosing(pattern, depthLabel);

  const personalizationLines = [];
  if (Array.isArray(metadata.recentThemes) && metadata.recentThemes.length > 0) {
    personalizationLines.push(`Recent themes: ${metadata.recentThemes.slice(0, 3).join(', ')}`);
  }
  if (metadata.frequentCard) personalizationLines.push(`Recurring card: ${metadata.frequentCard}`);
  if (metadata.leadingContext) personalizationLines.push(`Common context: ${metadata.leadingContext}`);
  if (metadata.reversalRate) personalizationLines.push(`Reversals: ${metadata.reversalRate}`);
  if (Array.isArray(metadata.recentQuestions) && metadata.recentQuestions.length > 0) {
    personalizationLines.push(`Avoid repeating: ${metadata.recentQuestions.join('; ')}`);
  }

  const instructions = [
    'You are a tarot intention coach. Write ONE open, agency-forward question that fits the user’s focus, timeframe, and depth.',
    'Use supportive verbs like support, navigate, transform, or explore. Avoid yes/no phrasing and avoid listing options.',
    'Do not add quotes, bullets, or any preamble. Respond with the question only and end with a question mark.',
    `Pattern: ${pattern} (support/navigate/lesson/transform), Closing: ${closing || 'none'}.`,
    metadata.seed ? `Seed: ${metadata.seed} (use to pick a variant; do not mention).` : null
  ].filter(Boolean).join('\n');

  const inputLines = [
    `Focus: ${focus}`,
    `Timeframe: ${timeframe}`,
    `Depth: ${depthLabel}`,
    `Topic: ${topicLabel}`,
    personalizationLines.length > 0 ? personalizationLines.join('\n') : null,
    '',
    'Return a single question. Keep it under 28 words.'
  ].filter(Boolean).join('\n');

  return { instructions, input: inputLines };
}

async function generateQuestionWithAzure(env, prompt, metadata) {
  ensureAzureConfig(env); // Throws if missing
  const { instructions, input } = buildAzureQuestionPrompt(prompt, metadata);

  const question = await callAzureResponses(env, {
    instructions,
    input,
    maxTokens: 120,
    reasoningEffort: 'low',
    verbosity: 'low'
  });

  return ensureQuestionMark(question);
}

function isAzureConfigured(env) {
  return Boolean(env?.AZURE_OPENAI_API_KEY && env?.AZURE_OPENAI_ENDPOINT && env?.AZURE_OPENAI_GPT5_MODEL);
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const prompt = body?.prompt;
    const metadata = body?.metadata || {};

    if (!prompt || typeof prompt !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing prompt' }),
        { status: 400, headers: JSON_HEADERS }
      );
    }

    let provider = 'local-fallback';
    let question = null;

    if (isAzureConfigured(env)) {
      try {
        question = await generateQuestionWithAzure(env, prompt, metadata);
        provider = 'azure-gpt5';
      } catch (error) {
        console.warn('Azure GPT-5 question generation failed, using fallback:', error?.message || error);
      }
    }

    if (!question) {
      question = craftQuestionFromPrompt(prompt, metadata);
      provider = 'local-fallback';
    }

    return new Response(
      JSON.stringify({
        question,
        provider,
        model: provider === 'azure-gpt5' ? env?.AZURE_OPENAI_GPT5_MODEL || null : null
      }),
      { status: 200, headers: JSON_HEADERS }
    );
  } catch (error) {
    console.error('generate-question error:', error);
    return new Response(
      JSON.stringify({ error: 'Unable to craft question' }),
      { status: 500, headers: JSON_HEADERS }
    );
  }
}
