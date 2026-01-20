import { enhanceSection, validateReadingNarrative } from '../../narrativeSpine.js';
import { sortCardsByImportance } from '../../positionWeights.js';
import { analyzeElementalDignity } from '../../spreadAnalysis.js';
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
  computeRemedyRotationIndex
} from '../helpers.js';
import { getToneStyle, getFrameVocabulary, buildNameClause, buildPersonalizedClosing } from '../styleHelpers.js';
import {
  selectReasoningConnector,
  buildReasoningAwareOpening,
  enhanceCardTextWithReasoning,
  buildReasoningSynthesis
} from '../reasoningIntegration.js';

export async function buildDecisionReading({
  cardsInfo,
  userQuestion,
  reflectionsText,
  themes,
  context,
  spreadInfo
}, options = {}) {
  const sections = [];
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
  const spreadName = 'Decision / Two-Path';
  const personalization = options.personalization || null;
  const tone = getToneStyle(personalization?.readingTone);
  const frameVocab = getFrameVocabulary(personalization?.spiritualFrame);
  const nameInline = buildNameClause(personalization?.displayName, 'inline');
  const proseOptions = { proseMode: options.proseMode === true };

  // Use reasoning-aware opening if available
  const openingQuestion = userQuestion ||
    'This spread illuminates the heart of your decision, two possible paths, clarifying insight, and a reminder of your agency.';
  const opening = reasoning
    ? buildReasoningAwareOpening(spreadName, openingQuestion, context, reasoning, { personalization: options.personalization })
    : buildOpening(spreadName, openingQuestion, context, { personalization: options.personalization });
  sections.push(opening);

  const normalizedCards = Array.isArray(cardsInfo) ? cardsInfo : [];
  if (normalizedCards.length < 5) {
    const placeholder = '### Decision / Two-Path\n\nThis spread needs all five cards (heart, two paths, clarifier, and free-will reminder) before a narrative can be generated. Draw or reveal the remaining cards, then try again.';
    return appendReversalReminder(placeholder, normalizedCards, themes);
  }
  const prioritized = sortCardsByImportance(normalizedCards, 'decision');
  const [heart, pathA, pathB, clarifier, freeWill] = normalizedCards;
  const positionOptions = getPositionOptions(themes, context);
  const remedyRotationIndex = computeRemedyRotationIndex({ cardsInfo: normalizedCards, userQuestion, spreadInfo });

  const attentionNote = buildWeightAttentionIntro(prioritized, spreadName, undefined, proseOptions);
  if (attentionNote) {
    sections.push(attentionNote);
  }

  // THE CHOICE
  let choice = `### The Choice\n\n`;
  const heartPosition = heart?.position || 'Heart of the decision';
  if (heart) {
    let heartText = buildPositionCardText(heart, heartPosition, positionOptions);
    if (reasoning) {
      const enhanced = enhanceCardTextWithReasoning(heartText, 0, reasoning, proseOptions);
      if (enhanced.enhanced) heartText = enhanced.text;
    }
    choice += heartText;
    choice += '\n\nThis position stands at the center of your decision and points toward what truly matters as you weigh each path.';
  } else {
    choice += 'This position has not been revealed yet, so the core of the decision is still taking shape.';
  }

  if (heart) {
    const heartWeightNote = buildWeightNote('decision', 0, heartPosition, proseOptions);
    if (heartWeightNote) {
      choice += `\n\n${heartWeightNote}`;
    }
  }
  sections.push(
    recordSection(choice, {
      type: 'decision-core',
      cards: [heart]
    })
  );

  // PATH A
  let aSection = `### Path A\n\n`;
  const pathAPosition = pathA?.position || 'Path A — energy & likely outcome';
  if (pathA) {
    const pathAConnector = (reasoning && selectReasoningConnector(reasoning, 0, 1)) || getConnector(pathAPosition, 'toPrev');
    let pathAText = buildPositionCardText(pathA, pathAPosition, positionOptions);
    if (reasoning) {
      const enhanced = enhanceCardTextWithReasoning(pathAText, 1, reasoning, proseOptions);
      if (enhanced.enhanced) pathAText = enhanced.text;
    }
    aSection += pathAConnector ? `${pathAConnector} ${pathAText}` : pathAText;
    aSection += '\n\nThis path suggests one possible trajectory if you commit to this direction.';

    const pathAWeightNote = buildWeightNote('decision', 1, pathAPosition, proseOptions);
    if (pathAWeightNote) {
      aSection += `\n\n${pathAWeightNote}`;
    }
  } else {
    aSection += 'Path A has not been revealed yet, so we cannot describe this trajectory.\n\n';
  }
  sections.push(
    recordSection(aSection, {
      type: 'decision-path',
      cards: [pathA]
    })
  );

  // PATH B
  let bSection = `### Path B\n\n`;
  const pathBPosition = pathB?.position || 'Path B — energy & likely outcome';
  if (pathB) {
    const pathBConnector = (reasoning && selectReasoningConnector(reasoning, 1, 2)) || getConnector(pathBPosition, 'toPrev');
    let pathBText = buildPositionCardText(pathB, pathBPosition, positionOptions);
    if (reasoning) {
      const enhanced = enhanceCardTextWithReasoning(pathBText, 2, reasoning, proseOptions);
      if (enhanced.enhanced) pathBText = enhanced.text;
    }
    bSection += pathBConnector ? `${pathBConnector} ${pathBText}` : pathBText;
    bSection += '\n\nThis path suggests an alternate trajectory, inviting you to compare how each route aligns with your values.';

    const pathBWeightNote = buildWeightNote('decision', 2, pathBPosition, proseOptions);
    if (pathBWeightNote) {
      bSection += `\n\n${pathBWeightNote}`;
    }
  } else {
    bSection += 'Path B has not been revealed yet, so there is no comparison point for the alternate route.\n\n';
  }
  sections.push(
    recordSection(bSection, {
      type: 'decision-path',
      cards: [pathB]
    })
  );

  // CLARITY + AGENCY
  let clarity = `### Clarity + Agency\n\n`;

  if (clarifier) {
    const clarifierPosition = clarifier.position || 'What clarifies the best path';
    const clarifierConnector = (reasoning && selectReasoningConnector(reasoning, 2, 3)) || getConnector(clarifierPosition, 'toPrev');
    let clarifierText = buildPositionCardText(clarifier, clarifierPosition, positionOptions);
    if (reasoning) {
      const enhanced = enhanceCardTextWithReasoning(clarifierText, 3, reasoning, proseOptions);
      if (enhanced.enhanced) clarifierText = enhanced.text;
    }
    clarity += clarifierConnector ? `${clarifierConnector} ${clarifierText}` : clarifierText;
    clarity += '\n\n';

    const clarifierWeightNote = buildWeightNote('decision', 3, clarifierPosition, proseOptions);
    if (clarifierWeightNote) {
      clarity += `${clarifierWeightNote}\n\n`;
    }
  } else {
    clarity += 'Clarifier card not provided yet, so note any new information you need before committing.\n\n';
  }

  if (pathA && pathB) {
    const elemental = analyzeElementalDignity(pathA, pathB);
    if (elemental && elemental.description) {
      clarity += `Comparing the two paths: ${elemental.description}. `;
    }
  }

  if (freeWill) {
    const freeWillPosition = freeWill.position || 'What to remember about your free will';
    const freeWillConnector = (reasoning && selectReasoningConnector(reasoning, 3, 4)) || getConnector(freeWillPosition, 'toPrev');
    let freeWillText = buildPositionCardText(freeWill, freeWillPosition, positionOptions);
    if (reasoning) {
      const enhanced = enhanceCardTextWithReasoning(freeWillText, 4, reasoning, proseOptions);
      if (enhanced.enhanced) freeWillText = enhanced.text;
    }
    clarity += freeWillConnector ? `${freeWillConnector} ${freeWillText}` : freeWillText;
    clarity += '\n\n';

    const freeWillWeightNote = buildWeightNote('decision', 4, freeWillPosition, proseOptions);
    if (freeWillWeightNote) {
      clarity += `${freeWillWeightNote}\n\n`;
    }
  } else {
    clarity += 'Remember: your free will ultimately guides this choice, even without a dedicated card drawn yet.\n\n';
  }

  clarity +=
    'Use these insights to understand how each option feels in your body and life. The cards illuminate possibilities; you remain the one who chooses. Each route is a trajectory shaped by your next intentional steps.';

  sections.push(
    recordSection(clarity, {
      type: 'decision-clarity',
      cards: [clarifier, freeWill].filter(Boolean)
    })
  );

  const supportingSummary = buildSupportingPositionsSummary(prioritized, spreadName, undefined, proseOptions);
  if (supportingSummary) {
    sections.push(supportingSummary);
  }

  if (reflectionsText && reflectionsText.trim()) {
    sections.push(buildReflectionsSection(reflectionsText));
  }

  // Use reasoning synthesis if available, otherwise fall back to pattern synthesis
  const synthesisSection = reasoning
    ? buildReasoningSynthesis(normalizedCards, reasoning, themes, userQuestion, context)
    : buildPatternSynthesis(themes);
  if (synthesisSection) {
    sections.push(synthesisSection);
  }

  // Guidance synthesis with elemental remedies
  let guidanceSection = await buildDecisionGuidance(normalizedCards, themes, context, remedyRotationIndex);
  if (guidanceSection) {
    const tonePhrase = tone.challengeFraming || 'clear reminder';
    const frameWord = frameVocab[0] || 'insight';
    guidanceSection += `\n\nFor you${nameInline || ''} this is a ${tonePhrase} to notice which path carries more ${frameWord} and agency.`;
  }
  if (guidanceSection) {
    sections.push(
      recordSection(guidanceSection, {
        type: 'guidance',
        cards: normalizedCards
      })
    );
  }

  const full = sections.filter(Boolean).join('\n\n');
  const validation = validateReadingNarrative(full);
  if (!validation.isValid) {
    console.debug('Decision narrative spine suggestions:', validation.suggestions || validation.sectionAnalyses);
  }

  const closing = buildPersonalizedClosing(personalization);
  const narrative = closing ? `${full}\n\n${closing}` : full;

  return appendReversalReminder(narrative, cardsInfo, themes);
}

async function buildDecisionGuidance(cardsInfo, themes, context, rotationIndex = 0) {
  let section = `### Guidance\n\n`;

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
      console.error('[Decision] Elemental remedies unavailable:', err.message);
    }
  }

  // Decision-specific guidance
  section += `Remember: a decision is not a single moment but a series of aligned actions. `;
  section += `These cards show energies and tendencies, not fixed outcomes. `;
  section += `Your choices, moment to moment, shape which path you actually walk.`;

  return section;
}
