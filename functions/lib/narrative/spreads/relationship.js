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
  buildInlineReversalNote,
  buildGuidanceActionPrompt,
  computeRemedyRotationIndex
} from '../helpers.js';
import { getToneStyle, getFrameVocabulary, buildNameClause, buildPersonalizedClosing } from '../styleHelpers.js';
import {
  selectReasoningConnector,
  buildReasoningAwareOpening,
  enhanceCardTextWithReasoning,
  buildReasoningSynthesis
} from '../reasoningIntegration.js';

export async function buildRelationshipReading({
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
  const spreadName = 'Relationship Snapshot';
  const personalization = options.personalization || null;
  const tone = getToneStyle(personalization?.readingTone);
  const frameVocab = getFrameVocabulary(personalization?.spiritualFrame);
  const nameInline = buildNameClause(personalization?.displayName, 'inline');

  // Use reasoning-aware opening if available
  const openingQuestion = userQuestion ||
    'This spread explores your energy, their energy, the connection between you, and guidance for relating with agency and care.';
  const opening = reasoning
    ? buildReasoningAwareOpening(spreadName, openingQuestion, context, reasoning, { personalization: options.personalization })
    : buildOpening(spreadName, openingQuestion, context, { personalization: options.personalization });
  sections.push(opening);

  const normalizedCards = Array.isArray(cardsInfo) ? cardsInfo : [];
  const prioritized = sortCardsByImportance(normalizedCards, 'relationship');
  const remedyRotationIndex = computeRemedyRotationIndex({ cardsInfo: normalizedCards, userQuestion, spreadInfo });
  const [youCard, themCard, connectionCard, ...extraCards] = normalizedCards;
  const dynamicsCard = extraCards[0];
  const outcomeCard = extraCards[1];
  const positionOptions = getPositionOptions(themes, context);
  let reversalReminderEmbedded = false;

  const attentionNote = buildWeightAttentionIntro(prioritized, spreadName);
  if (attentionNote) {
    sections.push(attentionNote);
  }

  // YOU AND THEM
  let youThem = `### You and Them\n\n`;
  const dyadCards = [youCard, themCard].filter(Boolean);

  if (youCard) {
    const youPosition = youCard.position || 'You / your energy';
    let youText = buildPositionCardText(youCard, youPosition, positionOptions);
    if (reasoning) {
      const enhanced = enhanceCardTextWithReasoning(youText, 0, reasoning);
      if (enhanced.enhanced) youText = enhanced.text;
    }
    youThem += youText;

    const youReversalNote = buildInlineReversalNote(youCard, themes, {
      shouldIncludeReminder: !reversalReminderEmbedded
    });
    if (youReversalNote) {
      youThem += `\n\n${youReversalNote.text}`;
      if (youReversalNote.includesReminder) {
        reversalReminderEmbedded = true;
      }
    }

    youThem += '\n\n';

    const youWeightNote = buildWeightNote('relationship', 0, youPosition);
    if (youWeightNote) {
      youThem += `${youWeightNote}\n\n`;
    }
  }

  if (themCard) {
    const themPosition = themCard.position || 'Them / their energy';
    const themConnector = (reasoning && selectReasoningConnector(reasoning, 0, 1)) || getConnector(themPosition, 'toPrev');
    let themText = buildPositionCardText(themCard, themPosition, positionOptions);
    if (reasoning) {
      const enhanced = enhanceCardTextWithReasoning(themText, 1, reasoning);
      if (enhanced.enhanced) themText = enhanced.text;
    }
    youThem += themConnector ? `${themConnector} ${themText}` : themText;

    const themReversalNote = buildInlineReversalNote(themCard, themes, {
      shouldIncludeReminder: !reversalReminderEmbedded
    });
    if (themReversalNote) {
      youThem += `\n\n${themReversalNote.text}`;
      if (themReversalNote.includesReminder) {
        reversalReminderEmbedded = true;
      }
    }

    const themWeightNote = buildWeightNote('relationship', 1, themPosition);
    if (themWeightNote) {
      youThem += `\n\n${themWeightNote}`;
    }
  }

  const elemental = analyzeElementalDignity(youCard, themCard);
  const summaryLines = [];
  if (elemental && elemental.description) {
    summaryLines.push(`*Elemental interplay between you: ${elemental.description}.*`);
    const elementalTakeaway = buildRelationshipElementalTakeaway(elemental, youCard, themCard);
    if (elementalTakeaway) {
      summaryLines.push(elementalTakeaway);
    }
  } else {
    summaryLines.push('Together, this pairing suggests the current dynamic between you and points toward how energy is moving in this connection.');
  }
  youThem += `\n\n${summaryLines.join(' ')}`;

  const relationshipsMeta = elemental && elemental.description
    ? { elementalRelationship: elemental }
    : undefined;

  sections.push(
    recordSection(youThem, {
      type: 'relationship-dyad',
      cards: dyadCards,
      relationships: relationshipsMeta
    })
  );

  // THE CONNECTION
  if (connectionCard) {
    let connection = `### The Connection\n\n`;
    connection += 'This position shows what the bond is asking for right now.\n\n';
    const connectionPosition = connectionCard.position || 'The connection / shared lesson';
    const connectionConnector = (reasoning && selectReasoningConnector(reasoning, 1, 2)) || getConnector(connectionPosition, 'toPrev');
    let connectionText = buildPositionCardText(connectionCard, connectionPosition, positionOptions);
    if (reasoning) {
      const enhanced = enhanceCardTextWithReasoning(connectionText, 2, reasoning);
      if (enhanced.enhanced) connectionText = enhanced.text;
    }
    connection += connectionConnector ? `${connectionConnector} ${connectionText}` : connectionText;

    const connectionReversalNote = buildInlineReversalNote(connectionCard, themes, {
      shouldIncludeReminder: !reversalReminderEmbedded
    });
    if (connectionReversalNote) {
      connection += `\n\n${connectionReversalNote.text}`;
      if (connectionReversalNote.includesReminder) {
        reversalReminderEmbedded = true;
      }
    }

    const connectionWeightNote = buildWeightNote('relationship', 2, connectionPosition);
    if (connectionWeightNote) {
      connection += `\n\n${connectionWeightNote}`;
    }

    connection += '\n\nThis focus invites you to notice what this bond is asking from both of you next.';
    sections.push(
      recordSection(connection, {
        type: 'connection',
        cards: [connectionCard]
      })
    );
  }

  // GUIDANCE FOR THIS CONNECTION (three-card friendly)
  const primaryGuidanceCards = [dynamicsCard, outcomeCard].filter(Boolean);
  const fallbackGuidanceCard = primaryGuidanceCards[0] || connectionCard || themCard || youCard;

  let guidance = `### Guidance for This Connection\n\n`;
  guidance += 'This guidance shows how to participate with agency, honesty, and care.\n\n';

  if (fallbackGuidanceCard) {
    const fallbackPosition = fallbackGuidanceCard.position
      ? fallbackGuidanceCard.position
      : fallbackGuidanceCard === youCard
        ? 'You / your energy'
        : fallbackGuidanceCard === themCard
          ? 'Them / their energy'
          : fallbackGuidanceCard === dynamicsCard
            ? 'Dynamics / guidance'
            : fallbackGuidanceCard === outcomeCard
              ? 'Outcome / what this can become'
              : 'The connection / shared lesson';
    const fallbackConnector = getConnector(fallbackPosition, 'toPrev');
    const fallbackText = buildPositionCardText(
      fallbackGuidanceCard,
      fallbackPosition,
      positionOptions
    );
    guidance += fallbackConnector ? `${fallbackConnector} ${fallbackText}\n\n` : `${fallbackText}\n\n`;

    const fallbackReversal = buildInlineReversalNote(fallbackGuidanceCard, themes, {
      shouldIncludeReminder: !reversalReminderEmbedded
    });
    if (fallbackReversal) {
      guidance += `${fallbackReversal.text}\n\n`;
      if (fallbackReversal.includesReminder) {
        reversalReminderEmbedded = true;
      }
    }

    const fallbackIndex = normalizedCards.findIndex(card => card === fallbackGuidanceCard);
    if (fallbackIndex >= 0) {
      const guidanceWeightNote = buildWeightNote('relationship', fallbackIndex, fallbackPosition);
      if (guidanceWeightNote) {
        guidance += `${guidanceWeightNote}\n\n`;
      }
    }
  }

  const actionSources = [youCard, themCard, connectionCard, dynamicsCard, outcomeCard].filter(Boolean);
  const guidancePrompts = actionSources
    .map(card => buildGuidanceActionPrompt(card, themes))
    .filter(Boolean);
  if (guidancePrompts.length > 0) {
    guidance += `${guidancePrompts.join(' ')}\n\n`;
  }

  if (dynamicsCard) {
    const dynamicsPosition = dynamicsCard.position || 'Dynamics / guidance';
    const dynamicsWeightNote = buildWeightNote('relationship', 3, dynamicsPosition);
    if (dynamicsWeightNote) {
      guidance += `${dynamicsWeightNote}\n\n`;
    }
  }

  if (outcomeCard) {
    const outcomePosition = outcomeCard.position || 'Outcome / what this can become';
    const outcomeWeightNote = buildWeightNote('relationship', 4, outcomePosition);
    if (outcomeWeightNote) {
      guidance += `${outcomeWeightNote}\n\n`;
    }
  }

  guidance += 'Emphasize honest communication, reciprocal care, and boundaries. Treat these insights as a mirror that informs how you choose to show up—not as a command to stay or leave. Choose the path that best honors honesty, care, and your own boundaries—the outcome still rests in the choices you both make.';
  const tonePhrase = tone.challengeFraming || 'honest reminder';
  const frameWord = frameVocab[0] || 'connection';
  guidance += `\n\nFor you${nameInline || ''} this is a ${tonePhrase}, inviting ${frameWord}-level dialogue about how you both want to participate.`;

  sections.push(
    recordSection(guidance, {
      type: 'relationship-guidance',
      cards: actionSources
    })
  );

  const supportingSummary = buildSupportingPositionsSummary(prioritized, spreadName);
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

  // Additional guidance with elemental remedies
  const additionalGuidance = await buildRelationshipAdditionalGuidance(normalizedCards, themes, context, remedyRotationIndex);
  if (additionalGuidance) {
    sections.push(
      recordSection(additionalGuidance, {
        type: 'relationship-support',
        cards: normalizedCards
      })
    );
  }

  const full = sections.filter(Boolean).join('\n\n');
  const validation = validateReadingNarrative(full);
  if (!validation.isValid) {
    console.debug('Relationship narrative spine suggestions:', validation.suggestions || validation.sectionAnalyses);
  }

  const closing = buildPersonalizedClosing(personalization);
  const narrative = closing ? `${full}\n\n${closing}` : full;

  if (reversalReminderEmbedded) {
    return narrative;
  }

  return appendReversalReminder(narrative, cardsInfo, themes);
}

function buildRelationshipElementalTakeaway(elemental, youCard, themCard) {
  if (!elemental || !elemental.relationship) {
    return '';
  }

  const youName = youCard?.card || 'your card';
  const themName = themCard?.card || 'their card';

  switch (elemental.relationship) {
    case 'supportive':
      return `Lean into this cooperative current by naming what ${youName} and ${themName} each need, then offer one concrete gesture that supports both.`;
    case 'tension':
      return `If friction flares between ${youName} and ${themName}, pause to acknowledge it aloud and agree on one boundary or adjustment that keeps the exchange balanced.`;
    case 'amplified':
      return `Because both cards amplify the same element, channel that intensity intentionally—co-create a ritual or conversation that directs this shared energy toward something constructive.`;
    default:
      return 'Stay curious about how each of you is showing up today and keep checking in so the energy stays responsive, not reactive.';
  }
}

async function buildRelationshipAdditionalGuidance(cardsInfo, themes, context, rotationIndex = 0) {
  // Only add elemental remedies section if there's an imbalance
  if (!themes.elementCounts || !themes.elementalBalance) {
    return null;
  }

  let remedies;
  try {
    const { buildElementalRemedies, shouldOfferElementalRemedies } = await import('../helpers.js');
    if (!shouldOfferElementalRemedies(themes.elementCounts, cardsInfo.length)) {
      return null;
    }

    remedies = buildElementalRemedies(themes.elementCounts, cardsInfo.length, context, {
      rotationIndex
    });
  } catch (err) {
    console.error('[Relationship] Elemental remedies unavailable:', err.message);
    return null;
  }
  if (!remedies) {
    return null;
  }

  let section = `### Supporting Your Connection\n\n`;
  section += `${themes.elementalBalance}\n\n`;
  section += `${remedies}\n\n`;
  section += `These practices can help each of you show up more fully, bringing balance to the energies present in this reading.`;

  return section;
}
