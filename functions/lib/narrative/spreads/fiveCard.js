import { enhanceSection, validateReadingNarrative } from '../../narrativeSpine.js';
import { sortCardsByImportance } from '../../positionWeights.js';
import {
  appendReversalReminder,
  buildPositionCardText,
  getPositionOptions,
  buildWeightAttentionIntro,
  buildWeightNote,
  buildSupportingPositionsSummary,
  buildPatternSynthesis,
  getConnector,
  computeRemedyRotationIndex
} from '../helpers.js';
import { getToneStyle, getFrameVocabulary, buildNameClause } from '../styleHelpers.js';
import {
  selectReasoningConnector,
  buildReasoningAwareOpening,
  enhanceCardTextWithReasoning,
  buildReasoningSynthesis
} from '../reasoningIntegration.js';
import { BaseSpreadBuilder, buildSpreadFallback } from './base.js';

class FiveCardBuilder extends BaseSpreadBuilder {
  constructor(options = {}) {
    super(options);
  }

  async buildFiveCardGuidance(cardsInfo, themes, context, direction, rotationIndex = 0) {
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
        console.error('[Five-Card] Elemental remedies unavailable:', err.message);
      }
    }

    // Direction summary
    section += `The path ahead shows ${direction.card} ${direction.orientation}. `;
    section += `This is not fixed fate, but where current momentum leads if nothing shifts. `;
    section += `Your awareness and choices shape what unfolds next.`;

    return section;
  }

  async buildNarrative({
    cardsInfo,
    userQuestion,
    reflectionsText,
    fiveCardAnalysis,
    themes,
    context,
    spreadInfo
  }) {
    const expectedCount = 5;
    const receivedCount = Array.isArray(cardsInfo) ? cardsInfo.length : 0;
    const fallback = buildSpreadFallback({
      spreadName: 'Five-Card Clarity',
      expectedCount,
      receivedCount
    });
    if (!Array.isArray(cardsInfo) || receivedCount === 0) {
      return fallback;
    }
    if (receivedCount !== expectedCount) {
      return buildSpreadFallback({
        spreadName: 'Five-Card Clarity',
        expectedCount,
        receivedCount
      });
    }
    for (let i = 0; i < cardsInfo.length; i++) {
      const card = cardsInfo[i];
      if (!card || !card.card || !card.position) {
        return buildSpreadFallback({
          spreadName: 'Five-Card Clarity',
          expectedCount,
          receivedCount,
          reason: `Missing details for card ${i + 1}.`
        });
      }
    }
    const sections = [];
    const personalization = this.options.personalization || null;
    const tone = getToneStyle(personalization?.readingTone);
    const frameVocab = getFrameVocabulary(personalization?.spiritualFrame);
    const nameInline = buildNameClause(personalization?.displayName, 'inline');
    const proseOptions = { proseMode: this.options.proseMode === true };
    const collectValidation = typeof this.options.collectValidation === 'function' ? this.options.collectValidation : null;
    const reasoning = this.options.reasoning || null;

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
    const spreadName = 'Five-Card Clarity';

    // Use reasoning-aware opening if available
    const opening = reasoning
      ? buildReasoningAwareOpening(spreadName, userQuestion, context, reasoning, { personalization: this.options.personalization })
      : this.buildOpening(spreadName, userQuestion, context);
    sections.push(opening);

    const [core, challenge, hidden, support, direction] = cardsInfo;
    const prioritized = sortCardsByImportance(cardsInfo, 'fiveCard');
    const positionOptions = getPositionOptions(themes, context);
    const remedyRotationIndex = computeRemedyRotationIndex({ cardsInfo, userQuestion, spreadInfo });

    const attentionNote = buildWeightAttentionIntro(prioritized, spreadName, undefined, proseOptions);
    if (attentionNote) {
      sections.push(attentionNote);
    }

    // Core + Challenge section
    let coreSection = `### Five-Card Clarity — Core & Challenge\n\n`;
    const corePosition = core.position || 'Core of the matter';
    let coreText = buildPositionCardText(core, corePosition, positionOptions);
    if (reasoning) {
      const enhanced = enhanceCardTextWithReasoning(coreText, 0, reasoning, proseOptions);
      if (enhanced.enhanced) coreText = enhanced.text;
    }
    coreSection += coreText;
    coreSection += '\n\n';
    const challengePosition = challenge.position || 'Challenge or tension';
    const challengeConnector = (reasoning && selectReasoningConnector(reasoning, 0, 1)) || getConnector(challengePosition, 'toPrev');
    let challengeText = buildPositionCardText(
      challenge,
      challengePosition,
      {
        ...positionOptions,
        prevElementalRelationship: fiveCardAnalysis?.coreVsChallenge
      }
    );
    if (reasoning) {
      const enhanced = enhanceCardTextWithReasoning(challengeText, 1, reasoning, proseOptions);
      if (enhanced.enhanced) challengeText = enhanced.text;
    }
    coreSection += challengeConnector ? `${challengeConnector} ${challengeText}` : challengeText;
    coreSection += '\n\n';

    if (fiveCardAnalysis?.coreVsChallenge?.description) {
      coreSection += `\n\n${fiveCardAnalysis.coreVsChallenge.description}.`;
    }

    const coreWeightNotes = [
      buildWeightNote('fiveCard', 0, corePosition, proseOptions),
      buildWeightNote('fiveCard', 1, challengePosition, proseOptions)
    ].filter(Boolean);
    if (coreWeightNotes.length > 0) {
      coreSection += `\n\n${coreWeightNotes.join(' ')}`;
    }

    sections.push(
      recordSection(coreSection, {
        type: 'nucleus',
        cards: [core, challenge],
        relationships: { elementalRelationship: fiveCardAnalysis?.coreVsChallenge }
      })
    );

    // Hidden influence
    let hiddenSection = `### Hidden Influence\n\n`;
    const hiddenPosition = hidden.position || 'Hidden / subconscious influence';
    const hiddenConnector = (reasoning && selectReasoningConnector(reasoning, 1, 2)) || getConnector(hiddenPosition, 'toPrev');
    let hiddenText = buildPositionCardText(hidden, hiddenPosition, positionOptions);
    if (reasoning) {
      const enhanced = enhanceCardTextWithReasoning(hiddenText, 2, reasoning, proseOptions);
      if (enhanced.enhanced) hiddenText = enhanced.text;
    }
    hiddenSection += hiddenConnector ? `${hiddenConnector} ${hiddenText}` : hiddenText;

    const hiddenWeightNote = buildWeightNote('fiveCard', 2, hiddenPosition, proseOptions);
    if (hiddenWeightNote) {
      hiddenSection += `\n\n${hiddenWeightNote}`;
    }
    sections.push(
      recordSection(hiddenSection, {
        type: 'subconscious',
        cards: [hidden]
      })
    );

    // Support
    let supportSection = `### Supporting Energies\n\n`;
    const supportPosition = support.position || 'Support / helpful energy';
    const supportConnector = (reasoning && selectReasoningConnector(reasoning, 2, 3)) || getConnector(supportPosition, 'toPrev');
    let supportText = buildPositionCardText(support, supportPosition, positionOptions);
    if (reasoning) {
      const enhanced = enhanceCardTextWithReasoning(supportText, 3, reasoning, proseOptions);
      if (enhanced.enhanced) supportText = enhanced.text;
    }
    supportSection += supportConnector ? `${supportConnector} ${supportText}` : supportText;

    const supportWeightNote = buildWeightNote('fiveCard', 3, supportPosition, proseOptions);
    if (supportWeightNote) {
      supportSection += `\n\n${supportWeightNote}`;
    }
    sections.push(
      recordSection(supportSection, {
        type: 'support',
        cards: [support]
      })
    );

    // Direction
    let directionSection = `### Direction on Your Current Path\n\n`;
    const directionPosition = direction.position || 'Likely direction on current path';
    const directionConnector = (reasoning && selectReasoningConnector(reasoning, 3, 4)) || getConnector(directionPosition, 'toPrev');
    let directionText = buildPositionCardText(
      direction,
      directionPosition,
      {
        ...positionOptions,
        prevElementalRelationship: fiveCardAnalysis?.supportVsDirection
      }
    );
    if (reasoning) {
      const enhanced = enhanceCardTextWithReasoning(directionText, 4, reasoning, proseOptions);
      if (enhanced.enhanced) directionText = enhanced.text;
    }
    directionSection += directionConnector ? `${directionConnector} ${directionText}` : directionText;

    if (fiveCardAnalysis?.synthesis) {
      directionSection += `\n\n${fiveCardAnalysis.synthesis}`;
    }

    const directionWeightNote = buildWeightNote('fiveCard', 4, directionPosition, proseOptions);
    if (directionWeightNote) {
      directionSection += `\n\n${directionWeightNote}`;
    }

    sections.push(
      recordSection(directionSection, {
        type: 'outcome',
        cards: [direction],
        relationships: { elementalRelationship: fiveCardAnalysis?.supportVsDirection }
      })
    );

    const supportingSummary = buildSupportingPositionsSummary(prioritized, spreadName, undefined, proseOptions);
    if (supportingSummary) {
      sections.push(supportingSummary);
    }

    // Reflections
    if (reflectionsText && reflectionsText.trim()) {
      sections.push(this.buildReflections(reflectionsText));
    }

    // Use reasoning synthesis if available, otherwise fall back to pattern synthesis
    const synthesisSection = reasoning
      ? buildReasoningSynthesis(cardsInfo, reasoning, themes, userQuestion, context)
      : buildPatternSynthesis(themes);
    if (synthesisSection) {
      sections.push(synthesisSection);
    }

    // Guidance synthesis with elemental remedies
    let guidanceSection = await this.buildFiveCardGuidance(cardsInfo, themes, context, direction, remedyRotationIndex);
    if (guidanceSection) {
      const tonePhrase = tone.challengeFraming || 'grounded next step';
      const frameWord = frameVocab[0] || 'insight';
      guidanceSection += `\n\nFor you${nameInline || ''} this becomes a ${tonePhrase}, translating ${frameWord} into practice.`;
    }
    if (guidanceSection) {
      sections.push(
        recordSection(guidanceSection, {
          type: 'guidance',
          cards: [direction]
        })
      );
    }

    const full = sections.filter(Boolean).join('\n\n');
    const validation = validateReadingNarrative(full);
    if (!validation.isValid) {
      console.debug('Five-Card narrative spine suggestions:', validation.suggestions || validation.sectionAnalyses);
    }

    const closing = this.buildClosing();
    const narrative = closing ? `${full}\n\n${closing}` : full;
    return appendReversalReminder(narrative, cardsInfo, themes);
  }
}

export async function buildFiveCardReading(payload, options = {}) {
  const builder = new FiveCardBuilder(options);
  return await builder.buildNarrative(payload);
}
