import { normalizeContext } from './narrative/helpers.js';
import { sanitizeText } from './utils.js';
import {
  USER_QUESTION_MAX_LENGTH,
  REFLECTIONS_TEXT_MAX_LENGTH
} from '../../shared/contracts/readingSchema.js';

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

// The accepted question (2,000) and reflections (5,000), existing six bounded
// focus labels, and section labels all fit within the embedding input boundary.
// Smaller explicit caller budgets remain supported without shortening defaults.
const MAX_CONTEXT_TEXT_LENGTH = 8000;
const GENERIC_QUESTION_CUES = new Set([...CONTEXT_KEYWORDS.decision, 'energy', 'energetic']);
const QUESTION_TOPIC_KEYWORDS = [...new Set([
  ...Object.values(CONTEXT_KEYWORDS).flat(),
  ...Object.values(GRAPH_RAG_CONTEXT_KEYWORDS).flat()
])].filter(keyword => !GENERIC_QUESTION_CUES.has(keyword));

function sanitizeQuestion(question) {
  return typeof question === 'string' ? question.trim().toLowerCase() : '';
}

function sanitizeContextSegment(value, maxLength) {
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
  const safeQuestion = sanitizeContextSegment(userQuestion, USER_QUESTION_MAX_LENGTH);
  const safeReflections = sanitizeContextSegment(reflectionsText, REFLECTIONS_TEXT_MAX_LENGTH);
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
    ? Math.min(Math.floor(maxLength), MAX_CONTEXT_TEXT_LENGTH)
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

const CONTEXT_WORDS = new Set(
  [...Object.values(CONTEXT_KEYWORDS).flat(), ...Object.values(GRAPH_RAG_CONTEXT_KEYWORDS).flat()]
    .flatMap(keyword => keyword.match(/[\p{L}\p{N}]+/gu) || [])
);

function normalizeContextWords(text) {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).map(word => {
    // Normalize common plurals only when their singular is in our vocabulary.
    // This preserves jobs/companies/bosses without matching rest in interests.
    if (word.endsWith('ies') && CONTEXT_WORDS.has(`${word.slice(0, -3)}y`)) {
      return `${word.slice(0, -3)}y`;
    }
    const esStem = word.slice(0, -2);
    if (word.endsWith('es') && /(?:s|x|z|ch|sh)$/.test(esStem) && CONTEXT_WORDS.has(esStem)) {
      return esStem;
    }
    if (word.endsWith('s') && !word.endsWith('ss') && CONTEXT_WORDS.has(word.slice(0, -1))) {
      return word.slice(0, -1);
    }
    return word;
  }).join(' ');
}

function countMatches(text, keywords) {
  if (!text) return 0;
  // Match complete Unicode words; punctuation and hyphens separate phrases.
  // A substring such as "rest" inside "interests" is not context evidence.
  const words = ` ${normalizeContextWords(text)} `;
  let score = 0;
  const phrases = new Set(keywords.map(normalizeContextWords));
  for (const phrase of phrases) {
    if (phrase && words.includes(` ${phrase} `)) {
      score += phrase.includes(' ') ? 3 : 2;
    }
  }
  return score;
}

function scoreContextSource(text, vocabulary) {
  return Object.fromEntries(Object.entries(vocabulary).map(([key, keywords]) => [key, countMatches(text, keywords)]));
}

function leadingContexts(scores) {
  const highest = Math.max(0, ...Object.values(scores));
  return highest > 0 ? Object.keys(scores).filter(key => scores[key] === highest) : [];
}

/**
 * Select topic evidence before applying spread defaults. Sources remain separate
 * so a long reflection or saved preference cannot outvote a clear question.
 * The original fields are still supplied independently to the narrative prompt.
 */
export function resolveContextSelection({ userQuestion, reflectionsText, focusAreas, contextInputText } = {}, spreadKey, options = {}) {
  // Legacy callers may only have a combined context string. Treat it as lower
  // priority background, never as the question when structured fields exist.
  const hasStructuredBackground = typeof reflectionsText === 'string' || Array.isArray(focusAreas);
  const background = !hasStructuredBackground && contextInputText !== userQuestion
    ? contextInputText
    : reflectionsText;
  const sources = [
    { source: 'question', text: sanitizeContextSegment(userQuestion, USER_QUESTION_MAX_LENGTH) },
    { source: 'reflections', text: sanitizeContextSegment(background, REFLECTIONS_TEXT_MAX_LENGTH) },
    { source: 'focusAreas', text: normalizeFocusAreas(focusAreas).join(', ') }
  ].map(source => ({
    ...source,
    reading: scoreContextSource(source.text, CONTEXT_KEYWORDS),
    graph: scoreContextSource(source.text, GRAPH_RAG_CONTEXT_KEYWORDS)
  }));
  const hasEvidence = source => [...Object.values(source.reading), ...Object.values(source.graph)].some(score => score > 0);
  const questionHasTopic = countMatches(sources[0].text, QUESTION_TOPIC_KEYWORDS) > 0;
  const selected = sources.find(source => hasEvidence(source) && (source.source !== 'question' || questionHasTopic))
    || (hasEvidence(sources[0]) ? sources[0] : null);
  const normalizedSpread = typeof spreadKey === 'string' ? spreadKey.toLowerCase() : '';
  if (!selected) {
    return {
      context: inferContext('', spreadKey, options),
      graphRAGContext: inferGraphRAGContext('', spreadKey),
      source: SPREAD_CONTEXT_DEFAULTS[normalizedSpread] || GRAPH_RAG_SPREAD_DEFAULTS[normalizedSpread] ? 'spread' : 'none',
      clarifiedBy: null,
      retrievalQuery: buildContextInferenceInput({ userQuestion: sources[0].text, reflectionsText: sources[1].text })
    };
  }

  let clarifiedBy = null;
  const pick = (taxonomy, priority, spreadDefault) => {
    let candidates = leadingContexts(selected[taxonomy]);
    if (selected.source === 'question' && candidates.length > 1) {
      const reflectionScores = Object.fromEntries(candidates.map(key => [key, sources[1][taxonomy][key]]));
      const clarified = leadingContexts(reflectionScores);
      if (clarified.length && clarified.length < candidates.length) {
        candidates = clarified;
        clarifiedBy = 'reflections';
      }
    }
    if (candidates.includes(spreadDefault)) return spreadDefault;
    return priority.find(key => candidates.includes(key)) || candidates[0] || 'general';
  };
  const context = normalizeContext(pick('reading', ['decision', 'wellbeing', 'love', 'career', 'self', 'spiritual'], SPREAD_CONTEXT_DEFAULTS[normalizedSpread]), options);
  const graphRAGContext = pick('graph', GRAPH_RAG_CONTEXT_PRIORITY, GRAPH_RAG_SPREAD_DEFAULTS[normalizedSpread]);
  const reflectionHasEvidence = [...Object.values(sources[1].reading), ...Object.values(sources[1].graph)].some(score => score > 0);
  const reflectionIsRelevant = !reflectionHasEvidence || sources[1].reading[context] > 0 || sources[1].graph[graphRAGContext] > 0;
  const retrievalQuery = buildContextInferenceInput({
    userQuestion: sources[0].text,
    // Question-led retrieval keeps a bounded amount of relevant detail so a long
    // reflection cannot dominate semantic ranking. Full reflections stay in the prompt.
    reflectionsText: selected.source === 'question'
      ? (reflectionIsRelevant ? sanitizeContextSegment(sources[1].text, 750) : '')
      : sources[1].text,
    focusAreas: selected.source === 'focusAreas' ? focusAreas : []
  });
  return { context, graphRAGContext, source: selected.source, clarifiedBy, retrievalQuery };
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
