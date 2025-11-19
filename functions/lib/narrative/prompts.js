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
import { THOTH_MINOR_TITLES, MARSEILLE_NUMERICAL_THEMES } from '../../../src/data/knowledgeGraphData.js';
import { isGraphRAGEnabled, retrievePassages, formatPassagesForPrompt } from '../graphRAG.js';

/**
 * Get optimal passage count based on spread complexity
 * @param {string} spreadKey - Spread identifier (single, threeCard, celtic, etc.)
 * @returns {number} Maximum number of passages to retrieve
 */
function getPassageCountForSpread(spreadKey) {
  const limits = {
    'single': 1,       // One-card = 1 passage (focused)
    'threeCard': 2,    // Simple spread = 2 passages
    'fiveCard': 3,     // Medium spread = 3 passages
    'celtic': 5,       // Complex spread = 5 passages (rich context needed)
    'decision': 3,     // Decision spread = 3 passages
    'relationship': 2, // Relationship = 2 passages
    'general': 3       // Default fallback
  };
  return limits[spreadKey] || 3;
}

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
    'You are an agency-forward, trauma-informed tarot storyteller.',
    '',
    'CORE PRINCIPLES',
    '- Keep the querent’s agency and consent at the center. Emphasize trajectories and choices, not fixed fate.',
    '- In each section, loosely follow a story spine: name what is happening (WHAT), why it matters or how it arose (WHY), and what might be next in terms of options or small steps (WHAT’S NEXT). You can signal these shifts with connective phrases such as "Because...", "Therefore...", or "However..." where helpful.',
    '- Speak in warm, grounded language. Avoid heavy jargon; use brief astrological or Qabalah notes only when they clearly support the card\'s core Rider–Waite–Smith meaning.',
    '- Never offer medical, mental health, legal, financial, or abuse-safety directives. When those themes surface, gently encourage seeking qualified professional or community support.',
    '- Treat reversals according to the selected framework for this reading (see Reversal Framework below) and keep that lens consistent throughout.'
  ];

  lines.push(
    '',
    'FORMATTING',
    '- Use Markdown with clear `###` section headings for major beats (for example, “### Opening”, “### The Story”, “### Guidance”, “### Gentle Next Steps”, “### Closing”).',
    '- Bold each card name the first time it appears.',
    '- Prefer 4–6 moderately sized paragraphs plus one short bullet list of practical steps. Avoid filler.',
    '- Keep paragraphs to about 2–4 sentences; break up anything longer for readability.',
    '- OUTPUT STYLE: Do NOT preface the reading with "Here is your reading" or "I have analyzed the cards." Start directly with the Opening section or the first header.'
  );

  lines.push(
    '',
    'ESOTERIC LAYERS (OPTIONAL)',
    '- You may briefly reference astrology or Qabalah only when it clarifies the card’s core meaning for this querent.',
    '- For very practical questions (for example, career logistics or daily check-ins), prioritize concrete, grounded language over esoteric detail.',
    '- When you do mention these correspondences, keep them to one short sentence and avoid repeating the same formula for every card.'
  );

  // Spread-specific flow hints
  if (spreadKey === 'celtic') {
    lines.push(
      '',
      'CELTIC CROSS FLOW: Move through Nucleus (1–2) → Timeline (3–1–4) → Consciousness (6–1–5) → Staff (7–10) → Cross-checks → Synthesis, so the story feels like one unfolding chapter rather than ten separate blurbs.'
    );
  } else if (spreadKey === 'threeCard') {
    lines.push(
      '',
      'THREE-CARD FLOW: Past → Present → Future. Show how each card leads into the next and note elemental support or tension along the way.'
    );
  } else if (spreadKey === 'relationship') {
    lines.push(
      '',
      'RELATIONSHIP FLOW: Explore the interplay between "You" and "Them" cards, then the Connection card as shared lesson. Include specific examples of communication, boundaries, and relational practices without telling the querent to stay or leave.'
    );
  }

  // Reversal framework
  const reversalSection = [];
  if (themes.reversalCount > 0 && themes.reversalFramework !== 'none') {
    reversalSection.push(
      '',
      'REVERSAL FRAMEWORK',
      `- Reversal lens for this reading: “${themes.reversalDescription.name}”.`,
      `- Definition: ${themes.reversalDescription.description}`,
      `- Guidance: ${themes.reversalDescription.guidance}`,
      '- Keep this lens consistent for all reversed cards in this spread so the story stays coherent.'
    );

    if (themes.reversalDescription.examples && Object.keys(themes.reversalDescription.examples).length > 0) {
      reversalSection.push('- Example applications:');
      Object.entries(themes.reversalDescription.examples).forEach(([card, interpretation]) => {
        reversalSection.push(`  - ${card} reversed: ${interpretation}`);
      });
    }
  } else if (themes.reversalCount === 0) {
    reversalSection.push(
      '',
      'REVERSAL FRAMEWORK',
      `- Reversal lens: ${themes.reversalDescription.name}. All cards appear upright in this reading.`
    );
  } else {
    // Fallback for edge cases
    reversalSection.push(
      '',
      'REVERSAL FRAMEWORK',
      `- Reversal lens: ${themes.reversalDescription.name}.`,
      `- Definition: ${themes.reversalDescription.description}`
    );
  }

  lines.push(
    ...reversalSection,
    ''
  );

  // GraphRAG: Retrieve and inject traditional wisdom passages
  if (isGraphRAGEnabled() && themes?.knowledgeGraph?.graphKeys) {
    try {
      // Adaptive passage count based on spread complexity
      const effectiveSpreadKey = spreadKey || 'general';
      const maxPassages = getPassageCountForSpread(effectiveSpreadKey);

      const retrievedPassages = retrievePassages(themes.knowledgeGraph.graphKeys, {
        maxPassages
      });

      if (retrievedPassages.length > 0) {
        const formattedPassages = formatPassagesForPrompt(retrievedPassages, {
          includeSource: true,
          markdown: true
        });

        lines.push(
          '## TRADITIONAL WISDOM (GraphRAG)',
          '',
          formattedPassages,
          'INTEGRATION: Ground your interpretation in this traditional wisdom. These passages provide',
          'archetypal context from respected tarot literature. Weave their insights naturally',
          'into your narrative—don\'t quote verbatim, but let them inform your understanding',
          'of the patterns present in this spread.',
          ''
        );
      }
    } catch (err) {
      // GraphRAG failure should not break readings; log and continue
      console.error('[GraphRAG] Passage retrieval failed:', err.message);
    }
  }

  lines.push(
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

  lines.push(
    '',
    'SYNTHESIS RULE: Use the **Traditional Wisdom** (GraphRAG) to understand the core archetype (the "What"). Use the **Visual Profile** (Vision) to determine the specific manifestation or emotional texture (the "How"). If the Visual Profile contradicts the Traditional Wisdom (e.g., a dark Sun card), explicitly acknowledge this tension in the narrative if it adds depth—interpret it as the archetype expressing itself through that specific visual lens (e.g., "joy found in darkness").',
    '',
    'GPT-5.1 DIRECTIVES:',
    '- PLAN FIRST: Before drafting, briefly plan the arc (sections, card order, actionable bulleted micro-steps) so the final response flows logically.',
    '- PERSIST UNTIL COMPLETE: Carry the reading through analysis, synthesis, and a short closing encouragement without stopping early or punting back to the user unless critical information is missing.',
    '- SELF-VERIFY: After composing, quickly scan to ensure each referenced card/position is accurate, reversal instructions are obeyed, and the specific *visual profile* (tone/emotion) of the user\'s deck is reflected in the descriptive language before producing the final answer.'
  );

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

  if (themes?.knowledgeGraph?.narrativeHighlights?.length) {
    prompt += '**Archetypal Highlights**:\n';
    themes.knowledgeGraph.narrativeHighlights.slice(0, 5).forEach((highlight, index) => {
      const label = highlight?.text || '';
      if (!label) return;
      prompt += `- ${label}\n`;
    });
    prompt += '\n';
  }

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

  const deckSpecificContext = buildDeckSpecificContext(deckStyle, cardsInfo);
  if (deckSpecificContext) {
    prompt += deckSpecificContext;
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
  prompt += `\nPlease now write the reading. Use Markdown and:
- Add clear \`###\` headings for major sections.
- Mention each card and its position at least once, in a way that feels natural.
- Let each section follow the story spine: briefly describe what is happening, why it matters or how it arose, and what might be next.
- When you link ideas across sentences or paragraphs, you may use connective phrases like "Because...", "Therefore...", or "However..." so the causal flow stays clear; vary or omit them when the link is already obvious.
- Include one short bullet list (2–4 items) of concrete, gentle next steps, each starting with a bolded verb.
- Close by reminding the querent that this spread shows a possible trajectory, and that their choices and circumstances can always shift the outcome.
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

    if (entry.symbolVerification && typeof entry.symbolVerification === 'object') {
      const sv = entry.symbolVerification;
      const matchRate = typeof sv.matchRate === 'number' ? `${(sv.matchRate * 100).toFixed(1)}% symbol alignment` : null;
      const missingList = Array.isArray(sv.missingSymbols) && sv.missingSymbols.length
        ? `missing: ${sv.missingSymbols.join(', ')}`
        : null;
      const symbolLine = [matchRate, missingList].filter(Boolean).join(' | ');
      if (symbolLine) {
        lines.push(`  · Symbol check: ${symbolLine}`);
      }
    }

    if (Array.isArray(entry.matches) && entry.matches.length) {
      const preview = entry.matches
        .slice(0, 2)
        .map((match) => {
          if (!match?.card) return null;
          if (typeof match.score === 'number') {
            return `${match.card} ${(match.score * 100).toFixed(1)}%`;
          }
          return match.card;
        })
        .filter(Boolean)
        .join('; ');
      if (preview) {
        lines.push(`  · Secondary matches: ${preview}`);
      }
    }

    if (entry.visualProfile) {
      const tone = Array.isArray(entry.visualProfile.tone) ? entry.visualProfile.tone.slice(0, 2).join(', ') : '';
      const emotion = Array.isArray(entry.visualProfile.emotion) ? entry.visualProfile.emotion.slice(0, 2).join(', ') : '';
      const parts = [];
      if (tone) parts.push(`Tone: [${tone}]`);
      if (emotion) parts.push(`Emotion: [${emotion}]`);
      
      if (parts.length > 0) {
        lines.push(`  · Visual Profile: ${parts.join(' | ')}`);
      }
    }
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

function buildDeckSpecificContext(deckStyle, cardsInfo) {
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
        const header = card.position ? `${card.position}` : key;
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
        const header = card.position ? `${card.position}` : (card.card || `Pip ${rankValue}`);
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
