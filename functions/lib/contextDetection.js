import { normalizeContext } from './narrative/helpers.js';

const SPREAD_CONTEXT_DEFAULTS = {
  relationship: 'love',
  decision: 'decision'
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

function sanitizeQuestion(question) {
  return typeof question === 'string' ? question.trim().toLowerCase() : '';
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
