import { enhanceSection, validateReadingNarrative } from '../../narrativeSpine.js';
import { sortCardsByImportance, getPositionWeight } from '../../positionWeights.js';
import {
  appendReversalReminder,
  buildOpening,
  buildPositionCardText,
  getPositionOptions,
  buildWeightAttentionIntro,
  buildWeightNote,
  buildSupportingPositionsSummary,
  buildReflectionsSection,
  buildPatternSynthesis,
  getConnector,
  getContextDescriptor,
  buildReversalGuidance,
  DEFAULT_WEIGHT_DETAIL_THRESHOLD,
  computeRemedyRotationIndex,
  getSectionHeader
} from '../helpers.js';
import { getToneStyle, getFrameVocabulary, buildNameClause, buildPersonalizedClosing } from '../styleHelpers.js';
import {
  selectReasoningConnector,
  buildReasoningAwareOpening,
  enhanceCardTextWithReasoning,
  buildReasoningSynthesis
} from '../reasoningIntegration.js';

export async function buildThreeCardReading({
  cardsInfo,
  userQuestion,
  reflectionsText,
  threeCardAnalysis,
  themes,
  context,
  spreadInfo
}, options = {}) {
  const sections = [];
  const personalization = options.personalization || null;
  const tone = getToneStyle(personalization?.readingTone);
  const frameVocab = getFrameVocabulary(personalization?.spiritualFrame);
  const nameInline = buildNameClause(personalization?.displayName, 'inline');
  const collectValidation =
    typeof options.collectValidation === 'function'
      ? options.collectValidation
      : null;
  const reasoning = options.reasoning || null;

  const recordSection = (text, metadata = {}) => {
    const result = enhanceSection(text, metadata);
    if (collectValidation) {
      collectValidation({
        text: result.text,
        metadata,
        validation: result.validation || null
      });
    }
    return result.text;
  };

  // Use reasoning-aware opening if available
  const opening = reasoning
    ? buildReasoningAwareOpening(
        'Three-Card Story (Past · Present · Future)',
        userQuestion,
        context,
        reasoning,
        { personalization: options.personalization }
      )
    : buildOpening(
        'Three-Card Story (Past · Present · Future)',
        userQuestion,
        context,
        { personalization: options.personalization }
      );
  sections.push(opening);

  const [past, present, future] = cardsInfo;
  const prioritized = sortCardsByImportance(cardsInfo, 'threeCard');
  const positionOptions = getPositionOptions(themes, context);
  const remedyRotationIndex = computeRemedyRotationIndex({ cardsInfo, userQuestion, spreadInfo });

  const attentionNote = buildWeightAttentionIntro(prioritized, 'Three-Card Story');
  if (attentionNote) {
    sections.push(attentionNote);
  }

  const storyHeader = getSectionHeader('threeCardStory');
  let narrative = storyHeader ? `${storyHeader}\n\n` : '';

  const pastPosition = past.position || 'Past — influences that led here';
  const presentPosition = present.position || 'Present — where you stand now';
  const futurePosition = future.position || 'Future — trajectory if nothing shifts';

  // Past card
  let pastText = buildPositionCardText(past, pastPosition, positionOptions);
  if (reasoning) {
    const enhanced = enhanceCardTextWithReasoning(pastText, 0, reasoning);
    if (enhanced.enhanced) pastText = enhanced.text;
  }
  narrative += `${pastText}\n\n`;
  const pastWeightNote = buildWeightNote('threeCard', 0, pastPosition);
  if (pastWeightNote) {
    narrative += `${pastWeightNote}\n\n`;
  }

  // Present card with connector and elemental imagery
  const firstToSecond = threeCardAnalysis?.transitions?.firstToSecond;
  const presentConnector = (reasoning && selectReasoningConnector(reasoning, 0, 1)) || getConnector(presentPosition, 'toPrev');
  let presentText = buildPositionCardText(present, presentPosition, {
    ...positionOptions,
    prevElementalRelationship: firstToSecond
  });
  if (reasoning) {
    const enhanced = enhanceCardTextWithReasoning(presentText, 1, reasoning);
    if (enhanced.enhanced) presentText = enhanced.text;
  }
  narrative += `${presentConnector} ${presentText}\n\n`;
  const presentWeightNote = buildWeightNote('threeCard', 1, presentPosition);
  if (presentWeightNote) {
    narrative += `${presentWeightNote}\n\n`;
  }

  // Future card with connector and elemental imagery
  const secondToThird = threeCardAnalysis?.transitions?.secondToThird;
  const futureConnector = (reasoning && selectReasoningConnector(reasoning, 1, 2)) || getConnector(futurePosition, 'toPrev');
  let futureText = buildPositionCardText(future, futurePosition, {
    ...positionOptions,
    prevElementalRelationship: secondToThird
  });
  if (reasoning) {
    const enhanced = enhanceCardTextWithReasoning(futureText, 2, reasoning);
    if (enhanced.enhanced) futureText = enhanced.text;
  }
  narrative += `${futureConnector} ${futureText}\n\n`;
  const futureWeightNote = buildWeightNote('threeCard', 2, futurePosition);
  if (futureWeightNote) {
    narrative += `${futureWeightNote}\n\n`;
  }

  if (threeCardAnalysis && threeCardAnalysis.narrative) {
    narrative += threeCardAnalysis.narrative;
  }

  sections.push(
    recordSection(narrative, {
      type: 'story',
      cards: [past, present, future]
    })
  );

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

  const supportingSummary = buildSupportingPositionsSummary(prioritized, 'Three-Card Story');
  if (supportingSummary) {
    sections.push(supportingSummary);
  }

  let guidanceSection = await buildThreeCardSynthesis(cardsInfo, themes, userQuestion, context, remedyRotationIndex);
  if (guidanceSection) {
    const tonePhrase = tone.challengeFraming || 'clear next step';
    const frameWord = frameVocab[0] || 'insight';
    guidanceSection += `\n\nFor you${nameInline || ''} this reads as a ${tonePhrase}, inviting ${frameWord} in motion.`;
  }
  if (guidanceSection) {
    sections.push(
      recordSection(guidanceSection, {
        type: 'guidance',
        cards: [future]
      })
    );
  }

  const full = sections.filter(Boolean).join('\n\n');
  const closing = buildPersonalizedClosing(personalization);
  const narrativeWithClosing = closing ? `${full}\n\n${closing}` : full;
  const validation = validateReadingNarrative(full);
  if (!validation.isValid) {
    console.debug('Three-card narrative spine suggestions:', validation.suggestions || validation.sectionAnalyses);
  }
  return appendReversalReminder(narrativeWithClosing, cardsInfo, themes);
}

async function buildThreeCardSynthesis(cardsInfo, themes, userQuestion, context, rotationIndex = 0) {
  const header = getSectionHeader('threeCardGuidance');
  let section = header ? `${header}\n\n` : '';

  if (context && context !== 'general') {
    section += `Focus: Interpreting the path ahead through ${getContextDescriptor(context)}.\n\n`;
  }

  if (themes.suitFocus) {
    section += `${themes.suitFocus}\n\n`;
  }

  // Elemental remedies if imbalanced
  if (themes.elementCounts && themes.elementalBalance) {
    try {
      const { buildElementalRemedies, shouldOfferElementalRemedies } = await import('../helpers.js');
      if (shouldOfferElementalRemedies(themes.elementCounts, cardsInfo.length)) {
        const remedies = buildElementalRemedies(themes.elementCounts, cardsInfo.length, context, {
          rotationIndex
        });
        if (remedies) {
          section += `${themes.elementalBalance}\n\n${remedies}\n\n`;
        }
      }
    } catch (err) {
      console.error('[Three-Card] Elemental remedies unavailable:', err.message);
    }
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
  const futureWeight = getPositionWeight('threeCard', 2);
  const presentWeight = getPositionWeight('threeCard', 1);
  section += `The path ahead shows ${future.card} ${future.orientation}.`;

  if ((future.orientation || '').toLowerCase() === 'reversed' && themes?.reversalDescription) {
    section += ` ${buildReversalGuidance(themes.reversalDescription)}`;
  }

  section += ` This is not fixed fate, but the trajectory of current momentum. Your awareness and choices shape what comes next.`;

  if (futureWeight >= DEFAULT_WEIGHT_DETAIL_THRESHOLD) {
    section += ` The Future position carries a weight of ${futureWeight.toFixed(2)}, so its voice leads the guidance.`;
  } else if (presentWeight >= DEFAULT_WEIGHT_DETAIL_THRESHOLD) {
    section += ` With the Present sitting at weight ${presentWeight.toFixed(2)}, your current stance remains the main lever for change.`;
  }

  section += '\n\nAltogether, these threads suggest your next supportive step and point toward how to walk this path with agency.';

  return section;
}
