export const CONTEXT_KEYWORDS = {
  love: [
    'relationship',
    'relationships',
    'romance',
    'romantic',
    'love',
    'partner',
    'partnership',
    'marriage',
    'wedding',
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
    'workplace',
    'workplace boundaries',
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

export const GRAPH_RAG_CONTEXT_KEYWORDS = {
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
    'wedding',
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
    'workplace',
    'workplace boundaries',
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
  // Everyday words (fear, pattern, habit, avoid, trigger) appear in ordinary
  // questions; alone they must not route retrieval to trauma or addiction texts.
  shadow: [
    'shadow',
    'shadow work',
    'shame',
    'guilt',
    'repress',
    'repressed',
    'avoidance',
    'addiction',
    'compulsion',
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

export const GRAPH_RAG_CONTEXT_PRIORITY = [
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

const CONTEXT_WORDS = new Set(
  [...Object.values(CONTEXT_KEYWORDS).flat(), ...Object.values(GRAPH_RAG_CONTEXT_KEYWORDS).flat()]
    .flatMap(keyword => keyword.match(/[\p{L}\p{N}]+/gu) || [])
);

export function normalizeContextWords(text) {
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

export function countMatches(text, keywords) {
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

export function matchedContextPhrases(text, keywords = []) {
  const words = ` ${normalizeContextWords(text)} `;
  return [...new Set(keywords.map(normalizeContextWords))].filter((phrase) => phrase && words.includes(` ${phrase} `));
}

/** Explicit rejection of a topic, rather than a negative action within it. */
export function excludedContextRanges(text = '') {
  const ranges = [];
  const pattern = /\b(?:not\s+(?:asking\s+about|about|seeking\s+(?:guidance|advice)\s+(?:on|about))|(?:do\s+not|don['’‘ʼ＇]t)\s+want\s+(?:guidance|advice|a\s+reading)\s+(?:on|about))\b[^.!?。！？;；\n]*/giu;
  for (const match of text.matchAll(pattern)) {
    const boundary = match[0].search(/,?\s+\b(?:but|instead|rather)\b|,\s+I\s+(?:need|want)\b/iu);
    const excludedText = match[0].slice(0, boundary < 0 ? match[0].length : boundary);
    const action = /(?:about|on)\s+(?:quitting|leaving|changing|switching|resigning|getting|taking|accepting|rejecting|ending|breaking|finding|moving)\b/iu.test(excludedText);
    ranges.push({ start: match.index, end: match.index + excludedText.length, scope: action ? 'action' : 'topic' });
  }
  return ranges;
}

/** Original UTF-16 offsets survive normalization and plural matching. */
export function contextPhraseMatches(text = '', keywords = [], { includeExcluded = false } = {}) {
  const tokens = [...text.matchAll(/[\p{L}\p{N}]+/gu)].map(match => ({ word: normalizeContextWords(match[0]), start: match.index, end: match.index + match[0].length }));
  const exclusions = excludedContextRanges(text);
  const result = [];
  for (const phrase of new Set(keywords.map(normalizeContextWords))) {
    const words = phrase.split(' ');
    if (!phrase) continue;
    tokens.forEach((token, index) => {
      if (!words.every((word, offset) => tokens[index + offset]?.word === word)) return;
      const end = tokens[index + words.length - 1].end;
      const exclusion = exclusions.find(range => token.start >= range.start && token.start < range.end);
      const excluded = Boolean(exclusion);
      if (includeExcluded || !excluded) result.push({ phrase, start: token.start, end, excluded, ...(exclusion ? { exclusionScope: exclusion.scope } : {}) });
    });
  }
  return result.sort((a, b) => a.start - b.start || a.end - b.end);
}

export function positiveContextPhrases(text, keywords) {
  return [...new Set(contextPhraseMatches(text, keywords).map(match => match.phrase))];
}
