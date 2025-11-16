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
  getConnector
} from '../helpers.js';

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

  const normalizedCards = Array.isArray(cardsInfo) ? cardsInfo : [];
  const prioritized = sortCardsByImportance(normalizedCards, 'decision');
  const [heart, pathA, pathB, clarifier, freeWill] = normalizedCards;
  const options = getPositionOptions(themes, context);

  const attentionNote = buildWeightAttentionIntro(prioritized, spreadName);
  if (attentionNote) {
    sections.push(attentionNote);
  }

  // THE CHOICE
  let choice = `### The Choice\n\n`;
  const heartPosition = heart?.position || 'Heart of the decision';
  choice += buildPositionCardText(
    heart,
    heartPosition,
    options
  );
  choice += '\n\nThis position stands at the center of your decision and points toward what truly matters as you weigh each path.';

  const heartWeightNote = buildWeightNote('decision', 0, heartPosition);
  if (heartWeightNote) {
    choice += `\n\n${heartWeightNote}`;
  }
  sections.push(
    enhanceSection(choice, {
      type: 'decision-core',
      cards: [heart]
    }).text
  );

  // PATH A
  let aSection = `### Path A\n\n`;
  const pathAPosition = pathA.position || 'Path A — energy & likely outcome';
  const pathAConnector = getConnector(pathAPosition, 'toPrev');
  const pathAText = buildPositionCardText(
    pathA,
    pathAPosition,
    options
  );
  aSection += pathAConnector ? `${pathAConnector} ${pathAText}` : pathAText;
  aSection += '\n\nThis path suggests one possible trajectory if you commit to this direction.';

  const pathAWeightNote = buildWeightNote('decision', 1, pathAPosition);
  if (pathAWeightNote) {
    aSection += `\n\n${pathAWeightNote}`;
  }
  sections.push(
    enhanceSection(aSection, {
      type: 'decision-path',
      cards: [pathA]
    }).text
  );

  // PATH B
  let bSection = `### Path B\n\n`;
  const pathBPosition = pathB.position || 'Path B — energy & likely outcome';
  const pathBConnector = getConnector(pathBPosition, 'toPrev');
  const pathBText = buildPositionCardText(
    pathB,
    pathBPosition,
    options
  );
  bSection += pathBConnector ? `${pathBConnector} ${pathBText}` : pathBText;
  bSection += '\n\nThis path suggests an alternate trajectory, inviting you to compare how each route aligns with your values.';

  const pathBWeightNote = buildWeightNote('decision', 2, pathBPosition);
  if (pathBWeightNote) {
    bSection += `\n\n${pathBWeightNote}`;
  }
  sections.push(
    enhanceSection(bSection, {
      type: 'decision-path',
      cards: [pathB]
    }).text
  );

  // CLARITY + AGENCY
  let clarity = `### Clarity + Agency\n\n`;

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

    const clarifierWeightNote = buildWeightNote('decision', 3, clarifierPosition);
    if (clarifierWeightNote) {
      clarity += `${clarifierWeightNote}\n\n`;
    }
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

    const freeWillWeightNote = buildWeightNote('decision', 4, freeWillPosition);
    if (freeWillWeightNote) {
      clarity += `${freeWillWeightNote}\n\n`;
    }
  }

  clarity +=
    'Use these insights to understand how each option feels in your body and life. The cards illuminate possibilities; you remain the one who chooses. Each route is a trajectory shaped by your next intentional steps.';

  sections.push(
    enhanceSection(clarity, {
      type: 'decision-clarity',
      cards: [clarifier, freeWill].filter(Boolean)
    }).text
  );

  const supportingSummary = buildSupportingPositionsSummary(prioritized, spreadName);
  if (supportingSummary) {
    sections.push(supportingSummary);
  }

  if (reflectionsText && reflectionsText.trim()) {
    sections.push(buildReflectionsSection(reflectionsText));
  }

  const patternSection = buildPatternSynthesis(themes);
  if (patternSection) {
    sections.push(patternSection);
  }

  const full = sections.filter(Boolean).join('\n\n');
  const validation = validateReadingNarrative(full);
  if (!validation.isValid) {
    console.debug('Decision narrative spine suggestions:', validation.suggestions || validation.sectionAnalyses);
  }

  return appendReversalReminder(full, cardsInfo, themes);
}
