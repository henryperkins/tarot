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
  buildGuidanceActionPrompt
} from '../helpers.js';

export async function buildRelationshipReading({
  cardsInfo,
  userQuestion,
  reflectionsText,
  themes,
  context
}) {
  const sections = [];
  const spreadName = 'Relationship Snapshot';

  sections.push(
    buildOpening(
      spreadName,
      userQuestion ||
        'This spread explores your energy, their energy, the connection between you, and guidance for relating with agency and care.',
      context
    )
  );

  const normalizedCards = Array.isArray(cardsInfo) ? cardsInfo : [];
  const prioritized = sortCardsByImportance(normalizedCards, 'relationship');
  const [youCard, themCard, connectionCard, ...extraCards] = normalizedCards;
  const dynamicsCard = extraCards[0];
  const outcomeCard = extraCards[1];
  const options = getPositionOptions(themes, context);
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
    const youText = buildPositionCardText(
      youCard,
      youPosition,
      options
    );
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
    const themConnector = getConnector(themPosition, 'toPrev');
    const themText = buildPositionCardText(
      themCard,
      themPosition,
      options
    );
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
    enhanceSection(youThem, {
      type: 'relationship-dyad',
      cards: dyadCards,
      relationships: relationshipsMeta
    }).text
  );

  // THE CONNECTION
  if (connectionCard) {
    let connection = `### The Connection\n\n`;
    connection += 'This position shows what the bond is asking for right now.\n\n';
    const connectionPosition = connectionCard.position || 'The connection / shared lesson';
    const connectionConnector = getConnector(connectionPosition, 'toPrev');
    const connectionText = buildPositionCardText(
      connectionCard,
      connectionPosition,
      options
    );
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
      enhanceSection(connection, {
        type: 'connection',
        cards: [connectionCard]
      }).text
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
      options
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

  guidance += 'Emphasize honest communication, reciprocal care, and boundaries. Treat these insights as a mirror that informs how you choose to show up—never as a command to stay or leave. Choose the path that best honors honesty, care, and your own boundaries—the outcome still rests in the choices you both make.';

  sections.push(
    enhanceSection(guidance, {
      type: 'relationship-guidance',
      cards: actionSources
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

  // Additional guidance with elemental remedies
  const additionalGuidance = await buildRelationshipAdditionalGuidance(normalizedCards, themes, context);
  if (additionalGuidance) {
    sections.push(additionalGuidance);
  }

  const full = sections.filter(Boolean).join('\n\n');
  const validation = validateReadingNarrative(full);
  if (!validation.isValid) {
    console.debug('Relationship narrative spine suggestions:', validation.suggestions || validation.sectionAnalyses);
  }

  if (reversalReminderEmbedded) {
    return full;
  }

  return appendReversalReminder(full, cardsInfo, themes);
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

async function buildRelationshipAdditionalGuidance(cardsInfo, themes, context) {
  // Only add elemental remedies section if there's an imbalance
  if (!themes.elementCounts || !themes.elementalBalance) {
    return null;
  }

  const { buildElementalRemedies, shouldOfferElementalRemedies } = await import('../helpers.js');
  if (!shouldOfferElementalRemedies(themes.elementCounts, cardsInfo.length)) {
    return null;
  }

  const remedies = buildElementalRemedies(themes.elementCounts, cardsInfo.length, context);
  if (!remedies) {
    return null;
  }

  let section = `### Supporting Your Connection\n\n`;
  section += `${themes.elementalBalance}\n\n`;
  section += `${remedies}\n\n`;
  section += `These practices can help each of you show up more fully, bringing balance to the energies present in this reading.`;

  return section;
}
