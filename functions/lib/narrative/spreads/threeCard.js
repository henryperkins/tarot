import { enhanceSection, validateReadingNarrative } from '../../narrativeSpine.js';
import { sortCardsByImportance, getPositionWeight } from '../../positionWeights.js';
import {
  appendReversalReminder,
  buildPositionCardText,
  getPositionOptions,
  buildWeightAttentionIntro,
  buildWeightNote,
  buildSupportingPositionsSummary,
  buildPatternSynthesis,
  getConnector,
  getContextDescriptor,
  buildReversalGuidance,
  DEFAULT_WEIGHT_DETAIL_THRESHOLD,
  computeRemedyRotationIndex,
  getSectionHeader
} from '../helpers.js';
import { getToneStyle, getFrameVocabulary, buildNameClause } from '../styleHelpers.js';
import {
  selectReasoningConnector,
  buildReasoningAwareOpening,
  enhanceCardTextWithReasoning,
  buildReasoningSynthesis
} from '../reasoningIntegration.js';
import { BaseSpreadBuilder, buildSpreadFallback } from './base.js';

class ThreeCardBuilder extends BaseSpreadBuilder {
  constructor(options = {}) {
    super(options);
  }

  async buildThreeCardGuidance(cardsInfo, themes, context, direction, rotationIndex = 0) {
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
        console.error('[Three-Card] Elemental remedies unavailable:', err.message);
      }
    }

    // Timing profile (if available)
    if (themes.timingProfile === 'near-term-tilt') {
      section += `Pace: These dynamics are poised to move in the nearer term if you act on them.\n\n`;
    } else if (themes.timingProfile === 'longer-arc-tilt') {
      section += `Pace: This pattern points to a longer, structural shift that unfolds over time.\n\n`;
    } else if (themes.timingProfile === 'developing-arc') {
      section += `Pace: Expect this to unfold across a meaningful chapter rather than in a single moment.\n\n`;
    }

    const future = cardsInfo[2];
    const futureWeight = getPositionWeight('threeCard', 2);
    const presentWeight = getPositionWeight('threeCard', 1);
    section += `The path ahead shows ${future.card} ${future.orientation}.`;
    section += ` This is not fixed fate, but the trajectory of current momentum. Your awareness and choices shape what unfolds next.`;

    if (futureWeight >= DEFAULT_WEIGHT_DETAIL_THRESHOLD) {
      section += ` The Future position carries a weight of ${futureWeight.toFixed(2)}, so its voice leads the guidance.`;
    } else if (presentWeight >= DEFAULT_WEIGHT_DETAIL_THRESHOLD) {
      section += ` With the Present sitting at weight ${presentWeight.toFixed(2)}, your current stance remains the main lever for change.`;
    }

    section += '\n\nAltogether, these threads suggest your next supportive step and point toward how to walk this path with agency.';

    return section;
  }

  async buildNarrative({
    cardsInfo,
    userQuestion,
    reflectionsText,
    threeCardAnalysis,
    themes,
    context,
    spreadInfo
  }) {
    const expectedCount = 3;
    const receivedCount = Array.isArray(cardsInfo) ? cardsInfo.length : 0;
    const fallback = buildSpreadFallback({
      spreadName: 'Three-Card Story (Past · Present · Future)',
      expectedCount,
      receivedCount
    });
    if (!Array.isArray(cardsInfo) || receivedCount === 0) {
      return fallback;
    }
    if (receivedCount !== expectedCount) {
      return buildSpreadFallback({
        spreadName: 'Three-Card Story (Past · Present · Future)',
        expectedCount,
        receivedCount
      });
    }
    for (let i = 0; i < cardsInfo.length; i++) {
      const card = cardsInfo[i];
      if (!card || !card.card || !card.position) {
        return buildSpreadFallback({
          spreadName: 'Three-Card Story (Past · Present · Future)',
          expectedCount,
          receivedCount,
          reason: `Missing details for card ${i + 1}.`
        });
      }
    }
    const sections = [];
    const prioritized = sortCardsByImportance(cardsInfo, 'threeCard');
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

    // Use reasoning-aware opening if available
    const opening = reasoning
      ? buildReasoningAwareOpening(
        'Three-Card Story (Past · Present · Future)',
        userQuestion,
        context,
        reasoning,
        { personalization: this.options.personalization }
      )
      : this.buildOpening(
        'Three-Card Story (Past · Present · Future)',
        userQuestion,
        context
      );
    sections.push(opening);

    const [past, present, future] = cardsInfo;
    const positionOptions = getPositionOptions(themes, context);
    const remedyRotationIndex = computeRemedyRotationIndex({ cardsInfo, userQuestion, spreadInfo });

    const attentionNote = buildWeightAttentionIntro(prioritized, 'Three-Card Story', DEFAULT_WEIGHT_DETAIL_THRESHOLD, proseOptions);
    if (attentionNote) {
      sections.push(attentionNote);
    }

    const storyHeader = getSectionHeader('threeCardStory', proseOptions);
    let narrative = storyHeader ? `${storyHeader}\n\n` : '';

    const pastPosition = past.position || 'Past — influences that led here';
    const presentPosition = present.position || 'Present — where you stand now';
    const futurePosition = future.position || 'Future — trajectory if nothing shifts';

    // Past card
    let pastText = buildPositionCardText(past, pastPosition, positionOptions);
    if (reasoning) {
      const enhanced = enhanceCardTextWithReasoning(pastText, 0, reasoning, proseOptions);
      if (enhanced.enhanced) pastText = enhanced.text;
    }
    narrative += `${pastText}\n\n`;
    const pastWeightNote = buildWeightNote('threeCard', 0, pastPosition, proseOptions);
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
      const enhanced = enhanceCardTextWithReasoning(presentText, 1, reasoning, proseOptions);
      if (enhanced.enhanced) presentText = enhanced.text;
    }
    narrative += `${presentConnector} ${presentText}\n\n`;
    const presentWeightNote = buildWeightNote('threeCard', 1, presentPosition, proseOptions);
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
      const enhanced = enhanceCardTextWithReasoning(futureText, 2, reasoning, proseOptions);
      if (enhanced.enhanced) futureText = enhanced.text;
    }
    narrative += `${futureConnector} ${futureText}\n\n`;
    const futureWeightNote = buildWeightNote('threeCard', 2, futurePosition, proseOptions);
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
      sections.push(this.buildReflections(reflectionsText));
    }

    // Use reasoning synthesis if available, otherwise fall back to pattern synthesis
    const synthesisSection = reasoning
      ? buildReasoningSynthesis(cardsInfo, reasoning, themes, userQuestion, context)
      : buildPatternSynthesis(themes);
    if (synthesisSection) {
      sections.push(synthesisSection);
    }

    const supportingSummary = buildSupportingPositionsSummary(prioritized, 'Three-Card Story', undefined, proseOptions);
    if (supportingSummary) {
      sections.push(supportingSummary);
    }

    let guidanceSection = await this.buildThreeCardGuidance(cardsInfo, themes, context, future, remedyRotationIndex);
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
    const validation = validateReadingNarrative(full);
    if (!validation.isValid) {
      console.debug('Three-card narrative spine suggestions:', validation.suggestions || validation.sectionAnalyses);
    }

    const closing = this.buildClosing();
    const narrativeWithClosing = closing ? `${full}\n\n${closing}` : full;
    return appendReversalReminder(narrativeWithClosing, cardsInfo, themes);
  }
}

export async function buildThreeCardReading(payload, options = {}) {
  const builder = new ThreeCardBuilder(options);
  return await builder.buildNarrative(payload);
}
