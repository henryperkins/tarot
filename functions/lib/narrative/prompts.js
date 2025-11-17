import { getImageryHook, isMajorArcana, getElementalImagery } from '../imageryHooks.js';
import {
  normalizeContext,
  getContextDescriptor,
  buildPositionCardText,
  getPositionOptions,
  buildReversalGuidance,
  getCrossCheckReversalNote,
  buildCrossCheckSynthesis,
  getConnector
} from './helpers.js';
import { getDeckProfile } from '../../../shared/vision/deckProfiles.js';

const DECK_STYLE_TIPS = {
  'thoth-a1': [
    'Use Crowley/Harris titles when they differ from Rider–Waite (Adjustment ↔ Justice, Lust ↔ Strength, Art ↔ Temperance).',
    'Reference the Minor epithets (Dominion, Peace, Swiftness, etc.) when they clarify the suit story.',
    'Let the tone lean into prismatic, alchemical imagery when it helps the querent visualize the card.'
  ],
  'marseille-classic': [
    'Refer to the suits as Batons, Cups, Swords, and Coins (instead of Wands/Pentacles).',
    'Describe Minor Arcana through number patterns, symmetry, and directional cues because pip cards are non-scenic.',
    'Call out when repeated motifs (flowers, petals, crossed blades) change the energy of a pip card.'
  ]
};

function getDeckStyleNotes(deckStyle = 'rws-1909') {
  const profile = getDeckProfile(deckStyle);
  if (!profile) return null;
  return {
    label: profile.label,
    cue: profile.promptCue,
    palette: Array.isArray(profile.palette) ? profile.palette.join(', ') : null,
    tips: DECK_STYLE_TIPS[deckStyle] || []
  };
}

export function buildEnhancedClaudePrompt({
  spreadInfo,
  cardsInfo,
  userQuestion,
  reflectionsText,
  themes,
  spreadAnalysis,
  context,
  visionInsights,
  deckStyle = 'rws-1909'
}) {
  const spreadKey = getSpreadKeyFromName(spreadInfo.name);
  const normalizedContext = normalizeContext(context);

  // Build spread-specific system prompt
  const systemPrompt = buildSystemPrompt(spreadKey, themes, normalizedContext, deckStyle);

  // Build structured user prompt
  const userPrompt = buildUserPrompt(
    spreadKey,
    cardsInfo,
    userQuestion,
    reflectionsText,
    themes,
    spreadAnalysis,
    normalizedContext,
    visionInsights,
    deckStyle
  );

  return { systemPrompt, userPrompt };
}

function getSpreadKeyFromName(name) {
  const map = {
    'Celtic Cross (Classic 10-Card)': 'celtic',
    'Three-Card Story (Past · Present · Future)': 'threeCard',
    'Five-Card Clarity': 'fiveCard',
    'One-Card Insight': 'single',
    'Relationship Snapshot': 'relationship',
    'Decision / Two-Path': 'decision'
  };
  return map[name] || 'general';
}

function buildSystemPrompt(spreadKey, themes, context, deckStyle) {
  const lines = [
    'You are an agency-forward professional tarot storyteller.',
    '',
    'NARRATIVE GUIDELINES:',
    '- Story spine every section (WHAT → WHY → WHAT’S NEXT) using connectors like "Because...", "Therefore...", "However...".',
    '- Cite card names, positions, and elemental dignities; add concise sensory imagery (especially for Major Arcana) to illustrate meaning.',
    '- You may weave in standard astrological or Qabalah correspondences as gentle color only when they naturally support the card\'s core Rider–Waite–Smith meaning.',
    `- Honor the ${themes.reversalDescription.name} reversal lens and Minor suit/rank rules; never invent cards or outcomes.`,
    '- Keep the tone trauma-informed, empowering, and non-deterministic.',
    '- Do NOT provide medical, mental health, legal, financial, or abuse-safety directives; when such topics arise, gently encourage seeking qualified professional support.',
    '- Make clear that outcome and timing cards describe likely trajectories based on current patterns, not fixed fate or guarantees.',
    '- Deliver 5-7 flowing paragraphs separated by blank lines.',
    '- DEPTH: Go beyond surface themes—explore nuanced dynamics, specific examples, and actionable micro-steps.',
    '- VARIETY: Vary your language when revisiting themes; use fresh metaphors and angles rather than repeating the same phrasing.',
    '- CONCRETENESS: Include at least 2-3 specific, practical next steps the querent can take immediately.',
    '- FORMAT: Output in Markdown with `###` section headings, bold card names the first time they appear, and bullet lists for actionable steps. Avoid HTML or fenced code blocks.'
  ];

  if (spreadKey === 'celtic') {
    lines.push(
      '',
      'CELTIC CROSS FLOW: Nucleus (1-2) → Timeline (3-1-4) → Consciousness (6-1-5) → Staff (7-10) → Cross-checks → Synthesis. Bridge each segment with the connectors above.'
    );
  } else if (spreadKey === 'threeCard') {
    lines.push(
      '',
      'THREE-CARD FLOW: Past → Present → Future. Show how each card leads to the next and note elemental support or tension along the way.'
    );
  } else if (spreadKey === 'relationship') {
    lines.push(
      '',
      'RELATIONSHIP FLOW: Explore the interplay between "You" and "Them" cards—what patterns emerge when these energies meet? How does the Connection card provide a shared path forward? Include specific communication strategies, boundary-setting examples, and 2-3 concrete relational practices.'
    );
  }

  // Build reversal lens section with strong enforcement when reversed cards are present
  const reversalSection = [''];

  if (themes.reversalCount > 0 && themes.reversalFramework !== 'none') {
    // CRITICAL: Enforce consistent reversal framework across entire reading
    reversalSection.push(
      '## REVERSAL INTERPRETATION FRAMEWORK — MANDATORY',
      '',
      `You MUST interpret ALL ${themes.reversalCount} reversed card(s) in this reading using the "${themes.reversalDescription.name}" lens exclusively.`,
      '',
      `Framework Definition: ${themes.reversalDescription.description}`,
      '',
      `Guidance: ${themes.reversalDescription.guidance}`,
      ''
    );

    // Include ALL examples to reinforce consistent application
    if (themes.reversalDescription.examples && Object.keys(themes.reversalDescription.examples).length > 0) {
      reversalSection.push('Concrete examples for this framework:');
      Object.entries(themes.reversalDescription.examples).forEach(([card, interpretation]) => {
        reversalSection.push(`• ${card} reversed: ${interpretation}`);
      });
      reversalSection.push('');
    }

    reversalSection.push(
      'CRITICAL CONSTRAINTS:',
      '• Do NOT mix different reversal interpretations within this reading',
      '• Do NOT interpret one reversal as "blocked" and another as "internalized" unless the framework is Contextual',
      '• Every reversed card must align with the same interpretive lens',
      '• Maintain framework consistency even when it creates narrative tension'
    );
  } else if (themes.reversalCount === 0) {
    reversalSection.push(
      `REVERSAL LENS: ${themes.reversalDescription.name} — All cards appear upright in this reading.`
    );
  } else {
    // Fallback for edge cases
    reversalSection.push(
      `REVERSAL LENS: ${themes.reversalDescription.name} — ${themes.reversalDescription.description}`
    );
  }

  lines.push(
    ...reversalSection,
    '',
    ...(themes?.knowledgeGraph?.narrativeHighlights?.length
      ? [
          '## ARCHETYPAL PATTERNS DETECTED',
          '',
          'Multi-card patterns identified:',
          ...themes.knowledgeGraph.narrativeHighlights.map((h) => `- ${h.text}`),
          '',
          'INTEGRATION: Weave these naturally into narrative, not mechanically.',
          ''
        ]
      : []),
    '',
    'ETHICS: Emphasize choice, agency, and trajectory language; forbid deterministic guarantees or fatalism.',
    'ETHICS: Do NOT provide diagnosis or treatment, or directives about medical, mental health, legal, financial, or abuse-safety matters; instead, when those themes surface, gently suggest consulting qualified professionals or trusted support resources.'
  );

  if (context && context !== 'general') {
    lines.push(
      '',
      `CONTEXT LENS: Frame insights through ${getContextDescriptor(context)} so guidance stays relevant to that arena.`
    );
  }

  const deckNotes = getDeckStyleNotes(deckStyle);
  if (deckNotes) {
    lines.push(
      '',
      `DECK STYLE: ${deckNotes.label}. ${deckNotes.cue || ''}`.trim(),
      deckNotes.palette ? `Palette cues: ${deckNotes.palette}.` : ''
    );
    if (deckNotes.tips.length > 0) {
      lines.push('', 'Follow these deck-specific nuances:');
      deckNotes.tips.forEach((tip) => lines.push(`- ${tip}`));
    }
  }

  return lines.join('\n');
}

function buildUserPrompt(spreadKey, cardsInfo, userQuestion, reflectionsText, themes, spreadAnalysis, context, visionInsights, deckStyle) {
  let prompt = ``;

  // Question
  prompt += `**Question**: ${userQuestion || '(No explicit question; speak to the energy most present for the querent.)'}\n\n`;

  const deckNotes = getDeckStyleNotes(deckStyle);
  if (deckNotes) {
    prompt += `**Deck Style**: ${deckNotes.label}\n`;
    if (deckNotes.cue) {
      prompt += `- Aesthetic cue: ${deckNotes.cue}\n`;
    }
    deckNotes.tips.forEach((tip) => {
      prompt += `- ${tip}\n`;
    });
    prompt += '\n';
  }

  // Thematic context
  const thematicLines = [];
  if (context && context !== 'general') {
    thematicLines.push(`- Context lens: Focus the narrative through ${getContextDescriptor(context)}`);
  }
  if (themes.suitFocus) thematicLines.push(`- ${themes.suitFocus}`);
  if (themes.archetypeDescription) thematicLines.push(`- ${themes.archetypeDescription}`);
  if (themes.elementalBalance) thematicLines.push(`- ${themes.elementalBalance}`);
  if (themes.timingProfile) {
    const timingDescriptions = {
      'near-term-tilt': 'Timing: This reading leans toward near-term shifts if you engage actively with the guidance.',
      'longer-arc-tilt': 'Timing: This pattern unfolds across a longer structural arc requiring patience and sustained attention.',
      'developing-arc': 'Timing: Expect this to emerge as a meaningful chapter rather than a single moment.'
    };
    const timingText = timingDescriptions[themes.timingProfile];
    if (timingText) {
      thematicLines.push(`- ${timingText}`);
    }
  }
  thematicLines.push(`- Reversal framework: ${themes.reversalDescription.name}`);
  prompt += `**Thematic Context**:\n${thematicLines.join('\n')}\n\n`;

  // Spread-specific card presentation
  if (spreadKey === 'celtic' && spreadAnalysis) {
    prompt += buildCelticCrossPromptCards(cardsInfo, spreadAnalysis, themes, context);
  } else if (spreadKey === 'threeCard' && spreadAnalysis) {
    prompt += buildThreeCardPromptCards(cardsInfo, spreadAnalysis, themes, context);
  } else if (spreadKey === 'fiveCard' && spreadAnalysis) {
    prompt += buildFiveCardPromptCards(cardsInfo, spreadAnalysis, themes, context);
  } else if (spreadKey === 'relationship') {
    prompt += buildRelationshipPromptCards(cardsInfo, themes, context);
  } else if (spreadKey === 'decision') {
    prompt += buildDecisionPromptCards(cardsInfo, themes, context);
  } else if (spreadKey === 'single') {
    prompt += buildSingleCardPrompt(cardsInfo, themes, context);
  } else {
    prompt += buildStandardPromptCards(cardsInfo, themes, context);
  }

  // Reflections
  if (reflectionsText && reflectionsText.trim()) {
    prompt += `\n**Querent's Reflections**:\n${reflectionsText.trim()}\n\n`;
  }

  const visionSection = buildVisionValidationSection(visionInsights);
  if (visionSection) {
    prompt += visionSection;
  }

  // Instructions
  prompt += `\nProvide a cohesive, flowing Markdown-formatted narrative that:
- Starts each major beat with a Title Case ### heading that is noun-focused (avoid "&" or "↔" in headings)
- References specific cards and positions (bold card names the first time they appear)
- Uses full sentences; if you need callouts, format them as bolded labels (e.g., **What:**) instead of shorthand like "What:"
- Vary transitional phrases between paragraphs (Looking ahead, As a result, Even so, etc.) to keep the flow natural and avoid repeating the same opener in consecutive paragraphs
- Do not start consecutive paragraphs with "Because" or "Therefore"; rotate to alternatives (Since, Even so, Still, Looking ahead) or omit the transition when the causal link is already clear
- Break up sentences longer than ~30 words; use two shorter sentences or em dashes/semicolons for clarity
- Ensures every paragraph ends with punctuation and closes any parenthetical references
- Keep paragraphs to 2–4 sentences so the narrative stays readable
- Describe reversed or blocked energy in fresh language (e.g., "In its inverted state...", "Under this blocked lens...") rather than repeating the same phrasing each time
- Integrates the thematic and elemental insights above
- Includes a short bullet list of actionable micro-steps before the final paragraph, leading each bullet with a bolded action verb for parallelism (e.g., **Name**, **Initiate**)
- Reminds the querent of their agency and free will
- Keeps the closing encouragement to one or two concise paragraphs instead of a single long block
Apply Minor Arcana interpretation rules to all non-Major cards.`;

  prompt += `\n\nRemember ethical constraints: emphasize agency, avoid guarantees, no medical/legal directives.`;

  return prompt;
}

function buildVisionValidationSection(visionInsights) {
  if (!Array.isArray(visionInsights) || visionInsights.length === 0) {
    return '';
  }

  const safeEntries = visionInsights.slice(0, 5);
  const coverage = safeEntries.filter((entry) => entry.matchesDrawnCard !== false).length;
  const coverageLine = coverage === safeEntries.length
    ? 'All uploaded cards align with the declared spread.'
    : `${safeEntries.length - coverage} upload(s) did not match the selected cards—address gently if relevant.`;

  const lines = ['\n**Vision Validation**:', coverageLine];

  safeEntries.forEach((entry) => {
    const confidenceText = typeof entry.confidence === 'number'
      ? `${(entry.confidence * 100).toFixed(1)}%`
      : 'confidence unavailable';
    const basisText = entry.basis ? ` via ${entry.basis}` : '';
    const mismatchFlag = entry.matchesDrawnCard === false ? ' [not in drawn spread]' : '';
    lines.push(`- ${entry.label}: recognized as ${entry.predictedCard}${basisText} (${confidenceText})${mismatchFlag}`);
  });

  lines.push('');
  return `${lines.join('\n')}\n`;
}

function buildCelticCrossPromptCards(cardsInfo, analysis, themes, context) {
  const options = getPositionOptions(themes, context);

  let cards = `**NUCLEUS** (Heart of the Matter):\n`;
  cards += buildCardWithImagery(cardsInfo[0], cardsInfo[0].position || 'Present — core situation (Card 1)', options);
  cards += buildCardWithImagery(cardsInfo[1], cardsInfo[1].position || 'Challenge — crossing / tension (Card 2)', options);
  cards += `Relationship insight: ${analysis.nucleus.synthesis}\n`;
  cards += getElementalImageryText(analysis.nucleus.elementalDynamic) + '\n\n';

  cards += `**TIMELINE**:\n`;
  cards += buildCardWithImagery(cardsInfo[2], cardsInfo[2].position || 'Past — what lies behind (Card 3)', options);

  const presentPosition = cardsInfo[0].position || 'Present — core situation (Card 1)';
  cards += buildCardWithImagery(
    cardsInfo[0],
    presentPosition,
    {
      ...options,
      prevElementalRelationship: analysis.timeline.pastToPresent
    },
    getConnector(presentPosition, 'toPrev')
  );

  const futurePosition = cardsInfo[3].position || 'Near Future — what lies before (Card 4)';
  cards += buildCardWithImagery(
    cardsInfo[3],
    futurePosition,
    {
      ...options,
      prevElementalRelationship: analysis.timeline.presentToFuture
    },
    getConnector(futurePosition, 'toPrev')
  );
  cards += `Flow insight: ${analysis.timeline.causality}\n`;
  cards += getElementalImageryText(analysis.timeline.pastToPresent) + '\n';
  cards += getElementalImageryText(analysis.timeline.presentToFuture) + '\n\n';

  cards += `**CONSCIOUSNESS**:\n`;
  cards += buildCardWithImagery(cardsInfo[5], cardsInfo[5].position || 'Subconscious — roots / hidden forces (Card 6)', options);
  cards += buildCardWithImagery(cardsInfo[4], cardsInfo[4].position || 'Conscious — goals & focus (Card 5)', options);
  cards += `Alignment insight: ${analysis.consciousness.synthesis}\n`;
  cards += getElementalImageryText(analysis.consciousness.elementalRelationship) + '\n\n';

  cards += `**STAFF** (Context & Outcome):\n`;
  cards += buildCardWithImagery(cardsInfo[6], cardsInfo[6].position || 'Self / Advice — how to meet this (Card 7)', options);
  cards += buildCardWithImagery(cardsInfo[7], cardsInfo[7].position || 'External Influences — people & environment (Card 8)', options);
  cards += buildCardWithImagery(cardsInfo[8], cardsInfo[8].position || 'Hopes & Fears — deepest wishes & worries (Card 9)', options);
  cards += buildCardWithImagery(cardsInfo[9], cardsInfo[9].position || 'Outcome — likely path if unchanged (Card 10)', options);
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

function buildThreeCardPromptCards(cardsInfo, analysis, themes, context) {
  const options = getPositionOptions(themes, context);
  const [past, present, future] = cardsInfo;

  let cards = `**THREE-CARD STORY STRUCTURE**\n`;
  cards += `- Past foundation\n- Present dynamics\n- Future trajectory if nothing shifts\n\n`;

  cards += buildCardWithImagery(
    past,
    past.position || 'Past — influences that led here',
    options
  );

  const presentPosition = present.position || 'Present — where you stand now';
  cards += buildCardWithImagery(
    present,
    presentPosition,
    {
      ...options,
      prevElementalRelationship: analysis?.transitions?.firstToSecond
    },
    getConnector(presentPosition, 'toPrev')
  );

  const futurePosition = future.position || 'Future — trajectory if nothing shifts';
  cards += buildCardWithImagery(
    future,
    futurePosition,
    {
      ...options,
      prevElementalRelationship: analysis?.transitions?.secondToThird
    },
    getConnector(futurePosition, 'toPrev')
  );

  if (analysis?.narrative) {
    cards += `\n${analysis.narrative.trim()}\n`;
  }

  cards += '\nThis future position points toward the most likely trajectory if nothing shifts, inviting you to adjust your path with intention.';

  return cards;
}

/**
 * Build card text with imagery hook for prompts
 */
function buildCardWithImagery(cardInfo, position, options, prefix = '') {
  const base = buildPositionCardText(cardInfo, position, options);
  const lead = prefix ? `${prefix} ${base}` : base;
  let text = `${lead}\n`;

  // Add imagery hook if Major Arcana
  if (isMajorArcana(cardInfo.number)) {
    const hook = getImageryHook(cardInfo.number, cardInfo.orientation);
    if (hook) {
      text += `*Imagery: ${hook.visual}*\n`;
      text += `*Sensory: ${hook.sensory}*\n`;
    }
  } else if (cardInfo.suit && cardInfo.rank) {
    const suitElements = {
      Wands: 'Fire',
      Cups: 'Water',
      Swords: 'Air',
      Pentacles: 'Earth'
    };
    const element = suitElements[cardInfo.suit];
    if (element) {
      text += `*Minor Arcana: ${cardInfo.suit} (${element}) — ${cardInfo.rank}*\n`;
    }
  }

  return text;
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

function buildFiveCardPromptCards(cardsInfo, fiveCardAnalysis, themes, context) {
  const options = getPositionOptions(themes, context);
  const [core, challenge, hidden, support, direction] = cardsInfo;

  let out = `**FIVE-CARD CLARITY STRUCTURE**\n`;
  out += `- Core of the matter\n- Challenge or tension\n- Hidden / subconscious influence\n- Support / helpful energy\n- Likely direction on current path\n\n`;

  out += buildCardWithImagery(core, core.position || 'Core of the matter', options);
  out += buildCardWithImagery(challenge, challenge.position || 'Challenge or tension', {
    ...options,
    prevElementalRelationship: fiveCardAnalysis?.coreVsChallenge
  });
  out += buildCardWithImagery(hidden, hidden.position || 'Hidden / subconscious influence', options);
  out += buildCardWithImagery(support, support.position || 'Support / helpful energy', options);
  out += buildCardWithImagery(direction, direction.position || 'Likely direction on current path', {
    ...options,
    prevElementalRelationship: fiveCardAnalysis?.supportVsDirection
  });

  return out;
}

function buildRelationshipPromptCards(cardsInfo, themes, context) {
  const options = getPositionOptions(themes, context);
  const [youCard, themCard, connectionCard, ...extraCards] = cardsInfo;

  let out = `**RELATIONSHIP SNAPSHOT STRUCTURE**\n`;
  out += `- You / your energy\n- Them / their energy\n- The connection / shared lesson\n\n`;

  if (youCard) {
    out += buildCardWithImagery(youCard, youCard.position || 'You / your energy', options);
  }
  if (themCard) {
    out += buildCardWithImagery(themCard, themCard.position || 'Them / their energy', options);
  }
  if (connectionCard) {
    out += buildCardWithImagery(
      connectionCard,
      connectionCard.position || 'The connection / shared lesson',
      options
    );
  }

  if (extraCards.length > 0) {
    out += `\n**ADDITIONAL INSIGHT CARDS**\n`;
    extraCards.forEach((card, idx) => {
      if (!card) return;
      const label = card.position || `Additional insight ${idx + 1}`;
      out += buildCardWithImagery(card, label, options);
    });
  }

  return out;
}

function buildDecisionPromptCards(cardsInfo, themes, context) {
  const options = getPositionOptions(themes, context);
  const [heart, pathA, pathB, clarifier, freeWill] = cardsInfo;

  let out = `**DECISION / TWO-PATH STRUCTURE**\n`;
  out += `- Heart of the decision\n- Path A — energy & likely outcome\n- Path B — energy & likely outcome\n- What clarifies the best path\n- What to remember about your free will\n\n`;

  if (heart) {
    out += buildCardWithImagery(
      heart,
      heart.position || 'Heart of the decision',
      options
    );
  }
  if (pathA) {
    out += buildCardWithImagery(
      pathA,
      pathA.position || 'Path A — energy & likely outcome',
      options
    );
  }
  if (pathB) {
    out += buildCardWithImagery(
      pathB,
      pathB.position || 'Path B — energy & likely outcome',
      options
    );
  }
  if (clarifier) {
    out += buildCardWithImagery(
      clarifier,
      clarifier.position || 'What clarifies the best path',
      options
    );
  }
  if (freeWill) {
    out += buildCardWithImagery(
      freeWill,
      freeWill.position || 'What to remember about your free will',
      options
    );
  }

  return out;
}

function buildSingleCardPrompt(cardsInfo, themes, context) {
  const options = getPositionOptions(themes, context);
  const card = cardsInfo[0];
  if (!card) return '';

  let out = `**ONE-CARD INSIGHT STRUCTURE**\n`;
  out += `- Theme / Guidance of the Moment\n\n`;
  out += buildCardWithImagery(
    card,
    card.position || 'Theme / Guidance of the Moment',
    options
  );
  return out;
}

function buildStandardPromptCards(cardsInfo, themes, context) {
  const options = getPositionOptions(themes, context);

  return cardsInfo
    .map((card, idx) => {
      const position = card.position || `Card ${idx + 1}`;
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

function formatMeaning(meaning) {
  const sentence = meaning.includes('.') ? meaning.split('.')[0] : meaning;
  const lowerCased = sentence.trim();
  if (!lowerCased) {
    return 'fresh perspectives that are still unfolding';
  }
  return lowerCased.charAt(0).toLowerCase() + lowerCased.slice(1);
}
