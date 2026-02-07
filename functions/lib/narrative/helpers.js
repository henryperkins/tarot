/**
 * Shared narrative helpers for tarot spread builders.
 */
import { getImageryHook, isMajorArcana, getElementalImagery, getMinorImageryHook } from '../imageryHooks.js';
import { buildMinorSummary } from '../minorMeta.js';
import { getPositionWeight } from '../positionWeights.js';
import { getToneStyle, buildNameClause, buildPersonalizationBridge } from './styleHelpers.js';
import {
  getAstroForCard,
  getQabalahForCard,
  shouldSurfaceAstroLens,
  shouldSurfaceQabalahLens
} from '../esotericMeta.js';
import { filterInstructionPatterns, sanitizeText } from '../utils.js';
import { detectPromptInjection } from '../promptInjectionDetector.js';
import { MAX_REFLECTION_TEXT_LENGTH, MAX_QUESTION_TEXT_LENGTH } from './prompts/constants.js';
import { getDeckAlias } from '../../../shared/vision/deckAssets.js';
import { THOTH_MINOR_TITLES, MARSEILLE_NUMERICAL_THEMES } from '../../../src/data/knowledgeGraphData.js';
import { SYMBOL_ANNOTATIONS } from '../symbolAnnotations.js';
import { getMinorSymbolAnnotation } from '../../../shared/vision/minorSymbolLexicon.js';

// Prose mode flag - legacy test helper. Runtime callers should always pass
// proseMode explicitly to avoid state bleed across requests.
let PROSE_MODE = false;

export function setProseMode(enabled) {
  PROSE_MODE = !!enabled;
}

export function isProseMode(options = {}) {
  if (typeof options.proseMode === 'boolean') {
    return options.proseMode;
  }

  // Prevent global state from leaking across requests. Only honor the
  // legacy toggle inside tests where NODE_ENV === 'test'.
  const env = options.env || (typeof process !== 'undefined' ? process.env : {});
  if (env?.NODE_ENV === 'test') {
    return PROSE_MODE;
  }

  return false;
}

// Section header mappings for prose mode
const SECTION_HEADERS = {
  // Celtic Cross
  nucleus: { technical: '### The Heart of the Matter (Nucleus)', prose: '### At the Heart of This Moment' },
  timeline: { technical: '### The Timeline (Horizontal Axis)', prose: '### How You Arrived Here' },
  consciousness: { technical: '### Consciousness Flow (Vertical Axis)', prose: '### What Moves Beneath the Surface' },
  staff: { technical: '### The Staff (Context & Trajectory)', prose: '### The Path Forward' },
  crossChecks: { technical: '### Key Relationships', prose: '### How the Cards Speak to Each Other' },
  synthesis: { technical: '### Synthesis & Guidance', prose: '### Bringing It Together' },
  supporting: { technical: '### Supporting Positions', prose: '' }, // Hidden in prose mode

  // Three Card
  threeCardStory: { technical: '### The Story', prose: '### Your Story' },
  threeCardCards: { technical: '### The Cards', prose: '### The Cards' },
  threeCardGuidance: { technical: '### Guidance', prose: '### Moving Forward' },

  // Five Card
  coreChallenge: { technical: '### Core & Challenge', prose: '### What You Face' },
  hiddenInfluence: { technical: '### Hidden Influence', prose: '### What Lies Beneath' },
  supportDirection: { technical: '### Support & Direction', prose: '### Your Path Forward' },
  fiveCardGuidance: { technical: '### Guidance', prose: '### Bringing It Together' },

  // Decision
  theChoice: { technical: '### The Choice', prose: '### The Heart of Your Decision' },
  pathA: { technical: '### Path A', prose: '### If You Choose This Way' },
  pathB: { technical: '### Path B', prose: '### If You Choose That Way' },
  clarityAgency: { technical: '### Clarity & Agency', prose: '### What Helps You Decide' },

  // Relationship
  youAndThem: { technical: '### You & Them', prose: '### The Two of You' },
  theConnection: { technical: '### The Connection', prose: '### What Flows Between You' },
  relationshipGuidance: { technical: '### Guidance', prose: '### Moving Forward Together' },
  relationshipDynamics: { technical: '### Relationship Dynamics', prose: '### How You Move Together' },

  // Common
  reflections: { technical: '### Your Reflections', prose: '### Your Reflections' },
  patterns: { technical: '### Deeper Patterns', prose: '### Deeper Patterns' },
  opening: { technical: '', prose: '' } // Openings don't have headers
};

export function getSectionHeader(sectionKey, options = {}) {
  const headers = SECTION_HEADERS[sectionKey];
  if (!headers) return `### ${sectionKey}`;
  return isProseMode(options) ? headers.prose : headers.technical;
}

/**
 * Sanitize user-provided strings before inserting into prompts to avoid prompt
 * injection via custom positions/meanings. Removes markdown control chars and
 * collapses whitespace while preserving readable text.
 */
export function sanitizePromptValue(text, maxLength = 500) {
  if (!text || typeof text !== 'string') return '';
  let trimmed = text.slice(0, maxLength);
  trimmed = filterInstructionPatterns(trimmed);
  if (trimmed) {
    const detection = detectPromptInjection(trimmed, { confidenceThreshold: 0.6, sanitize: true });
    if (detection.isInjection) {
      trimmed = detection.sanitizedText;
    }
  }
  return trimmed
    .replace(/[`#*_>]/g, '')   // strip markdown/control symbols
    .replace(/\{\{|\}\}|\$\{|\}|<%|%>|\{#|#\}|\{%|%\}/g, '') // template syntax
    .replace(/\[%|%\]|\[\[|\]\]/g, '') // template variants
    .replace(/\r?\n+/g, ' ')   // flatten newlines
    .replace(/\s{2,}/g, ' ')   // collapse whitespace
    .trim();
}

const CONTEXT_DESCRIPTORS = {
  love: 'relationships and heart-centered experiences',
  career: 'career, calling, and material pathways',
  self: 'personal growth and inner landscape',
  spiritual: 'spiritual practice and meaning-making',
  wellbeing: 'health, balance, and holistic wellness',
  decision: 'choices, crossroads, and clarity-seeking',
  general: 'overall life path'
};

const SUIT_CONTEXT_LENSES = {
  love: {
    Wands: 'In relationships, this encourages shared passion and momentum you cultivate together.',
    Cups: 'In relationships, this highlights emotional reciprocity, listening, and care.',
    Swords: 'In relationships, this invites honest dialogue, clear boundaries, and thoughtful communication.',
    Pentacles: 'In relationships, this focuses on steady support, daily rituals, and building something lasting.'
  },
  career: {
    Wands: 'In your career, this points to initiative, leadership, and courageous momentum.',
    Cups: 'In your career, this speaks to collaborative rapport, emotional intelligence, and people care.',
    Swords: 'In your career, this stresses strategy, communication, and decisive clarity.',
    Pentacles: 'In your career, this underscores planning, resources, and tangible results.'
  },
  self: {
    Wands: 'For personal growth, this asks you to kindle motivation and follow what energizes you.',
    Cups: 'For personal growth, this centers emotional processing, self-compassion, and heart work.',
    Swords: 'For personal growth, this supports mental clarity, journaling, and reframing stories.',
    Pentacles: 'For personal growth, this recommends embodiment, somatic practice, and grounding routines.'
  },
  spiritual: {
    Wands: 'In your spiritual practice, this channels devotional fire and inspired action.',
    Cups: 'In your spiritual practice, this deepens receptive listening and intuitive flow.',
    Swords: 'In your spiritual practice, this sharpens discernment, study, and sacred speech.',
    Pentacles: 'In your spiritual practice, this roots insight into ritual, service, and stewardship.'
  },
  wellbeing: {
    Wands: 'For your wellbeing, this speaks to vital energy, movement, and activities that restore your spark.',
    Cups: 'For your wellbeing, this centers emotional nourishment, rest, and heart-care practices.',
    Swords: 'For your wellbeing, this supports mental hygiene, stress reduction, and clarity of mind.',
    Pentacles: 'For your wellbeing, this recommends body care, nutrition, sleep, and grounding routines.'
  },
  decision: {
    Wands: 'For this decision, consider which path ignites your passion and aligns with your authentic drive.',
    Cups: 'For this decision, tune into your emotional truth and what your heart genuinely desires.',
    Swords: 'For this decision, apply clear analysis, weigh the facts, and cut through confusion.',
    Pentacles: 'For this decision, consider practical outcomes, resources, and long-term stability.'
  }
};

const MAJOR_CONTEXT_LENSES = {
  love: 'In relationships, let this archetype illuminate the dynamics asking for attention.',
  career: 'In your career, treat this archetype as guidance for how you show up in your work and collaborations.',
  self: 'For personal growth, let this archetype mirror the inner work unfolding.',
  spiritual: 'In your spiritual path, let this archetype frame the lesson seeking integration.',
  wellbeing: 'For your wellbeing, let this archetype reveal what your body and mind are calling for.',
  decision: 'For this decision, let this archetype illuminate the deeper currents shaping your choice.'
};

const CARD_SPECIFIC_CONTEXT = {
  love: {
    'two of cups': 'In relationships, this affirms mutual devotion, attentive listening, and balanced give-and-take.',
    'three of pentacles': 'In relationships, this often looks like co-creating plans and valuing each person’s contribution.',
    'ten of pentacles': 'In relationships, this reflects building a lasting sense of home, legacy, and shared support.',
    'the hermit': 'In relationships, this can signal honoring sacred space so deeper connection can emerge.',
    'the tower': 'In relationships, this may surface ruptures that ultimately clear the way for honest connection.'
  },
  career: {
    'two of cups': 'In your career, this can indicate a supportive partnership, aligned collaborator, or trusted client bond.',
    'three of pentacles': 'In your career, this emphasizes teamwork, craftsmanship, and being recognized for your expertise.',
    'ten of pentacles': 'In your career, this points to long-term stability, succession planning, and sustainable prosperity.',
    'the hermit': 'In your career, this invites strategic retreat to refine mastery before reengaging.',
    'the tower': 'In your career, this flags sudden change that ultimately clears space for a truer trajectory.'
  },
  self: {
    'three of swords': 'For personal growth, this encourages tending to the wound with compassion, integration, and honest acknowledgement.',
    'nine of swords': 'For personal growth, this highlights working with anxious narratives through grounding practices and support.',
    'the hermit': 'For personal growth, this supports contemplative solitude and inner listening.',
    'wheel of fortune': 'For personal growth, this reminds you to trust cycles and notice what is shifting within.'
  },
  spiritual: {
    'the hermit': 'In your spiritual path, this deepens the call toward contemplative retreat, sacred study, and inner guidance.',
    'wheel of fortune': 'In your spiritual path, this points to trusting the greater pattern and aligning with the turning of time.',
    'temperance': 'In your spiritual path, this celebrates alchemy, ritual balance, and embodied integration.'
  },
  wellbeing: {
    'five of pentacles': 'For your wellbeing, this acknowledges a season of struggle while pointing toward support systems waiting to be accessed.',
    'four of swords': 'For your wellbeing, this validates the need for rest and recovery—healing requires intentional pause.',
    'six of swords': 'For your wellbeing, this signals a transition toward calmer waters and gradual healing.',
    'nine of swords': 'For your wellbeing, this highlights the weight of anxious thoughts and invites grounding practices and compassionate support.',
    'three of swords': 'For your wellbeing, this acknowledges grief or heartache that needs tending with patience and honest processing.',
    'the star': 'For your wellbeing, this brings hope and renewal—a sign that replenishment and spiritual nourishment are available.',
    'temperance': 'For your wellbeing, this emphasizes balance, moderation, and the integration of body, mind, and spirit.',
    'the hermit': 'For your wellbeing, this supports taking sacred retreat time for self-care and inner restoration.',
    'ace of cups': 'For your wellbeing, this opens a channel for emotional renewal, self-love, and fresh beginnings in how you nurture yourself.',
    'ten of pentacles': 'For your wellbeing, this points to stable support systems, family bonds, and the security that sustains long-term health.'
  },
  decision: {
    'two of swords': 'For this decision, this reveals a stalemate—removing the blindfold may show what you already know but hesitate to see.',
    'seven of cups': 'For this decision, this cautions against getting lost in too many options—ground your choice in what is real and actionable.',
    'justice': 'For this decision, this calls for fair evaluation, weighing evidence carefully, and accepting the consequences of your choice.',
    'the hanged man': 'For this decision, this suggests pausing to gain a new perspective before committing—rushing may miss the deeper insight.',
    'the chariot': 'For this decision, this encourages decisive action and confident commitment once your direction is clear.',
    'wheel of fortune': 'For this decision, this reminds you that timing and external factors play a role—read the currents before acting.',
    'six of wands': 'For this decision, this suggests confidence in your choice and readiness to move forward publicly.',
    'four of cups': 'For this decision, this warns that apathy or disengagement may be blocking you from seeing a valuable opportunity.',
    'ace of swords': 'For this decision, this brings mental clarity and breakthrough insight—cut through confusion to the core truth.',
    'the lovers': 'For this decision, this emphasizes alignment with your deepest values—choose what resonates with who you truly are.'
  }
};

function deckAwareCardName(cardInfo, deckStyle = 'rws-1909') {
  const fallback = cardInfo?.card || cardInfo?.name || 'this card';
  if (!deckStyle || deckStyle === 'rws-1909') {
    return fallback;
  }

  const aliasInput = {
    number: cardInfo?.number,
    name: cardInfo?.card || cardInfo?.name,
    suit: cardInfo?.suit,
    rank: cardInfo?.rank,
    rankValue: cardInfo?.rankValue
  };
  const alias = getDeckAlias(aliasInput, deckStyle);
  if (!alias || alias === fallback) {
    return fallback || alias || 'this card';
  }

  if (fallback && alias) {
    return `${alias} (RWS: ${fallback})`;
  }

  return alias || fallback;
}

const MINOR_SUITS = ['Wands', 'Cups', 'Swords', 'Pentacles'];

const REVERSAL_LENS_CACHE = new WeakMap();

function hashString(input = '') {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickOne(value, seedKey = '') {
  if (!value) return '';
  if (Array.isArray(value)) {
    if (value.length === 0) return '';
  }
  if (Array.isArray(value) && value.length > 0) {
    if (value.length === 1) return value[0];
    const normalizedSeed = `${seedKey}|${value.map((entry) => String(entry)).join('||')}`;
    const index = hashString(normalizedSeed) % value.length;
    return value[index];
  }
  return value;
}

const VALID_CONTEXTS = ['love', 'career', 'self', 'spiritual', 'wellbeing', 'decision', 'general'];

function normalizeContext(context, { onUnknown, allowFallback = true, fallback = 'general', strict = false } = {}) {
  if (!context || typeof context !== 'string') return 'general';
  const key = context.trim().toLowerCase();
  if (VALID_CONTEXTS.includes(key)) {
    return key;
  }

  // Surface an explicit signal instead of silently downgrading.
  const fallbackNote = allowFallback ? 'falling back to "general".' : 'no fallback applied.';
  const message = `[narrative] Unknown context "${context}"; ${fallbackNote}`;
  if (typeof onUnknown === 'function') {
    onUnknown(message);
  } else if (typeof console !== 'undefined' && console.warn) {
    console.warn(message);
  }

  if (strict) {
    throw new Error(message);
  }

  if (!allowFallback) {
    return null;
  }

  if (fallback && VALID_CONTEXTS.includes(fallback)) {
    return fallback;
  }

  return 'general';
}

function getContextDescriptor(context) {
  return CONTEXT_DESCRIPTORS[normalizeContext(context)] || CONTEXT_DESCRIPTORS.general;
}

function resolveSuitForContext(cardInfo = {}) {
  if (cardInfo.suit && MINOR_SUITS.includes(cardInfo.suit)) {
    return cardInfo.suit;
  }
  const name = typeof cardInfo.card === 'string' ? cardInfo.card : '';
  return MINOR_SUITS.find(suit => name.includes(suit)) || null;
}

/**
 * Get key symbol annotations for a card.
 * Returns archetype and top 2-3 symbols for prompt enrichment.
 * @param {Object} cardInfo - Card data with number (Major) or suit/rank (Minor)
 * @returns {Object|null} - { archetype, symbols: [{object, meaning}], composition }
 */
function getKeySymbols(cardInfo) {
  if (!cardInfo) return null;

  let annotation = null;

  // Major Arcana: use card number (0-21)
  if (typeof cardInfo.number === 'number' && cardInfo.number >= 0 && cardInfo.number <= 21) {
    annotation = SYMBOL_ANNOTATIONS[cardInfo.number];
  }
  // Minor Arcana: use suit and rank
  else if (cardInfo.suit && cardInfo.rank) {
    annotation = getMinorSymbolAnnotation(cardInfo);
  }

  if (!annotation) return null;

  // Extract top 2-3 symbols (prioritize first ones which are usually most iconic)
  const symbols = Array.isArray(annotation.symbols)
    ? annotation.symbols.slice(0, 3).map(s => ({ object: s.object, meaning: s.meaning }))
    : [];

  return {
    archetype: annotation.archetype || null,
    symbols,
    composition: annotation.composition || null
  };
}

function buildContextualClause(cardInfo = {}, context) {
  const normalized = normalizeContext(context);
  if (normalized === 'general') return '';

  const cardName = (cardInfo.card || '').toLowerCase();
  const specificMap = CARD_SPECIFIC_CONTEXT[normalized];
  if (specificMap && specificMap[cardName]) {
    return specificMap[cardName];
  }

  const isMajor =
    typeof cardInfo.number === 'number' &&
    cardInfo.number >= 0 &&
    cardInfo.number <= 21;

  if (isMajor) {
    return MAJOR_CONTEXT_LENSES[normalized] || '';
  }

  const suit = resolveSuitForContext(cardInfo);
  if (suit && SUIT_CONTEXT_LENSES[normalized]?.[suit]) {
    return SUIT_CONTEXT_LENSES[normalized][suit];
  }

  return MAJOR_CONTEXT_LENSES[normalized] || '';
}

function buildContextReminder(context) {
  const normalized = normalizeContext(context);
  if (normalized === 'general') return '';
  return `We’ll ground this reading in your ${getContextDescriptor(normalized)}, while keeping each card rooted in its Rider–Waite–Smith lineage.`;
}

const DEFAULT_WEIGHT_DETAIL_THRESHOLD = 0.75;
const SUPPORTING_WEIGHT_THRESHOLD = 0.65;

function shouldEmphasizePosition(spreadKey, positionIndex, threshold = DEFAULT_WEIGHT_DETAIL_THRESHOLD) {
  return getPositionWeight(spreadKey, positionIndex) >= threshold;
}

function buildWeightNote(spreadKey, positionIndex, label, options = {}) {
  if (isProseMode(options)) return ''; // Silent in prose mode
  const weight = getPositionWeight(spreadKey, positionIndex);
  if (weight < DEFAULT_WEIGHT_DETAIL_THRESHOLD) return '';
  return `*${label} carries an attention weight of ${weight.toFixed(2)}, so it receives extended focus here.*`;
}

function buildWeightAttentionIntro(prioritized, spreadName, threshold = DEFAULT_WEIGHT_DETAIL_THRESHOLD, options = {}) {
  if (isProseMode(options)) return ''; // Silent in prose mode
  if (!Array.isArray(prioritized) || prioritized.length === 0) return '';
  const focal = prioritized.filter(card => card.weight >= threshold);
  if (!focal.length) return '';
  const cardMentions = focal
    .slice(0, 3)
    .map(card => `${card.position || `Card ${card.originalIndex + 1}`} (${card.card}) at weight ${card.weight.toFixed(2)}`)
    .join(', ');
  return `*Attention weighting (${spreadName}): ${cardMentions}. Lower-weight cards filter into synthesis summaries so the narrative mirrors what matters most.*`;
}

function buildSupportingPositionsSummary(prioritized, spreadName, threshold = SUPPORTING_WEIGHT_THRESHOLD, options = {}) {
  if (isProseMode(options)) return ''; // Silent in prose mode
  if (!Array.isArray(prioritized)) return '';
  const supporting = prioritized.filter(card => card.card && card.weight < threshold);
  if (!supporting.length) return '';
  const bullets = supporting
    .map(card => `- ${card.position || `Card ${card.originalIndex + 1}`}: ${card.card} (weight ${card.weight.toFixed(2)}) is summarized as connective tissue rather than extended prose.`)
    .join('\n');
  return `### Supporting Positions\n\nThese ${spreadName} cards carry lighter weighting, so their insights weave into connectors and synthesis:\n${bullets}`;
}

/**
 * Position-specific language templates
 *
 * These templates ensure the same card reads differently based on its position,
 * following professional tarot methodology where position acts as a "question lens"
 *
 * Enhanced with:
 * - connectorToPrev: Phrase to connect to previous position (e.g., "Because...")
 * - connectorToNext: Phrase to connect to next position (e.g., "Therefore...")
 * - useImagery: Whether to pull imagery hooks for Major Arcana cards
 */
const POSITION_LANGUAGE = {
  // Celtic Cross positions
  'Present — core situation (Card 1)': {
    intro: [
      (card, orientation) => `At the heart of this moment stands ${card} ${orientation}.`,
      (card, orientation) => `Right now, your story is colored by ${card} ${orientation}.`,
      (card, orientation) => `The core tone of this moment comes through ${card} ${orientation}.`
    ],
    frame: [
      'This card sketches the atmosphere you’re moving through right now.',
      'It points to what feels most alive, charged, or pressing in your experience.',
      'Treat this as a snapshot of how things feel from the inside out.'
    ],
    connectorToPrev: ['Because of this foundation,', 'Because of what has led you here,'],
    useImagery: true
  },

  'Challenge — crossing / tension (Card 2)': {
    intro: [
      (card, orientation) => `Crossing this, the challenge manifests as ${card} ${orientation}.`,
      (card, orientation) => `In tension with that, ${card} ${orientation} shows where things snag.`,
      (card, orientation) => `${card} ${orientation} highlights the knot in the story—the part that feels tight or testing.`
    ],
    frame: [
      'This points to the friction, obstacle, or dynamic that asks for integration.',
      'Here we see where effort, honesty, or adjustment may be needed.',
      'Treat this not as doom, but as the leverage point where change is possible.'
    ],
    connectorToPrev: ['However,', 'However, at the same time,', 'However, in contrast,'],
    useImagery: true
  },

  'Past — what lies behind (Card 3)': {
    intro: [
      (card, orientation) => `Looking to what lies behind, the past shows ${card} ${orientation}.`,
      (card, orientation) => `In the background, ${card} ${orientation} colors how you arrived here.`,
      (card, orientation) => `The roots of this story reach back to ${card} ${orientation}.`
    ],
    frame: [
      'This surfaces the experiences and patterns that set the stage for now.',
      'It names what you’re carrying forward, consciously or not.',
      'Noticing this past context helps you choose what to keep and what to release.'
    ],
    connectorToNext: ['Because of this,', 'Because of this history,', 'Because of this groundwork,'],
    useImagery: true
  },

  'Near Future — what lies before (Card 4)': {
    intro: [
      (card, orientation) => `What lies ahead in the near future: ${card} ${orientation}.`,
      (card, orientation) => `As the next chapter, ${card} ${orientation} comes into view.`,
      (card, orientation) => `Soon, the story leans into ${card} ${orientation}.`
    ],
    frame: [
      'This hints at near-term developments on your current trajectory, not a final verdict.',
      'See this as the next visible step if nothing major shifts.',
      'It sketches the emerging tone of what you’re stepping into.'
    ],
    connectorToPrev: ['Therefore,', 'Therefore, looking ahead,', 'Therefore, as this unfolds,'],
    useImagery: true
  },

  'Conscious — goals & focus (Card 5)': {
    intro: [
      (card, orientation) => `Your conscious goal, what you aspire toward: ${card} ${orientation}.`,
      (card, orientation) => `${card} ${orientation} speaks to what you know you’re reaching for.`,
      (card, orientation) => `In your conscious mind, ${card} ${orientation} names your current aims.`
    ],
    frame: [
      'This reflects the intentions you can already name and the outcomes you’re trying to move toward.',
      'It shows where your focus naturally goes when you think about this situation.',
      'Let it clarify what “doing well” here genuinely means to you.'
    ],
    useImagery: true
  },

  'Subconscious — roots / hidden forces (Card 6)': {
    intro: [
      (card, orientation) => `Hidden beneath awareness, in the subconscious realm: ${card} ${orientation}.`,
      (card, orientation) => `Below the surface, ${card} ${orientation} stirs quietly.`,
      (card, orientation) => `In the deeper layers, ${card} ${orientation} speaks to what’s moving you from within.`
    ],
    frame: [
      'This points to needs, fears, or loyalties that operate behind your conscious choices.',
      'Understanding this layer helps you respond with more self-compassion.',
      'Treat this as gentle intel about your inner landscape, not a judgment.'
    ],
    connectorToNext: ['Yet beneath the surface,', 'Yet beneath the surface, it all gathers,'],
    useImagery: true
  },

  'Self / Advice — how to meet this (Card 7)': {
    intro: [
      (card, orientation) => `Guidance on how to meet this situation comes through ${card} ${orientation}.`,
      (card, orientation) => `${card} ${orientation} offers a way you might show up for yourself here.`,
      (card, orientation) => `As counsel, ${card} ${orientation} sketches a stance that could support you.`
    ],
    frame: [
      'This suggests practical attitudes or small actions that are available to you.',
      'It highlights resources, boundaries, or habits that can anchor you.',
      'Take it as an invitation, not a command: notice what feels workable.'
    ],
    connectorToPrev: ['Therefore, to navigate this landscape,', 'Because of all of this,'],
    useImagery: true
  },

  'External Influences — people & environment (Card 8)': {
    intro: [
      (card, orientation) => `External influences, people and forces beyond your control: ${card} ${orientation}.`,
      (card, orientation) => `Around you, ${card} ${orientation} reflects other people and conditions in play.`,
      (card, orientation) => `In the wider field, ${card} ${orientation} points to what’s happening around you rather than inside you.`
    ],
    frame: [
      'This shows dynamics you can respond to, but not fully control.',
      'It’s a reminder to distinguish between your work and what belongs to others.',
      'Let this help you choose where to engage and where to release.'
    ],
    connectorToPrev: ['Meanwhile, in the external world,', 'Meanwhile, around you,'],
    useImagery: true
  },

  'Hopes & Fears — deepest wishes & worries (Card 9)': {
    intro: [
      (card, orientation) => `Your hopes and fears intertwine in ${card} ${orientation}.`,
      (card, orientation) => `${card} ${orientation} sits where desire and worry overlap.`,
      (card, orientation) => `This position, held by ${card} ${orientation}, tracks what you long for and what you guard against.`
    ],
    frame: [
      'It often names ambivalence—wanting something and fearing its cost at the same time.',
      'Let this clarify what your heart is truly asking for beneath the anxiety.',
      'Being honest here can soften inner pressure and inform kinder choices.'
    ],
    connectorToPrev: ['Meanwhile, emotionally,', 'And so, on an emotional level,'],
    useImagery: true
  },

  'Outcome — likely path if unchanged (Card 10)': {
    intro: [
      (card, orientation) => `The likely outcome, if the current path continues: ${card} ${orientation}.`,
      (card, orientation) => `If nothing major shifts, ${card} ${orientation} sketches where this could be heading.`,
      (card, orientation) => `As things stand, ${card} ${orientation} maps a plausible direction of travel.`
    ],
    frame: [
      'This is a trajectory based on current patterns, not a fixed fate.',
      'Use it as feedback about where your present choices may lead.',
      'If you don’t love this picture, that awareness is an invitation to course-correct.'
    ],
    connectorToPrev: ['Therefore, all of this converges toward', 'Therefore, taken together, this leans toward'],
    useImagery: true
  },

  // Three-Card positions
  'Past — influences that led here': {
    intro: [
      (card, orientation) => `The past, showing what has led to this moment: ${card} ${orientation}.`,
      (card, orientation) => `Behind you, ${card} ${orientation} outlines the experiences that fed into this chapter.`,
      (card, orientation) => `Looking back, ${card} ${orientation} traces the threads that shaped the current landscape.`
    ],
    frame: [
      'This represents the foundation, causes, and influences that set the stage for where you stand now.',
      'Noticing this helps you decide what you’re done carrying and what still serves.'
    ],
    connectorToNext: ['Because of this foundation,', 'Because of this backdrop,'],
    useImagery: true
  },

  'Present — where you stand now': {
    intro: [
      (card, orientation) => `The present moment, where you stand right now: ${card} ${orientation}.`,
      (card, orientation) => `Right now, ${card} ${orientation} mirrors the live dynamics you’re moving through.`,
      (card, orientation) => `In this moment, ${card} ${orientation} captures the tone of your experience.`
    ],
    frame: [
      'This is the current energy and active dynamic you are navigating.',
      'Treat it as a snapshot, not a sentence—a view of what’s here so you can choose how to meet it.'
    ],
    connectorToPrev: ['And so,', 'And so, from here,'],
    connectorToNext: ['This sets the stage for', 'This sets the stage for the path leaning toward'],
    useImagery: true
  },

  'Future — trajectory if nothing shifts': {
    intro: [
      (card, orientation) => `The future, the trajectory ahead: ${card} ${orientation}.`,
      (card, orientation) => `If nothing major shifts, ${card} ${orientation} suggests where this might be heading.`,
      (card, orientation) => `Looking ahead, ${card} ${orientation} outlines a likely path of momentum.`
    ],
    frame: [
      'This shows where things are tending if you maintain your current course.',
      'Hold it as a forecast of trajectory, adjustable through your choices.'
    ],
    connectorToPrev: ['Therefore,', 'Therefore, on this trajectory,'],
    useImagery: true
  },

  // Five-Card positions
  'Core of the matter': {
    intro: [
      (card, orientation) => `At the core of the matter: ${card} ${orientation}.`,
      (card, orientation) => `${card} ${orientation} sits at the center of this situation.`,
      (card, orientation) => `Here, ${card} ${orientation} names the heart of what you’re really exploring.`
    ],
    frame: [
      'This is the central issue—the thread that, if tended to, shifts the whole pattern.',
      'Let it help you focus on what truly matters beneath surface details.'
    ],
    useImagery: true
  },

  'Challenge or tension': {
    intro: [
      (card, orientation) => `The challenge or tension: ${card} ${orientation}.`,
      (card, orientation) => `Here, ${card} ${orientation} shows where things snag or feel demanding.`,
      (card, orientation) => `${card} ${orientation} highlights the friction that wants attention.`
    ],
    frame: [
      'This marks the obstacle or knot to work with—not a verdict, but an invitation to adjust.',
      'Naming this tension can make it more workable.'
    ],
    connectorToPrev: ['However,', 'However, in contrast,'],
    useImagery: true
  },

  'Hidden / subconscious influence': {
    intro: [
      (card, orientation) => `Hidden from view, the subconscious influence: ${card} ${orientation}.`,
      (card, orientation) => `Beneath the surface, ${card} ${orientation} moves quietly.`,
      (card, orientation) => `In the unseen layers, ${card} ${orientation} signals stories or needs that aren’t fully voiced.`
    ],
    frame: [
      'This reveals influences beneath awareness—unspoken fears, hopes, or loyalties.',
      'Seeing this gives you more compassionate context for your reactions.'
    ],
    connectorToPrev: ['Yet beneath the surface,', 'Yet beneath the surface, quietly,'],
    useImagery: true
  },

  'Support / helpful energy': {
    intro: [
      (card, orientation) => `Support and helpful energy come through: ${card} ${orientation}.`,
      (card, orientation) => `Here, ${card} ${orientation} shows what has your back.`,
      (card, orientation) => `${card} ${orientation} highlights resources, allies, or inner strengths available now.`
    ],
    frame: [
      'This is what you can lean on as you navigate the situation.',
      'Let this remind you that you are not moving through this empty-handed.'
    ],
    connectorToPrev: ['Meanwhile,', 'Meanwhile, alongside the challenge,'],
    connectorToNext: ['Therefore, drawing on this support,', 'And so, if you lean into this support,'],
    useImagery: true
  },

  'Likely direction on current path': {
    intro: [
      (card, orientation) => `The likely direction, if you continue as you are: ${card} ${orientation}.`,
      (card, orientation) => `On this current path, ${card} ${orientation} sketches a probable trajectory.`,
      (card, orientation) => `If patterns hold, ${card} ${orientation} hints at where things may be heading.`
    ],
    frame: [
      'This is not fixed fate—only the path of current momentum.',
      'Use it as feedback about how your present choices echo forward.'
    ],
    connectorToPrev: ['Therefore,', 'Therefore, taken together,'],
    useImagery: true
  },

  // Single card
  'Theme / Guidance of the Moment': {
    intro: [
      (card, orientation) => `This card shows: ${card} ${orientation}.`,
      (card, orientation) => `${card} ${orientation} offers a simple snapshot for right now.`,
      (card, orientation) => `For this moment, ${card} ${orientation} steps forward.`
    ],
    frame: [
      'This distills the essence of what wants your awareness.',
      'Hold it as a gentle focal point rather than a rigid rule.'
    ],
    useImagery: true
  },

  // Relationship spread positions
  'You / your energy': {
    intro: [
      (card, orientation) => `Your energy in this dynamic: ${card} ${orientation}.`,
      (card, orientation) => `${card} ${orientation} reflects how you’re currently arriving in this connection.`,
      (card, orientation) => `Here, ${card} ${orientation} mirrors your stance, needs, or patterns.`
    ],
    frame: [
      'This invites honest, compassionate self-recognition.',
      'Use it to notice how you participate, without blaming yourself.'
    ],
    connectorToNext: ['And so,', 'And so, from your side,'],
    useImagery: true
  },

  'Them / their energy': {
    intro: [
      (card, orientation) => `Their energy in this dynamic: ${card} ${orientation}.`,
      (card, orientation) => `${card} ${orientation} reflects how they’re currently arriving in this connection.`,
      (card, orientation) => `Here, ${card} ${orientation} sketches their stance, needs, or patterns in the bond.`
    ],
    frame: [
      'This offers a snapshot of how they may be engaging, without claiming to read their mind.',
      'Treat it as information about the dynamic—not a verdict on their character.'
    ],
    connectorToPrev: ['Meanwhile,', 'Meanwhile, alongside your energy,'],
    connectorToNext: ['Therefore, together, these energies create', 'And so, in combination, these currents shape'],
    useImagery: true
  },

  'The connection / shared lesson': {
    intro: [
      (card, orientation) => `The connection itself, the shared lesson: ${card} ${orientation}.`,
      (card, orientation) => `${card} ${orientation} gives language to what this bond is asking of you both.`,
      (card, orientation) => `Here, ${card} ${orientation} frames the relationship as its own living entity.`
    ],
    frame: [
      'This card speaks to the shared lesson, patterns, and potentials alive between you.',
      'Let it name what this connection is teaching, without overstating what must happen next.'
    ],
    connectorToPrev: ['Therefore,', 'Therefore, taken together,'],
    useImagery: true
  },

  // Extended relationship positions (for custom/extended relationship spreads)
  'Dynamics / guidance': {
    intro: [
      (card, orientation) => `The dynamics and guidance for this connection: ${card} ${orientation}.`,
      (card, orientation) => `${card} ${orientation} illuminates the active patterns and suggests how to engage with them.`,
      (card, orientation) => `Here, ${card} ${orientation} offers guidance on how to navigate the current dynamic.`
    ],
    frame: [
      'This card points toward how the relationship is moving and what awareness might help.',
      'Let it suggest attitudes or small shifts that could support healthier engagement.'
    ],
    connectorToPrev: ['Therefore, in this dynamic,', 'And so, given all of this,'],
    useImagery: true
  },

  'Outcome / what this can become': {
    intro: [
      (card, orientation) => `What this connection can become: ${card} ${orientation}.`,
      (card, orientation) => `${card} ${orientation} sketches a possible evolution of this bond.`,
      (card, orientation) => `Looking ahead, ${card} ${orientation} hints at where this relationship may grow.`
    ],
    frame: [
      'This is not a fixed fate, but a trajectory shaped by how you both choose to show up.',
      'Hold it as an invitation to co-create consciously, not a verdict on what must be.'
    ],
    connectorToPrev: ['Therefore,', 'Therefore, if you both lean in,'],
    useImagery: true
  },

  // Decision spread positions
  'Heart of the decision': {
    intro: [
      (card, orientation) => `At the heart of this decision: ${card} ${orientation}.`,
      (card, orientation) => `${card} ${orientation} shows what this choice is truly circling around.`,
      (card, orientation) => `Here, ${card} ${orientation} distills the core question beneath the logistics.`
    ],
    frame: [
      'This reveals what genuinely matters most as you consider your options.',
      'Let it help you name the values and needs that deserve to lead.'
    ],
    connectorToNext: ['Therefore, with this understanding,', 'And so, from this center,'],
    useImagery: true
  },

  'Path A — energy & likely outcome': {
    intro: [
      (card, orientation) => `Path A, its energy and likely outcome: ${card} ${orientation}.`,
      (card, orientation) => `If you lean into Path A, ${card} ${orientation} sketches how this route may feel.`,
      (card, orientation) => `As one possibility, Path A under ${card} ${orientation} outlines a distinct flavor of growth.`
    ],
    frame: [
      'This shows the character, challenges, and probable results of moving this way.',
      'Hold it as one trajectory among many, shaped by your choices.'
    ],
    connectorToPrev: ['Because this option emerges,', 'Because we are looking at one route,'],
    useImagery: true
  },

  'Path B — energy & likely outcome': {
    intro: [
      (card, orientation) => `Path B, its energy and likely outcome: ${card} ${orientation}.`,
      (card, orientation) => `If you lean into Path B, ${card} ${orientation} traces a different way this could unfold.`,
      (card, orientation) => `As another possibility, Path B under ${card} ${orientation} brings its own tone and lessons.`
    ],
    frame: [
      'This shows an alternate character and set of challenges to consider.',
      'Compare it with Path A by how your body and ethics respond, not from fear.'
    ],
    connectorToPrev: ['However, alternatively,', 'However, on the other hand,'],
    useImagery: true
  },

  'What clarifies the best path': {
    intro: [
      (card, orientation) => `What clarifies the best path forward: ${card} ${orientation}.`,
      (card, orientation) => `${card} ${orientation} adds perspective on how each option aligns with your real needs.`,
      (card, orientation) => `Here, ${card} ${orientation} softens confusion and highlights what rings true.`
    ],
    frame: [
      'This card offers perspective to help you discern which direction serves your integrity and wellbeing.',
      'Use it as a clarifying lens, not as a command.'
    ],
    connectorToPrev: ['This sets the stage for clarity,', 'This sets the stage for this clarifying view,'],
    useImagery: true
  },

  'What to remember about your free will': {
    intro: [
      (card, orientation) => `Remember about your free will and agency: ${card} ${orientation}.`,
      (card, orientation) => `${card} ${orientation} underscores that your choices remain central here.`,
      (card, orientation) => `This position, held by ${card} ${orientation}, is a reminder that no card overrides your consent or agency.`
    ],
    frame: [
      'This reminds you of your power to choose and re-choose as new information emerges.',
      'Let it anchor you in the understanding that you co-create outcomes.'
    ],
    connectorToPrev: ['Meanwhile,', 'And so, above all,'],
    useImagery: true
  }
};

/**
 * Maps positions from spreads.js (without Card #) to POSITION_LANGUAGE keys (with Card #)
 * Only needed for Celtic Cross where the source-of-truth positions differ from template keys.
 */
const CELTIC_CROSS_POSITION_MAP = {
  'Present — core situation': 'Present — core situation (Card 1)',
  'Challenge — crossing / tension': 'Challenge — crossing / tension (Card 2)',
  'Past — what lies behind': 'Past — what lies behind (Card 3)',
  'Near Future — what lies before': 'Near Future — what lies before (Card 4)',
  'Conscious — goals & focus': 'Conscious — goals & focus (Card 5)',
  'Subconscious — roots / hidden forces': 'Subconscious — roots / hidden forces (Card 6)',
  'Self / Advice — how to meet this': 'Self / Advice — how to meet this (Card 7)',
  'External Influences — people & environment': 'External Influences — people & environment (Card 8)',
  'Hopes & Fears — deepest wishes & worries': 'Hopes & Fears — deepest wishes & worries (Card 9)',
  'Outcome — likely path if unchanged': 'Outcome — likely path if unchanged (Card 10)'
};

/**
 * Normalize a position string to its canonical POSITION_LANGUAGE key.
 * Handles Celtic Cross positions that arrive without "(Card N)" suffix.
 *
 * @param {string} position - Position string from cardsInfo
 * @returns {string} Canonical position key for POSITION_LANGUAGE lookup
 */
export function normalizePositionKey(position) {
  if (!position || typeof position !== 'string') {
    return position;
  }
  return CELTIC_CROSS_POSITION_MAP[position] || position;
}

/**
 * Build a position-aware card description with optional imagery hooks
 */
function buildPositionCardText(cardInfo, position, options = {}) {
  const normalizedPosition = normalizePositionKey(position);
  const template = POSITION_LANGUAGE[normalizedPosition];
  const prevElementalRelationship = options.prevElementalRelationship; // For elemental imagery
  const normalizedContext = normalizeContext(options.context);

  if (!template) {
    // Fallback for unknown positions (defensive defaults)
    const safeCard = sanitizePromptValue(deckAwareCardName(cardInfo, options.deckStyle), 160);
    const safePosition = sanitizePromptValue(position, 200);
    const safeOrientation =
      typeof cardInfo.orientation === 'string' && cardInfo.orientation.trim()
        ? ` ${sanitizePromptValue(cardInfo.orientation, 80)}`
        : '';
    const meaning = sanitizePromptValue(formatMeaningForPosition(cardInfo.meaning || '', position), 700);
    return `${safePosition}: ${safeCard}${safeOrientation}. ${meaning}`;
  }

  const safeCard = sanitizePromptValue(deckAwareCardName(cardInfo, options.deckStyle), 160);
  const safeOrientation =
    typeof cardInfo.orientation === 'string' && cardInfo.orientation.trim()
      ? sanitizePromptValue(cardInfo.orientation, 80)
      : '';
  const introTemplate = pickOne(
    template.intro,
    `intro|${normalizedPosition}|${safeCard}|${safeOrientation}|${normalizedContext}`
  );
  const intro =
    typeof introTemplate === 'function'
      ? introTemplate(safeCard, safeOrientation)
      : introTemplate || `${sanitizePromptValue(position, 200)}: ${safeCard} ${safeOrientation}.`;
  const meaning = sanitizePromptValue(formatMeaningForPosition(cardInfo.meaning || '', position), 700);

  const contextClause = buildContextualClause(cardInfo, options.context);

  const allowEsoteric =
    normalizedContext === 'spiritual' ||
    normalizedContext === 'self' ||
    normalizedContext === 'general';

  let esotericClause = '';

  if (allowEsoteric && shouldSurfaceAstroLens(cardInfo)) {
    const astro = getAstroForCard(cardInfo);
    if (astro?.label && astro?.focus) {
      esotericClause = `On a symbolic level, some readers link this card to ${astro.label}, ${astro.focus}; treat that as color, not a command.`;
    }
  }

  if (allowEsoteric && !esotericClause && shouldSurfaceQabalahLens(cardInfo)) {
    const qabalah = getQabalahForCard(cardInfo);
    if (qabalah?.label && qabalah?.focus) {
      esotericClause = `On a symbolic level, some readers relate this card to ${qabalah.label}, ${qabalah.focus}; treat that as color, not a command.`;
    }
  }

  const occultFlavor = allowEsoteric ? buildOccultFlavor(cardInfo) : '';
  const enrichedMeaning = [meaning, contextClause, esotericClause, occultFlavor].filter(Boolean).join(' ');

  // Add imagery hook for Major Arcana if enabled
  let imagery = '';
  if (template.useImagery && isMajorArcana(cardInfo)) {
    const hook = getImageryHook(cardInfo.number, cardInfo.orientation);
    if (hook && hook.interpretation) {
      imagery = ` ${hook.interpretation}`;
    }
  }

  // Minor Arcana: suit/rank-aware enrichment plus optional light imagery hook.
  let minorContextText = '';
  if (!isMajorArcana(cardInfo)) {
    const minorSummary = buildMinorSummary({
      card: cardInfo.card,
      name: cardInfo.card,
      suit: cardInfo.suit,
      rank: cardInfo.rank,
      rankValue: cardInfo.rankValue
    });
    if (minorSummary) {
      minorContextText = ` ${minorSummary}`;
    }

    const minorHook = getMinorImageryHook({
      card: cardInfo.card,
      suit: cardInfo.suit,
      rank: cardInfo.rank,
      orientation: cardInfo.orientation
    });
    if (minorHook && minorHook.visual) {
      minorContextText += ` Picture ${minorHook.visual}—this subtly colors how this suit's lesson shows up here.`;
    }

    // Add Thoth epithet for Minor Arcana when using Thoth deck
    if (options.deckStyle === 'thoth-a1' && cardInfo.rank && cardInfo.suit) {
      const thothKey = `${cardInfo.rank} of ${cardInfo.suit}`;
      const thothInfo = THOTH_MINOR_TITLES[thothKey];
      if (thothInfo && thothInfo.title) {
        const astroNote = thothInfo.astrology ? ` (${thothInfo.astrology})` : '';
        minorContextText += ` *Thoth: ${thothInfo.title}${astroNote}*`;
      }
    }

    // Add Marseille pip geometry for numbered cards when using Marseille deck
    if (options.deckStyle === 'marseille-classic' && cardInfo.rankValue && cardInfo.rankValue <= 10) {
      const marseilleInfo = MARSEILLE_NUMERICAL_THEMES[cardInfo.rankValue];
      if (marseilleInfo && marseilleInfo.keyword) {
        minorContextText += ` *Marseille Pip ${cardInfo.rankValue}: ${marseilleInfo.keyword}—${marseilleInfo.geometry}*`;
      }
    }
  }

  // Add symbol annotations when enabled (provides archetype and key visual symbols)
  let symbolText = '';
  if (options.includeSymbols) {
    const keySymbols = getKeySymbols(cardInfo);
    if (keySymbols) {
      const parts = [];
      if (keySymbols.archetype) {
        parts.push(`Archetype: ${keySymbols.archetype}`);
      }
      if (keySymbols.symbols && keySymbols.symbols.length > 0) {
        const symbolList = keySymbols.symbols
          .map(s => `${s.object} (${s.meaning})`)
          .join(', ');
        parts.push(`Key symbols: ${symbolList}`);
      }
      if (parts.length > 0) {
        symbolText = ` *${parts.join('. ')}.*`;
      }
    }
  }

  // Add elemental sensory imagery if elemental relationship exists
  let elementalImagery = '';
  if (prevElementalRelationship && prevElementalRelationship.elements) {
    const [e1, e2] = prevElementalRelationship.elements;
    const sensoryCue = getElementalImagery(e1, e2);
    if (sensoryCue && sensoryCue.imagery) {
      elementalImagery = ` ${sensoryCue.imagery}`;
    }
  }

  const frameText = pickOne(
    template.frame,
    `frame|${normalizedPosition}|${safeCard}|${safeOrientation}|${normalizedContext}`
  ) || '';
  const safeElemental = elementalImagery || '';
  const positionLabel = position ? `${position}: ` : '';
  return `${positionLabel}${intro} ${enrichedMeaning}${imagery}${minorContextText}${symbolText} ${frameText}${safeElemental}`;
}

function buildReversalGuidance(reversalDescription) {
  return `Within the ${reversalDescription.name} lens, ${reversalDescription.guidance}`;
}

export function formatReversalLens(themes, options = {}) {
  const {
    includeExamples = true,
    includeReminder = true,
    cache = true,
    refresh = false
  } = options;

  if (!themes) return { lines: [], text: '' };

  const description = themes.reversalDescription || themes;
  if (!description) return { lines: [], text: '' };
  const hasNoReversals = themes?.reversalCount === 0;
  const cacheKey = [
    includeExamples ? 'examples' : 'no-examples',
    includeReminder ? 'reminder' : 'no-reminder',
    hasNoReversals ? 'all-upright' : 'mixed-or-reversed'
  ].join('|');
  const cacheBucket = description && typeof description === 'object'
    ? (REVERSAL_LENS_CACHE.get(description) || null)
    : null;

  if (cache !== false && !refresh && cacheBucket && cacheBucket.has(cacheKey)) {
    const cached = cacheBucket.get(cacheKey);
    return {
      lines: cached.split('\n'),
      text: cached
    };
  }

  const lines = [];
  const name = description.name || 'Reversal lens';
  lines.push(`- Reversal lens: “${name}”.${description.description ? ` ${description.description}` : ''}`);

  if (description.guidance) {
    lines.push(`- Guidance: ${description.guidance}`);
  }

  if (includeExamples && description.examples && Object.keys(description.examples).length > 0) {
    lines.push('- Example applications:');
    Object.entries(description.examples).forEach(([card, interpretation]) => {
      lines.push(`  - ${card} reversed: ${interpretation}`);
    });
  }

  if (includeReminder) {
    lines.push('- Keep this lens consistent for all reversed cards in this spread.');
  }

  if (hasNoReversals) {
    lines.push('- All cards appear upright in this reading.');
  }

  const text = lines.join('\n');
  if (cache !== false && description && typeof description === 'object') {
    const bucket = cacheBucket || new Map();
    bucket.set(cacheKey, text);
    if (!cacheBucket) {
      REVERSAL_LENS_CACHE.set(description, bucket);
    }
  }

  return { lines, text };
}

function getPositionOptions(themes, context) {
  const options = {};
  if (themes && themes.reversalDescription) {
    options.reversalDescription = themes.reversalDescription;
  }
  if (themes && themes.deckStyle) {
    options.deckStyle = themes.deckStyle;
  }
  if (typeof context !== 'undefined') {
    options.context = context;
  }
  // Enable symbol annotations for deep readings or when explicitly requested
  if (themes && themes.includeSymbols) {
    options.includeSymbols = true;
  }
  return options;
}

function getCrossCheckReversalNote(position, themes) {
  if (!position || !themes || !themes.reversalDescription) return '';
  if ((position.orientation || '').toLowerCase() !== 'reversed') return '';
  const guidance = buildReversalGuidance(themes.reversalDescription);
  const positionName = position.name || 'Position';
  return `${positionName} (${position.card} ${position.orientation}): ${guidance}`;
}

function formatMeaningForPosition(meaning, position) {
  const firstClause = meaning.includes('.') ? meaning.split('.')[0] : meaning;
  const lowered = firstClause.toLowerCase();

  if (position.includes('Challenge') || position.includes('tension')) {
    return `The friction here shows how it centers on ${lowered}.`;
  }

  if (position.includes('Advice') || position.includes('how to meet') || position.includes('Self / Advice')) {
    return `This shows how it may help to lean into ${lowered}.`;
  }

  if (position.includes('Outcome') || position.includes('direction') || position.includes('Future')) {
    return `If things continue as they are, this shows how the trajectory leans toward ${lowered}.`;
  }

  if (position.includes('Subconscious') || position.includes('Hidden') || position.includes('Below')) {
    return `This reveals how, beneath awareness, part of you is still relating to ${lowered}.`;
  }

  if (position.includes('External')) {
    return `This shows that around you, circumstances echo ${lowered}.`;
  }

  if (position.includes('Hopes & Fears')) {
    return `This reveals both longing and worry around ${lowered}.`;
  }

  return `This shows ${lowered} as a live theme.`;
}

function buildOpening(spreadName, userQuestion, context, options = {}) {
  const personalization = options.personalization || null;
  const tone = getToneStyle(personalization?.readingTone);
  const rawQuestion = typeof userQuestion === 'string' ? userQuestion.trim() : '';
  let safeQuestion = rawQuestion
    ? sanitizeText(rawQuestion, {
      maxLength: MAX_QUESTION_TEXT_LENGTH,
      addEllipsis: true,
      stripMarkdown: true,
      filterInstructions: true
    })
    : '';
  if (safeQuestion) {
    const injectionCheck = detectPromptInjection(safeQuestion, { confidenceThreshold: 0.6, sanitize: true });
    if (injectionCheck.isInjection) {
      safeQuestion = injectionCheck.sanitizedText || safeQuestion;
    }
  }
  const question = safeQuestion;
  const spreadLabel = spreadName || 'your chosen spread';
  const descriptor = tone.openingAdjectives?.[0] || 'thoughtful';
  const nameOpening = buildNameClause(personalization?.displayName, 'opening');
  const subject = nameOpening ? `${nameOpening}the cards` : 'The cards';

  const responseLead = question
    ? `${subject} offer a ${descriptor} response through the ${spreadLabel} to your question: "${question}".`
    : `${subject} share a ${descriptor} impression of what the ${spreadLabel.toLowerCase()} reveals around you.`;

  const followUp = 'They honor both seen and unseen influences while centering your agency.';
  const base = `${responseLead}\n\n${followUp}`;
  const contextDescriptor = getContextDescriptor(context);
  const personalizationBridge = buildPersonalizationBridge(personalization, { contextDescriptor });
  const contextReminder = buildContextReminder(context);
  const parts = [base];
  if (personalizationBridge) {
    parts.push(personalizationBridge);
  }
  if (contextReminder) {
    parts.push(contextReminder);
  }
  return parts.join('\n\n');
}

function appendReversalReminder(text, cardsInfo, themes) {
  if (!text) return text;

  if (!themes?.reversalDescription) {
    return text;
  }

  const reminder = `*Reversal lens reminder: ${buildReversalGuidance(themes.reversalDescription)}*`;
  if (text.includes(reminder)) {
    return text;
  }

  return `${text}\n\n${reminder}`;
}

function getConnector(position, direction = 'toPrev') {
  const normalizedPosition = normalizePositionKey(position);
  const template = POSITION_LANGUAGE[normalizedPosition];
  if (!template) return '';

  if (direction === 'toPrev' && template.connectorToPrev) {
    return pickOne(template.connectorToPrev, `connector|${normalizedPosition}|toPrev`);
  }

  if (direction === 'toNext' && template.connectorToNext) {
    return pickOne(template.connectorToNext, `connector|${normalizedPosition}|toNext`);
  }

  return '';
}

function buildCrossCheckSynthesis(crossCheck) {
  const { position1, position2, elementalRelationship, alignmentType } = crossCheck;

  let synthesis = `${position1.name} (${position1.card} ${position1.orientation}) and ${position2.name} (${position2.card} ${position2.orientation}): `;

  // Add elemental dynamic description
  if (elementalRelationship?.description) {
    synthesis += elementalRelationship.description + '. ';
  }

  // Add alignment-based interpretation
  const alignmentPhrases = {
    'unified': 'Both cards share the same elemental energy, creating a unified and intensified theme.',
    'harmonious': 'These positions work together harmoniously, supporting the same trajectory.',
    'evolving-support': 'The supportive elemental flow suggests evolution from one state to the next.',
    'parallel-tension': 'Both positions share orientation, indicating tension that runs consistently through this axis.',
    'dynamic-shift': 'Different orientations signal a dynamic shift or transformation between these positions.',
    'complex': 'The relationship between these positions shows nuanced dynamics worth exploring.'
  };

  synthesis += alignmentPhrases[alignmentType] || 'These positions relate in complex ways.';

  return synthesis;
}

/**
 * Prose-friendly cross-check formatting for local composer output.
 * Removes emoji indicators and uses natural language for relationships.
 */
function formatCrossCheckProse(label, crossCheck, _themes) {
  if (!crossCheck) return '';

  const { position1, position2, elementalRelationship } = crossCheck;
  if (!position1?.card || !position2?.card) return '';

  const relationship = elementalRelationship?.relationship || 'neutral';

  // Natural language mappings for elemental relationships
  const relationshipProse = {
    supportive: 'work together harmoniously',
    tension: 'create productive friction that invites integration',
    amplified: 'reinforce and intensify each other',
    neutral: 'each contribute their own voice to this reading'
  };

  const relationshipText = relationshipProse[relationship] || relationshipProse.neutral;

  // Build a flowing sentence
  const card1Name = `**${position1.card}**`;
  const card2Name = `**${position2.card}**`;
  const pos1Short = position1.name?.replace(/\s*\(Card \d+\)/g, '') || position1.name;
  const pos2Short = position2.name?.replace(/\s*\(Card \d+\)/g, '') || position2.name;

  return `${card1Name} in ${pos1Short} and ${card2Name} in ${pos2Short} ${relationshipText}.`;
}

function formatCrossCheck(label, crossCheck, themes, options = {}) {
  if (isProseMode(options)) return formatCrossCheckProse(label, crossCheck, themes);

  if (!crossCheck) {
    return `${label}: No comparative insight available.`;
  }

  const relationship = crossCheck.elementalRelationship?.relationship;
  let indicator = '';

  if (relationship === 'tension') {
    indicator = '⚠️ Elemental tension signals friction that needs balancing.';
  } else if (relationship === 'supportive') {
    indicator = '✓ Elemental harmony supports this pathway.';
  } else if (relationship === 'amplified') {
    indicator = 'Elemental repetition amplifies this theme significantly.';
  }

  const reversalNotes = [
    getCrossCheckReversalNote(crossCheck.position1, themes),
    getCrossCheckReversalNote(crossCheck.position2, themes)
  ].filter(Boolean);

  const parts = [];
  if (indicator) parts.push(indicator);
  parts.push(buildCrossCheckSynthesis(crossCheck).trim());
  if (reversalNotes.length > 0) {
    parts.push(reversalNotes.join(' '));
  }

  return `${label}: ${parts.join(' ')}`.trim();
}

function buildReflectionsSection(reflectionsText) {
  if (!reflectionsText || typeof reflectionsText !== 'string') return '';
  let safeReflection = sanitizeText(reflectionsText, {
    maxLength: MAX_REFLECTION_TEXT_LENGTH,
    addEllipsis: true,
    stripMarkdown: true,
    filterInstructions: true
  });
  if (safeReflection) {
    const reflectionCheck = detectPromptInjection(safeReflection, { confidenceThreshold: 0.6, sanitize: true });
    if (reflectionCheck.isInjection) {
      safeReflection = reflectionCheck.sanitizedText || safeReflection;
    }
  }
  if (!safeReflection) return '';
  return `### Your Reflections\n\nThis reflection shows how this reading lands in your lived experience.\n\n${safeReflection}\n\nYour intuitive impressions are valid and add personal meaning to this reading.`;
}

function buildOccultFlavor(cardInfo) {
  if (!cardInfo || !isMajorArcana(cardInfo)) return '';

  const astro = getAstroForCard(cardInfo);
  const qabalah = getQabalahForCard(cardInfo);

  const bits = [];

  if (astro?.label) {
    const detail = astro.focus ? `, ${astro.focus}` : '';
    bits.push(`${astro.label}${detail}`);
  }

  if (qabalah?.label) {
    const detail = qabalah.focus ? `, ${qabalah.focus}` : '';
    bits.push(`${qabalah.label}${detail}`);
  }

  if (!bits.length) return '';

  return ` On a symbolic level, some readers link this card to ${bits.join(' and ')}; treat that as color, not a command.`;
}

function _buildReflectionPrompt(cardInfo, position) {
  const name = (cardInfo.card || 'this card').toLowerCase();
  const pos = (position || '').toLowerCase();

  if (pos.includes('challenge') || pos.includes('tension')) {
    return `Where do you notice a similar tension or pattern to ${name} in your current experience?`;
  }

  if (pos.includes('advice') || pos.includes('self')) {
    return `What small, doable experiment this week would express the spirit of ${name} in your life?`;
  }

  if (pos.includes('outcome') || pos.includes('direction') || pos.includes('future')) {
    return `If this trajectory unfolded, what part of you would feel relieved, and what part might hesitate?`;
  }

  if (pos.includes('subconscious') || pos.includes('hidden')) {
    return `Does anything in this card’s theme quietly resonate with feelings you rarely say out loud?`;
  }

  return `What, if anything, in your current life feels most like the energy of ${name}?`;
}

function buildGuidanceActionPrompt(cardInfo, themes) {
  if (!cardInfo) return '';

  const cardName = cardInfo.card || 'This card';
  const clause = extractCoreTheme(cardInfo.meaning);
  if (!clause) return '';

  const clauseLower = decapitalize(clause);
  const isReversed = (cardInfo.orientation || '').toLowerCase() === 'reversed';

  if (isReversed) {
    const lensName = themes?.reversalDescription?.name;
    const lensPrefix = lensName ? `Within the ${lensName} lens, ` : '';
    return `${lensPrefix}${cardName} reversed asks you to notice where ${clauseLower} feels blocked and to agree on one practical step that eases the pressure.`;
  }

  return `${cardName} invites you to practice ${clauseLower} together—pick one specific action or conversation that expresses it this week.`;
}

function buildInlineReversalNote(cardInfo, themes, { shouldIncludeReminder = false } = {}) {
  if (
    !cardInfo ||
    (cardInfo.orientation || '').toLowerCase() !== 'reversed' ||
    !themes?.reversalDescription
  ) {
    return null;
  }

  const clause = extractCoreTheme(cardInfo.meaning);
  const clauseLower = clause ? decapitalize(clause) : 'the blocked lesson';
  const cardName = cardInfo.card || 'This card';

  if (shouldIncludeReminder) {
    const lensGuidance = buildReversalGuidance(themes.reversalDescription);
    return {
      text: `*Reversal lens reminder: ${lensGuidance} For ${cardName}, focus on where ${clauseLower} needs gentle attention before momentum can return.*`,
      includesReminder: true
    };
  }

  return {
    text: `*${cardName} reversed spotlights where ${clauseLower} needs gentle attention before momentum can return.*`,
    includesReminder: false
  };
}

function extractCoreTheme(meaning) {
  if (!meaning || typeof meaning !== 'string') return '';
  const firstClause = meaning.split(/[.;]/)[0];
  return firstClause.trim();
}

function decapitalize(text) {
  if (!text) return '';
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function buildPatternSynthesis(themes) {
  const highlights = themes?.knowledgeGraph?.narrativeHighlights;
  if (!Array.isArray(highlights) || highlights.length === 0) {
    return '';
  }

  const featured = highlights.slice(0, 3);
  let section = `### Deeper Patterns\n\n`;
  section += `Beyond the individual positions, your cards reveal larger archetypal movements:\n\n`;

  featured.forEach((highlight) => {
    const sanitized = typeof highlight.text === 'string'
      ? highlight.text.replace(/\*\*/g, '')
      : '';
    section += `- ${sanitized}\n`;
  });

  return `${section}\n`.trimEnd();
}

/**
 * ELEMENTAL REMEDIES
 * Concrete practices to balance underrepresented elemental energies
 */

const ELEMENTAL_REMEDIES_BY_CONTEXT = {
  Fire: {
    love: [
      'Plan a spontaneous date or shared adventure',
      'Have an honest conversation about what excites you both',
      'Try something new together that gets your hearts racing',
      'Light a candle together and share what ignites your passion'
    ],
    career: [
      'Pitch that idea you have been sitting on',
      'Take initiative on a project without waiting for permission',
      'Network with someone who inspires you',
      'Visualize a torch—what project would you carry forward boldly?'
    ],
    self: [
      'Move your body—take a walk, stretch, or dance to music',
      'Start that creative project you have been thinking about',
      'Do something that scares you a little in a good way',
      'Meditate on flame imagery—what needs to be sparked or released?'
    ],
    spiritual: [
      'Practice devotional movement (sacred dance, yoga, tai chi)',
      'Engage with your spiritual practice through action (ritual, service)',
      'Channel inspiration into creative expression of your beliefs',
      'Light a candle as a focal point for meditation or intention-setting'
    ],
    general: [
      'Move your body—take a walk, stretch, or dance to music',
      'Take one decisive action on something you have been considering',
      'Create something with your hands—cook, draw, rearrange a space',
      'Work with fire symbols: light a candle, contemplate flame imagery'
    ]
  },

  Water: {
    love: [
      'Share a vulnerable feeling with your partner',
      'Create space to really listen without planning your response',
      'Express appreciation for something you often take for granted',
      'Spend time near water together—a lake, fountain, or bath'
    ],
    career: [
      'Check in with how you feel about your work, not just what you think',
      'Reach out to a colleague with genuine care, not just networking',
      'Notice and honor your emotional needs around work boundaries',
      'Keep a cup of water at your desk as a reminder to flow with challenges'
    ],
    self: [
      'Journal your feelings without censoring or editing',
      'Practice self-compassion when difficult emotions arise',
      'Let yourself cry, laugh, or feel without trying to fix it',
      'Take a mindful bath or shower, visualizing emotions washing clean'
    ],
    spiritual: [
      'Spend time in receptive prayer or meditation',
      'Engage with sacred texts or teachings that move you emotionally',
      'Practice loving-kindness meditation for yourself and others',
      'Work with water symbols: visit moving water, use a chalice in ritual'
    ],
    general: [
      'Journal your feelings without censoring or editing',
      'Spend time near water or take a mindful bath',
      'Talk with someone who holds space for your emotions without trying to fix them',
      'Work with water symbols: cups, bowls, or images of flowing water'
    ]
  },

  Air: {
    love: [
      'Ask a question you have been afraid to ask',
      'Talk through a misunderstanding without defensiveness',
      'Share an idea or perspective you usually keep to yourself',
      'Write a letter (sent or unsent) to clear the air'
    ],
    career: [
      'Clarify expectations in a key work relationship',
      'Ask for the feedback you need to grow',
      'Articulate your vision or goals to someone who can help',
      'Brainstorm on paper—let ideas flow like wind before editing'
    ],
    self: [
      'Write out your thoughts to gain perspective on what feels confusing',
      'Talk through your inner dialogue with a trusted friend',
      'Question an assumption you have been carrying',
      'Step outside and feel the breeze—let it clear mental fog'
    ],
    spiritual: [
      'Study a teaching or text that challenges your understanding',
      'Engage in dialogue with someone whose beliefs differ from yours',
      'Write or speak your prayers aloud to clarify your intentions',
      'Work with air symbols: incense smoke, feathers, or open windows'
    ],
    general: [
      'Discuss your thoughts with a trusted friend or mentor',
      'Write out your thoughts to gain perspective on what feels confusing',
      'Learn something new that sparks your curiosity',
      'Work with air symbols: open a window, watch clouds, or use incense'
    ]
  },

  Earth: {
    love: [
      'Create a small daily ritual you do together (morning coffee, evening walk)',
      'Tend to the practical, unglamorous foundations of your relationship',
      'Show love through concrete actions, not just words',
      'Cook a meal together or plant something as a shared grounding ritual'
    ],
    career: [
      'Organize your workspace or schedule for better flow',
      'Complete one small task that has been lingering',
      'Build a sustainable routine that supports your energy',
      'Keep a stone or crystal on your desk as a reminder to stay grounded'
    ],
    self: [
      'Establish one grounding daily ritual (morning tea, evening walk, bedtime routine)',
      'Tend to your body\'s basic needs (sleep, nourishing food, gentle movement)',
      'Spend time in nature or with your hands in soil',
      'Work with earth symbols: hold a stone, walk barefoot, or tend plants'
    ],
    spiritual: [
      'Create a physical altar or sacred space in your home',
      'Engage in embodied practice (walking meditation, sacred gardening)',
      'Ground your beliefs in daily ritual and tangible acts of service',
      'Work with earth symbols: stones, coins, or images of mountains'
    ],
    general: [
      'Establish one grounding daily ritual (morning tea, evening walk, bedtime routine)',
      'Organize a small physical space to create order',
      'Work with your hands—garden, cook, craft, or repair something tangible',
      'Work with earth symbols: stones, soil, or pentacle imagery'
    ]
  }
};

/**
 * Select context-appropriate remedy for an element
 * Implements fallback chain: context → general → first available
 *
 * @param {string} element - Fire, Water, Air, Earth
 * @param {string} context - love, career, self, spiritual, general
 * @param {number} index - Which remedy to pick (0-2, rotates for variety)
 * @returns {string} Context-appropriate remedy
 */
function selectContextAwareRemedy(element, context, index = 0) {
  const contextRemedies = ELEMENTAL_REMEDIES_BY_CONTEXT[element];
  if (!contextRemedies) return null;

  // Try context-specific first
  let remedyList = contextRemedies[context];

  // Fallback to general
  if (!remedyList || remedyList.length === 0) {
    remedyList = contextRemedies.general;
  }

  // Fallback to first available
  if (!remedyList || remedyList.length === 0) {
    const firstAvailable = Object.values(contextRemedies).find(
      list => list && list.length > 0
    );
    remedyList = firstAvailable || [];
  }

  if (remedyList.length === 0) return null;

  // Rotate through options
  const selectedIndex = index % remedyList.length;
  return remedyList[selectedIndex];
}

/**
 * Generate actionable remedies for underrepresented elements
 * Now with context-aware selection
 *
 * @param {Object} elementCounts - Counts of each element {Fire: 2, Water: 0, Air: 1, Earth: 0}
 * @param {number} totalCards - Total number of cards in spread
 * @param {string} context - Reading context (love, career, self, spiritual, general)
 * @param {Object} options - Additional options
 * @param {number} options.rotationIndex - Index for rotating through remedies (default: 0)
 * @returns {string|null} Formatted remedy guidance or null if balanced
 */
function buildElementalRemedies(elementCounts, totalCards, context = 'general', options = {}) {
  if (!elementCounts || !totalCards || totalCards < 3) return null;

  const rotationIndex = Number.isFinite(options.rotationIndex)
    ? Math.abs(Math.floor(options.rotationIndex))
    : 0;

  // Calculate which elements are underrepresented (< 15% of spread)
  const threshold = 0.15;
  const underrepresented = Object.entries(elementCounts)
    .filter(([_element, count]) => {
      const ratio = count / totalCards;
      return ratio < threshold && count < totalCards; // Exclude if element = 100%
    })
    .map(([element]) => element)
    .filter(element => ELEMENTAL_REMEDIES_BY_CONTEXT[element]); // Only elements with remedies

  if (underrepresented.length === 0) return null;

  // Build remedy text with context-aware selection
  const remedies = underrepresented
    .map(element => {
      const remedy = selectContextAwareRemedy(element, context, rotationIndex);
      if (!remedy) return null;
      return `- ${element}: ${remedy}`;
    })
    .filter(Boolean);

  if (remedies.length === 0) return null;

  return `To bring in underrepresented energies:\n${remedies.join('\n')}`;
}

function computeRemedyRotationIndex({ cardsInfo = [], userQuestion = '', spreadInfo = {} } = {}) {
  const segments = [];

  if (spreadInfo?.name) segments.push(spreadInfo.name);
  if (spreadInfo?.key) segments.push(spreadInfo.key);
  if (spreadInfo?.deckStyle) segments.push(spreadInfo.deckStyle);
  if (userQuestion) segments.push(userQuestion);

  if (Array.isArray(cardsInfo)) {
    cardsInfo.forEach((card) => {
      if (card?.canonicalName) {
        segments.push(card.canonicalName);
      } else if (card?.card) {
        segments.push(card.card);
      }
    });
  }

  const composite = segments.join('|').trim();
  if (!composite) return 0;

  let hash = 0;
  for (let i = 0; i < composite.length; i += 1) {
    hash = (hash << 5) - hash + composite.charCodeAt(i);
    hash |= 0; // Convert to 32-bit int
  }

  return Math.abs(hash);
}

/**
 * Check if elemental remedies should be offered
 * True when one element dominates (≥50%) or elements are very sparse
 * Only applies to spreads with 3+ cards (single/two-card spreads too small to meaningfully balance)
 */
function shouldOfferElementalRemedies(elementCounts, totalCards) {
  if (!elementCounts || !totalCards || totalCards < 3) return false;

  const counts = Object.values(elementCounts);
  const maxCount = Math.max(...counts);
  const maxRatio = maxCount / totalCards;

  // Offer remedies if:
  // 1. One element dominates (≥50%)
  // 2. OR 2 or fewer active elements (sparse coverage)
  if (maxRatio >= 0.5) return true;

  const activeElements = counts.filter(c => c > 0).length;
  return activeElements <= 2;
}

export {
  DEFAULT_WEIGHT_DETAIL_THRESHOLD,
  SUPPORTING_WEIGHT_THRESHOLD,
  normalizeContext,
  getContextDescriptor,
  buildContextReminder,
  shouldEmphasizePosition,
  buildWeightNote,
  buildWeightAttentionIntro,
  buildSupportingPositionsSummary,
  buildPositionCardText,
  buildReversalGuidance,
  getPositionOptions,
  getCrossCheckReversalNote,
  buildOpening,
  appendReversalReminder,
  getConnector,
  buildCrossCheckSynthesis,
  formatCrossCheck,
  buildReflectionsSection,
  buildGuidanceActionPrompt,
  buildInlineReversalNote,
  buildPatternSynthesis,
  buildElementalRemedies,
  shouldOfferElementalRemedies,
  selectContextAwareRemedy,
  computeRemedyRotationIndex,
  pickOne,
  getKeySymbols
};
