/**
 * Narrative Builder Library
 *
 * Constructs spread-specific, position-aware tarot reading narratives
 * that integrate elemental, thematic, and relationship analysis.
 */

import { getImageryHook, isMajorArcana, getElementalImagery, getMinorImageryHook } from './imageryHooks.js';
import { buildMinorSummary } from './minorMeta.js';
import { enhanceSection, validateReadingNarrative } from './narrativeSpine.js';
import { analyzeElementalDignity } from './spreadAnalysis.js';
import {
  getAstroForCard,
  getQabalahForCard,
  shouldSurfaceAstroLens,
  shouldSurfaceQabalahLens
} from './esotericMeta.js';

const CONTEXT_DESCRIPTORS = {
  love: 'relationships and heart-centered experiences',
  career: 'career, calling, and material pathways',
  self: 'personal growth and inner landscape',
  spiritual: 'spiritual practice and meaning-making',
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
  }
};

const MAJOR_CONTEXT_LENSES = {
  love: 'In relationships, let this archetype illuminate the dynamics asking for attention.',
  career: 'In your career, treat this archetype as guidance for how you show up in your work and collaborations.',
  self: 'For personal growth, let this archetype mirror the inner work unfolding.',
  spiritual: 'In your spiritual path, let this archetype frame the lesson seeking integration.'
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
  }
};

const MINOR_SUITS = ['Wands', 'Cups', 'Swords', 'Pentacles'];

function pickOne(value) {
  if (!value) return '';
  if (Array.isArray(value) && value.length > 0) {
    return value[Math.floor(Math.random() * value.length)];
  }
  return value;
}

function normalizeContext(context) {
  if (!context || typeof context !== 'string') return 'general';
  const key = context.trim().toLowerCase();
  if (['love', 'career', 'self', 'spiritual'].includes(key)) {
    return key;
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
      'Hold it as a forecast of trajectory, always adjustable through your choices.'
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
 * Build a position-aware card description with optional imagery hooks
 */
export function buildPositionCardText(cardInfo, position, options = {}) {
  const template = POSITION_LANGUAGE[position];
  const prevElementalRelationship = options.prevElementalRelationship; // For elemental imagery

  if (!template) {
    // Fallback for unknown positions (defensive defaults)
    const safeCard = cardInfo.card || 'this card';
    const safeOrientation =
      typeof cardInfo.orientation === 'string' && cardInfo.orientation.trim()
        ? ` ${cardInfo.orientation}`
        : '';
    const meaning = formatMeaningForPosition(cardInfo.meaning || '', position);
    return `${position}: ${safeCard}${safeOrientation}. ${meaning}`;
  }

  const safeCard = cardInfo.card || 'this card';
  const safeOrientation =
    typeof cardInfo.orientation === 'string' && cardInfo.orientation.trim()
      ? cardInfo.orientation
      : '';
  const introTemplate = pickOne(template.intro);
  const intro =
    typeof introTemplate === 'function'
      ? introTemplate(safeCard, safeOrientation)
      : introTemplate || `${position}: ${safeCard} ${safeOrientation}.`;
  const meaning = formatMeaningForPosition(cardInfo.meaning || '', position);

  const contextClause = buildContextualClause(cardInfo, options.context);

  let esotericClause = '';

  if (shouldSurfaceAstroLens(cardInfo)) {
    const astro = getAstroForCard(cardInfo);
    if (astro?.label && astro?.focus) {
      esotericClause = `Traditionally linked with ${astro.label}, ${astro.focus}.`;
    }
  }

  if (!esotericClause && shouldSurfaceQabalahLens(cardInfo)) {
    const qabalah = getQabalahForCard(cardInfo);
    if (qabalah?.label && qabalah?.focus) {
      esotericClause = `On the Tree of Life, this aligns with ${qabalah.label}, ${qabalah.focus}.`;
    }
  }

  const occultFlavor = buildOccultFlavor(cardInfo);
  const enrichedMeaning = [meaning, contextClause, esotericClause, occultFlavor].filter(Boolean).join(' ');

  // Add imagery hook for Major Arcana if enabled
  let imagery = '';
  if (template.useImagery && isMajorArcana(cardInfo.number)) {
    const hook = getImageryHook(cardInfo.number, cardInfo.orientation);
    if (hook && hook.interpretation) {
      imagery = ` ${hook.interpretation}`;
    }
  }

  // Minor Arcana: suit/rank-aware enrichment plus optional light imagery hook.
  let minorContextText = '';
  if (!isMajorArcana(cardInfo.number)) {
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

  const frameText = pickOne(template.frame) || '';
  const safeElemental = elementalImagery || '';
  const positionLabel = position ? `${position}: ` : '';
  return `${positionLabel}${intro} ${enrichedMeaning}${imagery}${minorContextText} ${frameText}${safeElemental}`;
}

function buildReversalGuidance(reversalDescription) {
  return `Within the ${reversalDescription.name} lens, ${reversalDescription.guidance}`;
}

function getPositionOptions(themes, context) {
  const options = {};
  if (themes && themes.reversalDescription) {
    options.reversalDescription = themes.reversalDescription;
  }
  if (typeof context !== 'undefined') {
    options.context = context;
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

/**
 * Format card meaning to fit position context
 */
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

/**
 * Build Celtic Cross reading using position-relationship analysis
 */
export function buildCelticCrossReading({
  cardsInfo,
  userQuestion,
  reflectionsText,
  celticAnalysis,
  themes,
  context
}) {
  const sections = [];

  // Opening
  sections.push(buildOpening('Celtic Cross (Classic 10-Card)', userQuestion, context));

  // 1. NUCLEUS - The Heart of the Matter (Cards 1-2)
  sections.push(
    enhanceSection(
      buildNucleusSection(celticAnalysis.nucleus, cardsInfo, themes, context),
      { type: 'nucleus', cards: [cardsInfo[0], cardsInfo[1]], relationships: { elementalRelationship: celticAnalysis.nucleus.elementalDynamic } }
    ).text
  );

  // 2. TIMELINE - Past, Present, Future (Cards 3-1-4)
  sections.push(
    enhanceSection(
      buildTimelineSection(celticAnalysis.timeline, cardsInfo, themes, context),
      { type: 'timeline' }
    ).text
  );

  // 3. CONSCIOUSNESS - Subconscious, Center, Conscious (Cards 6-1-5)
  sections.push(
    enhanceSection(
      buildConsciousnessSection(celticAnalysis.consciousness, cardsInfo, themes, context),
      { type: 'consciousness' }
    ).text
  );

  // 4. STAFF - Self, External, Hopes/Fears, Outcome (Cards 7-10)
  sections.push(
    enhanceSection(
      buildStaffSection(celticAnalysis.staff, cardsInfo, themes, context),
      { type: 'staff' }
    ).text
  );

  // 5. CROSS-CHECKS - Key position comparisons
  sections.push(
    enhanceSection(
      buildCrossChecksSection(celticAnalysis.crossChecks, themes),
      { type: 'relationships' }
    ).text
  );

  // 6. User Reflections
  if (reflectionsText && reflectionsText.trim()) {
    sections.push(buildReflectionsSection(reflectionsText));
  }

  // 7. SYNTHESIS - Actionable integration
  sections.push(
    enhanceSection(
      buildSynthesisSection(cardsInfo, themes, celticAnalysis, userQuestion, context),
      { type: 'outcome' }
    ).text
  );

  // Final validation log (non-blocking)
  const readingBody = sections.filter(Boolean).join('\n\n');
  const validation = validateReadingNarrative(readingBody);
  if (!validation.isValid) {
    console.debug('Celtic Cross narrative spine suggestions:', validation.suggestions || validation.sectionAnalyses);
  }

  return appendReversalReminder(readingBody, cardsInfo, themes);
}

function buildOpening(spreadName, userQuestion, context) {
  const question = userQuestion && userQuestion.trim();
  const base = question
    ? `Focusing on the ${spreadName}, I attune to your question: "${question}"\n\nThe cards respond with insight that honors both seen and unseen influences.`
    : `Focusing on the ${spreadName}, the cards speak to the energy most present for you right now.`;

  const contextReminder = buildContextReminder(context);
  return contextReminder ? `${base}\n\n${contextReminder}` : base;
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

function buildNucleusSection(nucleus, cardsInfo, themes, context) {
  const present = cardsInfo[0];
  const challenge = cardsInfo[1];

  let section = `**THE HEART OF THE MATTER** (Nucleus)\n\n`;

  const presentPosition = present.position || 'Present — core situation (Card 1)';
  const challengePosition = challenge.position || 'Challenge — crossing / tension (Card 2)';

  section += `${buildPositionCardText(present, presentPosition, getPositionOptions(themes, context))}\n\n`;
  section += `${buildPositionCardText(challenge, challengePosition, getPositionOptions(themes, context))}\n\n`;

  section += nucleus.synthesis;

  return section;
}

function buildTimelineSection(timeline, cardsInfo, themes, context) {
  const past = cardsInfo[2];
  const present = cardsInfo[0];
  const future = cardsInfo[3];

  let section = `**THE TIMELINE** (Horizontal Axis)\n\n`;

  const options = getPositionOptions(themes, context);

  // Past card
  section += `${buildPositionCardText(past, past.position || 'Past — what lies behind (Card 3)', options)}\n\n`;

  // Present card with connector and elemental imagery
  const pastToPresent = timeline.pastToPresent;
  const presentConnector = getConnector('Present — core situation (Card 1)', 'toPrev');
  section += `${presentConnector} ${buildPositionCardText(present, present.position || 'Present — core situation (Card 1)', {
    ...options,
    prevElementalRelationship: pastToPresent
  })}\n\n`;

  // Future card with connector and elemental imagery
  const presentToFuture = timeline.presentToFuture;
  const futureConnector = getConnector('Near Future — what lies before (Card 4)', 'toPrev');
  section += `${futureConnector} ${buildPositionCardText(future, future.position || 'Near Future — what lies before (Card 4)', {
    ...options,
    prevElementalRelationship: presentToFuture
  })}\n\n`;

  section += timeline.causality;

  return section;
}

/**
 * Get connector phrase for a position
 */
function getConnector(position, direction = 'toPrev') {
  const template = POSITION_LANGUAGE[position];
  if (!template) return '';

  if (direction === 'toPrev' && template.connectorToPrev) {
    return pickOne(template.connectorToPrev);
  }

  if (direction === 'toNext' && template.connectorToNext) {
    return pickOne(template.connectorToNext);
  }

  return '';
}

function buildConsciousnessSection(consciousness, cardsInfo, themes, context) {
  const subconscious = cardsInfo[5];
  const conscious = cardsInfo[4];

  let section = `**CONSCIOUSNESS FLOW** (Vertical Axis)\n\n`;

  section += `${buildPositionCardText(subconscious, subconscious.position || 'Subconscious — roots / hidden forces (Card 6)', getPositionOptions(themes, context))}\n\n`;
  section += `${buildPositionCardText(conscious, conscious.position || 'Conscious — goals & focus (Card 5)', getPositionOptions(themes, context))}\n\n`;

  section += consciousness.synthesis;

  if (consciousness.alignment === 'conflicted') {
    section += `\n\n*This misalignment suggests inner work is needed to bring your depths and aspirations into harmony.*`;
  } else if (consciousness.alignment === 'aligned') {
    section += `\n\n*This alignment is a source of power—your whole being is moving in one direction.*`;
  }

  return section;
}

function buildStaffSection(staff, cardsInfo, themes, context) {
  const self = cardsInfo[6];
  const external = cardsInfo[7];
  const hopesFears = cardsInfo[8];
  const outcome = cardsInfo[9];

  let section = `**THE STAFF** (Context & Trajectory)\n\n`;

  section += `${buildPositionCardText(self, self.position || 'Self / Advice — how to meet this (Card 7)', getPositionOptions(themes, context))}\n\n`;
  section += `${buildPositionCardText(external, external.position || 'External Influences — people & environment (Card 8)', getPositionOptions(themes, context))}\n\n`;
  section += `${buildPositionCardText(hopesFears, hopesFears.position || 'Hopes & Fears — deepest wishes & worries (Card 9)', getPositionOptions(themes, context))}\n\n`;
  section += `${buildPositionCardText(outcome, outcome.position || 'Outcome — likely path if unchanged (Card 10)', getPositionOptions(themes, context))}\n\n`;

  section += staff.adviceImpact;

  return section;
}

function buildCrossChecksSection(crossChecks, themes) {
  let section = `**KEY RELATIONSHIPS**\n\n`;

  section += 'This overview shows how core positions interact and compare.\n\n';

  section += formatCrossCheck('Conscious Goal vs Outcome', crossChecks.goalVsOutcome, themes);
  section += `\n\n${formatCrossCheck('Advice vs Outcome', crossChecks.adviceVsOutcome, themes)}`;
  section += `\n\n${formatCrossCheck('Near Future vs Outcome', crossChecks.nearFutureVsOutcome, themes)}`;
  section += `\n\n${formatCrossCheck('Subconscious vs Hopes & Fears', crossChecks.subconsciousVsHopesFears, themes)}`;

  section += '\n\nTaken together, these cross-checks point toward how to translate the spread\'s insights into your next aligned step.';

  return section;
}

function formatCrossCheck(label, crossCheck, themes) {
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
  parts.push(crossCheck.synthesis.trim());
  if (reversalNotes.length > 0) {
    parts.push(reversalNotes.join(' '));
  }

  return `${label}: ${parts.join(' ')}`.trim();
}

function buildReflectionsSection(reflectionsText) {
  return `**YOUR REFLECTIONS**\n\nThis reflection shows how this reading lands in your lived experience.\n\n${reflectionsText.trim()}\n\nYour intuitive impressions are valid and add personal meaning to this reading.`;
}

function buildSynthesisSection(cardsInfo, themes, celticAnalysis, userQuestion, context) {
  let section = `**SYNTHESIS & GUIDANCE**\n\n`;

  section += 'This synthesis shows how the spread integrates into actionable guidance.\n\n';

  if (context && context !== 'general') {
    section += `Focus: Interpreting this guidance through ${getContextDescriptor(context)}.\n\n`;
  }

  // Thematic summary
  if (themes.suitFocus) {
    section += `${themes.suitFocus}\n\n`;
  }

  if (themes.archetypeDescription) {
    section += `${themes.archetypeDescription}\n\n`;
  }

  if (themes.elementalBalance) {
    section += `Elemental context: ${themes.elementalBalance}\n\n`;
  }

  // Timing profile (if available)
  if (themes.timingProfile === 'near-term-tilt') {
    section += `Pace: These dynamics are poised to move in the nearer term if you act on them.\n\n`;
  } else if (themes.timingProfile === 'longer-arc-tilt') {
    section += `Pace: This pattern points to a longer, structural shift that unfolds over time.\n\n`;
  } else if (themes.timingProfile === 'developing-arc') {
    section += `Pace: This reads as an unfolding chapter that rewards consistent, conscious engagement.\n\n`;
  }

  const options = getPositionOptions(themes, context);
  const advice = cardsInfo[6];
  const outcome = cardsInfo[9];

  section += `**Your next step**\n`;
  section += `This step shows where to focus your agency right now.\n`;
  section += `${buildPositionCardText(advice, advice.position || 'Self / Advice — how to meet this (Card 7)', options)}\n`;
  section += `${celticAnalysis.staff.adviceImpact}\n\n`;

  section += `**Trajectory Reminder**\n${buildPositionCardText(outcome, outcome.position || 'Outcome — likely path if unchanged (Card 10)', options)}\n`;
  section += `Remember: The outcome shown by ${outcome.card} is a trajectory based on current patterns. Your choices, consciousness, and actions shape what unfolds. You are co-creating this path.`;

  return section;
}

/**
 * Build Three-Card reading with connective flow
 */
export function buildFiveCardReading({
  cardsInfo,
  userQuestion,
  reflectionsText,
  fiveCardAnalysis,
  themes,
  context
}) {
  const sections = [];
  const spreadName = 'Five-Card Clarity';

  // Opening
  sections.push(
    buildOpening(
      spreadName,
      userQuestion ||
        'This spread clarifies the core issue, the challenge, hidden influences, support, and where things are heading if nothing shifts.',
      context
    )
  );

  if (!Array.isArray(cardsInfo) || cardsInfo.length < 5) {
    return 'This five-card spread is incomplete; please redraw or ensure all five cards are present.';
  }

  const [core, challenge, hidden, support, direction] = cardsInfo;
  const positionOptions = getPositionOptions(themes, context);

  // Core + Challenge section
  let coreSection = `**FIVE-CARD CLARITY — CORE & CHALLENGE**\n\n`;
  coreSection += buildPositionCardText(
    core,
    core.position || 'Core of the matter',
    positionOptions
  );
  coreSection += '\n\n';
  const challengePosition = challenge.position || 'Challenge or tension';
  const challengeConnector = getConnector(challengePosition, 'toPrev');
  const challengeText = buildPositionCardText(
    challenge,
    challengePosition,
    {
      ...positionOptions,
      prevElementalRelationship: fiveCardAnalysis?.coreVsChallenge
    }
  );
  coreSection += challengeConnector ? `${challengeConnector} ${challengeText}` : challengeText;
  coreSection += '\n\n';

  if (fiveCardAnalysis?.coreVsChallenge?.description) {
    coreSection += `\n\n${fiveCardAnalysis.coreVsChallenge.description}.`;
  }

  sections.push(enhanceSection(coreSection, {
    type: 'nucleus',
    cards: [core, challenge],
    relationships: { elementalRelationship: fiveCardAnalysis?.coreVsChallenge }
  }).text);

  // Hidden influence
  let hiddenSection = `**HIDDEN INFLUENCE**\n\n`;
  const hiddenPosition = hidden.position || 'Hidden / subconscious influence';
  const hiddenConnector = getConnector(hiddenPosition, 'toPrev');
  const hiddenText = buildPositionCardText(
    hidden,
    hiddenPosition,
    positionOptions
  );
  hiddenSection += hiddenConnector ? `${hiddenConnector} ${hiddenText}` : hiddenText;
  sections.push(enhanceSection(hiddenSection, {
    type: 'subconscious',
    cards: [hidden]
  }).text);

  // Support
  let supportSection = `**SUPPORTING ENERGIES**\n\n`;
  const supportPosition = support.position || 'Support / helpful energy';
  const supportConnector = getConnector(supportPosition, 'toPrev');
  const supportText = buildPositionCardText(
    support,
    supportPosition,
    positionOptions
  );
  supportSection += supportConnector ? `${supportConnector} ${supportText}` : supportText;
  sections.push(enhanceSection(supportSection, {
    type: 'support',
    cards: [support]
  }).text);

  // Direction
  let directionSection = `**DIRECTION ON YOUR CURRENT PATH**\n\n`;
  const directionPosition = direction.position || 'Likely direction on current path';
  const directionConnector = getConnector(directionPosition, 'toPrev');
  const directionText = buildPositionCardText(
    direction,
    directionPosition,
    {
      ...positionOptions,
      prevElementalRelationship: fiveCardAnalysis?.supportVsDirection
    }
  );
  directionSection += directionConnector ? `${directionConnector} ${directionText}` : directionText;

  if (fiveCardAnalysis?.synthesis) {
    directionSection += `\n\n${fiveCardAnalysis.synthesis}`;
  }

  sections.push(enhanceSection(directionSection, {
    type: 'outcome',
    cards: [direction],
    relationships: { elementalRelationship: fiveCardAnalysis?.supportVsDirection }
  }).text);

  // Reflections
  if (reflectionsText && reflectionsText.trim()) {
    sections.push(buildReflectionsSection(reflectionsText));
  }

  const full = sections.filter(Boolean).join('\n\n');
  const validation = validateReadingNarrative(full);
  if (!validation.isValid) {
    console.debug('Five-Card narrative spine suggestions:', validation.suggestions || validation.sectionAnalyses);
  }

  return appendReversalReminder(full, cardsInfo, themes);
}

export function buildRelationshipReading({
  cardsInfo,
  userQuestion,
  reflectionsText,
  themes,
  context
}) {
  const sections = [];
  const spreadName = 'Relationship Snapshot';

  sections.push(
    buildOpening(
      spreadName,
      userQuestion ||
        'This spread explores your energy, their energy, the connection between you, and guidance for relating with agency and care.',
      context
    )
  );

  const [youCard, themCard, connectionCard, dynamicsCard, outcomeCard] = Array.isArray(cardsInfo)
    ? cardsInfo
    : [];
  const options = getPositionOptions(themes, context);
  let reversalReminderEmbedded = false;

  // YOU AND THEM
  let youThem = `**YOU AND THEM**\n\n`;
  const dyadCards = [youCard, themCard].filter(Boolean);

  if (youCard) {
    const youText = buildPositionCardText(
      youCard,
      youCard.position || 'You / your energy',
      options
    );
    youThem += youText;

    const youReversalNote = buildInlineReversalNote(youCard, themes, {
      shouldIncludeReminder: !reversalReminderEmbedded
    });
    if (youReversalNote) {
      youThem += `\n\n${youReversalNote.text}`;
      if (youReversalNote.includesReminder) {
        reversalReminderEmbedded = true;
      }
    }

    youThem += '\n\n';
  }

  if (themCard) {
    const themPosition = themCard.position || 'Them / their energy';
    const themConnector = getConnector(themPosition, 'toPrev');
    const themText = buildPositionCardText(
      themCard,
      themPosition,
      options
    );
    youThem += themConnector ? `${themConnector} ${themText}` : themText;

    const themReversalNote = buildInlineReversalNote(themCard, themes, {
      shouldIncludeReminder: !reversalReminderEmbedded
    });
    if (themReversalNote) {
      youThem += `\n\n${themReversalNote.text}`;
      if (themReversalNote.includesReminder) {
        reversalReminderEmbedded = true;
      }
    }
  }

  const elemental = analyzeElementalDignity(youCard, themCard);
  const summaryLines = [];
  if (elemental && elemental.description) {
    summaryLines.push(`*Elemental interplay between you: ${elemental.description}.*`);
    const elementalTakeaway = buildRelationshipElementalTakeaway(elemental, youCard, themCard);
    if (elementalTakeaway) {
      summaryLines.push(elementalTakeaway);
    }
  } else {
    summaryLines.push('Together, this pairing suggests the current dynamic between you and points toward how energy is moving in this connection.');
  }
  youThem += `\n\n${summaryLines.join(' ')}`;

  const relationshipsMeta = elemental && elemental.description
    ? { elementalRelationship: elemental }
    : undefined;

  sections.push(
    enhanceSection(youThem, {
      type: 'relationship-dyad',
      cards: dyadCards,
      relationships: relationshipsMeta
    }).text
  );

  // THE CONNECTION
  if (connectionCard) {
    let connection = `**THE CONNECTION**\n\n`;
    connection += 'This position shows what the bond is asking for right now.\n\n';
    const connectionPosition = connectionCard.position || 'The connection / shared lesson';
    const connectionConnector = getConnector(connectionPosition, 'toPrev');
    const connectionText = buildPositionCardText(
      connectionCard,
      connectionPosition,
      options
    );
    connection += connectionConnector ? `${connectionConnector} ${connectionText}` : connectionText;

    const connectionReversalNote = buildInlineReversalNote(connectionCard, themes, {
      shouldIncludeReminder: !reversalReminderEmbedded
    });
    if (connectionReversalNote) {
      connection += `\n\n${connectionReversalNote.text}`;
      if (connectionReversalNote.includesReminder) {
        reversalReminderEmbedded = true;
      }
    }

    connection += '\n\nThis focus invites you to notice what this bond is asking from both of you next.';
    sections.push(
      enhanceSection(connection, {
        type: 'connection',
        cards: [connectionCard]
      }).text
    );
  }

  // GUIDANCE FOR THIS CONNECTION
  let guidance = `**GUIDANCE FOR THIS CONNECTION**\n\n`;
  guidance += 'This guidance shows how to participate with agency, honesty, and care.\n\n';
  const guidanceCards = [];
  if (dynamicsCard) {
    const dynamicsPosition = dynamicsCard.position || 'Dynamics / guidance';
    const dynamicsConnector = getConnector(dynamicsPosition, 'toPrev');
    const dynamicsText = buildPositionCardText(
      dynamicsCard,
      dynamicsPosition,
      options
    );
    guidance += dynamicsConnector ? `${dynamicsConnector} ${dynamicsText}` : dynamicsText;

    const dynamicsReversalNote = buildInlineReversalNote(dynamicsCard, themes, {
      shouldIncludeReminder: !reversalReminderEmbedded
    });
    if (dynamicsReversalNote) {
      guidance += `\n\n${dynamicsReversalNote.text}`;
      if (dynamicsReversalNote.includesReminder) {
        reversalReminderEmbedded = true;
      }
    }

    guidance += '\n\n';
    guidanceCards.push(dynamicsCard);
  }
  if (outcomeCard) {
    const outcomePosition = outcomeCard.position || 'Outcome / what this can become';
    const outcomeConnector = getConnector(outcomePosition, 'toPrev');
    const outcomeText = buildPositionCardText(
      outcomeCard,
      outcomePosition,
      options
    );
    guidance += outcomeConnector ? `${outcomeConnector} ${outcomeText}` : outcomeText;

    const outcomeReversalNote = buildInlineReversalNote(outcomeCard, themes, {
      shouldIncludeReminder: !reversalReminderEmbedded
    });
    if (outcomeReversalNote) {
      guidance += `\n\n${outcomeReversalNote.text}`;
      if (outcomeReversalNote.includesReminder) {
        reversalReminderEmbedded = true;
      }
    }

    guidance += '\n\n';
    guidanceCards.push(outcomeCard);
  }

  guidance += 'Emphasize what supports honest communication, mutual respect, and boundaries. Treat these insights as a mirror that informs how you choose to show up—never as a command to stay or leave.';
  const guidancePrompts = guidanceCards
    .map(card => buildGuidanceActionPrompt(card, themes))
    .filter(Boolean);
  if (guidancePrompts.length > 0) {
    guidance += ` ${guidancePrompts.join(' ')}`;
  }
  guidance += '\n\nChoose the path that best honors honesty, care, and your own boundaries—the outcome still rests in the choices you both make.';

  sections.push(
    enhanceSection(guidance, {
      type: 'relationship-guidance',
      cards: guidanceCards
    }).text
  );

  if (reflectionsText && reflectionsText.trim()) {
    sections.push(buildReflectionsSection(reflectionsText));
  }

  const full = sections.filter(Boolean).join('\n\n');
  const validation = validateReadingNarrative(full);
  if (!validation.isValid) {
    console.debug('Relationship narrative spine suggestions:', validation.suggestions || validation.sectionAnalyses);
  }

  if (reversalReminderEmbedded) {
    return full;
  }

  return appendReversalReminder(full, cardsInfo, themes);
}

function buildRelationshipElementalTakeaway(elemental, youCard, themCard) {
  if (!elemental || !elemental.relationship) {
    return '';
  }

  const youName = youCard?.card || 'your card';
  const themName = themCard?.card || 'their card';

  switch (elemental.relationship) {
    case 'supportive':
      return `Lean into this cooperative current by naming what ${youName} and ${themName} each need, then offer one concrete gesture that supports both.`;
    case 'tension':
      return `If friction flares between ${youName} and ${themName}, pause to acknowledge it aloud and agree on one boundary or adjustment that keeps the exchange balanced.`;
    case 'amplified':
      return `Because both cards amplify the same element, channel that intensity intentionally—co-create a ritual or conversation that directs this shared energy toward something constructive.`;
    default:
      return 'Stay curious about how each of you is showing up today and keep checking in so the energy stays responsive, not reactive.';
  }
}

function buildOccultFlavor(cardInfo) {
  if (!cardInfo || !isMajorArcana(cardInfo.number)) return '';

  const astro = getAstroForCard(cardInfo);
  const qabalah = getQabalahForCard(cardInfo);

  const bits = [];

  if (astro?.label) {
    const detail = astro.focus ? `, ${astro.focus}` : '';
    bits.push(`echoes ${astro.label}${detail}`);
  }

  if (qabalah?.label) {
    const detail = qabalah.focus ? `, ${qabalah.focus}` : '';
    bits.push(`touches ${qabalah.label}${detail}`);
  }

  if (!bits.length) return '';

  return ` On an occult level, this ${bits.join(', ')}—a symbolic backdrop rather than a fixed rule.`;
}

function buildReflectionPrompt(cardInfo, position) {
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

export function buildDecisionReading({
  cardsInfo,
  userQuestion,
  reflectionsText,
  themes,
  context
}) {
  const sections = [];
  const spreadName = 'Decision / Two-Path';

  sections.push(
    buildOpening(
      spreadName,
      userQuestion ||
        'This spread illuminates the heart of your decision, two possible paths, clarifying insight, and a reminder of your agency.',
      context
    )
  );

  const [heart, pathA, pathB, clarifier, freeWill] = Array.isArray(cardsInfo)
    ? cardsInfo
    : [];
  const options = getPositionOptions(themes, context);

  // THE CHOICE
  let choice = `**THE CHOICE**\n\n`;
  choice += buildPositionCardText(
    heart,
    heart.position || 'Heart of the decision',
    options
  );
  choice += '\n\nThis position stands at the center of your decision and points toward what truly matters as you weigh each path.';
  sections.push(
    enhanceSection(choice, {
      type: 'decision-core',
      cards: [heart]
    }).text
  );

  // PATH A
  let aSection = `**PATH A**\n\n`;
  const pathAPosition = pathA.position || 'Path A — energy & likely outcome';
  const pathAConnector = getConnector(pathAPosition, 'toPrev');
  const pathAText = buildPositionCardText(
    pathA,
    pathAPosition,
    options
  );
  aSection += pathAConnector ? `${pathAConnector} ${pathAText}` : pathAText;
  aSection += '\n\nThis path suggests one possible trajectory if you commit to this direction.';
  sections.push(
    enhanceSection(aSection, {
      type: 'decision-path',
      cards: [pathA]
    }).text
  );

  // PATH B
  let bSection = `**PATH B**\n\n`;
  const pathBPosition = pathB.position || 'Path B — energy & likely outcome';
  const pathBConnector = getConnector(pathBPosition, 'toPrev');
  const pathBText = buildPositionCardText(
    pathB,
    pathBPosition,
    options
  );
  bSection += pathBConnector ? `${pathBConnector} ${pathBText}` : pathBText;
  bSection += '\n\nThis path suggests an alternate trajectory, inviting you to compare how each route aligns with your values.';
  sections.push(
    enhanceSection(bSection, {
      type: 'decision-path',
      cards: [pathB]
    }).text
  );

  // CLARITY + AGENCY
  let clarity = `**CLARITY + AGENCY**\n\n`;

  if (clarifier) {
    const clarifierPosition = clarifier.position || 'What clarifies the best path';
    const clarifierConnector = getConnector(clarifierPosition, 'toPrev');
    const clarifierText = buildPositionCardText(
      clarifier,
      clarifierPosition,
      options
    );
    clarity += clarifierConnector ? `${clarifierConnector} ${clarifierText}` : clarifierText;
    clarity += '\n\n';
  }

  if (pathA && pathB) {
    const elemental = analyzeElementalDignity(pathA, pathB);
    if (elemental && elemental.description) {
      clarity += `Comparing the two paths: ${elemental.description}. `;
    }
  }

  if (freeWill) {
    const freeWillPosition = freeWill.position || 'What to remember about your free will';
    const freeWillConnector = getConnector(freeWillPosition, 'toPrev');
    const freeWillText = buildPositionCardText(
      freeWill,
      freeWillPosition,
      options
    );
    clarity += freeWillConnector ? `${freeWillConnector} ${freeWillText}` : freeWillText;
    clarity += '\n\n';
  }

  clarity +=
    'Use these insights to understand how each option feels in your body and life. The cards illuminate possibilities; you remain the one who chooses. Each route is a trajectory shaped by your next intentional steps.';

  sections.push(
    enhanceSection(clarity, {
      type: 'decision-clarity',
      cards: [clarifier, freeWill].filter(Boolean)
    }).text
  );

  if (reflectionsText && reflectionsText.trim()) {
    sections.push(buildReflectionsSection(reflectionsText));
  }

  const full = sections.filter(Boolean).join('\n\n');
  const validation = validateReadingNarrative(full);
  if (!validation.isValid) {
    console.debug('Decision narrative spine suggestions:', validation.suggestions || validation.sectionAnalyses);
  }

  return appendReversalReminder(full, cardsInfo, themes);
}

export function buildSingleCardReading({
  cardsInfo,
  userQuestion,
  reflectionsText,
  themes,
  context
}) {
  if (!Array.isArray(cardsInfo) || cardsInfo.length === 0 || !cardsInfo[0]) {
    return '**ONE-CARD INSIGHT**\n\nNo card data was provided. Please draw at least one card to receive a focused message.';
  }

  const card = cardsInfo[0];
  const options = getPositionOptions(themes, context);

  let narrative = `**ONE-CARD INSIGHT**\n\n`;

  if (userQuestion && userQuestion.trim()) {
    narrative += `Focusing on your question "${userQuestion.trim()}", this card offers a snapshot of guidance in this moment.\n\n`;
  } else {
    narrative += 'This single card offers a focused snapshot of the energy around you right now.\n\n';
  }

  const contextReminder = buildContextReminder(context);
  if (contextReminder) {
    narrative += `${contextReminder}\n\n`;
  }

  // Core section with WHAT → WHY → WHAT'S NEXT flavor
  const positionLabel = card.position || 'Theme / Guidance of the Moment';
  const baseText = buildPositionCardText(card, positionLabel, options);

  narrative += `${baseText}\n\n`;
  narrative +=
    "In simple terms: notice what this theme is asking you to acknowledge (WHAT), reflect on why it might be surfacing now (WHY), and choose one small, aligned next step that honors your agency (WHAT'S NEXT). Therefore, treat this insight as a living moment, not a fixed verdict—a trajectory you actively shape.";

  if (reflectionsText && reflectionsText.trim()) {
    narrative += `\n\n**Your Reflections**\n\n${reflectionsText.trim()}`;
  }

  const validation = validateReadingNarrative(narrative);
  if (!validation.isValid) {
    console.debug('Single-card narrative spine suggestions:', validation.suggestions || validation.sectionAnalyses);
  }

  return appendReversalReminder(narrative, cardsInfo, themes);
}

export function buildThreeCardReading({
  cardsInfo,
  userQuestion,
  reflectionsText,
  threeCardAnalysis,
  themes,
  context
}) {
  const sections = [];

  sections.push(buildOpening('Three-Card Story (Past · Present · Future)', userQuestion, context));

  const [past, present, future] = cardsInfo;
  const options = getPositionOptions(themes, context);

  let narrative = `**THE STORY**\n\n`;

  // Past card
  narrative += `${buildPositionCardText(past, past.position || 'Past — influences that led here', options)}\n\n`;

  // Present card with connector and elemental imagery
  const firstToSecond = threeCardAnalysis?.transitions?.firstToSecond;
  const presentConnector = getConnector('Present — where you stand now', 'toPrev');
  narrative += `${presentConnector} ${buildPositionCardText(present, present.position || 'Present — where you stand now', {
    ...options,
    prevElementalRelationship: firstToSecond
  })}\n\n`;

  // Future card with connector and elemental imagery
  const secondToThird = threeCardAnalysis?.transitions?.secondToThird;
  const futureConnector = getConnector('Future — trajectory if nothing shifts', 'toPrev');
  narrative += `${futureConnector} ${buildPositionCardText(future, future.position || 'Future — trajectory if nothing shifts', {
    ...options,
    prevElementalRelationship: secondToThird
  })}\n\n`;

  if (threeCardAnalysis && threeCardAnalysis.narrative) {
    narrative += threeCardAnalysis.narrative;
  }

  sections.push(narrative);

  if (reflectionsText && reflectionsText.trim()) {
    sections.push(buildReflectionsSection(reflectionsText));
  }

  sections.push(buildThreeCardSynthesis(cardsInfo, themes, userQuestion, context));

  const full = sections.filter(Boolean).join('\n\n');
  return appendReversalReminder(full, cardsInfo, themes);
}

function buildThreeCardSynthesis(cardsInfo, themes, userQuestion, context) {
  let section = `**GUIDANCE**\n\n`;

  if (context && context !== 'general') {
    section += `Focus: Interpreting the path ahead through ${getContextDescriptor(context)}.\n\n`;
  }

  if (themes.suitFocus) {
    section += `${themes.suitFocus}\n\n`;
  }

  // Timing profile (if available)
  if (themes.timingProfile === 'near-term-tilt') {
    section += `Pace: Signals here lean toward shifts in the nearer term, provided you participate with them.\n\n`;
  } else if (themes.timingProfile === 'longer-arc-tilt') {
    section += `Pace: This story speaks to a longer process that asks patience and steady engagement.\n\n`;
  } else if (themes.timingProfile === 'developing-arc') {
    section += `Pace: Expect this to unfold across a meaningful chapter rather than in a single moment.\n\n`;
  }

  const future = cardsInfo[2];
  section += `The path ahead shows ${future.card} ${future.orientation}.`;

  if ((future.orientation || '').toLowerCase() === 'reversed' && themes?.reversalDescription) {
    section += ` ${buildReversalGuidance(themes.reversalDescription)}`;
  }

  section += ` This is not fixed fate, but the trajectory of current momentum. Your awareness and choices shape what comes next.`;

  section += '\n\nAltogether, these threads suggest your next supportive step and point toward how to walk this path with agency.';

  return section;
}

/**
 * Build enhanced Claude Sonnet 4.5 prompt with position-relationship structure
 */
export function buildEnhancedClaudePrompt({
  spreadInfo,
  cardsInfo,
  userQuestion,
  reflectionsText,
  themes,
  spreadAnalysis,
  context
}) {
  const spreadKey = getSpreadKeyFromName(spreadInfo.name);
  const normalizedContext = normalizeContext(context);

  // Build spread-specific system prompt
  const systemPrompt = buildSystemPrompt(spreadKey, themes, normalizedContext);

  // Build structured user prompt
  const userPrompt = buildUserPrompt(
    spreadKey,
    cardsInfo,
    userQuestion,
    reflectionsText,
    themes,
    spreadAnalysis,
    normalizedContext
  );

  return { systemPrompt, userPrompt };
}

function getSpreadKeyFromName(name) {
  const map = {
    'Celtic Cross (Classic 10-Card)': 'celtic',
    'Three-Card Story (Past · Present · Future)': 'threeCard',
    'Five-Card Clarity': 'fiveCard',
    'One-Card Insight': 'single',
    'Relationship Snapshot': 'relationship',
    'Decision / Two-Path': 'decision'
  };
  return map[name] || 'general';
}

function buildSystemPrompt(spreadKey, themes, context) {
  const lines = [
    'You are an agency-forward professional tarot storyteller.',
    '',
    'NARRATIVE GUIDELINES:',
    '- Story spine every section (WHAT → WHY → WHAT\'S NEXT) using connectors like "Because...", "Therefore...", "However...".',
    '- Cite card names, positions, and elemental dignities; add concise sensory imagery (especially for Major Arcana) to illustrate meaning.',
    '- You may weave in standard astrological or Qabalah correspondences as gentle color only when they naturally support the card\'s core Rider–Waite–Smith meaning.',
    `- Honor the ${themes.reversalDescription.name} reversal lens and Minor suit/rank rules; never invent cards or outcomes.`,
    '- Keep the tone trauma-informed, empowering, and non-deterministic.',
    '- Do NOT provide medical, mental health, legal, financial, or abuse-safety directives; when such topics arise, gently encourage seeking qualified professional support.',
    '- Make clear that outcome and timing cards describe likely trajectories based on current patterns, not fixed fate or guarantees.',
    '- Deliver 5-7 flowing paragraphs separated by blank lines.',
    '- DEPTH: Go beyond surface themes—explore nuanced dynamics, specific examples, and actionable micro-steps.',
    '- VARIETY: Vary your language when revisiting themes; use fresh metaphors and angles rather than repeating the same phrasing.',
    '- CONCRETENESS: Include at least 2-3 specific, practical next steps the querent can take immediately.'
  ];

  if (spreadKey === 'celtic') {
    lines.push(
      '',
      'CELTIC CROSS FLOW: Nucleus (1-2) → Timeline (3-1-4) → Consciousness (6-1-5) → Staff (7-10) → Cross-checks → Synthesis. Bridge each segment with the connectors above.'
    );
  } else if (spreadKey === 'threeCard') {
    lines.push(
      '',
      'THREE-CARD FLOW: Past → Present → Future. Show how each card leads to the next and note elemental support or tension along the way.'
    );
  } else if (spreadKey === 'relationship') {
    lines.push(
      '',
      'RELATIONSHIP FLOW: Explore the interplay between "You" and "Them" cards—what patterns emerge when these energies meet? How does the Connection card provide a shared path forward? Include specific communication strategies, boundary-setting examples, and 2-3 concrete relational practices.'
    );
  }

  lines.push(
    '',
    `REVERSAL LENS: ${themes.reversalDescription.name} — ${themes.reversalDescription.description} (${themes.reversalDescription.guidance})`,
    'ETHICS: Emphasize choice, agency, and trajectory language; forbid deterministic guarantees or fatalism.',
    'ETHICS: Do NOT provide diagnosis or treatment, or directives about medical, mental health, legal, financial, or abuse-safety matters; instead, when those themes surface, gently suggest consulting qualified professionals or trusted support resources.'
  );

  if (context && context !== 'general') {
    lines.push(
      '',
      `CONTEXT LENS: Frame insights through ${getContextDescriptor(context)} so guidance stays relevant to that arena.`
    );
  }

  return lines.join('\n');
}

function buildUserPrompt(spreadKey, cardsInfo, userQuestion, reflectionsText, themes, spreadAnalysis, context) {
  let prompt = ``;

  // Question
  prompt += `**Question**: ${userQuestion || '(No explicit question; speak to the energy most present for the querent.)'}\n\n`;

  // Thematic context
  const thematicLines = [];
  if (context && context !== 'general') {
    thematicLines.push(`- Context lens: Focus the narrative through ${getContextDescriptor(context)}`);
  }
  if (themes.suitFocus) thematicLines.push(`- ${themes.suitFocus}`);
  if (themes.archetypeDescription) thematicLines.push(`- ${themes.archetypeDescription}`);
  if (themes.elementalBalance) thematicLines.push(`- ${themes.elementalBalance}`);
  thematicLines.push(`- Reversal framework: ${themes.reversalDescription.name}`);
  prompt += `**Thematic Context**:\n${thematicLines.join('\n')}\n\n`;

  // Spread-specific card presentation
  if (spreadKey === 'celtic' && spreadAnalysis) {
    prompt += buildCelticCrossPromptCards(cardsInfo, spreadAnalysis, themes, context);
  } else if (spreadKey === 'threeCard' && spreadAnalysis) {
    prompt += buildThreeCardPromptCards(cardsInfo, spreadAnalysis, themes, context);
  } else if (spreadKey === 'fiveCard' && spreadAnalysis) {
    prompt += buildFiveCardPromptCards(cardsInfo, spreadAnalysis, themes, context);
  } else if (spreadKey === 'relationship') {
    prompt += buildRelationshipPromptCards(cardsInfo, themes, context);
  } else if (spreadKey === 'decision') {
    prompt += buildDecisionPromptCards(cardsInfo, themes, context);
  } else if (spreadKey === 'single') {
    prompt += buildSingleCardPrompt(cardsInfo, themes, context);
  } else {
    prompt += buildStandardPromptCards(cardsInfo, themes, context);
  }

  // Reflections
  if (reflectionsText && reflectionsText.trim()) {
    prompt += `\n**Querent's Reflections**:\n${reflectionsText.trim()}\n\n`;
  }

  // Instructions
  prompt += `\nProvide a cohesive, flowing narrative (no bullet lists) that:
- References specific cards and positions
- Integrates the thematic and elemental insights above
- Offers practical, grounded, empowering guidance
- Reminds the querent of their agency and free will
Apply Minor Arcana interpretation rules to all non-Major cards.`;

  prompt += `\n\nRemember ethical constraints: emphasize agency, avoid guarantees, no medical/legal directives.`;

  return prompt;
}

function buildCelticCrossPromptCards(cardsInfo, analysis, themes, context) {
  const options = getPositionOptions(themes, context);

  let cards = `**NUCLEUS** (Heart of the Matter):\n`;
  cards += buildCardWithImagery(cardsInfo[0], cardsInfo[0].position || 'Present — core situation (Card 1)', options);
  cards += buildCardWithImagery(cardsInfo[1], cardsInfo[1].position || 'Challenge — crossing / tension (Card 2)', options);
  cards += `Relationship insight: ${analysis.nucleus.synthesis}\n`;
  cards += getElementalImageryText(analysis.nucleus.elementalDynamic) + '\n\n';

  cards += `**TIMELINE**:\n`;
  cards += buildCardWithImagery(cardsInfo[2], cardsInfo[2].position || 'Past — what lies behind (Card 3)', options);

  const presentPosition = cardsInfo[0].position || 'Present — core situation (Card 1)';
  cards += buildCardWithImagery(
    cardsInfo[0],
    presentPosition,
    {
      ...options,
      prevElementalRelationship: analysis.timeline.pastToPresent
    },
    getConnector(presentPosition, 'toPrev')
  );

  const futurePosition = cardsInfo[3].position || 'Near Future — what lies before (Card 4)';
  cards += buildCardWithImagery(
    cardsInfo[3],
    futurePosition,
    {
      ...options,
      prevElementalRelationship: analysis.timeline.presentToFuture
    },
    getConnector(futurePosition, 'toPrev')
  );
  cards += `Flow insight: ${analysis.timeline.causality}\n`;
  cards += getElementalImageryText(analysis.timeline.pastToPresent) + '\n';
  cards += getElementalImageryText(analysis.timeline.presentToFuture) + '\n\n';

  cards += `**CONSCIOUSNESS**:\n`;
  cards += buildCardWithImagery(cardsInfo[5], cardsInfo[5].position || 'Subconscious — roots / hidden forces (Card 6)', options);
  cards += buildCardWithImagery(cardsInfo[4], cardsInfo[4].position || 'Conscious — goals & focus (Card 5)', options);
  cards += `Alignment insight: ${analysis.consciousness.synthesis}\n`;
  cards += getElementalImageryText(analysis.consciousness.elementalRelationship) + '\n\n';

  cards += `**STAFF** (Context & Outcome):\n`;
  cards += buildCardWithImagery(cardsInfo[6], cardsInfo[6].position || 'Self / Advice — how to meet this (Card 7)', options);
  cards += buildCardWithImagery(cardsInfo[7], cardsInfo[7].position || 'External Influences — people & environment (Card 8)', options);
  cards += buildCardWithImagery(cardsInfo[8], cardsInfo[8].position || 'Hopes & Fears — deepest wishes & worries (Card 9)', options);
  cards += buildCardWithImagery(cardsInfo[9], cardsInfo[9].position || 'Outcome — likely path if unchanged (Card 10)', options);
  cards += `Advice-to-outcome insight: ${analysis.staff.adviceImpact}\n`;
  cards += getElementalImageryText(analysis.staff.adviceToOutcome) + '\n\n';

  cards += `**KEY CROSS-CHECKS**:\n`;
  cards += buildPromptCrossChecks(analysis.crossChecks, themes);

  return cards;
}

function buildThreeCardPromptCards(cardsInfo, analysis, themes, context) {
  const options = getPositionOptions(themes, context);
  const [past, present, future] = cardsInfo;

  let cards = `**THREE-CARD STORY STRUCTURE**\n`;
  cards += `- Past foundation\n- Present dynamics\n- Future trajectory if nothing shifts\n\n`;

  cards += buildCardWithImagery(
    past,
    past.position || 'Past — influences that led here',
    options
  );

  const presentPosition = present.position || 'Present — where you stand now';
  cards += buildCardWithImagery(
    present,
    presentPosition,
    {
      ...options,
      prevElementalRelationship: analysis?.transitions?.firstToSecond
    },
    getConnector(presentPosition, 'toPrev')
  );

  const futurePosition = future.position || 'Future — trajectory if nothing shifts';
  cards += buildCardWithImagery(
    future,
    futurePosition,
    {
      ...options,
      prevElementalRelationship: analysis?.transitions?.secondToThird
    },
    getConnector(futurePosition, 'toPrev')
  );

  if (analysis?.narrative) {
    cards += `\n${analysis.narrative.trim()}\n`;
  }

  cards += '\nThis future position points toward the most likely trajectory if nothing shifts, inviting you to adjust your path with intention.';

  return cards;
}

/**
 * Build card text with imagery hook for prompts
 */
function buildCardWithImagery(cardInfo, position, options, prefix = '') {
  const base = buildPositionCardText(cardInfo, position, options);
  const lead = prefix ? `${prefix} ${base}` : base;
  let text = `${lead}\n`;

  // Add imagery hook if Major Arcana
  if (isMajorArcana(cardInfo.number)) {
    const hook = getImageryHook(cardInfo.number, cardInfo.orientation);
    if (hook) {
      text += `*Imagery: ${hook.visual}*\n`;
      text += `*Sensory: ${hook.sensory}*\n`;
    }
  }

  return text;
}

/**
 * Get elemental imagery text for prompts
 */
function getElementalImageryText(elementalRelationship) {
  if (!elementalRelationship || !elementalRelationship.elements) {
    return '';
  }

  const [e1, e2] = elementalRelationship.elements;
  const imagery = getElementalImagery(e1, e2);

  if (imagery && imagery.imagery) {
    return `*Elemental imagery: ${imagery.imagery}*`;
  }

  return '';
}

function buildFiveCardPromptCards(cardsInfo, fiveCardAnalysis, themes, context) {
  const options = getPositionOptions(themes, context);
  const [core, challenge, hidden, support, direction] = cardsInfo;

  let out = `**FIVE-CARD CLARITY STRUCTURE**\n`;
  out += `- Core of the matter\n- Challenge or tension\n- Hidden / subconscious influence\n- Support / helpful energy\n- Likely direction on current path\n\n`;

  out += buildCardWithImagery(core, core.position || 'Core of the matter', options);
  out += buildCardWithImagery(challenge, challenge.position || 'Challenge or tension', {
    ...options,
    prevElementalRelationship: fiveCardAnalysis?.coreVsChallenge
  });
  out += buildCardWithImagery(hidden, hidden.position || 'Hidden / subconscious influence', options);
  out += buildCardWithImagery(support, support.position || 'Support / helpful energy', options);
  out += buildCardWithImagery(direction, direction.position || 'Likely direction on current path', {
    ...options,
    prevElementalRelationship: fiveCardAnalysis?.supportVsDirection
  });

  return out;
}

function buildRelationshipPromptCards(cardsInfo, themes, context) {
  const options = getPositionOptions(themes, context);
  const [youCard, themCard, connectionCard, dynamicsCard, outcomeCard] = cardsInfo;

  let out = `**RELATIONSHIP SNAPSHOT STRUCTURE**\n`;
  out += `- You / your energy\n- Them / their energy\n- The connection / shared lesson\n- Dynamics / guidance\n- Outcome / what this can become\n\n`;

  if (youCard) {
    out += buildCardWithImagery(youCard, youCard.position || 'You / your energy', options);
  }
  if (themCard) {
    out += buildCardWithImagery(themCard, themCard.position || 'Them / their energy', options);
  }
  if (connectionCard) {
    out += buildCardWithImagery(
      connectionCard,
      connectionCard.position || 'The connection / shared lesson',
      options
    );
  }
  if (dynamicsCard) {
    out += buildCardWithImagery(
      dynamicsCard,
      dynamicsCard.position || 'Dynamics / guidance',
      options
    );
  }
  if (outcomeCard) {
    out += buildCardWithImagery(
      outcomeCard,
      outcomeCard.position || 'Outcome / what this can become',
      options
    );
  }

  return out;
}

function buildDecisionPromptCards(cardsInfo, themes, context) {
  const options = getPositionOptions(themes, context);
  const [heart, pathA, pathB, clarifier, freeWill] = cardsInfo;

  let out = `**DECISION / TWO-PATH STRUCTURE**\n`;
  out += `- Heart of the decision\n- Path A — energy & likely outcome\n- Path B — energy & likely outcome\n- What clarifies the best path\n- What to remember about your free will\n\n`;

  if (heart) {
    out += buildCardWithImagery(
      heart,
      heart.position || 'Heart of the decision',
      options
    );
  }
  if (pathA) {
    out += buildCardWithImagery(
      pathA,
      pathA.position || 'Path A — energy & likely outcome',
      options
    );
  }
  if (pathB) {
    out += buildCardWithImagery(
      pathB,
      pathB.position || 'Path B — energy & likely outcome',
      options
    );
  }
  if (clarifier) {
    out += buildCardWithImagery(
      clarifier,
      clarifier.position || 'What clarifies the best path',
      options
    );
  }
  if (freeWill) {
    out += buildCardWithImagery(
      freeWill,
      freeWill.position || 'What to remember about your free will',
      options
    );
  }

  return out;
}

function buildSingleCardPrompt(cardsInfo, themes, context) {
  const options = getPositionOptions(themes, context);
  const card = cardsInfo[0];
  if (!card) return '';

  let out = `**ONE-CARD INSIGHT STRUCTURE**\n`;
  out += `- Theme / Guidance of the Moment\n\n`;
  out += buildCardWithImagery(
    card,
    card.position || 'Theme / Guidance of the Moment',
    options
  );
  return out;
}

function buildStandardPromptCards(cardsInfo, themes, context) {
  const options = getPositionOptions(themes, context);

  return cardsInfo
    .map((card, idx) => {
      const position = card.position || `Card ${idx + 1}`;
      return buildCardWithImagery(card, position, options);
    })
    .join('\n') + '\n';
}

function buildPromptCrossChecks(crossChecks, themes) {
  const entries = [
    ['Goal vs Outcome', crossChecks.goalVsOutcome],
    ['Advice vs Outcome', crossChecks.adviceVsOutcome],
    ['Near Future vs Outcome', crossChecks.nearFutureVsOutcome],
    ['Subconscious vs Hopes/Fears', crossChecks.subconsciousVsHopesFears]
  ];

  return entries
    .map(([label, value]) => {
      if (!value) {
        return `- ${label}: No comparative insight available.`;
      }

      const shortenMeaning = meaning => {
        if (!meaning || typeof meaning !== 'string') return '';
        const firstClause = meaning.split(/[.!?]/)[0].trim();
        if (!firstClause) return '';
        return firstClause.length > 90 ? `${firstClause.slice(0, 87)}...` : firstClause;
      };

      const summarizePosition = position => {
        if (!position) return null;
        const base = `${position.name}: ${position.card} ${position.orientation}`.trim();
        const snippet = shortenMeaning(position.meaning);
        return snippet ? `${base} — ${snippet}` : base;
      };

      const reversalNotes = [
        getCrossCheckReversalNote(value.position1, themes),
        getCrossCheckReversalNote(value.position2, themes)
      ].filter(Boolean);

      const details = [];
      if (value.elementalRelationship?.relationship === 'tension') {
        details.push('⚠️ Elemental tension present.');
      } else if (value.elementalRelationship?.relationship === 'supportive') {
        details.push('✓ Elemental harmony present.');
      } else if (value.elementalRelationship?.relationship === 'amplified') {
        details.push('Elemental energies amplified.');
      }

      if (reversalNotes.length > 0) {
        details.push(reversalNotes.join(' '));
      }

      // Surface position summaries for clarity
      const positionsText = [summarizePosition(value.position1), summarizePosition(value.position2)]
        .filter(Boolean)
        .join(' | ');

      const parts = [`- ${label}: ${value.synthesis.trim()}`];
      if (positionsText) {
        parts.push(`(Positions: ${positionsText})`);
      }
      if (details.length > 0) {
        parts.push(details.join(' '));
      }

      return parts.join(' ');
    })
    .join('\n');
}

function formatMeaning(meaning) {
  const sentence = meaning.includes('.') ? meaning.split('.')[0] : meaning;
  const lowerCased = sentence.trim();
  if (!lowerCased) {
    return 'fresh perspectives that are still unfolding';
  }
  return lowerCased.charAt(0).toLowerCase() + lowerCased.slice(1);
}
