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
    intro: (card, orientation) =>
      `At the heart of this moment stands ${card} ${orientation}.`,
    frame: 'This card represents your current situation, the central energy at play, and the atmosphere surrounding the matter.',
    useImagery: true
  },

  'Challenge — crossing / tension (Card 2)': {
    intro: (card, orientation) =>
      `Crossing this, the challenge manifests as ${card} ${orientation}.`,
    frame: 'Even if this card appears positive, it represents the obstacle, tension, or dynamic force you must integrate or overcome to move forward.',
    connectorToPrev: 'However,',
    useImagery: true
  },

  'Past — what lies behind (Card 3)': {
    intro: (card, orientation) =>
      `Looking to what lies behind, the past shows ${card} ${orientation}.`,
    frame: 'This card reveals the events, influences, and patterns that have led to the present situation.',
    connectorToNext: 'Because of this,',
    useImagery: true
  },

  'Near Future — what lies before (Card 4)': {
    intro: (card, orientation) =>
      `What lies ahead in the near future: ${card} ${orientation}.`,
    frame: 'This indicates developments likely to occur in the coming weeks or months—not the final outcome, but the next chapter unfolding.',
    connectorToPrev: 'Therefore,',
    useImagery: true
  },

  'Conscious — goals & focus (Card 5)': {
    intro: (card, orientation) =>
      `Your conscious goal, what you aspire toward: ${card} ${orientation}.`,
    frame: 'This card reflects what you are actively focusing on, your known intentions, and the outcome you hope to achieve. For Majors, this often points to soul-level aspirations; for Minors, read how practical efforts and day-to-day choices echo those higher aims.',
    useImagery: true
  },

  'Subconscious — roots / hidden forces (Card 6)': {
    intro: (card, orientation) =>
      `Hidden beneath awareness, in the subconscious realm: ${card} ${orientation}.`,
    frame: 'This reveals deeper feelings, underlying drives, fears, or foundations that shape the situation from below the surface.',
    connectorToNext: 'Yet beneath the surface,',
    useImagery: true
  },

  'Self / Advice — how to meet this (Card 7)': {
    intro: (card, orientation) =>
      `Guidance on how to meet this situation comes through ${card} ${orientation}.`,
    frame: 'This card offers advice: the stance to take, resources to draw upon, or actions aligned with your highest good.',
    connectorToPrev: 'To navigate this landscape,',
    useImagery: true
  },

  'External Influences — people & environment (Card 8)': {
    intro: (card, orientation) =>
      `External influences, people and forces beyond your control: ${card} ${orientation}.`,
    frame: 'This shows the environment, other people, or circumstances affecting the outcome that you must work with or around.',
    connectorToPrev: 'Meanwhile, in the external world,',
    useImagery: true
  },

  'Hopes & Fears — deepest wishes & worries (Card 9)': {
    intro: (card, orientation) =>
      `Your hopes and fears intertwine in ${card} ${orientation}.`,
    frame: 'This card is often complex—what you hope for and what you fear can be two sides of the same coin, revealing deep desires and anxieties.',
    connectorToPrev: 'Emotionally,',
    useImagery: true
  },

  'Outcome — likely path if unchanged (Card 10)': {
    intro: (card, orientation) =>
      `The likely outcome, if the current path continues: ${card} ${orientation}.`,
    frame: 'This shows where the situation is heading based on present dynamics. Remember: your choices shape this path, and free will allows for change.',
    connectorToPrev: 'All of this converges toward',
    useImagery: true
  },

  // Three-Card positions
  'Past — influences that led here': {
    intro: (card, orientation) =>
      `The past, showing what has led to this moment: ${card} ${orientation}.`,
    frame: 'This card represents the foundation, the causes, and the influences that set the stage for where you stand now.',
    connectorToNext: 'Because of this foundation,',
    useImagery: true
  },

  'Present — where you stand now': {
    intro: (card, orientation) =>
      `The present moment, where you stand right now: ${card} ${orientation}.`,
    frame: 'This is the current energy, the active dynamic, and the immediate situation you are navigating.',
    connectorToPrev: 'And so,',
    connectorToNext: 'This sets the stage for',
    useImagery: true
  },

  'Future — trajectory if nothing shifts': {
    intro: (card, orientation) =>
      `The future, the trajectory ahead: ${card} ${orientation}.`,
    frame: 'This shows where things are heading if you maintain your current course, with the power to shift through conscious choice.',
    connectorToPrev: 'Therefore,',
    useImagery: true
  },

  // Five-Card positions
  'Core of the matter': {
    intro: (card, orientation) =>
      `At the core of the matter: ${card} ${orientation}.`,
    frame: 'This is the central issue, the heart of what you are exploring.',
    useImagery: true
  },

  'Challenge or tension': {
    intro: (card, orientation) =>
      `The challenge or tension: ${card} ${orientation}.`,
    frame: 'This represents the obstacle, the friction point, or the dynamic that must be worked with.',
    connectorToPrev: 'However,',
    useImagery: true
  },

  'Hidden / subconscious influence': {
    intro: (card, orientation) =>
      `Hidden from view, the subconscious influence: ${card} ${orientation}.`,
    frame: 'This card reveals what is operating beneath awareness, unseen forces or unacknowledged feelings.',
    connectorToPrev: 'Beneath the surface,',
    useImagery: true
  },

  'Support / helpful energy': {
    intro: (card, orientation) =>
      `Support and helpful energy come through: ${card} ${orientation}.`,
    frame: 'This is what aids you, what you can lean on, and where strength or assistance can be found.',
    connectorToPrev: 'Fortunately,',
    connectorToNext: 'Drawing on this support,',
    useImagery: true
  },

  'Likely direction on current path': {
    intro: (card, orientation) =>
      `The likely direction, if you continue as you are: ${card} ${orientation}.`,
    frame: 'This shows the trajectory ahead based on current momentum.',
    connectorToPrev: 'All of this points toward',
    useImagery: true
  },

  // Single card
  'Theme / Guidance of the Moment': {
    intro: (card, orientation) =>
      `The card speaks: ${card} ${orientation}.`,
    frame: 'This single card captures the essential energy, message, or guidance for this moment.',
    useImagery: true
  },

  // Relationship spread positions
  'You / your energy': {
    intro: (card, orientation) =>
      `Your energy in this dynamic: ${card} ${orientation}.`,
    frame: 'This card shows how you are showing up, your emotional state, and what you bring to the connection.',
    connectorToNext: 'While you bring this,',
    useImagery: true
  },

  'Them / their energy': {
    intro: (card, orientation) =>
      `Their energy in this dynamic: ${card} ${orientation}.`,
    frame: 'This reflects how they are showing up, their perspective, and what they bring to the connection.',
    connectorToPrev: 'In response,',
    connectorToNext: 'Together, these energies create',
    useImagery: true
  },

  'The connection / shared lesson': {
    intro: (card, orientation) =>
      `The connection itself, the shared lesson: ${card} ${orientation}.`,
    frame: 'This card speaks to the relationship as its own entity, what it teaches, and the dynamic between you.',
    connectorToPrev: 'Therefore,',
    useImagery: true
  },

  // Decision spread positions
  'Heart of the decision': {
    intro: (card, orientation) =>
      `At the heart of this decision: ${card} ${orientation}.`,
    frame: 'This card reveals what this choice is truly about at its core.',
    connectorToNext: 'With this understanding,',
    useImagery: true
  },

  'Path A — energy & likely outcome': {
    intro: (card, orientation) =>
      `Path A, its energy and likely outcome: ${card} ${orientation}.`,
    frame: 'This shows the character, challenges, and probable results of choosing this path.',
    connectorToPrev: 'Looking at one option,',
    useImagery: true
  },

  'Path B — energy & likely outcome': {
    intro: (card, orientation) =>
      `Path B, its energy and likely outcome: ${card} ${orientation}.`,
    frame: 'This shows the character, challenges, and probable results of choosing this path.',
    connectorToPrev: 'Alternatively,',
    useImagery: true
  },

  'What clarifies the best path': {
    intro: (card, orientation) =>
      `What clarifies the best path forward: ${card} ${orientation}.`,
    frame: 'This card offers perspective or insight to help you discern which direction serves your highest good.',
    connectorToPrev: 'To choose wisely,',
    useImagery: true
  },

  'What to remember about your free will': {
    intro: (card, orientation) =>
      `Remember about your free will and agency: ${card} ${orientation}.`,
    frame: 'This card reminds you of your power to choose, the nature of your autonomy, and how to honor your own path.',
    connectorToPrev: 'Most importantly,',
    useImagery: true
  }
};

/**
 * Build a position-aware card description with optional imagery hooks
 */
export function buildPositionCardText(cardInfo, position, options = {}) {
  const template = POSITION_LANGUAGE[position];
  const reversalDescription = options.reversalDescription;
  const isReversed = (cardInfo.orientation || '').toLowerCase() === 'reversed';
  const withConnectors = options.withConnectors !== false; // Default true
  const prevElementalRelationship = options.prevElementalRelationship; // For elemental imagery

  const appendReversalGuidance = reversalDescription && isReversed
    ? ` ${buildReversalGuidance(reversalDescription)}`
    : '';

  if (!template) {
    // Fallback for unknown positions (defensive defaults)
    const safeCard = cardInfo.card || 'this card';
    const safeOrientation =
      typeof cardInfo.orientation === 'string' && cardInfo.orientation.trim()
        ? ` ${cardInfo.orientation}`
        : '';
    const meaning = formatMeaningForPosition(cardInfo.meaning || '', position);
    return `${position}: ${safeCard}${safeOrientation}. ${meaning}${appendReversalGuidance}`;
  }

  const safeCard = cardInfo.card || 'this card';
  const safeOrientation =
    typeof cardInfo.orientation === 'string' && cardInfo.orientation.trim()
      ? cardInfo.orientation
      : '';
  const intro = template.intro(safeCard, safeOrientation);
  const meaning = formatMeaningForPosition(cardInfo.meaning || '', position);

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

  const safeFrame = template.frame || '';
  const safeElemental = elementalImagery || '';
  const safeReversal = appendReversalGuidance || '';
  return `${intro} ${meaning}${imagery}${minorContextText} ${safeFrame}${safeElemental}${safeReversal}`;
}

function buildReversalGuidance(reversalDescription) {
  return `Within the ${reversalDescription.name} lens, ${reversalDescription.guidance}`;
}

function getPositionOptions(themes) {
  if (!themes || !themes.reversalDescription) {
    return {};
  }
  return { reversalDescription: themes.reversalDescription };
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
  // Extract first clause of meaning
  const firstClause = meaning.includes('.') ? meaning.split('.')[0] : meaning;

  // Adjust language based on position type
  if (position.includes('Challenge') || position.includes('tension')) {
    return `The obstacle here involves ${firstClause.toLowerCase()}.`;
  }

  if (position.includes('Advice') || position.includes('how to meet')) {
    return `The guidance is to embrace ${firstClause.toLowerCase()}.`;
  }

  if (position.includes('Outcome') || position.includes('direction') || position.includes('Future')) {
    return `This points toward ${firstClause.toLowerCase()}.`;
  }

  if (position.includes('Subconscious') || position.includes('Hidden') || position.includes('Below')) {
    return `Beneath awareness lies ${firstClause.toLowerCase()}.`;
  }

  if (position.includes('External')) {
    return `Outside forces bring ${firstClause.toLowerCase()}.`;
  }

  // Default
  return `Here we see ${firstClause.toLowerCase()}.`;
}

/**
 * Build Celtic Cross reading using position-relationship analysis
 */
export function buildCelticCrossReading({
  cardsInfo,
  userQuestion,
  reflectionsText,
  celticAnalysis,
  themes
}) {
  const sections = [];

  // Opening
  sections.push(buildOpening('Celtic Cross (Classic 10-Card)', userQuestion));

  // 1. NUCLEUS - The Heart of the Matter (Cards 1-2)
  sections.push(
    enhanceSection(
      buildNucleusSection(celticAnalysis.nucleus, cardsInfo, themes),
      { type: 'nucleus', cards: [cardsInfo[0], cardsInfo[1]], relationships: { elementalRelationship: celticAnalysis.nucleus.elementalDynamic } }
    ).text
  );

  // 2. TIMELINE - Past, Present, Future (Cards 3-1-4)
  sections.push(
    enhanceSection(
      buildTimelineSection(celticAnalysis.timeline, cardsInfo, themes),
      { type: 'timeline' }
    ).text
  );

  // 3. CONSCIOUSNESS - Subconscious, Center, Conscious (Cards 6-1-5)
  sections.push(
    enhanceSection(
      buildConsciousnessSection(celticAnalysis.consciousness, cardsInfo, themes),
      { type: 'consciousness' }
    ).text
  );

  // 4. STAFF - Self, External, Hopes/Fears, Outcome (Cards 7-10)
  sections.push(
    enhanceSection(
      buildStaffSection(celticAnalysis.staff, cardsInfo, themes),
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
      buildSynthesisSection(cardsInfo, themes, celticAnalysis, userQuestion),
      { type: 'outcome' }
    ).text
  );

  // Final validation log (non-blocking)
  const validation = validateReadingNarrative(sections.join('\n\n'));
  if (!validation.isValid) {
    console.debug('Celtic Cross narrative spine suggestions:', validation.suggestions || validation.sectionAnalyses);
  }

  return sections.filter(Boolean).join('\n\n');
}

function buildOpening(spreadName, userQuestion) {
  if (userQuestion && userQuestion.trim()) {
    return `Focusing on the ${spreadName}, I attune to your question: "${userQuestion.trim()}"\n\nThe cards respond with insight that honors both seen and unseen influences.`;
  }
  return `Focusing on the ${spreadName}, the cards speak to the energy most present for you right now.`;
}

function buildNucleusSection(nucleus, cardsInfo, themes) {
  const present = cardsInfo[0];
  const challenge = cardsInfo[1];

  let section = `**THE HEART OF THE MATTER** (Nucleus)\n\n`;

  const presentPosition = present.position || 'Present — core situation (Card 1)';
  const challengePosition = challenge.position || 'Challenge — crossing / tension (Card 2)';

  section += `${buildPositionCardText(present, presentPosition, getPositionOptions(themes))}\n\n`;
  section += `${buildPositionCardText(challenge, challengePosition, getPositionOptions(themes))}\n\n`;

  section += nucleus.synthesis;

  return section;
}

function buildTimelineSection(timeline, cardsInfo, themes) {
  const past = cardsInfo[2];
  const present = cardsInfo[0];
  const future = cardsInfo[3];

  let section = `**THE TIMELINE** (Horizontal Axis)\n\n`;

  const options = getPositionOptions(themes);

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
    return template.connectorToPrev;
  }

  if (direction === 'toNext' && template.connectorToNext) {
    return template.connectorToNext;
  }

  return '';
}

function buildConsciousnessSection(consciousness, cardsInfo, themes) {
  const subconscious = cardsInfo[5];
  const conscious = cardsInfo[4];

  let section = `**CONSCIOUSNESS FLOW** (Vertical Axis)\n\n`;

  section += `${buildPositionCardText(subconscious, subconscious.position || 'Subconscious — roots / hidden forces (Card 6)', getPositionOptions(themes))}\n\n`;
  section += `${buildPositionCardText(conscious, conscious.position || 'Conscious — goals & focus (Card 5)', getPositionOptions(themes))}\n\n`;

  section += consciousness.synthesis;

  if (consciousness.alignment === 'conflicted') {
    section += `\n\n*This misalignment suggests inner work is needed to bring your depths and aspirations into harmony.*`;
  } else if (consciousness.alignment === 'aligned') {
    section += `\n\n*This alignment is a source of power—your whole being is moving in one direction.*`;
  }

  return section;
}

function buildStaffSection(staff, cardsInfo, themes) {
  const self = cardsInfo[6];
  const external = cardsInfo[7];
  const hopesFears = cardsInfo[8];
  const outcome = cardsInfo[9];

  let section = `**THE STAFF** (Context & Trajectory)\n\n`;

  section += `${buildPositionCardText(self, self.position || 'Self / Advice — how to meet this (Card 7)', getPositionOptions(themes))}\n\n`;
  section += `${buildPositionCardText(external, external.position || 'External Influences — people & environment (Card 8)', getPositionOptions(themes))}\n\n`;
  section += `${buildPositionCardText(hopesFears, hopesFears.position || 'Hopes & Fears — deepest wishes & worries (Card 9)', getPositionOptions(themes))}\n\n`;
  section += `${buildPositionCardText(outcome, outcome.position || 'Outcome — likely path if unchanged (Card 10)', getPositionOptions(themes))}\n\n`;

  section += staff.adviceImpact;

  return section;
}

function buildCrossChecksSection(crossChecks, themes) {
  let section = `**KEY RELATIONSHIPS**\n\n`;

  section += formatCrossCheck('Conscious Goal vs Outcome', crossChecks.goalVsOutcome, themes);
  section += `\n\n${formatCrossCheck('Advice vs Outcome', crossChecks.adviceVsOutcome, themes)}`;
  section += `\n\n${formatCrossCheck('Near Future vs Outcome', crossChecks.nearFutureVsOutcome, themes)}`;
  section += `\n\n${formatCrossCheck('Subconscious vs Hopes & Fears', crossChecks.subconsciousVsHopesFears, themes)}`;

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
  return `**YOUR REFLECTIONS**\n\n${reflectionsText.trim()}\n\nYour intuitive impressions are valid and add personal meaning to this reading.`;
}

function buildSynthesisSection(cardsInfo, themes, celticAnalysis, userQuestion) {
  let section = `**SYNTHESIS & GUIDANCE**\n\n`;

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

  const options = getPositionOptions(themes);
  const advice = cardsInfo[6];
  const outcome = cardsInfo[9];

  section += `**Your next step**\n${buildPositionCardText(advice, advice.position || 'Self / Advice — how to meet this (Card 7)', options)}\n`;
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
  themes
}) {
  const sections = [];
  const spreadName = 'Five-Card Clarity';

  // Opening
  sections.push(
    buildOpening(
      spreadName,
      userQuestion ||
        'This spread clarifies the core issue, the challenge, hidden influences, support, and where things are heading if nothing shifts.'
    )
  );

  if (!Array.isArray(cardsInfo) || cardsInfo.length < 5) {
    return 'This five-card spread is incomplete; please redraw or ensure all five cards are present.';
  }

  const [core, challenge, hidden, support, direction] = cardsInfo;
  const positionOptions = getPositionOptions(themes);

  // Core + Challenge section
  let coreSection = `**FIVE-CARD CLARITY — CORE & CHALLENGE**\n\n`;
  coreSection += buildPositionCardText(
    core,
    core.position || 'Core of the matter',
    positionOptions
  );
  coreSection += '\n\n';
  coreSection += buildPositionCardText(
    challenge,
    challenge.position || 'Challenge or tension',
    {
      ...positionOptions,
      prevElementalRelationship: fiveCardAnalysis?.coreVsChallenge
    }
  );

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
  hiddenSection += buildPositionCardText(
    hidden,
    hidden.position || 'Hidden / subconscious influence',
    positionOptions
  );
  sections.push(enhanceSection(hiddenSection, {
    type: 'subconscious',
    cards: [hidden]
  }).text);

  // Support
  let supportSection = `**SUPPORTING ENERGIES**\n\n`;
  supportSection += buildPositionCardText(
    support,
    support.position || 'Support / helpful energy',
    positionOptions
  );
  sections.push(enhanceSection(supportSection, {
    type: 'support',
    cards: [support]
  }).text);

  // Direction
  let directionSection = `**DIRECTION ON YOUR CURRENT PATH**\n\n`;
  directionSection += buildPositionCardText(
    direction,
    direction.position || 'Likely direction on current path',
    {
      ...positionOptions,
      prevElementalRelationship: fiveCardAnalysis?.supportVsDirection
    }
  );

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

  return full;
}

export function buildRelationshipReading({
  cardsInfo,
  userQuestion,
  reflectionsText,
  themes
}) {
  const sections = [];
  const spreadName = 'Relationship Snapshot';

  sections.push(
    buildOpening(
      spreadName,
      userQuestion ||
        'This spread explores your energy, their energy, the connection between you, and guidance for relating with agency and care.'
    )
  );

  const [youCard, themCard, connectionCard, dynamicsCard, outcomeCard] = Array.isArray(cardsInfo)
    ? cardsInfo
    : [];
  const options = getPositionOptions(themes);

  // YOU AND THEM
  let youThem = `**YOU AND THEM**\n\n`;
  youThem += buildPositionCardText(
    youCard,
    youCard.position || 'You / your energy',
    options
  );
  youThem += '\n\n';
  youThem += buildPositionCardText(
    themCard,
    themCard.position || 'Them / their energy',
    options
  );

  // Elemental relationship between you and them (if both exist)
  if (youCard && themCard) {
    const elemental = analyzeElementalDignity(youCard, themCard);
    if (elemental && elemental.description) {
      youThem += `\n\n*Elemental interplay between you: ${elemental.description}.*`;
    }
  }

  sections.push(
    enhanceSection(youThem, {
      type: 'relationship-dyad',
      cards: [youCard, themCard]
    }).text
  );

  // THE CONNECTION
  if (connectionCard) {
    let connection = `**THE CONNECTION**\n\n`;
    connection += buildPositionCardText(
      connectionCard,
      connectionCard.position || 'The connection / shared lesson',
      options
    );
    sections.push(
      enhanceSection(connection, {
        type: 'connection',
        cards: [connectionCard]
      }).text
    );
  }

  // GUIDANCE FOR THIS CONNECTION
  let guidance = `**GUIDANCE FOR THIS CONNECTION**\n\n`;
  if (dynamicsCard) {
    guidance += buildPositionCardText(
      dynamicsCard,
      dynamicsCard.position || 'Dynamics / guidance',
      options
    );
    guidance += '\n\n';
  }
  if (outcomeCard) {
    guidance += buildPositionCardText(
      outcomeCard,
      outcomeCard.position || 'Outcome / what this can become',
      options
    );
    guidance += '\n\n';
  }

  guidance +=
    'Emphasize what supports honest communication, mutual respect, and boundaries. Treat these insights as a mirror that helps you choose how to show up; never as a command to stay or leave.';

  sections.push(
    enhanceSection(guidance, {
      type: 'relationship-guidance',
      cards: [dynamicsCard, outcomeCard].filter(Boolean)
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

  return full;
}

export function buildDecisionReading({
  cardsInfo,
  userQuestion,
  reflectionsText,
  themes
}) {
  const sections = [];
  const spreadName = 'Decision / Two-Path';

  sections.push(
    buildOpening(
      spreadName,
      userQuestion ||
        'This spread illuminates the heart of your decision, two possible paths, clarifying insight, and a reminder of your agency.'
    )
  );

  const [heart, pathA, pathB, clarifier, freeWill] = Array.isArray(cardsInfo)
    ? cardsInfo
    : [];
  const options = getPositionOptions(themes);

  // THE CHOICE
  let choice = `**THE CHOICE**\n\n`;
  choice += buildPositionCardText(
    heart,
    heart.position || 'Heart of the decision',
    options
  );
  sections.push(
    enhanceSection(choice, {
      type: 'decision-core',
      cards: [heart]
    }).text
  );

  // PATH A
  let aSection = `**PATH A**\n\n`;
  aSection += buildPositionCardText(
    pathA,
    pathA.position || 'Path A — energy & likely outcome',
    options
  );
  sections.push(
    enhanceSection(aSection, {
      type: 'decision-path',
      cards: [pathA]
    }).text
  );

  // PATH B
  let bSection = `**PATH B**\n\n`;
  bSection += buildPositionCardText(
    pathB,
    pathB.position || 'Path B — energy & likely outcome',
    options
  );
  sections.push(
    enhanceSection(bSection, {
      type: 'decision-path',
      cards: [pathB]
    }).text
  );

  // CLARITY + AGENCY
  let clarity = `**CLARITY + AGENCY**\n\n`;

  if (clarifier) {
    clarity += buildPositionCardText(
      clarifier,
      clarifier.position || 'What clarifies the best path',
      options
    );
    clarity += '\n\n';
  }

  if (pathA && pathB) {
    const elemental = analyzeElementalDignity(pathA, pathB);
    if (elemental && elemental.description) {
      clarity += `Comparing the two paths: ${elemental.description}. `;
    }
  }

  if (freeWill) {
    clarity += buildPositionCardText(
      freeWill,
      freeWill.position || 'What to remember about your free will',
      options
    );
    clarity += '\n\n';
  }

  clarity +=
    'Use these insights to understand how each option feels in your body and life. The cards illuminate possibilities; you remain the one who chooses.';

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

  return full;
}

export function buildSingleCardReading({
  cardsInfo,
  userQuestion,
  reflectionsText,
  themes
}) {
  if (!Array.isArray(cardsInfo) || cardsInfo.length === 0 || !cardsInfo[0]) {
    return '**ONE-CARD INSIGHT**\n\nNo card data was provided. Please draw at least one card to receive a focused message.';
  }

  const card = cardsInfo[0];
  const options = getPositionOptions(themes);

  let narrative = `**ONE-CARD INSIGHT**\n\n`;

  if (userQuestion && userQuestion.trim()) {
    narrative += `Focusing on your question "${userQuestion.trim()}", this card offers a snapshot of guidance in this moment.\n\n`;
  } else {
    narrative += 'This single card offers a focused snapshot of the energy around you right now.\n\n';
  }

  // Core section with WHAT → WHY → WHAT'S NEXT flavor
  const positionLabel = card.position || 'Theme / Guidance of the Moment';
  const baseText = buildPositionCardText(card, positionLabel, options);

  narrative += `${baseText}\n\n`;
  narrative +=
    "In simple terms: notice what this theme is asking you to acknowledge (WHAT), reflect on why it might be surfacing now (WHY), and choose one small, aligned next step that honors your agency (WHAT'S NEXT). This is a living moment, not a fixed verdict.";

  if (reflectionsText && reflectionsText.trim()) {
    narrative += `\n\n**Your Reflections**\n\n${reflectionsText.trim()}`;
  }

  const validation = validateReadingNarrative(narrative);
  if (!validation.isValid) {
    console.debug('Single-card narrative spine suggestions:', validation.suggestions || validation.sectionAnalyses);
  }

  return narrative;
}

export function buildThreeCardReading({
  cardsInfo,
  userQuestion,
  reflectionsText,
  threeCardAnalysis,
  themes
}) {
  const sections = [];

  sections.push(buildOpening('Three-Card Story (Past · Present · Future)', userQuestion));

  const [past, present, future] = cardsInfo;
  const options = getPositionOptions(themes);

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

  sections.push(buildThreeCardSynthesis(cardsInfo, themes, userQuestion));

  return sections.filter(Boolean).join('\n\n');
}

function buildThreeCardSynthesis(cardsInfo, themes, userQuestion) {
  let section = `**GUIDANCE**\n\n`;

  if (themes.suitFocus) {
    section += `${themes.suitFocus}\n\n`;
  }

  const future = cardsInfo[2];
  section += `The path ahead shows ${future.card} ${future.orientation}.`;

  if ((future.orientation || '').toLowerCase() === 'reversed' && themes?.reversalDescription) {
    section += ` ${buildReversalGuidance(themes.reversalDescription)}`;
  }

  section += ` This is not fixed fate, but the trajectory of current momentum. Your awareness and choices shape what comes next.`;

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
  spreadAnalysis
}) {
  const spreadKey = getSpreadKeyFromName(spreadInfo.name);

  // Build spread-specific system prompt
  const systemPrompt = buildSystemPrompt(spreadKey, themes);

  // Build structured user prompt
  const userPrompt = buildUserPrompt(spreadKey, cardsInfo, userQuestion, reflectionsText, themes, spreadAnalysis);

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

function buildSystemPrompt(spreadKey, themes) {
  let prompt = `You are an expert tarot reader trained in authentic professional methodology and narrative storytelling.\n\n`;

  // Story Spine Guidance (NEW)
  prompt += `NARRATIVE STORYTELLING PRINCIPLES:

**Story Spine Structure** - Each section should flow as a story with:
1. WHAT is happening (describe the card/situation)
2. WHY it's happening (use connectors: "because," "therefore," "however," "so that")
3. WHAT'S NEXT (trajectory, invitation, guidance)

**Connective Phrases** - Link cards and positions to create causal flow:
- "Because [card/influence]…" — shows cause
- "Therefore…" / "And so…" — shows consequence
- "However…" / "Yet…" — shows contrast or tension
- "Meanwhile…" — shows parallel dynamics
- "This sets the stage for…" — bridges to next position

**Imagery Prompts** - For Major Arcana cards, reference visual symbolism:
- Example: "Notice the Tower's lightning—this visual underscores the sudden shift described here."
- Example: "Picture the Hermit's lantern piercing darkness—solitude illuminates what crowds obscure."
- Use imagery to ILLUSTRATE meaning, not replace it

**Elemental Imagery** - Tie elemental relationships to sensory language:
- Fire + Air (supportive): "Like wind feeding flame, these forces accelerate together."
- Water + Earth (supportive): "As rain nourishes soil, these energies create fertile ground."
- Fire + Water (tension): "Steam rises where fire meets water—friction creates obscuring mist."
- Air + Earth (tension): "Wind scatters earth; grounded stability meets airy ideals in productive friction."
- Same element (amplified): "Flame upon flame intensifies—doubled energy demands direction."\n\n`;

  // Spread-specific structure
  if (spreadKey === 'celtic') {
    prompt += `CELTIC CROSS READING STRUCTURE:
1. NUCLEUS (Cards 1-2): Identify the core tension between present state and challenge
   - Use "However," to introduce the Challenge crossing the Present
2. TIMELINE (Cards 3-1-4): Trace how past influences led to present and shape near future
   - Use "Because of this foundation," to connect Past → Present
   - Use "Therefore," to connect Present → Future
3. CONSCIOUSNESS (Cards 6-1-5): Assess alignment between subconscious drivers and conscious goals
   - Use "Yet beneath the surface," to introduce Subconscious
4. STAFF (Cards 7-10): Examine self-perception, external forces, hopes/fears, and likely outcome
   - Use "To navigate this landscape," for Advice
   - Use "Meanwhile, in the external world," for External Influences
   - Use "All of this converges toward" for Outcome
5. CROSS-CHECKS: Compare goal vs outcome, advice vs outcome, subconscious vs hopes/fears
6. SYNTHESIS: Integrate insights into actionable guidance\n\n`;
  } else if (spreadKey === 'threeCard') {
    prompt += `THREE-CARD READING STRUCTURE:
1. Establish the causal flow from past through present to future
   - Use "Because of this foundation," to connect Past → Present
   - Use "Therefore," or "This sets the stage for" to connect Present → Future
2. Note how transitions between positions show support or friction
   - Reference elemental imagery when cards support or clash
3. Emphasize the trajectory is shaped by current choices\n\n`;
  }

  // Reversal framework
  prompt += `REVERSAL FRAMEWORK: ${themes.reversalDescription.name}
${themes.reversalDescription.description}
${themes.reversalDescription.guidance}
**Use this lens consistently for ALL reversed cards in this reading.**\n\n`;

  // Minor Arcana rules
  prompt += `MINOR ARCANA INTERPRETATION RULES:
- Treat Minor Arcana as first-class: always use their actual suit and rank.
- Suits:
  - Wands (Fire): action, will, creativity, desire.
  - Cups (Water): emotions, relationships, intuition, care.
  - Swords (Air): mind, truth, communication, conflict, clarity.
  - Pentacles (Earth): body, work, resources, and material stability.
- Ranks (Aces–Tens): read as a progression from seed/beginning (Aces), through tests and growth, to culmination/legacy (Tens).
- Court Cards:
  - Pages: students or messengers of the suit—early expressions, curiosity, signals (often parts of self).
  - Knights: movement and pursuit—how this energy is actively carried or defended.
  - Queens: inner, receptive mastery—embodied wisdom and stewardship.
  - Kings: outer, directive mastery—structure, leadership, accountability.
- Always ground interpretations in the specific cards and positions provided.
- Do NOT invent new cards, suits, or attributes beyond the input.\n\n`;

  // Position interpretation rules
  prompt += `POSITION INTERPRETATION RULES:
- Each position is a question lens—the same card reads differently based on its position
- Challenge position: Even "positive" cards become obstacles to integrate or overcome
- Advice position: Frame as actionable guidance aligned with the card's energy
- Outcome position: Always include "if current path continues" + emphasize free will
- Subconscious position: Frame as hidden drivers, beneath awareness
- External position: Frame as forces beyond querent's direct control\n\n`;

  // Ethical constraints
  prompt += `ETHICAL CONSTRAINTS:
- No hallucinated extra cards beyond those provided
- No fortune-telling guarantees or deterministic predictions
- No medical, legal, or financial directives
- Emphasize free will, choice, and personal agency
- Maintain gentle, trauma-informed, empowering tone
- Use 4-7 flowing paragraphs separated by blank lines
- Each paragraph should follow: what → why → what's next structure\n\n`;

  return prompt;
}

function buildUserPrompt(spreadKey, cardsInfo, userQuestion, reflectionsText, themes, spreadAnalysis) {
  let prompt = ``;

  // Question
  prompt += `**Question**: ${userQuestion || '(No explicit question; speak to the energy most present for the querent.)'}\n\n`;

  // Thematic context
  prompt += `**Thematic Context**:\n`;
  if (themes.suitFocus) prompt += `- ${themes.suitFocus}\n`;
  if (themes.archetypeDescription) prompt += `- ${themes.archetypeDescription}\n`;
  if (themes.elementalBalance) prompt += `- ${themes.elementalBalance}\n`;
  prompt += `- Reversal framework: ${themes.reversalDescription.name}\n\n`;

  // Spread-specific card presentation
  if (spreadKey === 'celtic' && spreadAnalysis) {
    prompt += buildCelticCrossPromptCards(cardsInfo, spreadAnalysis, themes);
  } else if (spreadKey === 'fiveCard' && spreadAnalysis) {
    prompt += buildFiveCardPromptCards(cardsInfo, spreadAnalysis, themes);
  } else if (spreadKey === 'relationship') {
    prompt += buildRelationshipPromptCards(cardsInfo, themes);
  } else if (spreadKey === 'decision') {
    prompt += buildDecisionPromptCards(cardsInfo, themes);
  } else if (spreadKey === 'single') {
    prompt += buildSingleCardPrompt(cardsInfo, themes);
  } else {
    prompt += buildStandardPromptCards(cardsInfo, themes);
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
- Reminds the querent of their agency and free will`;

  return prompt;
}

function buildCelticCrossPromptCards(cardsInfo, analysis, themes) {
  const options = getPositionOptions(themes);

  let cards = `**NUCLEUS** (Heart of the Matter):\n`;
  cards += buildCardWithImagery(cardsInfo[0], cardsInfo[0].position || 'Present — core situation (Card 1)', options);
  cards += buildCardWithImagery(cardsInfo[1], cardsInfo[1].position || 'Challenge — crossing / tension (Card 2)', options);
  cards += `Relationship insight: ${analysis.nucleus.synthesis}\n`;
  cards += getElementalImageryText(analysis.nucleus.elementalDynamic) + '\n\n';

  cards += `**TIMELINE**:\n`;
  cards += buildCardWithImagery(cardsInfo[2], cardsInfo[2].position || 'Past — what lies behind (Card 3)', options);
  cards += buildCardWithImagery(cardsInfo[3], cardsInfo[3].position || 'Near Future — what lies before (Card 4)', options);
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

/**
 * Build card text with imagery hook for prompts
 */
function buildCardWithImagery(cardInfo, position, options) {
  let text = `${buildPositionCardText(cardInfo, position, options)}\n`;

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

function buildFiveCardPromptCards(cardsInfo, fiveCardAnalysis, themes) {
  const options = getPositionOptions(themes);
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

function buildRelationshipPromptCards(cardsInfo, themes) {
  const options = getPositionOptions(themes);
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

function buildDecisionPromptCards(cardsInfo, themes) {
  const options = getPositionOptions(themes);
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

function buildSingleCardPrompt(cardsInfo, themes) {
  const options = getPositionOptions(themes);
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

function buildStandardPromptCards(cardsInfo, themes) {
  const options = getPositionOptions(themes);

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
      const positionsText = [
        value.position1
          ? `${value.position1.name}: ${value.position1.card} ${value.position1.orientation}`
          : null,
        value.position2
          ? `${value.position2.name}: ${value.position2.card} ${value.position2.orientation}`
          : null
      ].filter(Boolean).join(' | ');

      const parts = [`- ${label}: ${value.synthesis.trim()}`];
      if (positionsText) parts.push(`Positions: ${positionsText}`);
      if (details.length > 0) parts.push(details.join(' '));

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
