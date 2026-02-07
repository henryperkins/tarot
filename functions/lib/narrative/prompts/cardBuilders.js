import { getImageryHook, isMajorArcana, getElementalImagery } from '../../imageryHooks.js';
import {
  buildPositionCardText,
  getPositionOptions,
  getCrossCheckReversalNote,
  buildCrossCheckSynthesis,
  getConnector,
  DEFAULT_WEIGHT_DETAIL_THRESHOLD
} from '../helpers.js';
import { THOTH_MINOR_TITLES, MARSEILLE_NUMERICAL_THEMES } from '../../../../src/data/knowledgeGraphData.js';
import { getPositionWeight } from '../../positionWeights.js';
import { sanitizeText } from '../../utils.js';
import { detectPromptInjection } from '../../promptInjectionDetector.js';
import { RELATIONSHIP_SPREAD_MAX_CLARIFIERS } from '../../spreadContracts.js';

export function buildCelticCrossPromptCards(cardsInfo, analysis, themes, context, userQuestion, visionInsights, promptOptions = {}) {
  const baseOptions = { ...getPositionOptions(themes, context), visionInsights };
  const optionsFor = (index, extra = {}) => ({
    ...makeCardOptions('celtic', index, baseOptions, promptOptions),
    ...extra
  });

  let cards = `**NUCLEUS** (Heart of the Matter):\n`;
  cards += buildCardWithImagery(cardsInfo[0], cardsInfo[0].position || 'Present — core situation (Card 1)', optionsFor(0));
  cards += buildCardWithImagery(cardsInfo[1], cardsInfo[1].position || 'Challenge — crossing / tension (Card 2)', optionsFor(1));
  cards += `Relationship insight: ${analysis.nucleus.synthesis}\n`;
  cards += getElementalImageryText(analysis.nucleus.elementalDynamic) + '\n\n';

  cards += `**TIMELINE**:\n`;
  cards += buildCardWithImagery(cardsInfo[2], cardsInfo[2].position || 'Past — what lies behind (Card 3)', optionsFor(2));

  const presentPosition = cardsInfo[0].position || 'Present — core situation (Card 1)';
  cards += buildCardWithImagery(
    cardsInfo[0],
    presentPosition,
    optionsFor(0, { prevElementalRelationship: analysis.timeline.pastToPresent }),
    getConnector(presentPosition, 'toPrev')
  );

  const futurePosition = cardsInfo[3].position || 'Near Future — what lies before (Card 4)';
  cards += buildCardWithImagery(
    cardsInfo[3],
    futurePosition,
    optionsFor(3, { prevElementalRelationship: analysis.timeline.presentToFuture }),
    getConnector(futurePosition, 'toPrev')
  );
  cards += `Flow insight: ${analysis.timeline.causality}\n`;
  cards += getElementalImageryText(analysis.timeline.pastToPresent) + '\n';
  cards += getElementalImageryText(analysis.timeline.presentToFuture) + '\n\n';

  cards += `**CONSCIOUSNESS**:\n`;
  cards += buildCardWithImagery(cardsInfo[5], cardsInfo[5].position || 'Subconscious — roots / hidden forces (Card 6)', optionsFor(5));
  cards += buildCardWithImagery(cardsInfo[4], cardsInfo[4].position || 'Conscious — goals & focus (Card 5)', optionsFor(4));
  cards += `Alignment insight: ${analysis.consciousness.synthesis}\n`;
  cards += getElementalImageryText(analysis.consciousness.elementalRelationship) + '\n\n';

  cards += `**STAFF** (Context & Outcome):\n`;
  cards += buildCardWithImagery(cardsInfo[6], cardsInfo[6].position || 'Self / Advice — how to meet this (Card 7)', optionsFor(6));
  cards += buildCardWithImagery(cardsInfo[7], cardsInfo[7].position || 'External Influences — people & environment (Card 8)', optionsFor(7));
  cards += buildCardWithImagery(cardsInfo[8], cardsInfo[8].position || 'Hopes & Fears — deepest wishes & worries (Card 9)', optionsFor(8));

  const outcomeLabel = userQuestion
    ? `Outcome — likely path for "${sanitizeText(userQuestion, { maxLength: 100, addEllipsis: true, stripMarkdown: true, filterInstructions: true })}" if unchanged (Card 10)`
    : 'Outcome — likely path if unchanged (Card 10)';

  cards += buildCardWithImagery(cardsInfo[9], cardsInfo[9].position || outcomeLabel, optionsFor(9));
  cards += `Advice-to-outcome insight: ${analysis.staff.adviceImpact}\n`;
  cards += getElementalImageryText(analysis.staff.adviceToOutcome) + '\n\n';

  cards += `**KEY CROSS-CHECKS**:\n`;
  cards += buildPromptCrossChecks(analysis.crossChecks, themes);

  cards += `\n\n**POSITION INTERPRETATION NOTES**:\n`;
  cards += `- Present (1): Anchor for all axes; core atmosphere of this moment\n`;
  cards += `- Challenge (2): Obstacle to integrate, not to defeat\n`;
  cards += `- Past (3): Foundation influencing current state\n`;
  cards += `- Near Future (4): Next chapter; cross-check with Outcome\n`;
  cards += `- Conscious (5): Stated goals; verify alignment with Outcome\n`;
  cards += `- Subconscious (6): Hidden drivers; mirror with Hopes/Fears\n`;
  cards += `- Advice (7): Active guidance; assess impact on Outcome\n`;
  cards += `- External (8): Environmental context, not command\n`;
  cards += `- Hopes/Fears (9): Mixed desires/anxieties\n`;
  cards += `- Outcome (10): Trajectory if unchanged, never deterministic\n`;

  return cards;
}

export function buildThreeCardPromptCards(cardsInfo, analysis, themes, context, userQuestion, visionInsights, promptOptions = {}) {
  const baseOptions = { ...getPositionOptions(themes, context), visionInsights };
  const optionsFor = (index, extra = {}) => ({
    ...makeCardOptions('threeCard', index, baseOptions, promptOptions),
    ...extra
  });
  const [past, present, future] = cardsInfo;

  let cards = `**THREE-CARD STORY STRUCTURE**\n`;
  cards += `- Past foundation\n- Present dynamics\n- Future trajectory if nothing shifts\n\n`;

  cards += buildCardWithImagery(
    past,
    past.position || 'Past — influences that led here',
    optionsFor(0)
  );

  const presentPosition = present.position || 'Present — where you stand now';
  cards += buildCardWithImagery(
    present,
    presentPosition,
    optionsFor(1, {
      prevElementalRelationship: analysis?.transitions?.firstToSecond
    }),
    getConnector(presentPosition, 'toPrev')
  );

  const sanitizedQuestion = userQuestion
    ? sanitizeText(userQuestion, { maxLength: 100, addEllipsis: true, stripMarkdown: true, filterInstructions: true })
    : '';
  const futureLabel = sanitizedQuestion
    ? `Future — likely trajectory for "${sanitizedQuestion}" if nothing shifts`
    : 'Future — trajectory if nothing shifts';

  const baseFuturePosition = future.position || '';
  const hasGenericFuturePosition = /future\s*[—–-]\s*trajectory\s+if\s+nothing\s+shifts/i.test(baseFuturePosition);
  if (sanitizedQuestion && hasGenericFuturePosition) {
    cards += `${futureLabel}\n`;
  }

  const futurePosition = baseFuturePosition || futureLabel;
  cards += buildCardWithImagery(
    future,
    futurePosition,
    optionsFor(2, {
      prevElementalRelationship: analysis?.transitions?.secondToThird
    }),
    getConnector(futurePosition, 'toPrev')
  );

  if (analysis?.narrative) {
    cards += `\n${analysis.narrative.trim()}\n`;
  }

  cards += '\nThis future position points toward the most likely trajectory if nothing shifts, inviting you to adjust your path with intention.';

  return cards;
}

/**
 * Find vision insight for a specific card by matching card name
 */
function findVisionInsightForCard(cardName, visionInsights) {
  if (!Array.isArray(visionInsights) || !cardName) return null;

  const normalized = cardName.toLowerCase().trim();
  return visionInsights.find(
    insight => insight?.predictedCard?.toLowerCase().trim() === normalized
  );
}

function shouldIncludeImageryForPosition(spreadKey, positionIndex, promptOptions = {}) {
  if (!promptOptions.omitLowWeightImagery) return true;
  return getPositionWeight(spreadKey, positionIndex) >= DEFAULT_WEIGHT_DETAIL_THRESHOLD;
}

function makeCardOptions(spreadKey, positionIndex, baseOptions, promptOptions = {}) {
  const includeImagery = shouldIncludeImageryForPosition(spreadKey, positionIndex, promptOptions);
  return {
    ...baseOptions,
    omitImagery: !includeImagery
  };
}

/**
 * Build card text with imagery hook for prompts
 * Now includes vision-detected visual profile (tone/emotion) when available
 */
function buildCardWithImagery(cardInfo, position, options, prefix = '') {
  const safeOptions = options || {};
  const base = buildPositionCardText(cardInfo, position, safeOptions);
  const lead = prefix ? `${prefix} ${base}` : base;
  let text = `${lead}\n`;

  // Check if vision profile exists for this card
  const visionInsight = findVisionInsightForCard(cardInfo.card, safeOptions.visionInsights);
  const visualProfile = visionInsight?.visualProfile;
  const allowImagery = !safeOptions.omitImagery;

  // Add imagery hook if Major Arcana
  if (allowImagery && isMajorArcana(cardInfo)) {
    const hook = getImageryHook(cardInfo.number, cardInfo.orientation);
    if (hook) {
      text += `*Imagery: ${hook.visual}*\n`;
      text += `*Sensory: ${hook.sensory}*\n`;

      // NEW: Add vision-detected tone if available
      if (visualProfile?.tone?.length) {
        const toneDescriptors = visualProfile.tone.slice(0, 2).join(', ');
        text += `*Vision-detected tone: ${toneDescriptors} — interpret the archetype through this visual lens*\n`;
      }

      // NEW: Add vision-detected emotion if available
      if (visualProfile?.emotion?.length) {
        const emotionDescriptors = visualProfile.emotion.slice(0, 2).join(', ');
        text += `*Emotional quality: ${emotionDescriptors}*\n`;
      }
    }
  } else if (allowImagery && cardInfo.suit && cardInfo.rank) {
    const suitElements = {
      Wands: 'Fire',
      Cups: 'Water',
      Swords: 'Air',
      Pentacles: 'Earth'
    };
    const element = suitElements[cardInfo.suit];
    if (element) {
      text += `*Minor Arcana: ${cardInfo.suit} (${element}) — ${cardInfo.rank}*\n`;

      // NEW: Add vision-detected emotional quality for Minor cards
      if (visualProfile?.emotion?.length) {
        const emotionDescriptors = visualProfile.emotion.slice(0, 2).join(', ');
        text += `*Vision-detected emotion: ${emotionDescriptors}*\n`;
      }
    }
  }

  if (cardInfo.userReflection) {
    let safeReflection = sanitizeText(cardInfo.userReflection, { maxLength: 100, addEllipsis: true, stripMarkdown: true, filterInstructions: true });
    if (safeReflection) {
      const reflectionCheck = detectPromptInjection(safeReflection, { confidenceThreshold: 0.6, sanitize: true });
      if (reflectionCheck.isInjection) {
        console.warn('[PromptInjection] Potential injection detected in card reflection:', {
          confidence: reflectionCheck.confidence,
          severity: reflectionCheck.severity,
          reasons: reflectionCheck.reasons.slice(0, 3)
        });
        safeReflection = reflectionCheck.sanitizedText;
      }
    }
    if (safeReflection) {
      text += `*Querent's Reflection: "${safeReflection}"*\n`;
    }
  }

  return text;
}

export function buildDeckSpecificContext(deckStyle, cardsInfo, options = {}) {
  if (options.includeDeckContext === false) return '';

  if (!Array.isArray(cardsInfo) || cardsInfo.length === 0) {
    return '';
  }

  if (deckStyle === 'thoth-a1') {
    const lines = cardsInfo
      .map((card) => {
        const key = (card?.card || card?.name || '').trim();
        if (!key) return null;
        const info = THOTH_MINOR_TITLES[key];
        if (!info) return null;
        const rawHeader = card.position ? `${card.position}` : key;
        let safeHeader = sanitizeText(rawHeader, { maxLength: 120, stripMarkdown: true, filterInstructions: true });
        if (safeHeader) {
          const headerCheck = detectPromptInjection(safeHeader, { confidenceThreshold: 0.6, sanitize: true });
          if (headerCheck.isInjection) {
            console.warn('[PromptInjection] Potential injection detected in deck context header:', {
              confidence: headerCheck.confidence,
              severity: headerCheck.severity,
              reasons: headerCheck.reasons.slice(0, 3)
            });
            safeHeader = headerCheck.sanitizedText;
          }
        }
        const header = safeHeader || key;
        const astrology = info.astrology ? ` (${info.astrology})` : '';
        return `- ${header}: **${info.title}**${astrology} — ${info.description}`;
      })
      .filter(Boolean);
    if (!lines.length) {
      return '';
    }
    return `\n**Thoth Titles & Decans**:\n${lines.join('\n')}\n\n`;
  }

  if (deckStyle === 'marseille-classic') {
    const lines = cardsInfo
      .map((card) => {
        const rankValue = typeof card?.rankValue === 'number' ? card.rankValue : null;
        const theme = rankValue ? MARSEILLE_NUMERICAL_THEMES[rankValue] : null;
        if (!theme) return null;
        const rawHeader = card.position ? `${card.position}` : (card.card || `Pip ${rankValue}`);
        let safeHeader = sanitizeText(rawHeader, { maxLength: 120, stripMarkdown: true, filterInstructions: true });
        if (safeHeader) {
          const headerCheck = detectPromptInjection(safeHeader, { confidenceThreshold: 0.6, sanitize: true });
          if (headerCheck.isInjection) {
            console.warn('[PromptInjection] Potential injection detected in deck context header:', {
              confidence: headerCheck.confidence,
              severity: headerCheck.severity,
              reasons: headerCheck.reasons.slice(0, 3)
            });
            safeHeader = headerCheck.sanitizedText;
          }
        }
        const header = safeHeader || (card.card || `Pip ${rankValue}`);
        return `- ${header}: Pip ${rankValue} (${theme.keyword}) — ${theme.description}`;
      })
      .filter(Boolean);
    if (!lines.length) {
      return '';
    }
    return `\n**Marseille Pip Geometry**:\n${lines.join('\n')}\n\n`;
  }

  return '';
}

/**
 * Get elemental imagery text for prompts
 */
function getElementalImageryText(elementalRelationship) {
  if (!elementalRelationship || !elementalRelationship.elements) {
    return '';
  }

  const [e1, e2] = elementalRelationship.elements;
  const imagery = getElementalImagery(e1, e2);

  if (imagery && imagery.imagery) {
    return `*Elemental imagery: ${imagery.imagery}*`;
  }

  return '';
}

export function buildFiveCardPromptCards(cardsInfo, fiveCardAnalysis, themes, context, visionInsights, promptOptions = {}) {
  const baseOptions = { ...getPositionOptions(themes, context), visionInsights };
  const optionsFor = (index, extra = {}) => ({
    ...makeCardOptions('fiveCard', index, baseOptions, promptOptions),
    ...extra
  });
  const [core, challenge, hidden, support, direction] = cardsInfo;

  let out = `**FIVE-CARD CLARITY STRUCTURE**\n`;
  out += `- Core of the matter\n- Challenge or tension\n- Hidden / subconscious influence\n- Support / helpful energy\n- Likely direction on current path\n\n`;

  out += buildCardWithImagery(core, core.position || 'Core of the matter', optionsFor(0));
  out += buildCardWithImagery(challenge, challenge.position || 'Challenge or tension', optionsFor(1, {
    prevElementalRelationship: fiveCardAnalysis?.coreVsChallenge
  }));
  out += buildCardWithImagery(hidden, hidden.position || 'Hidden / subconscious influence', optionsFor(2));
  out += buildCardWithImagery(support, support.position || 'Support / helpful energy', optionsFor(3));
  out += buildCardWithImagery(direction, direction.position || 'Likely direction on current path', optionsFor(4, {
    prevElementalRelationship: fiveCardAnalysis?.supportVsDirection
  }));

  return out;
}

export function buildRelationshipPromptCards(cardsInfo, themes, context, visionInsights, promptOptions = {}) {
  const baseOptions = { ...getPositionOptions(themes, context), visionInsights };
  const optionsFor = (index, extra = {}) => ({
    ...makeCardOptions('relationship', index, baseOptions, promptOptions),
    ...extra
  });

  const [youCard, themCard, connectionCard, ...rawExtraCards] = cardsInfo;
  const extraCards = rawExtraCards.slice(0, RELATIONSHIP_SPREAD_MAX_CLARIFIERS);
  const omittedClarifierCount = Math.max(0, rawExtraCards.length - extraCards.length);
  if (omittedClarifierCount > 0 && Array.isArray(promptOptions.contextDiagnostics)) {
    const message =
      `[relationship] Received ${rawExtraCards.length} clarifier cards; truncating to ${RELATIONSHIP_SPREAD_MAX_CLARIFIERS}.`;
    if (!promptOptions.contextDiagnostics.includes(message)) {
      promptOptions.contextDiagnostics.push(message);
    }
  }

  let out = `**RELATIONSHIP SNAPSHOT STRUCTURE**\n`;
  out += `- You / your energy\n- Them / their energy\n- The connection / shared lesson\n\n`;

  if (youCard) {
    out += buildCardWithImagery(youCard, youCard.position || 'You / your energy', optionsFor(0));
  }
  if (themCard) {
    out += buildCardWithImagery(themCard, themCard.position || 'Them / their energy', optionsFor(1));
  }
  if (connectionCard) {
    out += buildCardWithImagery(
      connectionCard,
      connectionCard.position || 'The connection / shared lesson',
      optionsFor(2)
    );
  }

  if (extraCards.length > 0) {
    out += `\n**ADDITIONAL RELATIONSHIP CLARIFIERS**\n`;
    extraCards.forEach((card, index) => {
      if (!card) return;
      const fallbackPosition = index === 0
        ? 'Dynamics / guidance'
        : index === 1
          ? 'Outcome / what this can become'
          : `Additional clarifier ${index + 1}`;
      out += buildCardWithImagery(card, card.position || fallbackPosition, optionsFor(index + 3));
    });
  }

  return out;
}

export function buildDecisionPromptCards(cardsInfo, themes, context, visionInsights, promptOptions = {}) {
  const baseOptions = { ...getPositionOptions(themes, context), visionInsights };
  const optionsFor = (index, extra = {}) => ({
    ...makeCardOptions('decision', index, baseOptions, promptOptions),
    ...extra
  });

  const [heart, pathA, pathB, clarifier, freeWill] = cardsInfo;

  let out = `**DECISION / TWO-PATH STRUCTURE**\n`;
  out += `- Heart of the decision\n- Path A — energy & likely outcome\n- Path B — energy & likely outcome\n- What clarifies the best path\n- What to remember about your free will\n\n`;

  if (heart) {
    out += buildCardWithImagery(
      heart,
      heart.position || 'Heart of the decision',
      optionsFor(0)
    );
  }
  if (pathA) {
    out += buildCardWithImagery(
      pathA,
      pathA.position || 'Path A — energy & likely outcome',
      optionsFor(1)
    );
  }
  if (pathB) {
    out += buildCardWithImagery(
      pathB,
      pathB.position || 'Path B — energy & likely outcome',
      optionsFor(2)
    );
  }
  if (clarifier) {
    out += buildCardWithImagery(
      clarifier,
      clarifier.position || 'What clarifies the best path',
      optionsFor(3)
    );
  }
  if (freeWill) {
    out += buildCardWithImagery(
      freeWill,
      freeWill.position || 'What to remember about your free will',
      optionsFor(4)
    );
  }

  return out;
}

export function buildSingleCardPrompt(cardsInfo, themes, context, visionInsights, promptOptions = {}) {
  const baseOptions = { ...getPositionOptions(themes, context), visionInsights };
  const optionsFor = makeCardOptions('single', 0, baseOptions, promptOptions);
  const card = cardsInfo[0];
  if (!card) return '';

  let out = `**ONE-CARD INSIGHT STRUCTURE**\n`;
  out += `- Theme / Guidance of the Moment\n\n`;
  out += buildCardWithImagery(
    card,
    card.position || 'Theme / Guidance of the Moment',
    optionsFor
  );
  return out;
}

export function buildStandardPromptCards(spreadKey, cardsInfo, themes, context, visionInsights, promptOptions = {}) {
  const baseOptions = { ...getPositionOptions(themes, context), visionInsights };

  return cardsInfo
    .map((card, idx) => {
      const position = card.position || `Card ${idx + 1}`;
      const options = makeCardOptions(spreadKey, idx, baseOptions, promptOptions);
      return buildCardWithImagery(card, position, options);
    })
    .join('\n') + '\n';
}

function buildPromptCrossChecks(crossChecks, themes) {
  const entries = [
    ['Goal vs Outcome', crossChecks.goalVsOutcome],
    ['Advice vs Outcome', crossChecks.adviceVsOutcome],
    ['Near Future vs Outcome', crossChecks.nearFutureVsOutcome],
    ['Subconscious vs Hopes/Fears', crossChecks.subconsciousVsHopesFears]
  ];

  return entries
    .map(([label, value]) => {
      if (!value) {
        return `- ${label}: No comparative insight available.`;
      }

      const shortenMeaning = meaning => {
        if (!meaning || typeof meaning !== 'string') return '';
        const firstClause = meaning.split(/[.!?]/)[0].trim();
        if (!firstClause) return '';
        return firstClause.length > 90 ? `${firstClause.slice(0, 87)}...` : firstClause;
      };

      const summarizePosition = position => {
        if (!position) return null;
        const base = `${position.name}: ${position.card} ${position.orientation}`.trim();
        const snippet = shortenMeaning(position.meaning);
        return snippet ? `${base} — ${snippet}` : base;
      };

      const reversalNotes = [
        getCrossCheckReversalNote(value.position1, themes),
        getCrossCheckReversalNote(value.position2, themes)
      ].filter(Boolean);

      const details = [];
      if (value.elementalRelationship?.relationship === 'tension') {
        details.push('⚠️ Elemental tension present.');
      } else if (value.elementalRelationship?.relationship === 'supportive') {
        details.push('✓ Elemental harmony present.');
      } else if (value.elementalRelationship?.relationship === 'amplified') {
        details.push('Elemental energies amplified.');
      }

      if (reversalNotes.length > 0) {
        details.push(reversalNotes.join(' '));
      }

      // Surface position summaries for clarity
      const positionsText = [summarizePosition(value.position1), summarizePosition(value.position2)]
        .filter(Boolean)
        .join(' | ');

      // Generate synthesis from structured data
      const synthesis = buildCrossCheckSynthesis(value);

      const parts = [`- ${label}: ${synthesis.trim()}`];
      if (positionsText) {
        parts.push(`(Positions: ${positionsText})`);
      }
      if (details.length > 0) {
        parts.push(details.join(' '));
      }

      return parts.join(' ');
    })
    .join('\n');
}

function _formatMeaning(meaning) {
  const sentence = meaning.includes('.') ? meaning.split('.')[0] : meaning;
  const lowerCased = sentence.trim();
  if (!lowerCased) {
    return 'fresh perspectives that are still unfolding';
  }
  return lowerCased.charAt(0).toLowerCase() + lowerCased.slice(1);
}
