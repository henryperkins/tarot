import { EXAMPLE_QUESTIONS } from '../data/exampleQuestions.js';
import { loadStoredJournalInsights } from './journalInsights.js';
import { loadCoachHistory } from './coachStorage.js';
import { hashString } from './deck.js';

const STOP_PHRASES = [' this week', ' this relationship', ' right now', ' with clarity'];

function deriveOpener(seed) {
  if (!seed) return 'How can I';
  let opener = seed.replace(/\?$/, '').trim();
  for (const phrase of STOP_PHRASES) {
    if (opener.endsWith(phrase)) {
      opener = opener.slice(0, -phrase.length).trim();
      break;
    }
  }
  return opener || 'How can I';
}

const focusSeed = EXAMPLE_QUESTIONS[0] || 'What should I focus on this week?';
const navigateSeed = EXAMPLE_QUESTIONS[1] || 'How can I navigate this relationship?';
const lessonSeed = EXAMPLE_QUESTIONS[3] || 'What lesson am I meant to learn?';
const claritySeed = EXAMPLE_QUESTIONS[4] || 'How can I move forward with clarity?';

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
  const numericSeed = typeof seed === 'string' ? hashString(seed) : (seed >>> 0);

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
  const seed = hashString(`${seedBase}|${Date.now()}|${Math.random()}`);
  return list[seed % list.length];
}

function ensureQuestionMark(text) {
  if (!text) return '';
  const trimmed = text.trim();
  return trimmed.endsWith('?') ? trimmed : `${trimmed}?`;
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
    opener: deriveOpener(focusSeed),
    pattern: 'support',
    closing: 'with calm awareness'
  },
  {
    value: 'guided',
    label: 'Focused guidance',
    description: 'Clarify the next move or plan.',
    opener: deriveOpener(navigateSeed),
    pattern: 'navigate',
    closing: 'with confidence'
  },
  {
    value: 'lesson',
    label: 'Lesson & insight',
    description: 'Zoom out for the deeper teaching.',
    opener: deriveOpener(lessonSeed),
    pattern: 'lesson',
    closing: ''
  },
  {
    value: 'deep',
    label: 'Deep dive',
    description: 'Transformational, soulful work.',
    opener: deriveOpener(claritySeed),
    pattern: 'transform',
    closing: 'honor my growth'
  }
];

/**
 * Local creative question builder (fallback when API is unavailable).
 *
 * @param {Object} params - Question parameters
 * @param {string} params.focus - Focus area text
 * @param {string} [params.timeframePhrase] - Timeframe phrase
 * @param {string} params.depthLabel - Depth label
 * @param {string} params.topicLabel - Topic label
 * @param {number|string} [params.seed] - Optional seed for deterministic output
 * @returns {string} Generated question text
 */
function buildLocalCreativeQuestion({ focus, timeframePhrase, depthLabel, topicLabel, seed }) {
  const verbs = [
    'move forward with',
    'nurture',
    'deepen trust in',
    'open up to',
    'energize'
  ];
  const aims = [
    'honor my growth',
    'stay aligned with my values',
    'invite reciprocity',
    'feel grounded',
    'show up with compassion'
  ];
  const lenses = [
    'with curiosity',
    'with steadiness',
    'with healthy boundaries',
    'with courage',
    'with clear communication'
  ];

  // Choose picker based on seed presence
  const picker = seed !== undefined ? pickVariantDeterministic : pickVariant;

  const verb = picker(verbs, seed !== undefined ? hashString(`${seed}|verb|${focus}`) : focus);
  const aim = picker(aims, seed !== undefined ? hashString(`${seed}|aim|${depthLabel}`) : depthLabel);
  const lens = picker(lenses, seed !== undefined ? hashString(`${seed}|lens|${topicLabel}`) : topicLabel);
  const timeframe = timeframePhrase ? ` ${timeframePhrase}` : '';

  return ensureQuestionMark(`How can I ${verb} ${focus}${timeframe} so I can ${aim} ${lens}`.replace(/\s+/g, ' ').trim());
}

export async function callLlmApi(prompt, metadata) {
  try {
    const response = await fetch('/api/generate-question', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ prompt, metadata })
    });

    if (!response.ok) {
      throw new Error('API request failed');
    }

    const data = await response.json();
    return data.question;
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
export async function buildCreativeQuestion({ topic, timeframe, depth, customFocus, seed }) {
  const topicData = INTENTION_TOPIC_OPTIONS.find(option => option.value === topic) || INTENTION_TOPIC_OPTIONS[0];
  const timeframeData = INTENTION_TIMEFRAME_OPTIONS.find(option => option.value === timeframe) || INTENTION_TIMEFRAME_OPTIONS[0];
  const depthData = INTENTION_DEPTH_OPTIONS.find(option => option.value === depth) || INTENTION_DEPTH_OPTIONS[0];

  const focus = customFocus?.trim() || topicData.focus;
  const timeframeText = timeframeData?.phrase ? ` ${timeframeData.phrase}` : '';

  const insights = loadStoredJournalInsights();
  const stats = insights?.stats || null;
  const recentThemes = stats?.recentThemes || [];
  const frequentCard = stats?.frequentCards?.[0]?.name || null;
  const leadingContext = stats?.contextBreakdown?.[0]?.name || null;
  const reversalRate = typeof stats?.reversalRate === 'number' ? `${stats.reversalRate}% reversals logged` : null;
  const recentQuestions = loadCoachHistory(3).map(entry => entry.question);

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

  const personalizationNote = personalizationFragments.length > 0
    ? `Personalization: ${personalizationFragments.join(' | ')}.`
    : '';

  const prompt = `Generate a tarot question about ${focus} for the${timeframeText || ' current moment'}. The desired depth is ${depthData.label}. ${personalizationNote}`.trim();
  const metadata = {
    focus,
    customFocus: customFocus?.trim() || null,
    topic: topicData.label,
    timeframe: timeframeData.label,
    depth: depthData.label,
    recentThemes,
    frequentCard,
    leadingContext,
    reversalRate,
    recentQuestions,
    seed: seed !== undefined ? seed : null  // Pass seed to backend
  };

  let creativeQuestion = null;
  try {
    creativeQuestion = await callLlmApi(prompt, metadata);
  } catch (error) {
    // swallow and fall back below
  }

  if (creativeQuestion) {
    return { question: creativeQuestion, source: 'api' };
  }

  // Local creative fallback adds variety instead of repeating guided wording
  const localCreative = buildLocalCreativeQuestion({
    focus,
    timeframePhrase: timeframeData?.phrase,
    depthLabel: depthData.label,
    topicLabel: topicData.label,
    seed  // Pass seed to fallback
  });

  return { question: localCreative, source: 'local' };
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

  const focus = customFocus?.trim() || topicData.focus;
  const timeframeText = timeframeData?.phrase ? ` ${timeframeData.phrase}` : '';

  // Choose picker based on seed presence
  const picker = seed !== undefined ? pickVariantDeterministic : pickVariant;
  const pickerSeed = seed !== undefined ? hashString(`${seed}|${focus}`) : focus;

  switch (depthData.pattern) {
    case 'support': {
      const closing = depthData.closing ? ` ${depthData.closing}` : '';
      const variants = [
        `${depthData.opener} support ${focus}${timeframeText}${closing}`,
        `${depthData.opener} hold space for ${focus}${timeframeText}${closing}`,
        `${depthData.opener} bring balance to ${focus}${timeframeText}`
      ];
      return ensureQuestionMark(picker(variants, pickerSeed));
    }
    case 'navigate': {
      const closing = depthData.closing ? ` ${depthData.closing}` : '';
      const variants = [
        `${depthData.opener} ${focus}${timeframeText}${closing}`,
        `How can I stay aligned with ${focus}${timeframeText}${closing}`,
        `How can I make progress in ${focus}${timeframeText}`
      ];
      return ensureQuestionMark(picker(variants, pickerSeed));
    }
    case 'lesson': {
      const variants = [
        `${depthData.opener} from ${focus}${timeframeText}`,
        `What deeper lesson is ${focus} offering${timeframeText}`,
        `What is the hidden gift within ${focus}${timeframeText}`
      ];
      return ensureQuestionMark(picker(variants, pickerSeed));
    }
    case 'transform': {
      const closing = depthData.closing ? ` so I can ${depthData.closing}` : '';
      const relationshipVariants = [
        `${depthData.opener} with ${focus}${timeframeText}${closing}`,
        `What would help me feel closer to ${focus}${timeframeText}${closing}`,
        `How might I nurture ${focus}${timeframeText}${closing}`,
        `What must I release to transform ${focus}${timeframeText}`
      ];
      const transformSeed = seed !== undefined ? hashString(`${seed}|${focus}|${timeframe}|${depth}`) : `${focus}|${timeframe}|${depth}`;
      return ensureQuestionMark(picker(relationshipVariants, transformSeed));
    }
    default:
      return ensureQuestionMark(`${depthData.opener} ${focus}${timeframeText}`);
  }
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
