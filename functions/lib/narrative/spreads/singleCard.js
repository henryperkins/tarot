import { enhanceSection, validateReadingNarrative } from '../../narrativeSpine.js';
import {
  appendReversalReminder,
  buildPositionCardText,
  getPositionOptions,
  buildContextReminder
} from '../helpers.js';

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

  if (!Array.isArray(cardsInfo) || cardsInfo.length === 0 || !cardsInfo[0]) {
    return '### One-Card Insight\n\nNo card data was provided. Please draw at least one card to receive a focused message.';
  }

  const card = cardsInfo[0];
  const positionOptions = getPositionOptions(themes, context);

  let narrative = `### One-Card Insight\n\n`;

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
  const baseText = buildPositionCardText(card, positionLabel, positionOptions);

  narrative += `${baseText}\n\n`;
  narrative +=
    "In simple terms: notice what this theme is asking you to acknowledge (WHAT), reflect on why it might be surfacing now (WHY), and choose one small, aligned next step that honors your agency (WHAT'S NEXT). Therefore, treat this insight as a living moment, not a fixed verdict—a trajectory you actively shape.";

  if (reflectionsText && reflectionsText.trim()) {
    narrative += `\n\n### Your Reflections\n\n${reflectionsText.trim()}`;
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
