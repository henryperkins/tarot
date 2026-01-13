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
  getContextDescriptor,
  DEFAULT_WEIGHT_DETAIL_THRESHOLD,
  computeRemedyRotationIndex,
  getSectionHeader,
  isProseMode
} from '../helpers.js';
import { buildPersonalizedClosing } from '../styleHelpers.js';
import {
  selectReasoningConnector,
  buildReasoningAwareOpening,
  enhanceCardTextWithReasoning,
  buildReasoningSynthesis
} from '../reasoningIntegration.js';

export async function buildCelticCrossReading({
  cardsInfo,
  userQuestion,
  reflectionsText,
  celticAnalysis,
  themes,
  context,
  spreadInfo
}, options = {}) {
  const prioritized = sortCardsByImportance(cardsInfo, 'celtic');
  const sections = [];
  const personalization = options.personalization || null;
  const collectValidation = typeof options.collectValidation === 'function' ? options.collectValidation : null;
  const reasoning = options.reasoning || null;
  const remedyRotationIndex = computeRemedyRotationIndex({ cardsInfo, userQuestion, spreadInfo });
  const proseOptions = { proseMode: options.proseMode === true };

  const recordEnhancedSection = (sectionText, metadata = {}) => {
    const result = enhanceSection(sectionText, metadata);
    if (collectValidation) {
      collectValidation({
        text: result.text,
        metadata,
        validation: result.validation || null
      });
    }
    sections.push(result.text);
  };

  // Use reasoning-aware opening if available
  const opening = reasoning
    ? buildReasoningAwareOpening(
        'Celtic Cross (Classic 10-Card)',
        userQuestion,
        context,
        reasoning,
        { personalization: options.personalization }
      )
    : buildOpening(
        'Celtic Cross (Classic 10-Card)',
        userQuestion,
        context,
        { personalization: options.personalization }
      );
  sections.push(opening);

  const attentionNote = buildWeightAttentionIntro(prioritized, 'Celtic Cross', DEFAULT_WEIGHT_DETAIL_THRESHOLD, proseOptions);
  if (attentionNote) {
    sections.push(attentionNote);
  }

  // 1. NUCLEUS - The Heart of the Matter (Cards 1-2)
  recordEnhancedSection(
    buildNucleusSection(celticAnalysis.nucleus, cardsInfo, themes, context, reasoning, proseOptions),
    {
      type: 'nucleus',
      cards: [cardsInfo[0], cardsInfo[1]],
      relationships: { elementalRelationship: celticAnalysis.nucleus.elementalDynamic }
    }
  );

  // 2. TIMELINE - Past, Present, Future (Cards 3-1-4)
  recordEnhancedSection(
    buildTimelineSection(celticAnalysis.timeline, cardsInfo, themes, context, reasoning, proseOptions),
    { type: 'timeline' }
  );

  // 3. CONSCIOUSNESS - Subconscious, Center, Conscious (Cards 6-1-5)
  recordEnhancedSection(
    buildConsciousnessSection(celticAnalysis.consciousness, cardsInfo, themes, context, reasoning, proseOptions),
    { type: 'consciousness' }
  );

  // 4. STAFF - Self, External, Hopes/Fears, Outcome (Cards 7-10)
  recordEnhancedSection(
    buildStaffSection(celticAnalysis.staff, cardsInfo, themes, context, reasoning, proseOptions),
    { type: 'staff' }
  );

  // 5. CROSS-CHECKS - Key position comparisons
  recordEnhancedSection(
    buildCrossChecksSection(celticAnalysis.crossChecks, themes, proseOptions),
    { type: 'relationships' }
  );

  // 6. User Reflections
  if (reflectionsText && reflectionsText.trim()) {
    sections.push(buildReflectionsSection(reflectionsText));
  }

  // Use reasoning synthesis if available, otherwise fall back to pattern synthesis
  const synthesisSection = reasoning
    ? buildReasoningSynthesis(cardsInfo, reasoning, themes, userQuestion, context)
    : buildPatternSynthesis(themes);
  if (synthesisSection) {
    sections.push(synthesisSection);
  }

  // 7. SYNTHESIS - Actionable integration
  recordEnhancedSection(
    await buildSynthesisSection(cardsInfo, themes, celticAnalysis, userQuestion, context, remedyRotationIndex, proseOptions),
    { type: 'outcome' }
  );

  const supportingSummary = buildSupportingPositionsSummary(prioritized, 'Celtic Cross', undefined, proseOptions);
  if (supportingSummary) {
    sections.push(supportingSummary);
  }

  // Final validation log (non-blocking)
  const readingBody = sections.filter(Boolean).join('\n\n');
  const validation = validateReadingNarrative(readingBody);
  if (!validation.isValid) {
    console.debug('Celtic Cross narrative spine suggestions:', validation.suggestions || validation.sectionAnalyses);
  }

  const closing = buildPersonalizedClosing(personalization);
  const narrative = closing ? `${readingBody}\n\n${closing}` : readingBody;
  return appendReversalReminder(narrative, cardsInfo, themes);
}



function buildNucleusSection(nucleus, cardsInfo, themes, context, reasoning = null, proseOptions = {}) {
  const present = cardsInfo[0];
  const challenge = cardsInfo[1];

  const header = getSectionHeader('nucleus', proseOptions);
  let section = header ? `${header}\n\n` : '';

  const presentPosition = present.position || 'Present — core situation (Card 1)';
  const challengePosition = challenge.position || 'Challenge — crossing / tension (Card 2)';

  let presentText = buildPositionCardText(present, presentPosition, getPositionOptions(themes, context));
  if (reasoning) {
    const enhanced = enhanceCardTextWithReasoning(presentText, 0, reasoning);
    if (enhanced.enhanced) presentText = enhanced.text;
  }
  section += `${presentText}\n\n`;

  let challengeText = buildPositionCardText(challenge, challengePosition, getPositionOptions(themes, context));
  if (reasoning) {
    const enhanced = enhanceCardTextWithReasoning(challengeText, 1, reasoning);
    if (enhanced.enhanced) challengeText = enhanced.text;
  }
  section += `${challengeText}\n\n`;

  section += nucleus.synthesis;

  const emphasisNotes = [
    buildWeightNote('celtic', 0, presentPosition, proseOptions),
    buildWeightNote('celtic', 1, challengePosition, proseOptions)
  ].filter(Boolean);

  if (emphasisNotes.length > 0) {
    section += `\n\n${emphasisNotes.join('\n\n')}`;
  }

  return section;
}

function buildTimelineSection(timeline, cardsInfo, themes, context, reasoning = null, proseOptions = {}) {
  const past = cardsInfo[2];
  const present = cardsInfo[0];
  const future = cardsInfo[3];

  const header = getSectionHeader('timeline', proseOptions);
  let section = header ? `${header}\n\n` : '';

  const options = getPositionOptions(themes, context);
  const pastPosition = past.position || 'Past — what lies behind (Card 3)';
  const presentPosition = present.position || 'Present — core situation (Card 1)';
  const futurePosition = future.position || 'Near Future — what lies before (Card 4)';

  // Past card
  let pastText = buildPositionCardText(past, pastPosition, options);
  if (reasoning) {
    const enhanced = enhanceCardTextWithReasoning(pastText, 2, reasoning);
    if (enhanced.enhanced) pastText = enhanced.text;
  }
  section += `${pastText}\n\n`;

  // Present card with connector and elemental imagery
  const pastToPresent = timeline.pastToPresent;
  const presentConnector = (reasoning && selectReasoningConnector(reasoning, 2, 0)) || getConnector(presentPosition, 'toPrev');
  let presentText = buildPositionCardText(present, presentPosition, {
    ...options,
    prevElementalRelationship: pastToPresent
  });
  if (reasoning) {
    const enhanced = enhanceCardTextWithReasoning(presentText, 0, reasoning);
    if (enhanced.enhanced) presentText = enhanced.text;
  }
  section += `${presentConnector} ${presentText}\n\n`;

  // Future card with connector and elemental imagery
  const presentToFuture = timeline.presentToFuture;
  const futureConnector = (reasoning && selectReasoningConnector(reasoning, 0, 3)) || getConnector(futurePosition, 'toPrev');
  let futureText = buildPositionCardText(future, futurePosition, {
    ...options,
    prevElementalRelationship: presentToFuture
  });
  if (reasoning) {
    const enhanced = enhanceCardTextWithReasoning(futureText, 3, reasoning);
    if (enhanced.enhanced) futureText = enhanced.text;
  }
  section += `${futureConnector} ${futureText}\n\n`;

  section += timeline.causality;

  const timelineWeightNotes = [
    buildWeightNote('celtic', 0, presentPosition, proseOptions),
    buildWeightNote('celtic', 3, futurePosition, proseOptions)
  ].filter(Boolean);

  if (timelineWeightNotes.length > 0) {
    section += `\n\n${timelineWeightNotes.join(' ')}`;
  }

  return section;
}

function buildConsciousnessSection(consciousness, cardsInfo, themes, context, reasoning = null, proseOptions = {}) {
  const subconscious = cardsInfo[5];
  const conscious = cardsInfo[4];

  const header = getSectionHeader('consciousness', proseOptions);
  let section = header ? `${header}\n\n` : '';

  const subconsciousPosition = subconscious.position || 'Subconscious — roots / hidden forces (Card 6)';
  const consciousPosition = conscious.position || 'Conscious — goals & focus (Card 5)';

  let subconsciousText = buildPositionCardText(subconscious, subconsciousPosition, getPositionOptions(themes, context));
  if (reasoning) {
    const enhanced = enhanceCardTextWithReasoning(subconsciousText, 5, reasoning);
    if (enhanced.enhanced) subconsciousText = enhanced.text;
  }
  section += `${subconsciousText}\n\n`;

  let consciousText = buildPositionCardText(conscious, consciousPosition, getPositionOptions(themes, context));
  if (reasoning) {
    const enhanced = enhanceCardTextWithReasoning(consciousText, 4, reasoning);
    if (enhanced.enhanced) consciousText = enhanced.text;
  }
  section += `${consciousText}\n\n`;

  section += consciousness.synthesis;

  if (consciousness.alignment === 'conflicted') {
    section += `\n\n*This misalignment suggests inner work is needed to bring your depths and aspirations into harmony.*`;
  } else if (consciousness.alignment === 'aligned') {
    section += `\n\n*This alignment is a source of power—your whole being is moving in one direction.*`;
  }

  const consciousnessWeightNotes = [
    buildWeightNote('celtic', 5, subconsciousPosition, proseOptions),
    buildWeightNote('celtic', 4, consciousPosition, proseOptions)
  ].filter(Boolean);

  if (consciousnessWeightNotes.length > 0) {
    section += `\n\n${consciousnessWeightNotes.join(' ')}`;
  }

  return section;
}

function buildStaffSection(staff, cardsInfo, themes, context, reasoning = null, proseOptions = {}) {
  const self = cardsInfo[6];
  const external = cardsInfo[7];
  const hopesFears = cardsInfo[8];
  const outcome = cardsInfo[9];

  const header = getSectionHeader('staff', proseOptions);
  let section = header ? `${header}\n\n` : '';

  const selfPosition = self.position || 'Self / Advice — how to meet this (Card 7)';
  const externalPosition = external.position || 'External Influences — people & environment (Card 8)';
  const hopesFearsPosition = hopesFears.position || 'Hopes & Fears — deepest wishes & worries (Card 9)';
  const outcomePosition = outcome.position || 'Outcome — likely path if unchanged (Card 10)';

  let selfText = buildPositionCardText(self, selfPosition, getPositionOptions(themes, context));
  if (reasoning) {
    const enhanced = enhanceCardTextWithReasoning(selfText, 6, reasoning);
    if (enhanced.enhanced) selfText = enhanced.text;
  }
  section += `${selfText}\n\n`;

  let externalText = buildPositionCardText(external, externalPosition, getPositionOptions(themes, context));
  if (reasoning) {
    const enhanced = enhanceCardTextWithReasoning(externalText, 7, reasoning);
    if (enhanced.enhanced) externalText = enhanced.text;
  }
  section += `${externalText}\n\n`;

  let hopesFearsText = buildPositionCardText(hopesFears, hopesFearsPosition, getPositionOptions(themes, context));
  if (reasoning) {
    const enhanced = enhanceCardTextWithReasoning(hopesFearsText, 8, reasoning);
    if (enhanced.enhanced) hopesFearsText = enhanced.text;
  }
  section += `${hopesFearsText}\n\n`;

  let outcomeText = buildPositionCardText(outcome, outcomePosition, getPositionOptions(themes, context));
  if (reasoning) {
    const enhanced = enhanceCardTextWithReasoning(outcomeText, 9, reasoning);
    if (enhanced.enhanced) outcomeText = enhanced.text;
  }
  section += `${outcomeText}\n\n`;

  section += staff.adviceImpact;

  const staffWeightNotes = [
    buildWeightNote('celtic', 6, selfPosition, proseOptions),
    buildWeightNote('celtic', 7, externalPosition, proseOptions),
    buildWeightNote('celtic', 8, hopesFearsPosition, proseOptions),
    buildWeightNote('celtic', 9, outcomePosition, proseOptions)
  ].filter(Boolean);

  if (staffWeightNotes.length > 0) {
    section += `\n\n${staffWeightNotes.join(' ')}`;
  }

  // In non-prose mode, add extended staff note
  if (!isProseMode(proseOptions) && (shouldEmphasizePosition('celtic', 6) || shouldEmphasizePosition('celtic', 9))) {
    section += `\n\n*Extended staff detail appears because the Advice/Outcome axis carries concentrated weighting.*`;
  }

  return section;
}

function buildCrossChecksSection(crossChecks, themes, proseOptions = {}) {
  const header = getSectionHeader('crossChecks', proseOptions);
  let section = header ? `${header}\n\n` : '';

  // Use different intro text based on prose mode
  const introText = isProseMode(proseOptions)
    ? 'Several cards in this spread echo and respond to each other.\n\n'
    : 'This overview shows how core positions interact and compare.\n\n';
  section += introText;

  section += formatCrossCheck('Conscious Goal vs Outcome', crossChecks.goalVsOutcome, themes, proseOptions);
  section += `\n\n${formatCrossCheck('Advice vs Outcome', crossChecks.adviceVsOutcome, themes, proseOptions)}`;
  section += `\n\n${formatCrossCheck('Near Future vs Outcome', crossChecks.nearFutureVsOutcome, themes, proseOptions)}`;
  section += `\n\n${formatCrossCheck('Subconscious vs Hopes & Fears', crossChecks.subconsciousVsHopesFears, themes, proseOptions)}`;

  // Use different closing text based on prose mode
  const closingText = isProseMode(proseOptions)
    ? '\n\nThese connections reveal how to translate the spread\'s wisdom into your next step.'
    : '\n\nTaken together, these cross-checks point toward how to translate the spread\'s insights into your next aligned step.';
  section += closingText;

  return section;
}

/**
 * Generate synthesis prose from cross-check structured data
 */



async function buildSynthesisSection(cardsInfo, themes, celticAnalysis, userQuestion, context, rotationIndex = 0, proseOptions = {}) {
  const header = getSectionHeader('synthesis', proseOptions);
  let section = header ? `${header}\n\n` : '';

  // Use different intro text based on prose mode
  const introText = isProseMode(proseOptions)
    ? ''  // Skip technical intro in prose mode
    : 'This synthesis shows how the spread integrates into actionable guidance.\n\n';
  section += introText;

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
      try {
        const { buildElementalRemedies, shouldOfferElementalRemedies } = await import('../helpers.js');
        if (shouldOfferElementalRemedies(themes.elementCounts, cardsInfo.length)) {
          const remedies = buildElementalRemedies(themes.elementCounts, cardsInfo.length, context, {
            rotationIndex
          });
          if (remedies) {
            section += `${remedies}\n\n`;
          }
        }
      } catch (err) {
        console.error('[Celtic Cross] Elemental remedies unavailable:', err.message);
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

  // In non-prose mode, add weight note
  if (!isProseMode(proseOptions) && adviceWeight >= DEFAULT_WEIGHT_DETAIL_THRESHOLD) {
    section += `*This Advice position sits at weight ${adviceWeight.toFixed(2)}, so it receives extended guidance above.*\n\n`;
  }

  section += `**Trajectory Reminder**\n${buildPositionCardText(outcome, outcome.position || 'Outcome — likely path if unchanged (Card 10)', options)}\n`;
  section += `Remember: The outcome shown by ${outcome.card} is a trajectory based on current patterns. Your choices, consciousness, and actions shape what unfolds. You are co-creating this path.`;

  // In non-prose mode, add weight note
  if (!isProseMode(proseOptions) && outcomeWeight >= DEFAULT_WEIGHT_DETAIL_THRESHOLD) {
    section += `\n\n*Outcome receives extra attention because its weight clocks in at ${outcomeWeight.toFixed(2)}.*`;
  }

  return section;
}
