import { createDeadline, getTaskTimeoutMs } from '../lib/requestDeadline.js';
import { observeInferenceAttempt } from '../lib/inferenceAttempts.js';
import {
  fetchEphemerisForecast,
  formatForecastHighlights
} from '../lib/ephemerisIntegration.js';
import { getUserFromRequest } from '../lib/auth.js';
import { enforceApiCallLimit } from '../lib/apiUsage.js';
import { readFeatureJsonBody, reserveFeatureUsage, settleFeatureUsage } from '../lib/featureUsage.js';
import { getSubscriptionContext } from '../lib/entitlements.js';
import { sanitizeText } from '../lib/utils.js';
import { hashString, ensureQuestionMark } from '../../shared/utils.js';
import {
  buildSpreadQuestionVariants,
  DECISION_QUESTION_INSTRUCTION,
  resolveSpreadQuestionContext
} from '../../shared/coach/spreadQuestions.js';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// Suggested questions use Workers AI independently of TEXT_PROVIDER. Model
// failures use the local templates without calling Claude or OpenAI.
const WORKERS_AI_PROVIDER = 'workers-ai';
const DEFAULT_QUESTION_MODEL = '@cf/zai-org/glm-5.3';
const DEFAULT_QUESTION_REASONING_EFFORT = 'high';
const QUESTION_REASONING_EFFORTS = new Set(['none', 'low', 'medium', 'high', 'xhigh', 'max']);
// The budget includes reasoning; the prompt limits the final question.
const QUESTION_MAX_TOKENS = 8192;
const DEFAULT_QUESTION_TIMEOUT_MS = 60000;

// The depth descriptions the coach shows, sent as tone rather than labels:
// GLM-5.3 copied "Pattern:" and "Closing:" labels into its questions.
const QUESTION_TONES = {
  support: 'a gentle check-in on the energy',
  navigate: 'clarity about the next move or plan',
  lesson: 'the deeper lesson or teaching',
  transform: 'transformational, soulful change'
};

// The reading frames the Relationship Snapshot's second card as another
// person's energy. Without this line GLM-5.3 often made the topic (work,
// money) the other party.
const RELATIONSHIP_OTHER_PARTY = 'Them: another person in the querent’s life, unnamed unless the focus names them. The focus is where the bond lives, never the other party.';

// Questions show whole in the coach's serif display. The prompt asks for
// about 180 characters; a model answer past this is rejected rather than cut.
const GENERATED_QUESTION_MAX_LENGTH = 240;
// Matches the coach's own detail limit (CUSTOM_FOCUS_MAX_LENGTH), so the
// querent's words are never cut here.
const FOCUS_MAX_LENGTH = 160;

function canUseAIQuestions(subscription) {
  const tier = subscription?.effectiveTier || 'free';
  return tier === 'plus' || tier === 'pro';
}

function sanitizeSnippet(value, fallback, maxLength = 140) {
  if (!value || typeof value !== 'string') return fallback;
  const sanitized = sanitizeText(value, {
    maxLength,
    stripMarkdown: true,
    stripControlChars: true,
    filterInstructions: true
  })
    .replace(/\{\{|\}\}|\$\{|\}|<%|%>|\{#|#\}|\{%|%\}/g, '')
    .replace(/\[%|%\]|\[\[|\]\]/g, '')
    .trim();
  return sanitized || fallback;
}

function sanitizeSnippetList(values, maxItems, maxLength) {
  if (!Array.isArray(values)) return [];
  return values
    .slice(0, maxItems)
    .map((value) => sanitizeSnippet(value, '', maxLength))
    .filter(Boolean);
}

function sanitizeGeneratedQuestion(value) {
  const sanitized = sanitizeSnippet(value, '', 1000)
    .replace(/^[-•\d.)\s]+/, '')
    .replace(/^['"“”‘’]+|['"“”‘’]+$/g, '')
    .trim();
  // Model answers are length-checked before normalization. Local templates
  // retain the full detail and closing instead of becoming incomplete clauses.
  return ensureQuestionMark(sanitized || 'What question would help me explore this moment with clarity');
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
 * @param {Object} metadata - Question metadata, including seed and spreadKey
 * @returns {string} Generated question text
 */
export function craftQuestionFromPrompt(prompt, metadata = {}) {
  const spread = resolveSpreadQuestionContext(metadata.spreadKey);
  const safePrompt = sanitizeSnippet(prompt, '', 500);
  const focusMatch = safePrompt.match(/about (.+?) for the/i);
  const timeframeMatch = safePrompt.match(/for the (.+?)(?:\.|$)/i);
  const depthMatch = safePrompt.match(/depth is (.+?)(?:\.|$)/i);

  const focus = sanitizeSnippet(metadata.focus || metadata.customFocus || (focusMatch ? focusMatch[1] : ''), 'this area of my life', FOCUS_MAX_LENGTH);
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

  // A known spread shapes the question; unknown keys keep the generic list.
  const spreadVariants = spread
    ? buildSpreadQuestionVariants(spread.key, pattern, {
      focus,
      timeframeText: timeframePhrase ? ` ${timeframePhrase}` : '',
      closingSuffix
    })
    : null;
  const variants = spreadVariants || variantsByPattern[pattern] || [`How can I explore ${focusWithTimeframe}${closingSuffix}`];

  const seed = metadata.seed;
  const hasSeed = seed !== null && seed !== undefined;
  const picker = hasSeed ? pickDeterministic : pick;
  const pickerSeed = hasSeed
    ? `${seed}|${focusWithTimeframe}|${depthLabel}|${pattern}`
    : `${focusWithTimeframe}|${depthLabel}|${topicLabel}|${pattern}`;

  const question = picker(variants, pickerSeed);
  return sanitizeGeneratedQuestion(question);
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

function getForecastDays(metadata = {}) {
  const tf = `${metadata.timeframe || ''} ${metadata.timeframePhrase || ''} ${metadata.timeframeValue || ''}`.toLowerCase();

  if (tf.includes('season')) return 90;
  if (tf.includes('few months')) return 90;
  if (tf.includes('30') || tf.includes('month')) return 30;
  return null;
}

// The Relationship Snapshot's clarifiers are drawn only on request, so the
// question must stand on its three core positions.
function describeSpread(spread) {
  const numbered = (positions) => positions.map((position, index) => `${index + 1}. ${position}`).join('; ');
  if (spread.optionalPositions.length > 0) {
    return [
      `Spread: ${spread.name} (${spread.cardCount} core cards; up to ${spread.optionalPositions.length} optional clarifiers)`,
      `Core positions: ${numbered(spread.corePositions)}`,
      `Optional clarifiers (drawn only if the querent asks): ${spread.optionalPositions.join('; ')}`,
      ...(spread.key === 'relationship' ? [RELATIONSHIP_OTHER_PARTY] : [])
    ];
  }
  return [
    `Spread: ${spread.name} (${spread.cardCount} cards)`,
    `Positions: ${numbered(spread.corePositions)}`
  ];
}

/**
 * Instructions and input for the question model. Only metadata.spreadKey is
 * read for the spread: its name and positions come from the canonical
 * definitions, never from client-sent text.
 */
export function buildQuestionPrompt(prompt, metadata = {}) {
  const spread = resolveSpreadQuestionContext(metadata.spreadKey);
  const safePrompt = sanitizeSnippet(prompt, '', 500);
  const focusMatch = safePrompt.match(/about (.+?) for the/i);
  const timeframeMatch = safePrompt.match(/for the (.+?)(?:\.|$)/i);
  const depthMatch = safePrompt.match(/depth is (.+?)(?:\.|$)/i);

  const focus = sanitizeSnippet(metadata.focus || metadata.customFocus || (focusMatch ? focusMatch[1] : ''), 'this area of my life', FOCUS_MAX_LENGTH);
  const timeframe = sanitizeSnippet(metadata.timeframePhrase || (timeframeMatch ? timeframeMatch[1] : ''), 'the current moment');
  const depthLabel = sanitizeSnippet(metadata.depth || (depthMatch ? depthMatch[1] : ''), 'Focused guidance');
  const topicLabel = sanitizeSnippet(metadata.topic, 'this chapter');
  const pattern = inferPattern(metadata.pattern, depthLabel);
  const closing = sanitizeSnippet(metadata.closing, '') || inferClosing(pattern, depthLabel);

  const personalizationLines = [];
  if (Array.isArray(metadata.recentThemes) && metadata.recentThemes.length > 0) {
    const recentThemes = sanitizeSnippetList(metadata.recentThemes, 3, 80);
    if (recentThemes.length) personalizationLines.push(`Recent themes: ${recentThemes.join(', ')}`);
  }
  if (metadata.frequentCard) personalizationLines.push(`Recurring card: ${sanitizeSnippet(metadata.frequentCard, '', 80)}`);
  if (metadata.leadingContext) personalizationLines.push(`Common context: ${sanitizeSnippet(metadata.leadingContext, '', 80)}`);
  if (metadata.reversalRate) personalizationLines.push(`Reversals: ${sanitizeSnippet(String(metadata.reversalRate), '', 40)}`);
  if (Array.isArray(metadata.recentQuestions) && metadata.recentQuestions.length > 0) {
    const recentQuestions = sanitizeSnippetList(metadata.recentQuestions, 4, 120);
    if (recentQuestions.length) personalizationLines.push(`Avoid repeating: ${recentQuestions.join('; ')}`);
  }
  if (Array.isArray(metadata.focusAreas) && metadata.focusAreas.length > 0) {
    const focusAreas = sanitizeSnippetList(metadata.focusAreas, 5, 80);
    if (focusAreas.length) personalizationLines.push(`User focus areas: ${focusAreas.join(', ')}`);
  }

  const astroHighlights = Array.isArray(metadata.ephemerisForecast?.highlights)
    ? metadata.ephemerisForecast.highlights
    : [];

  // The Decision spread weighs two paths in one question, which the generic
  // "avoid listing options" rule would forbid.
  const optionsRule = spread?.key === 'decision'
    ? DECISION_QUESTION_INSTRUCTION
    : 'Avoid yes/no phrasing and avoid listing options.';
  const closingNote = closing ? ` It may end with “${closing}” if that reads naturally.` : '';

  const instructions = [
    `You are a tarot intention coach. Write ONE open, agency-forward question that fits the user’s focus, timeframe, ${spread ? 'depth, and chosen spread' : 'and depth'}.`,
    // GLM-5.3 otherwise addresses the querent as "you".
    'Write it in the querent’s own voice, in the first person (I, me, my), as they would ask it of the cards.',
    `Use open, supportive verbs (support, navigate, explore, transform) without repeating them mechanically. ${optionsRule}`,
    'Do not add quotes, bullets, or any preamble. Respond with the question only and end with a question mark.',
    `Tone: ${QUESTION_TONES[pattern]}.${closingNote} Treat this as tone, not words to copy.`,
    spread ? `Spread shape: ${spread.promptShape}` : null,
    astroHighlights.length ? 'Astro window is contextual; you may echo the timing (e.g., “this cycle”, “up to the next Full Moon”) but do not list the events verbatim.' : null,
    metadata.seed ? `Seed: ${sanitizeSnippet(String(metadata.seed), '', 80)} (use to pick a variant; do not mention).` : null
  ].filter(Boolean).join('\n');

  const inputLines = [
    `Focus: ${focus}`,
    `Timeframe: ${timeframe}`,
    `Depth: ${depthLabel}`,
    `Topic: ${topicLabel}`,
    ...(spread ? describeSpread(spread) : []),
    personalizationLines.length > 0 ? personalizationLines.join('\n') : null,
    astroHighlights.length ? `Astro window: ${sanitizeSnippetList(astroHighlights, 3, 120).join(' • ')}` : null,
    '',
    'Return a single question. Keep it under 28 words (about 180 characters).'
  ].filter(Boolean).join('\n');

  return { instructions, input: inputLines };
}

function resolveQuestionReasoningEffort(value) {
  const effort = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return QUESTION_REASONING_EFFORTS.has(effort) ? effort : DEFAULT_QUESTION_REASONING_EFFORT;
}

// A question timeout falls back to the template, but the route deadline
// cancels the whole request, so the question timeout never outlasts it.
function getQuestionTimeoutMs(env) {
  const configured = Number(env?.QUESTION_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_QUESTION_TIMEOUT_MS;
  return Math.min(getTaskTimeoutMs(env), Math.max(1000, timeoutMs));
}

// Only the final answer can become the question; reasoning is never read.
function readQuestionText(response) {
  const text = typeof response?.response === 'string'
    ? response.response
    : response?.choices?.[0]?.message?.content;
  return typeof text === 'string' ? text.trim() : '';
}

async function generateQuestionWithWorkersAI(env, prompt, metadata, signal, requestId) {
  if (!env?.AI) throw new Error('Workers AI binding is not available.');
  const model = env.QUESTION_MODEL || DEFAULT_QUESTION_MODEL;
  const { instructions, input } = buildQuestionPrompt(prompt, metadata);
  // Aborts on the route deadline, a client abort or the question timeout.
  const questionDeadline = createDeadline({ signal, timeoutMs: getQuestionTimeoutMs(env) });
  try {
    const response = await observeInferenceAttempt(env, {
      requestId, task: 'question', provider: WORKERS_AI_PROVIDER, requestedModel: model, signal: questionDeadline.signal
    }, () => questionDeadline.run(async () => {
      const result = await env.AI.run(model, {
        messages: [
          { role: 'system', content: instructions },
          { role: 'user', content: input }
        ],
        max_tokens: QUESTION_MAX_TOKENS,
        reasoning_effort: resolveQuestionReasoningEffort(env.QUESTION_REASONING_EFFORT)
      }, { signal: questionDeadline.signal });
      // Thrown here so the attempt is recorded as an empty response.
      const text = readQuestionText(result);
      if (!text) {
        throw Object.assign(new Error('Workers AI returned an empty question.'), { model: result?.model, usage: result?.usage });
      }
      // Cutting a rambling answer short would end it mid-thought; the
      // template reads better.
      if (text.length > GENERATED_QUESTION_MAX_LENGTH) {
        throw Object.assign(new Error('Workers AI returned an over-long question.'), {
          model: result?.model, usage: result?.usage, qualityIssues: ['question_too_long']
        });
      }
      return result;
    }));
    return { question: sanitizeGeneratedQuestion(readQuestionText(response)), model: response?.model || model };
  } finally {
    questionDeadline.dispose();
  }
}

export async function onRequestPost({ request, env }) {
  const deadline = createDeadline({ signal: request.signal, timeoutMs: getTaskTimeoutMs(env) });
  const requestId = crypto.randomUUID();
  let reservationId = null;
  let completed = false;
  try {
    const body = await readFeatureJsonBody(request, 64 * 1024);
    const prompt = body?.prompt;
    const metadata = body?.metadata || {};

    if (!prompt || typeof prompt !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing prompt' }),
        { status: 400, headers: JSON_HEADERS }
      );
    }

    // Check subscription tier for AI question access
    const user = await getUserFromRequest(request, env);
    const subscription = getSubscriptionContext(user);
    const hasAIAccess = canUseAIQuestions(subscription);

    // API key usage is Pro-only and subject to API call limits.
    if (user?.auth_provider === 'api_key') {
      const apiLimit = await enforceApiCallLimit(env, user);
      if (!apiLimit.allowed) {
        return new Response(JSON.stringify(apiLimit.payload), {
          status: apiLimit.status,
          headers: JSON_HEADERS
        });
      }
    }

    // For free tier, skip the model and use local template directly
    if (!hasAIAccess) {
      const question = craftQuestionFromPrompt(prompt, metadata);
      return new Response(
        JSON.stringify({
          question,
          provider: 'local-template',
          model: null,
          forecast: null,
          tierLimited: true
        }),
        { status: 200, headers: JSON_HEADERS }
      );
    }

    const reservation = await reserveFeatureUsage({ env, request, user, feature: 'question' });
    if (!reservation.allowed) return new Response(JSON.stringify(reservation.payload), { status: reservation.status, headers: JSON_HEADERS });
    reservationId = reservation.reservationId;

    // Optional ephemeris forecast for medium/long-range timeframes
    let ephemerisForecast = null;
    const forecastDays = getForecastDays(metadata);

    if (forecastDays) {
      try {
        const forecast = await fetchEphemerisForecast(forecastDays);
        const highlights = formatForecastHighlights(forecast, 4);

        if (highlights.length) {
          ephemerisForecast = {
            days: forecast.forecastDays,
            highlights,
            source: forecast.source || 'astronomy-engine'
          };

          metadata.ephemerisForecast = ephemerisForecast;
          metadata.timeframeValue = metadata.timeframeValue || (forecastDays === 90 ? 'season' : 'month');
        }
      } catch (error) {
        console.warn('[generate-question] Ephemeris forecast unavailable:', error?.message || error);
      }
    }

    let provider = 'local-fallback';
    let question = null;
    let inferenceModel = null;

    try {
      const result = await generateQuestionWithWorkersAI(env, prompt, metadata, deadline.signal, requestId);
      question = result.question;
      inferenceModel = result.model;
      provider = WORKERS_AI_PROVIDER;
    } catch (error) {
      // A cancelled request still fails; only the question timeout or a
      // model failure falls through to the template.
      deadline.signal.throwIfAborted();
      console.warn('Workers AI question generation failed, using the local template:', error?.message || error);
    }

    if (!question) {
      question = craftQuestionFromPrompt(prompt, metadata);
      provider = 'local-fallback';
    }

    completed = provider === WORKERS_AI_PROVIDER;

    return new Response(
      JSON.stringify({
        question,
        provider,
        model: completed ? inferenceModel : null,
        forecast: ephemerisForecast
      }),
      { status: 200, headers: JSON_HEADERS }
    );
  } catch (error) {
    console.error('generate-question error:', error);
    return new Response(
      JSON.stringify({ error: 'Unable to craft question' }),
      { status: deadline.signal.aborted ? 503 : error.status || 500, headers: JSON_HEADERS }
    );
  } finally {
    deadline.dispose();
    await settleFeatureUsage(env, reservationId, { completed });
  }
}
