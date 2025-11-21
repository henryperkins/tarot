import { enhanceSection, validateReadingNarrative } from '../../narrativeSpine.js';
import { sortCardsByImportance, getPositionWeight } from '../../positionWeights.js';
import {
  appendReversalReminder,
  buildOpening,
  buildPositionCardText,
  buildWeightAttentionIntro,
  buildSupportingPositionsSummary,
  buildWeightNote,
  getPositionOptions,
  buildReflectionsSection,
  buildPatternSynthesis,
  getConnector,
  shouldEmphasizePosition,
  formatCrossCheck,
  buildReversalGuidance,
  getContextDescriptor,
  DEFAULT_WEIGHT_DETAIL_THRESHOLD
} from '../helpers.js';

export async function buildCelticCrossReading({
  cardsInfo,
  userQuestion,
  reflectionsText,
  celticAnalysis,
  themes,
  context
}) {
  const prioritized = sortCardsByImportance(cardsInfo, 'celtic');
  const sections = [];

  // Opening
  sections.push(buildOpening('Celtic Cross (Classic 10-Card)', userQuestion, context));

  const attentionNote = buildWeightAttentionIntro(prioritized, 'Celtic Cross');
  if (attentionNote) {
    sections.push(attentionNote);
  }

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

  const patternSection = buildPatternSynthesis(themes);
  if (patternSection) {
    sections.push(patternSection);
  }

  // 7. SYNTHESIS - Actionable integration
  sections.push(
    enhanceSection(
      await buildSynthesisSection(cardsInfo, themes, celticAnalysis, userQuestion, context),
      { type: 'outcome' }
    ).text
  );

  const supportingSummary = buildSupportingPositionsSummary(prioritized, 'Celtic Cross');
  if (supportingSummary) {
    sections.push(supportingSummary);
  }

  // Final validation log (non-blocking)
  const readingBody = sections.filter(Boolean).join('\n\n');
  const validation = validateReadingNarrative(readingBody);
  if (!validation.isValid) {
    console.debug('Celtic Cross narrative spine suggestions:', validation.suggestions || validation.sectionAnalyses);
  }

  return appendReversalReminder(readingBody, cardsInfo, themes);
}



function buildNucleusSection(nucleus, cardsInfo, themes, context) {
  const present = cardsInfo[0];
  const challenge = cardsInfo[1];

  let section = `### The Heart of the Matter (Nucleus)\n\n`;

  const presentPosition = present.position || 'Present — core situation (Card 1)';
  const challengePosition = challenge.position || 'Challenge — crossing / tension (Card 2)';

  section += `${buildPositionCardText(present, presentPosition, getPositionOptions(themes, context))}\n\n`;
  section += `${buildPositionCardText(challenge, challengePosition, getPositionOptions(themes, context))}\n\n`;

  section += nucleus.synthesis;

  const emphasisNotes = [
    buildWeightNote('celtic', 0, presentPosition),
    buildWeightNote('celtic', 1, challengePosition)
  ].filter(Boolean);

  if (emphasisNotes.length > 0) {
    section += `\n\n${emphasisNotes.join('\n\n')}`;
  }

  return section;
}

function buildTimelineSection(timeline, cardsInfo, themes, context) {
  const past = cardsInfo[2];
  const present = cardsInfo[0];
  const future = cardsInfo[3];

  let section = `### The Timeline (Horizontal Axis)\n\n`;

  const options = getPositionOptions(themes, context);
  const pastPosition = past.position || 'Past — what lies behind (Card 3)';
  const presentPosition = present.position || 'Present — core situation (Card 1)';
  const futurePosition = future.position || 'Near Future — what lies before (Card 4)';

  // Past card
  section += `${buildPositionCardText(past, pastPosition, options)}\n\n`;

  // Present card with connector and elemental imagery
  const pastToPresent = timeline.pastToPresent;
  const presentConnector = getConnector(presentPosition, 'toPrev');
  section += `${presentConnector} ${buildPositionCardText(present, presentPosition, {
    ...options,
    prevElementalRelationship: pastToPresent
  })}\n\n`;

  // Future card with connector and elemental imagery
  const presentToFuture = timeline.presentToFuture;
  const futureConnector = getConnector(futurePosition, 'toPrev');
  section += `${futureConnector} ${buildPositionCardText(future, futurePosition, {
    ...options,
    prevElementalRelationship: presentToFuture
  })}\n\n`;

  section += timeline.causality;

  const timelineWeightNotes = [
    buildWeightNote('celtic', 0, presentPosition),
    buildWeightNote('celtic', 3, futurePosition)
  ].filter(Boolean);

  if (timelineWeightNotes.length > 0) {
    section += `\n\n${timelineWeightNotes.join(' ')}`;
  }

  return section;
}

function buildConsciousnessSection(consciousness, cardsInfo, themes, context) {
  const subconscious = cardsInfo[5];
  const conscious = cardsInfo[4];

  let section = `### Consciousness Flow (Vertical Axis)\n\n`;

  const subconsciousPosition = subconscious.position || 'Subconscious — roots / hidden forces (Card 6)';
  const consciousPosition = conscious.position || 'Conscious — goals & focus (Card 5)';

  section += `${buildPositionCardText(subconscious, subconsciousPosition, getPositionOptions(themes, context))}\n\n`;
  section += `${buildPositionCardText(conscious, consciousPosition, getPositionOptions(themes, context))}\n\n`;

  section += consciousness.synthesis;

  if (consciousness.alignment === 'conflicted') {
    section += `\n\n*This misalignment suggests inner work is needed to bring your depths and aspirations into harmony.*`;
  } else if (consciousness.alignment === 'aligned') {
    section += `\n\n*This alignment is a source of power—your whole being is moving in one direction.*`;
  }

  const consciousnessWeightNotes = [
    buildWeightNote('celtic', 5, subconsciousPosition),
    buildWeightNote('celtic', 4, consciousPosition)
  ].filter(Boolean);

  if (consciousnessWeightNotes.length > 0) {
    section += `\n\n${consciousnessWeightNotes.join(' ')}`;
  }

  return section;
}

function buildStaffSection(staff, cardsInfo, themes, context) {
  const self = cardsInfo[6];
  const external = cardsInfo[7];
  const hopesFears = cardsInfo[8];
  const outcome = cardsInfo[9];

  let section = `### The Staff (Context & Trajectory)\n\n`;

  const selfPosition = self.position || 'Self / Advice — how to meet this (Card 7)';
  const externalPosition = external.position || 'External Influences — people & environment (Card 8)';
  const hopesFearsPosition = hopesFears.position || 'Hopes & Fears — deepest wishes & worries (Card 9)';
  const outcomePosition = outcome.position || 'Outcome — likely path if unchanged (Card 10)';

  section += `${buildPositionCardText(self, selfPosition, getPositionOptions(themes, context))}\n\n`;
  section += `${buildPositionCardText(external, externalPosition, getPositionOptions(themes, context))}\n\n`;
  section += `${buildPositionCardText(hopesFears, hopesFearsPosition, getPositionOptions(themes, context))}\n\n`;
  section += `${buildPositionCardText(outcome, outcomePosition, getPositionOptions(themes, context))}\n\n`;

  section += staff.adviceImpact;

  const staffWeightNotes = [
    buildWeightNote('celtic', 6, selfPosition),
    buildWeightNote('celtic', 7, externalPosition),
    buildWeightNote('celtic', 8, hopesFearsPosition),
    buildWeightNote('celtic', 9, outcomePosition)
  ].filter(Boolean);

  if (staffWeightNotes.length > 0) {
    section += `\n\n${staffWeightNotes.join(' ')}`;
  }

  if (shouldEmphasizePosition('celtic', 6) || shouldEmphasizePosition('celtic', 9)) {
    section += `\n\n*Extended staff detail appears because the Advice/Outcome axis carries concentrated weighting.*`;
  }

  return section;
}

function buildCrossChecksSection(crossChecks, themes) {
  let section = `### Key Relationships\n\n`;

  section += 'This overview shows how core positions interact and compare.\n\n';

  section += formatCrossCheck('Conscious Goal vs Outcome', crossChecks.goalVsOutcome, themes);
  section += `\n\n${formatCrossCheck('Advice vs Outcome', crossChecks.adviceVsOutcome, themes)}`;
  section += `\n\n${formatCrossCheck('Near Future vs Outcome', crossChecks.nearFutureVsOutcome, themes)}`;
  section += `\n\n${formatCrossCheck('Subconscious vs Hopes & Fears', crossChecks.subconsciousVsHopesFears, themes)}`;

  section += '\n\nTaken together, these cross-checks point toward how to translate the spread\'s insights into your next aligned step.';

  return section;
}

/**
 * Generate synthesis prose from cross-check structured data
 */



async function buildSynthesisSection(cardsInfo, themes, celticAnalysis, userQuestion, context) {
  let section = `### Synthesis & Guidance\n\n`;

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

    // Elemental remedies if imbalanced
    if (themes.elementCounts) {
      const { buildElementalRemedies, shouldOfferElementalRemedies } = await import('../helpers.js');
      if (shouldOfferElementalRemedies(themes.elementCounts, cardsInfo.length)) {
        const remedies = buildElementalRemedies(themes.elementCounts, cardsInfo.length, context);
        if (remedies) {
          section += `${remedies}\n\n`;
        }
      }
    }
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
  const adviceWeight = getPositionWeight('celtic', 6);
  const outcomeWeight = getPositionWeight('celtic', 9);

  section += `**Your next step**\n`;
  section += `This step shows where to focus your agency right now.\n`;
  section += `${buildPositionCardText(advice, advice.position || 'Self / Advice — how to meet this (Card 7)', options)}\n`;
  section += `${celticAnalysis.staff.adviceImpact}\n\n`;

  if (adviceWeight >= DEFAULT_WEIGHT_DETAIL_THRESHOLD) {
    section += `*This Advice position sits at weight ${adviceWeight.toFixed(2)}, so it receives extended guidance above.*\n\n`;
  }

  section += `**Trajectory Reminder**\n${buildPositionCardText(outcome, outcome.position || 'Outcome — likely path if unchanged (Card 10)', options)}\n`;
  section += `Remember: The outcome shown by ${outcome.card} is a trajectory based on current patterns. Your choices, consciousness, and actions shape what unfolds. You are co-creating this path.`;

  if (outcomeWeight >= DEFAULT_WEIGHT_DETAIL_THRESHOLD) {
    section += `\n\n*Outcome receives extra attention because its weight clocks in at ${outcomeWeight.toFixed(2)}.*`;
  }

  return section;
}
