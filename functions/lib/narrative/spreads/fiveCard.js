import { enhanceSection, validateReadingNarrative } from '../../narrativeSpine.js';
import { sortCardsByImportance } from '../../positionWeights.js';
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
  const prioritized = sortCardsByImportance(cardsInfo, 'fiveCard');
  const positionOptions = getPositionOptions(themes, context);

  const attentionNote = buildWeightAttentionIntro(prioritized, spreadName);
  if (attentionNote) {
    sections.push(attentionNote);
  }

  // Core + Challenge section
  let coreSection = `### Five-Card Clarity — Core & Challenge\n\n`;
  const corePosition = core.position || 'Core of the matter';
  coreSection += buildPositionCardText(
    core,
    corePosition,
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

  const coreWeightNotes = [
    buildWeightNote('fiveCard', 0, corePosition),
    buildWeightNote('fiveCard', 1, challengePosition)
  ].filter(Boolean);
  if (coreWeightNotes.length > 0) {
    coreSection += `\n\n${coreWeightNotes.join(' ')}`;
  }

  sections.push(enhanceSection(coreSection, {
    type: 'nucleus',
    cards: [core, challenge],
    relationships: { elementalRelationship: fiveCardAnalysis?.coreVsChallenge }
  }).text);

  // Hidden influence
  let hiddenSection = `### Hidden Influence\n\n`;
  const hiddenPosition = hidden.position || 'Hidden / subconscious influence';
  const hiddenConnector = getConnector(hiddenPosition, 'toPrev');
  const hiddenText = buildPositionCardText(
    hidden,
    hiddenPosition,
    positionOptions
  );
  hiddenSection += hiddenConnector ? `${hiddenConnector} ${hiddenText}` : hiddenText;

  const hiddenWeightNote = buildWeightNote('fiveCard', 2, hiddenPosition);
  if (hiddenWeightNote) {
    hiddenSection += `\n\n${hiddenWeightNote}`;
  }
  sections.push(enhanceSection(hiddenSection, {
    type: 'subconscious',
    cards: [hidden]
  }).text);

  // Support
  let supportSection = `### Supporting Energies\n\n`;
  const supportPosition = support.position || 'Support / helpful energy';
  const supportConnector = getConnector(supportPosition, 'toPrev');
  const supportText = buildPositionCardText(
    support,
    supportPosition,
    positionOptions
  );
  supportSection += supportConnector ? `${supportConnector} ${supportText}` : supportText;

  const supportWeightNote = buildWeightNote('fiveCard', 3, supportPosition);
  if (supportWeightNote) {
    supportSection += `\n\n${supportWeightNote}`;
  }
  sections.push(enhanceSection(supportSection, {
    type: 'support',
    cards: [support]
  }).text);

  // Direction
  let directionSection = `### Direction on Your Current Path\n\n`;
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

  const directionWeightNote = buildWeightNote('fiveCard', 4, directionPosition);
  if (directionWeightNote) {
    directionSection += `\n\n${directionWeightNote}`;
  }

  sections.push(enhanceSection(directionSection, {
    type: 'outcome',
    cards: [direction],
    relationships: { elementalRelationship: fiveCardAnalysis?.supportVsDirection }
  }).text);

  const supportingSummary = buildSupportingPositionsSummary(prioritized, spreadName);
  if (supportingSummary) {
    sections.push(supportingSummary);
  }

  // Reflections
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
    console.debug('Five-Card narrative spine suggestions:', validation.suggestions || validation.sectionAnalyses);
  }

  return appendReversalReminder(full, cardsInfo, themes);
}
