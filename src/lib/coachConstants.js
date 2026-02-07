export const STEPS = [
  { id: 'topic', label: 'Topic' },
  { id: 'timeframe', label: 'Timeframe' },
  { id: 'depth', label: 'Depth' }
];

export const COACH_PREFS_KEY = 'tarot-coach-preferences';
export const SUGGESTIONS_PER_PAGE = 5;

// Timing constants (milliseconds)
export const TIMING = {
  CREATIVE_DEBOUNCE: 800,
  STATUS_DISPLAY_SHORT: 1800,
  STATUS_DISPLAY_MEDIUM: 2600,
  STATUS_DISPLAY_LONG: 5000,
  PREFS_EXPIRY: 7 * 24 * 60 * 60 * 1000 // 1 week
};

// Map spreads to suggested topics
export const SPREAD_TO_TOPIC_MAP = {
  relationship: 'relationships',
  decision: 'decision',
  celtic: 'growth',
  fiveCard: 'wellbeing',
  threeCard: null,
  single: null
};

// Friendly spread names for hints
export const SPREAD_NAMES = {
  relationship: 'Relationship Snapshot',
  decision: 'Decision',
  celtic: 'Celtic Cross',
  fiveCard: 'Five-Card Clarity',
  threeCard: 'Three-Card Story',
  single: 'One-Card Insight'
};

// Map onboarding focus areas to intention topics
export const FOCUS_AREA_TO_TOPIC = {
  love: 'relationships',
  career: 'career',
  self_worth: 'growth',
  healing: 'wellbeing',
  creativity: 'career',
  spirituality: 'growth'
};

export const CONTEXT_HINTS = {
  love: {
    label: 'Relationship reciprocity',
    topic: 'relationships',
    timeframe: 'week',
    depth: 'guided',
    customFocus: 'my closest relationships and how I can nurture reciprocity'
  },
  career: {
    label: 'Purpose & vocation pulse',
    topic: 'career',
    timeframe: 'month',
    depth: 'guided',
    customFocus: 'my career direction and purpose'
  },
  self: {
    label: 'Inner growth focus',
    topic: 'growth',
    timeframe: 'open',
    depth: 'lesson',
    customFocus: 'my inner growth and healing'
  },
  spiritual: {
    label: 'Spiritual practice check-in',
    topic: 'growth',
    timeframe: 'season',
    depth: 'deep',
    customFocus: 'my spiritual practice and devotion'
  },
  wellbeing: {
    label: 'Energy & wellbeing tune-up',
    topic: 'wellbeing',
    timeframe: 'week',
    depth: 'guided',
    customFocus: 'my wellbeing and daily balance'
  },
  decision: {
    label: 'Navigating a decision',
    topic: 'decision',
    timeframe: 'week',
    depth: 'guided',
    customFocus: 'the decision currently on my mind'
  }
};

export const FOCUS_AREA_SUGGESTIONS = {
  love: {
    label: 'Love & relationships',
    topic: 'relationships',
    timeframe: 'week',
    depth: 'guided',
    customFocus: 'my closest relationships'
  },
  career: {
    label: 'Career & money',
    topic: 'career',
    timeframe: 'month',
    depth: 'guided',
    customFocus: 'my career direction and finances'
  },
  self_worth: {
    label: 'Self-worth & confidence',
    topic: 'growth',
    timeframe: 'month',
    depth: 'lesson',
    customFocus: 'my self-worth and confidence'
  },
  healing: {
    label: 'Healing & growth',
    topic: 'wellbeing',
    timeframe: 'season',
    depth: 'lesson',
    customFocus: 'my healing and balance'
  },
  creativity: {
    label: 'Creativity & projects',
    topic: 'career',
    timeframe: 'month',
    depth: 'guided',
    customFocus: 'my creative projects'
  },
  spirituality: {
    label: 'Spiritual path',
    topic: 'growth',
    timeframe: 'season',
    depth: 'deep',
    customFocus: 'my spiritual path'
  }
};
