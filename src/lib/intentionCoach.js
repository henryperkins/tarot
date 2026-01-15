import { loadStoredJournalInsights } from './journalInsights.js';
import { loadCoachHistory } from './coachStorage.js';
import { djb2Hash } from './utils.js';
import { ensureQuestionMark } from './themeText.js';

/**
 * Deterministically picks a variant from a list based on a seed.
 * Same inputs always produce the same output.
 *
 * @param {Array} list - Array of variants to choose from
 * @param {number|string} seed - Seed value for deterministic selection
 * @returns {string} Selected variant
 */
function pickVariantDeterministic(list, seed) {
  if (!Array.isArray(list) || list.length === 0) return '';

  // Convert seed to number if it's a string
  const numericSeed = typeof seed === 'string' ? djb2Hash(seed) : (seed >>> 0);

  // Use simple modulo for deterministic selection
  return list[numericSeed % list.length];
}

/**
 * Legacy variant picker with time-based randomization (non-deterministic).
 * Kept for backward compatibility when no seed is provided.
 *
 * @param {Array} list - Array of variants to choose from
 * @param {string} seedBase - Base string to influence selection
 * @returns {string} Selected variant
 */
function pickVariant(list, seedBase = '') {
  if (!Array.isArray(list) || list.length === 0) return '';
  const seed = djb2Hash(`${seedBase}|${Date.now()}|${Math.random()}`);
  return list[seed % list.length];
}

export const INTENTION_TOPIC_OPTIONS = [
  {
    value: 'relationships',
    label: 'Love & Relationships',
    description: 'Partners, dating, family dynamics, community.',
    focus: 'my closest relationships and connections'
  },
  {
    value: 'career',
    label: 'Career & Purpose',
    description: 'Work, calling, leadership, creative path.',
    focus: 'my career direction and purpose'
  },
  {
    value: 'wellbeing',
    label: 'Wellbeing & Balance',
    description: 'Energy, health, daily flow, emotional balance.',
    focus: 'my wellbeing and day-to-day balance'
  },
  {
    value: 'growth',
    label: 'Self-Growth & Spiritual',
    description: 'Inner work, intuition, healing, spiritual practice.',
    focus: 'my personal growth and spiritual practice'
  },
  {
    value: 'decision',
    label: 'Choices & Crossroads',
    description: 'Making a call, weighing paths, bold changes.',
    focus: 'the decision that is on my mind'
  },
  {
    value: 'abundance',
    label: 'Money & Resources',
    description: 'Finances, home, stability, material support.',
    focus: 'my finances and sense of stability'
  }
];

export const INTENTION_TIMEFRAME_OPTIONS = [
  { value: 'today', label: 'Today / Daily', phrase: 'today', description: 'Immediate clarity' },
  { value: 'week', label: 'This week', phrase: 'this week', description: 'Short-term focus' },
  { value: 'month', label: 'Next 30 days', phrase: 'over the next month', description: 'Medium timeline' },
  { value: 'season', label: 'Season ahead', phrase: 'over the next few months', description: 'Quarterly planning' },
  { value: 'open', label: 'Open timeline', phrase: 'right now', description: 'Timeless guidance' }
];

export const INTENTION_DEPTH_OPTIONS = [
  {
    value: 'pulse',
    label: 'Quick pulse',
    description: 'Gentle check-in on the energy.',
    pattern: 'support',
    closing: 'with calm awareness'
  },
  {
    value: 'guided',
    label: 'Focused guidance',
    description: 'Clarify the next move or plan.',
    pattern: 'navigate',
    closing: 'with confidence'
  },
  {
    value: 'lesson',
    label: 'Lesson & insight',
    description: 'Zoom out for the deeper teaching.',
    pattern: 'lesson',
    closing: ''
  },
  {
    value: 'deep',
    label: 'Deep dive',
    description: 'Transformational, soulful work.',
    pattern: 'transform',
    closing: 'honor my growth'
  }
];

/**
 * Local creative question builder (fallback when API is unavailable).
 * Mirrors the guided templates so creative mode keeps the same intention-aware tone.
 *
 * @param {Object} params - Question parameters
 * @param {string} params.focus - Focus area text
 * @param {string} [params.timeframePhrase] - Timeframe phrase
 * @param {string} params.depthLabel - Depth label
 * @param {string} params.topicLabel - Topic label
 * @param {string} params.pattern - Depth pattern (support/navigate/lesson/transform)
 * @param {string} [params.closing] - Closing phrase based on depth
 * @param {number|string} [params.seed] - Optional seed for deterministic output
 * @returns {string} Generated question text
 */
export function buildLocalCreativeQuestion({ focus, timeframePhrase, depthLabel, topicLabel, pattern, closing, seed }) {
  const cleanFocus = (focus || 'this area of my life').replace(/\s+/g, ' ').trim();
  const timeframeText = timeframePhrase ? ` ${timeframePhrase}` : '';
  const closingSuffix = pattern === 'transform'
    ? (closing ? ` so I can ${closing}` : '')
    : (closing ? ` ${closing}` : '');
  const focusWithTimeframe = `${cleanFocus}${timeframeText}`;

  const supportVariants = [
    `How can I better support ${focusWithTimeframe}${closingSuffix}`,
    `What would help me tend to ${focusWithTimeframe}${closingSuffix}`,
    `Where should I focus to steady ${focusWithTimeframe}${closingSuffix}`,
    `What support will help me honor ${focusWithTimeframe}${closingSuffix}`,
    `How can I hold space for ${focusWithTimeframe}${closingSuffix}`,
    `How can I show up for ${focusWithTimeframe}${closingSuffix}`
  ];

  const navigateVariants = [
    `How can I navigate ${focusWithTimeframe}${closingSuffix}`,
    `How can I stay aligned with ${focusWithTimeframe}${closingSuffix}`,
    `What next step would move ${cleanFocus} forward${timeframeText}${closingSuffix}`,
    `What should I prioritize to move through ${focusWithTimeframe}${closingSuffix}`,
    `Where should I direct my energy to navigate ${focusWithTimeframe}${closingSuffix}`,
    `How can I make progress with ${cleanFocus}${timeframeText}${closingSuffix}`
  ];

  const lessonVariants = [
    `What deeper lesson is ${cleanFocus} offering${timeframeText}${closingSuffix}`,
    `How can I interpret ${focusWithTimeframe} as guidance${closingSuffix}`,
    `What am I being shown about ${focusWithTimeframe}${closingSuffix}`,
    `Where is ${cleanFocus} inviting me to grow${timeframeText}${closingSuffix}`,
    `How does ${focusWithTimeframe} reflect my bigger story${closingSuffix}`
  ];

  const transformVariants = [
    `How can I transform ${focusWithTimeframe}${closingSuffix}`,
    `What needs to shift within ${focusWithTimeframe}${closingSuffix}`,
    `What would renewal look like for ${focusWithTimeframe}${closingSuffix}`,
    `How might I nurture ${focusWithTimeframe}${closingSuffix}`,
    `What must I release to renew ${focusWithTimeframe}${closingSuffix}`,
    `How can I support the transformation of ${focusWithTimeframe}${closingSuffix}`
  ];

  const variantsByPattern = {
    support: supportVariants,
    navigate: navigateVariants,
    lesson: lessonVariants,
    transform: transformVariants
  };

  const variants = variantsByPattern[pattern] || [`How can I explore ${focusWithTimeframe}${closingSuffix}`];

  // Choose picker based on seed presence and bake the context into the seed to reduce collisions
  const picker = seed !== undefined ? pickVariantDeterministic : pickVariant;
  const pickerSeed = seed !== undefined
    ? `${seed}|${focusWithTimeframe}|${depthLabel}|${pattern}`
    : `${focusWithTimeframe}|${depthLabel}|${topicLabel}|${pattern}`;

  const question = picker(variants, pickerSeed);
  return ensureQuestionMark(question);
}

export async function callLlmApi(prompt, metadata, options = {}) {
  const { signal } = options;
  try {
    const response = await fetch('/api/generate-question', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ prompt, metadata }),
      signal
    });

    if (!response.ok) {
      throw new Error('API request failed');
    }

    const data = await response.json();
    if (data && typeof data === 'object') {
      return {
        question: data.question,
        provider: data.provider || data.source || null,
        model: data.model || null,
        forecast: data.forecast || null
      };
    }
    return null;
  } catch (error) {
    console.error('LLM API call failed:', error);
    return null;
  }
}

/**
 * Builds a creative/personalized tarot question with journal context integration.
 *
 * @param {Object} params - Question parameters
 * @param {string} params.topic - Topic area (relationships, career, etc.)
 * @param {string} params.timeframe - Time scope (today, week, month, etc.)
 * @param {string} params.depth - Depth level (pulse, guided, lesson, deep)
 * @param {string} [params.customFocus] - Optional custom focus text
 * @param {number|string} [params.seed] - Optional seed for deterministic output
 * @returns {Promise<Object>} { question: string, source: 'api'|'local' }
 */
export async function buildCreativeQuestion({ topic, timeframe, depth, customFocus, seed, focusAreas }, options = {}) {
  const { signal, userId = null } = options;
  const topicData = INTENTION_TOPIC_OPTIONS.find(option => option.value === topic) || INTENTION_TOPIC_OPTIONS[0];
  const timeframeData = INTENTION_TIMEFRAME_OPTIONS.find(option => option.value === timeframe) || INTENTION_TIMEFRAME_OPTIONS[0];
  const depthData = INTENTION_DEPTH_OPTIONS.find(option => option.value === depth) || INTENTION_DEPTH_OPTIONS[0];

  const focus = customFocus?.trim() || topicData.focus;
  const timeframeClause = timeframeData?.phrase || 'the current moment';
  const normalizedFocusAreas = Array.isArray(focusAreas)
    ? focusAreas.map(area => (typeof area === 'string' ? area.trim() : '')).filter(Boolean)
    : [];

  const insights = loadStoredJournalInsights(userId);
  const stats = insights?.stats || null;
  const recentThemes = stats?.recentThemes || [];
  const frequentCard = stats?.frequentCards?.[0]?.name || null;
  const leadingContext = stats?.contextBreakdown?.[0]?.name || null;
  const reversalRate = typeof stats?.reversalRate === 'number' ? `${stats.reversalRate}% reversals logged` : null;
  const recentQuestions = loadCoachHistory(3, userId)
    .map(entry => (typeof entry?.question === 'string' ? entry.question.trim() : ''))
    .filter(Boolean);

  const personalizationFragments = [];
  if (recentThemes.length > 0) {
    personalizationFragments.push(`Recent themes to honor: ${recentThemes.slice(0, 3).join(', ')}`);
  }
  if (frequentCard) {
    personalizationFragments.push(`Recurring card: ${frequentCard}`);
  }
  if (leadingContext) {
    personalizationFragments.push(`Common context: ${leadingContext}`);
  }
  if (reversalRate) {
    personalizationFragments.push(reversalRate);
  }
  if (recentQuestions.length > 0) {
    personalizationFragments.push(`Avoid repeating prior asks like: ${recentQuestions.join('; ')}`);
  }
  if (normalizedFocusAreas.length > 0) {
    personalizationFragments.push(`User focus areas: ${normalizedFocusAreas.join(', ')}`);
  }

  const personalizationNote = personalizationFragments.length > 0
    ? `Personalization: ${personalizationFragments.join(' | ')}.`
    : '';

  const promptParts = [
    `Generate a tarot question about ${focus} for ${timeframeClause}.`,
    `The desired depth is ${depthData.label}.`,
    personalizationNote
  ].filter(Boolean);
  const prompt = promptParts.join(' ').trim();
  const metadata = {
    focus,
    customFocus: customFocus?.trim() || null,
    topic: topicData.label,
    topicValue: topicData.value,
    timeframe: timeframeData.label,
    timeframeValue: timeframeData.value,
    timeframePhrase: timeframeData.phrase,
    depth: depthData.label,
    pattern: depthData.pattern,
    closing: depthData.closing,
    recentThemes,
    frequentCard,
    leadingContext,
    reversalRate,
    recentQuestions,
    seed: seed !== undefined ? seed : null,  // Pass seed to backend
    focusAreas: normalizedFocusAreas
  };

  let apiResult = null;
  try {
    apiResult = await callLlmApi(prompt, metadata, { signal });
  } catch (error) {
    console.warn('Creative question API failed, falling back to local generator:', error);
  }

  const apiQuestion = typeof apiResult === 'string' ? apiResult : apiResult?.question;
  const apiSource = apiResult?.provider || 'api';
  const apiForecast = apiResult?.forecast || null;

  if (apiQuestion) {
    return { question: apiQuestion, source: apiSource, forecast: apiForecast };
  }

  // Local creative fallback adds variety instead of repeating guided wording
  const localCreative = buildLocalCreativeQuestion({
    focus,
    timeframePhrase: timeframeData?.phrase,
    depthLabel: depthData.label,
    pattern: depthData.pattern,
    closing: depthData.closing,
    topicLabel: topicData.label,
    seed  // Pass seed to fallback
  });

  return { question: localCreative, source: 'local', forecast: null };
}

/**
 * Builds a guided tarot question from structured parameters.
 *
 * @param {Object} params - Question parameters
 * @param {string} params.topic - Topic area (relationships, career, etc.)
 * @param {string} params.timeframe - Time scope (today, week, month, etc.)
 * @param {string} params.depth - Depth level (pulse, guided, lesson, deep)
 * @param {string} [params.customFocus] - Optional custom focus text
 * @param {number|string} [params.seed] - Optional seed for deterministic output
 * @returns {string} Generated question text
 */
export function buildGuidedQuestion({ topic, timeframe, depth, customFocus, seed }) {
  const topicData = INTENTION_TOPIC_OPTIONS.find(option => option.value === topic) || INTENTION_TOPIC_OPTIONS[0];
  const timeframeData = INTENTION_TIMEFRAME_OPTIONS.find(option => option.value === timeframe) || INTENTION_TIMEFRAME_OPTIONS[0];
  const depthData = INTENTION_DEPTH_OPTIONS.find(option => option.value === depth) || INTENTION_DEPTH_OPTIONS[0];

  const focus = (customFocus?.trim() || topicData.focus || '').replace(/\s+/g, ' ').trim() || 'this area of my life';
  const timeframeText = timeframeData?.phrase ? ` ${timeframeData.phrase}` : '';
  const closingSuffix = depthData.pattern === 'transform'
    ? (depthData.closing ? ` so I can ${depthData.closing}` : '')
    : (depthData.closing ? ` ${depthData.closing}` : '');
  const focusWithTimeframe = `${focus}${timeframeText}`;

  const supportVariants = [
    `How can I better support ${focusWithTimeframe}${closingSuffix}`,
    `What would help me hold space for ${focusWithTimeframe}${closingSuffix}`,
    `Where should I focus my energy to bring balance to ${focusWithTimeframe}${closingSuffix}`
  ];

  const navigateVariants = [
    `How can I navigate ${focusWithTimeframe}${closingSuffix}`,
    `How can I stay aligned with ${focusWithTimeframe}${closingSuffix}`,
    `What next step would move ${focus} forward${timeframeText}${closingSuffix}`,
    `What should I prioritize to navigate ${focus}${timeframeText}${closingSuffix}`,
    `How can I make progress with ${focus}${timeframeText}${closingSuffix}`
  ];

  const lessonVariants = [
    `What deeper lesson is ${focus} offering${timeframeText}`,
    `How can I interpret ${focus}${timeframeText} as guidance`,
    `Where is ${focus} inviting me to grow${timeframeText}`
  ];

  const transformVariants = [
    `How can I transform ${focus}${timeframeText}${closingSuffix}`,
    `What needs to shift within ${focus}${timeframeText}${closingSuffix}`,
    `How might I nurture ${focus}${timeframeText}${closingSuffix}`,
    `What must I release to renew ${focus}${timeframeText}${closingSuffix}`
  ];

  const variantsByPattern = {
    support: supportVariants,
    navigate: navigateVariants,
    lesson: lessonVariants,
    transform: transformVariants
  };

  const variants = variantsByPattern[depthData.pattern] || [`How can I explore ${focus}${timeframeText}`];

  // Choose picker based on seed presence
  const picker = seed !== undefined ? pickVariantDeterministic : pickVariant;
  const pickerSeed = seed !== undefined
    ? String(seed)
    : `${focus}|${timeframe}|${depth}`;

  const question = picker(variants, pickerSeed);
  return ensureQuestionMark(question);
}

export function getCoachSummary({ topic, timeframe, depth }) {
  const topicData = INTENTION_TOPIC_OPTIONS.find(option => option.value === topic);
  const timeframeData = INTENTION_TIMEFRAME_OPTIONS.find(option => option.value === timeframe);
  const depthData = INTENTION_DEPTH_OPTIONS.find(option => option.value === depth);

  return {
    topicLabel: topicData?.label || 'Topic',
    timeframeLabel: timeframeData?.label || 'Timeframe',
    depthLabel: depthData?.label || 'Depth'
  };
}
