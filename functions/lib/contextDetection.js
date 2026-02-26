import { normalizeContext } from './narrative/helpers.js';
import { sanitizeText } from './utils.js';

const SPREAD_CONTEXT_DEFAULTS = {
  relationship: 'love',
  decision: 'decision'
};

const GRAPH_RAG_SPREAD_DEFAULTS = {
  relationship: 'relationship'
};

const CONTEXT_KEYWORDS = {
  love: [
    'relationship',
    'relationships',
    'romance',
    'romantic',
    'love',
    'partner',
    'partnership',
    'marriage',
    'married',
    'spouse',
    'crush',
    'dating',
    'soulmate',
    'twin flame',
    'connection',
    'couple',
    'lover',
    'feelings',
    'intimacy'
  ],
  career: [
    'career',
    'job',
    'work',
    'working',
    'boss',
    'coworker',
    'manager',
    'business',
    'client',
    'project',
    'promotion',
    'salary',
    'money',
    'finance',
    'finances',
    'income',
    'profession',
    'entrepreneur',
    'company',
    'office',
    'team',
    'coworkers'
  ],
  self: [
    'self',
    'myself',
    'personal',
    'growth',
    'confidence',
    'mindset',
    'boundary',
    'boundaries',
    'shadow',
    'inner child',
    'therapy',
    'habit',
    'habits',
    'self-care',
    'self care'
  ],
  spiritual: [
    'spiritual',
    'spirit',
    'soul',
    'soulpath',
    'purpose',
    'mission',
    'intuition',
    'psychic',
    'meditation',
    'meditate',
    'prayer',
    'ritual',
    'energy',
    'energetic',
    'chakra',
    'astrology',
    'ancestor',
    'guides',
    'universe',
    'divine'
  ],
  wellbeing: [
    'wellbeing',
    'well-being',
    'wellness',
    'health',
    'healthy',
    'healing',
    'heal',
    'mental health',
    'physical',
    'body',
    'stress',
    'anxiety',
    'depression',
    'rest',
    'sleep',
    'balance',
    'burnout',
    'exhaustion',
    'recovery',
    'self-care'
  ],
  decision: [
    'decision',
    'decide',
    'deciding',
    'choose',
    'choice',
    'choices',
    'choosing',
    'crossroads',
    'path',
    'direction',
    'option',
    'options',
    'should i',
    'which way',
    'what to do',
    'dilemma',
    'uncertain',
    'fork in the road',
    'or should i'
  ]
};

const GRAPH_RAG_CONTEXT_KEYWORDS = {
  grief: [
    'grief',
    'grieving',
    'loss',
    'mourning',
    'bereavement',
    'funeral',
    'passed away',
    'passed on'
  ],
  relationship: [
    'relationship',
    'relationships',
    'romance',
    'romantic',
    'love',
    'partner',
    'partnership',
    'marriage',
    'married',
    'spouse',
    'boyfriend',
    'girlfriend',
    'dating',
    'crush',
    'soulmate',
    'connection',
    'breakup',
    'separation',
    'divorce'
  ],
  career: [
    'career',
    'job',
    'work',
    'working',
    'boss',
    'coworker',
    'manager',
    'business',
    'client',
    'project',
    'promotion',
    'salary',
    'money',
    'finance',
    'finances',
    'income',
    'profession',
    'entrepreneur',
    'company',
    'office',
    'team',
    'coworkers'
  ],
  health: [
    'health',
    'healthy',
    'healing',
    'heal',
    'wellbeing',
    'well-being',
    'wellness',
    'mental health',
    'physical',
    'body',
    'stress',
    'anxiety',
    'depression',
    'rest',
    'sleep',
    'balance',
    'burnout',
    'exhaustion',
    'recovery',
    'therapy',
    'self-care',
    'self care'
  ],
  spiritual: [
    'spiritual',
    'spirit',
    'soul',
    'purpose',
    'mission',
    'intuition',
    'psychic',
    'meditation',
    'meditate',
    'prayer',
    'ritual',
    'energy',
    'energetic',
    'chakra',
    'ancestor',
    'guides',
    'universe',
    'divine',
    'sacred',
    'mystic'
  ],
  transition: [
    'transition',
    'change',
    'changing',
    'shift',
    'shifting',
    'crossroads',
    'next chapter',
    'new chapter',
    'ending',
    'beginning',
    'moving',
    'move',
    'relocation',
    'graduation',
    'threshold'
  ],
  shadow: [
    'shadow',
    'shadow work',
    'trigger',
    'shame',
    'guilt',
    'repress',
    'repressed',
    'avoid',
    'avoidance',
    'fear',
    'fears',
    'pattern',
    'patterns',
    'addiction',
    'compulsion',
    'habit',
    'habits',
    'inner child',
    'subconscious',
    'trauma'
  ],
  creative: [
    'creative',
    'creativity',
    'artist',
    'artistic',
    'writing',
    'writer',
    'design',
    'music'
  ],
  manifestation: [
    'manifestation',
    'manifest',
    'manifesting',
    'law of attraction'
  ],
  personal: [
    'personal',
    'personal growth',
    'identity',
    'self-worth',
    'self worth',
    'milestone',
    'confidence'
  ],
  leadership: [
    'leadership',
    'leader',
    'leading'
  ],
  parenting: [
    'parenting',
    'parent',
    'mother',
    'father',
    'child',
    'children',
    'kids'
  ],
  legal: [
    'legal',
    'lawsuit',
    'court',
    'trial',
    'judge',
    'attorney',
    'lawyer',
    'settlement'
  ],
  calling: [
    'calling',
    'vocation',
    'vocational'
  ],
  boundaries: [
    'boundary',
    'boundaries'
  ],
  clarity: [
    'clarity'
  ],
  acceptance: [
    'acceptance',
    'letting go',
    'let go',
    'surrender'
  ],
  values: [
    'values',
    'integrity',
    'principles'
  ],
  'life-cycle': [
    'life cycle',
    'life-cycle'
  ]
};

const GRAPH_RAG_CONTEXT_PRIORITY = [
  'grief',
  'health',
  'relationship',
  'career',
  'transition',
  'shadow',
  'spiritual',
  'creative',
  'manifestation',
  'personal',
  'leadership',
  'parenting',
  'legal',
  'calling',
  'boundaries',
  'clarity',
  'acceptance',
  'values',
  'life-cycle'
];

const MAX_CONTEXT_TEXT_LENGTH = 900;
const MAX_CONTEXT_SEGMENT_LENGTH = 320;

function sanitizeQuestion(question) {
  return typeof question === 'string' ? question.trim().toLowerCase() : '';
}

function sanitizeContextSegment(value, maxLength = MAX_CONTEXT_SEGMENT_LENGTH) {
  if (typeof value !== 'string') return '';
  return sanitizeText(value, {
    maxLength,
    addEllipsis: true,
    stripMarkdown: true,
    stripControlChars: true,
    collapseWhitespace: true,
    filterInstructions: true
  });
}

function normalizeFocusAreas(focusAreas) {
  if (!Array.isArray(focusAreas)) return [];

  return focusAreas
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      if (entry && typeof entry === 'object') {
        if (typeof entry.label === 'string') return entry.label;
        if (typeof entry.name === 'string') return entry.name;
      }
      return '';
    })
    .map((value) => sanitizeContextSegment(value, 60))
    .filter(Boolean)
    .slice(0, 6);
}

export function buildContextInferenceInput({
  userQuestion,
  reflectionsText,
  focusAreas,
  maxLength = MAX_CONTEXT_TEXT_LENGTH
} = {}) {
  const segments = [];
  const safeQuestion = sanitizeContextSegment(userQuestion);
  const safeReflections = sanitizeContextSegment(reflectionsText);
  const normalizedFocusAreas = normalizeFocusAreas(focusAreas);

  if (safeQuestion) {
    segments.push(`question: ${safeQuestion}`);
  }
  if (safeReflections) {
    segments.push(`reflections: ${safeReflections}`);
  }
  if (normalizedFocusAreas.length > 0) {
    segments.push(`focus areas: ${normalizedFocusAreas.join(', ')}`);
  }

  if (segments.length === 0) {
    return '';
  }

  const safeMaxLength = Number.isFinite(maxLength) && maxLength > 0
    ? Math.min(Math.floor(maxLength), 2000)
    : MAX_CONTEXT_TEXT_LENGTH;

  return sanitizeText(segments.join(' | '), {
    maxLength: safeMaxLength,
    addEllipsis: true,
    stripMarkdown: true,
    stripControlChars: true,
    collapseWhitespace: true,
    filterInstructions: true
  });
}

function countMatches(text, keywords) {
  if (!text) return 0;
  let score = 0;
  for (const keyword of keywords) {
    if (keyword.includes(' ')) {
      if (text.includes(keyword)) {
        score += 3;
      }
    } else if (text.includes(keyword)) {
      score += 2;
    }
  }
  return score;
}

export function inferContext(userQuestion, spreadKey, options = {}) {
  const { onUnknown } = options;
  const normalizedSpreadKey = typeof spreadKey === 'string' ? spreadKey.toLowerCase() : '';
  const defaultContext = SPREAD_CONTEXT_DEFAULTS[normalizedSpreadKey] || null;

  const text = sanitizeQuestion(userQuestion);
  const scores = {
    love: 0,
    career: 0,
    self: 0,
    spiritual: 0,
    wellbeing: 0,
    decision: 0
  };

  for (const [context, keywords] of Object.entries(CONTEXT_KEYWORDS)) {
    scores[context] = countMatches(text, keywords);
  }

  // Weight spread default slightly to break ties when relevant
  if (defaultContext) {
    scores[defaultContext] += 1;
  }

  let bestContext = 'general';
  let bestScore = 0;

  for (const [context, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestContext = context;
    } else if (score === bestScore && score > 0) {
      // Tie-breaker priority: decision > wellbeing > love > career > self > spiritual
      // decision/wellbeing first since they're more specific intents
      const priority = ['decision', 'wellbeing', 'love', 'career', 'self', 'spiritual'];
      if (priority.indexOf(context) < priority.indexOf(bestContext)) {
        bestContext = context;
      }
    }
  }

  if (bestScore === 0 && defaultContext) {
    return normalizeContext(defaultContext, { onUnknown });
  }

  const detected = bestScore > 0 ? bestContext : 'general';
  return normalizeContext(detected, { onUnknown });
}

export function inferGraphRAGContext(userQuestion, spreadKey) {
  const normalizedSpreadKey = typeof spreadKey === 'string' ? spreadKey.toLowerCase() : '';
  const defaultContext = GRAPH_RAG_SPREAD_DEFAULTS[normalizedSpreadKey] || null;
  const text = sanitizeQuestion(userQuestion);

  const scores = {};
  for (const [context, keywords] of Object.entries(GRAPH_RAG_CONTEXT_KEYWORDS)) {
    scores[context] = countMatches(text, keywords);
  }

  if (defaultContext && scores[defaultContext] !== undefined) {
    scores[defaultContext] += 1;
  }

  let bestContext = 'general';
  let bestScore = 0;

  for (const [context, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestContext = context;
    } else if (score === bestScore && score > 0) {
      const currentPriority = GRAPH_RAG_CONTEXT_PRIORITY.indexOf(context);
      const bestPriority = GRAPH_RAG_CONTEXT_PRIORITY.indexOf(bestContext);
      if (currentPriority !== -1 && (bestPriority === -1 || currentPriority < bestPriority)) {
        bestContext = context;
      }
    }
  }

  if (bestScore === 0 && defaultContext) {
    return defaultContext;
  }

  return bestScore > 0 ? bestContext : 'general';
}
