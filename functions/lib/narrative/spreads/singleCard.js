import { enhanceSection, validateReadingNarrative } from '../../narrativeSpine.js';
import {
  appendReversalReminder,
  buildPositionCardText,
  getPositionOptions,
  buildContextReminder
} from '../helpers.js';
import { getToneStyle, getFrameVocabulary, buildNameClause, buildPersonalizedClosing } from '../styleHelpers.js';

export function buildSingleCardReading({
  cardsInfo,
  userQuestion,
  reflectionsText,
  themes,
  context
}, options = {}) {
  const collectValidation =
    typeof options.collectValidation === 'function'
      ? options.collectValidation
      : null;
  const personalization = options.personalization || null;
  const tone = getToneStyle(personalization?.readingTone);
  const frameVocab = getFrameVocabulary(personalization?.spiritualFrame);
  const nameOpening = buildNameClause(personalization?.displayName, 'opening');
  const nameInline = buildNameClause(personalization?.displayName, 'inline');

  if (!Array.isArray(cardsInfo) || cardsInfo.length === 0 || !cardsInfo[0]) {
    return '### One-Card Insight\n\nNo card data was provided. Please draw at least one card to receive a focused message.';
  }

  const card = cardsInfo[0];
  const positionOptions = getPositionOptions(themes, context);

  let narrative = `### One-Card Insight\n\n`;

  if (userQuestion && userQuestion.trim()) {
    const subject = nameOpening ? `${nameOpening}this card` : 'This card';
    narrative += `${subject} offers a ${tone.openingAdjectives[0] || 'thoughtful'} snapshot on your question "${userQuestion.trim()}".\n\n`;
  } else {
    const subject = nameOpening ? `${nameOpening}this single card` : 'This single card';
    narrative += `${subject} offers a ${tone.openingAdjectives[0] || 'grounded'} glimpse of the energy around you right now.\n\n`;
  }

  const contextReminder = buildContextReminder(context);
  if (contextReminder) {
    narrative += `${contextReminder}\n\n`;
  }

  // Core section with WHAT → WHY → WHAT'S NEXT flavor
  const positionLabel = card.position || 'Theme / Guidance of the Moment';
  const baseText = buildPositionCardText(card, positionLabel, positionOptions);

  narrative += `${baseText}\n\n`;
  narrative +=
    "In simple terms: notice what this theme is asking you to acknowledge (WHAT), reflect on why it might be surfacing now (WHY), and choose one small, aligned next step that honors your agency (WHAT'S NEXT). Therefore, treat this insight as a living moment, not a fixed verdict—a trajectory you actively shape.";
  if (nameInline) {
    narrative += ` For you${nameInline || ''} this is a ${tone.challengeFraming || 'gentle prompt'} to move with your own ${frameVocab[0] || 'wisdom'} rather than against it.`;
  }

  if (reflectionsText && reflectionsText.trim()) {
    narrative += `\n\n### Your Reflections\n\n${reflectionsText.trim()}`;
  }

  const closing = buildPersonalizedClosing(personalization);
  if (closing) {
    narrative += `\n\n${closing}`;
  }

  const result = enhanceSection(narrative, {
    type: 'single-card',
    cards: cardsInfo
  });

  if (collectValidation) {
    collectValidation({
      text: result.text,
      metadata: { type: 'single-card', cards: cardsInfo },
      validation: result.validation || null
    });
  }

  const validation = validateReadingNarrative(result.text);
  if (!validation.isValid) {
    console.debug('Single-card narrative spine suggestions:', validation.suggestions || validation.sectionAnalyses);
  }

  return appendReversalReminder(result.text, cardsInfo, themes);
}

/**
 * Three-card builder using [`POSITION_WEIGHTS`](functions/lib/positionWeights.js:6) for emphasis.
 */
