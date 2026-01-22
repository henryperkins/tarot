import { enhanceSection, validateReadingNarrative } from '../../narrativeSpine.js';
import {
  appendReversalReminder,
  buildPositionCardText,
  getPositionOptions,
  buildContextReminder
} from '../helpers.js';
import { getToneStyle, getFrameVocabulary, buildNameClause } from '../styleHelpers.js';
import {
  buildReasoningAwareOpening,
  buildReasoningSynthesis
} from '../reasoningIntegration.js';
import { BaseSpreadBuilder, buildSpreadFallback } from './base.js';

class SingleCardBuilder extends BaseSpreadBuilder {
  constructor(options = {}) {
    super(options);
  }

  buildNarrative({
    cardsInfo,
    userQuestion,
    reflectionsText,
    themes,
    context
  }) {
    const expectedCount = 1;
    const receivedCount = Array.isArray(cardsInfo) ? cardsInfo.length : 0;
    const fallback = buildSpreadFallback({
      spreadName: 'One-Card Insight',
      expectedCount,
      receivedCount
    });
    if (!Array.isArray(cardsInfo) || receivedCount === 0) {
      return fallback;
    }
    if (receivedCount !== expectedCount) {
      return buildSpreadFallback({
        spreadName: 'One-Card Insight',
        expectedCount,
        receivedCount
      });
    }
    for (let i = 0; i < cardsInfo.length; i++) {
      const card = cardsInfo[i];
      if (!card || !card.card || !card.position) {
        return buildSpreadFallback({
          spreadName: 'One-Card Insight',
          expectedCount,
          receivedCount,
          reason: `Missing details for card ${i + 1}.`
        });
      }
    }
    const collectValidation = typeof this.options.collectValidation === 'function' ? this.options.collectValidation : null;
    const reasoning = this.options.reasoning || null;
    const tone = getToneStyle(this.options.personalization?.readingTone);
    const frameVocab = getFrameVocabulary(this.options.personalization?.spiritualFrame);
    const nameOpening = buildNameClause(this.options.personalization?.displayName, 'opening');
    const nameInline = buildNameClause(this.options.personalization?.displayName, 'inline');

    const card = cardsInfo[0];
    const positionOptions = getPositionOptions(themes, context);

    let narrative = '';

    // Use reasoning-aware opening if available
    if (reasoning) {
      narrative = buildReasoningAwareOpening(
        'One-Card Insight',
        userQuestion,
        context,
        reasoning,
        { personalization: this.options.personalization }
      );
      narrative += '\n\n';
    } else {
      narrative = `### One-Card Insight\n\n`;
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
      narrative += `\n\n${this.buildReflections(reflectionsText)}`;
    }

    // Add reasoning synthesis if available
    if (reasoning) {
      const synthesis = buildReasoningSynthesis(
        cardsInfo,
        reasoning,
        themes,
        userQuestion,
        context
      );
      if (synthesis) {
        narrative += `\n\n${synthesis}`;
      }
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

    const closing = this.buildClosing();
    const narrativeWithClosing = closing ? `${result.text}\n\n${closing}` : result.text;
    return appendReversalReminder(narrativeWithClosing, cardsInfo, themes);
  }
}

export function buildSingleCardReading(payload, options = {}) {
  const builder = new SingleCardBuilder(options);
  return builder.buildNarrative(payload);
}
