import { EXAMPLE_QUESTIONS } from '../data/exampleQuestions';

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

export async function callLlmApi(prompt) {
  try {
    const response = await fetch('/api/generate-question', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ prompt })
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

export async function buildCreativeQuestion({ topic, timeframe, depth, customFocus }) {
  const topicData = INTENTION_TOPIC_OPTIONS.find(option => option.value === topic) || INTENTION_TOPIC_OPTIONS[0];
  const timeframeData = INTENTION_TIMEFRAME_OPTIONS.find(option => option.value === timeframe) || INTENTION_TIMEFRAME_OPTIONS[0];
  const depthData = INTENTION_DEPTH_OPTIONS.find(option => option.value === depth) || INTENTION_DEPTH_OPTIONS[0];

  const focus = customFocus?.trim() || topicData.focus;
  const timeframeText = timeframeData?.phrase ? ` ${timeframeData.phrase}` : '';

  const prompt = `Generate a tarot question about ${focus} for the ${timeframeText}. The desired depth is ${depthData.label}.`;

  const creativeQuestion = await callLlmApi(prompt);
  return creativeQuestion;
}

export function buildGuidedQuestion({ topic, timeframe, depth, customFocus, useCreative = false }) {
  if (useCreative) {
    return buildCreativeQuestion({ topic, timeframe, depth, customFocus });
  }
  const topicData = INTENTION_TOPIC_OPTIONS.find(option => option.value === topic) || INTENTION_TOPIC_OPTIONS[0];
  const timeframeData = INTENTION_TIMEFRAME_OPTIONS.find(option => option.value === timeframe) || INTENTION_TIMEFRAME_OPTIONS[0];
  const depthData = INTENTION_DEPTH_OPTIONS.find(option => option.value === depth) || INTENTION_DEPTH_OPTIONS[0];

  const focus = customFocus?.trim() || topicData.focus;
  const timeframeText = timeframeData?.phrase ? ` ${timeframeData.phrase}` : '';

  switch (depthData.pattern) {
    case 'support': {
      const closing = depthData.closing ? ` ${depthData.closing}` : '';
      return `${depthData.opener} to support ${focus}${timeframeText}${closing}?`;
    }
    case 'navigate': {
      const closing = depthData.closing ? ` ${depthData.closing}` : '';
      return `${depthData.opener} ${focus}${timeframeText}${closing}?`;
    }
    case 'lesson': {
      return `${depthData.opener} from ${focus}${timeframeText}?`;
    }
    case 'transform': {
      const closing = depthData.closing ? ` so I can ${depthData.closing}` : '';
      return `${depthData.opener} with ${focus}${timeframeText}${closing}?`;
    }
    default:
      return `${depthData.opener} ${focus}${timeframeText}?`;
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
