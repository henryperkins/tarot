import { normalizeContext } from './narrative/helpers.js';

const SPREAD_CONTEXT_DEFAULTS = {
  relationship: 'love'
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
    'healing',
    'heal',
    'wellbeing',
    'well-being',
    'wellness',
    'growth',
    'confidence',
    'mindset',
    'mental health',
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
    spiritual: 0
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
      // Tie-breaker priority: love > career > self > spiritual
      const priority = ['love', 'career', 'self', 'spiritual'];
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
