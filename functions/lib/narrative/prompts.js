import { getImageryHook, isMajorArcana, getElementalImagery } from '../imageryHooks.js';
import {
  normalizeContext,
  getContextDescriptor,
  buildPositionCardText,
  getPositionOptions,
  formatReversalLens,
  getCrossCheckReversalNote,
  buildCrossCheckSynthesis,
  getConnector,
  DEFAULT_WEIGHT_DETAIL_THRESHOLD
} from './helpers.js';
import {
  buildAstrologicalWeatherSection,
  buildCardTransitNotes,
  buildForecastSection,
  generateTimingGuidance
} from '../ephemerisIntegration.js';
import { getDeckProfile } from '../../../shared/vision/deckProfiles.js';
import { THOTH_MINOR_TITLES, MARSEILLE_NUMERICAL_THEMES } from '../../../src/data/knowledgeGraphData.js';
import {
  isGraphRAGEnabled,
  retrievePassages,
  retrievePassagesWithQuality,
  formatPassagesForPrompt,
  getPassageCountForSpread,
  buildRetrievalSummary,
  buildQualityRetrievalSummary
} from '../graphRAG.js';
import { getPositionWeight } from '../positionWeights.js';
import { formatVisionLabelForPrompt } from '../visionLabels.js';
import { getDepthProfile } from './styleHelpers.js';

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

const TOKEN_ESTIMATE_DIVISOR = 4; // Rough heuristic: ~4 characters per token
const MAX_REFLECTION_TEXT_LENGTH = 600;
const DEFAULT_REVERSAL_DESCRIPTION = {
  name: 'Upright Emphasis',
  description: 'No specific reversal framework supplied for this reading.',
  guidance: 'If a card appears reversed, treat it as an internalized or blocked expression rather than an ominous inversion.'
};

const TONE_GUIDANCE = {
  gentle: `Use warm, nurturing language throughout. Lead with validation before addressing challenges. Frame difficulties as growth opportunities rather than obstacles. Avoid harsh absolutes or alarming language. Emphasize possibilities, hope, and the querent's inner wisdom.`,
  balanced: `Be honest but kind. Acknowledge both challenges and opportunities with equal weight. Balance difficult truths with encouragement. Use measured language that neither sugarcoats nor dramatizes. Trust the querent to handle nuanced information.`,
  blunt: `Be direct and clear. Skip softening phrases like "perhaps" or "you might consider." State observations plainly without hedging. Focus on clarity over comfort. Assume the querent prefers straightforward guidance over diplomatic cushioning.`
};

const FRAME_GUIDANCE = {
  psychological: `Interpret through Jungian archetypes, shadow work, and behavioral patterns. Use language of the psyche: projection, integration, individuation. Ground insights in observable patterns and personal development frameworks.`,
  spiritual: `Embrace intuitive, mystical language. Reference cosmic cycles, soul contracts, and energetic resonance. Honor the sacred dimension of the reading. Use terms like "spirit guides," "higher self," and "universal wisdom" where appropriate.`,
  mixed: `Blend psychological insight with spiritual symbolism naturally. Move fluidly between archetypal psychology and mystical language based on what serves each card's message. This is the default approach when no preference is specified.`,
  playful: `Keep it light, fun, and exploratory. Use humor where appropriate. Frame the reading as a curious adventure rather than a solemn ritual. Avoid heavy language even for challenging cards. Maintain wonder and levity throughout.`
};

function readEnvNumber(value) {
  if (value === undefined || value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function estimateTokenCount(text = '') {
  const safe = typeof text === 'string' ? text : String(text || '');
  return Math.ceil(safe.length / TOKEN_ESTIMATE_DIVISOR);
}

export function getPromptBudgetForTarget(target = 'default', options = {}) {
  const env = options.env || (typeof process !== 'undefined' && process.env ? process.env : {});
  const normalizedTarget = (target || 'default').toLowerCase();

  let raw = null;
  if (normalizedTarget === 'azure') {
    raw = env.PROMPT_BUDGET_AZURE ?? env.PROMPT_BUDGET_DEFAULT;
  } else if (normalizedTarget === 'claude') {
    raw = env.PROMPT_BUDGET_CLAUDE ?? env.PROMPT_BUDGET_DEFAULT;
  } else {
    raw = env.PROMPT_BUDGET_DEFAULT;
  }

  return readEnvNumber(raw);
}

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
  deckStyle = 'rws-1909',
  graphRAGPayload = null,
  ephemerisContext = null,
  ephemerisForecast = null,
  transitResonances = [],
  budgetTarget = 'claude',
  contextDiagnostics = [],
  promptBudgetEnv = null,
  personalization = null,
  enableSemanticScoring = null
}) {
  const baseThemes = typeof themes === 'object' && themes !== null ? themes : {};
  const activeThemes = baseThemes.reversalDescription
    ? baseThemes
    : { ...baseThemes, reversalDescription: { ...DEFAULT_REVERSAL_DESCRIPTION } };

  const spreadKey = getSpreadKeyFromName(spreadInfo.name);
  const diagnostics = Array.isArray(contextDiagnostics) ? contextDiagnostics : [];

  const normalizedContext = normalizeContext(context, {
    onUnknown: (message) => diagnostics.push(message)
  });

  const promptBudget = getPromptBudgetForTarget(budgetTarget, { env: promptBudgetEnv });

  // Pre-fetch GraphRAG payload if not already provided
  // This ensures a single retrieval even across slimming passes
  let effectiveGraphRAGPayload = graphRAGPayload;
  if (!effectiveGraphRAGPayload && isGraphRAGEnabled(promptBudgetEnv) && activeThemes?.knowledgeGraph?.graphKeys) {
    const effectiveSpreadKey = spreadKey || 'general';
    const maxPassages = getPassageCountForSpread(effectiveSpreadKey);

    try {
      // Note: Semantic scoring with embeddings requires async, so we use
      // keyword-only synchronous retrieval here. Semantic scoring can be
      // enabled by pre-computing the graphRAGPayload with retrievePassagesWithQuality
      // before calling buildEnhancedClaudePrompt.
      const retrievedPassages = retrievePassages(activeThemes.knowledgeGraph.graphKeys, {
        maxPassages,
        userQuery: userQuestion
      });

      effectiveGraphRAGPayload = {
        passages: retrievedPassages,
        formattedBlock: null,
        retrievalSummary: buildRetrievalSummary(activeThemes.knowledgeGraph.graphKeys, retrievedPassages),
        enableSemanticScoring: false
      };
    } catch (err) {
      console.error('[GraphRAG] Pre-fetch failed:', err.message);
    }
  }

  const baseControls = {
    graphRAGPayload: effectiveGraphRAGPayload,
    ephemerisContext,
    ephemerisForecast,
    transitResonances,
    includeGraphRAG: true,
    includeEphemeris: true,
    includeForecast: true,
    includeDeckContext: true,
    includeDiagnostics: true,
    omitLowWeightImagery: false,
    enableSemanticScoring,
    env: promptBudgetEnv
  };

  const buildWithControls = (controls) => {
    const systemPrompt = buildSystemPrompt(
      spreadKey,
      activeThemes,
      normalizedContext,
      deckStyle,
      userQuestion,
      {
        ...controls,
        personalization,
        maxTokenBudget: promptBudget
      }
    );

    const userPrompt = buildUserPrompt(
      spreadKey,
      cardsInfo,
      userQuestion,
      reflectionsText,
      activeThemes,
      spreadAnalysis,
      normalizedContext,
      visionInsights,
      deckStyle,
      {
        ...controls,
        personalization
      }
    );

    const systemTokens = estimateTokenCount(systemPrompt);
    const userTokens = estimateTokenCount(userPrompt);

    return {
      systemPrompt,
      userPrompt,
      systemTokens,
      userTokens,
      totalTokens: systemTokens + userTokens
    };
  };

  let controls = { ...baseControls };
  let built = buildWithControls(controls);
  const slimmingSteps = [];

  const maybeSlim = (label, updater) => {
    if (!promptBudget) return;
    if (built.totalTokens <= promptBudget) return;
    updater();
    built = buildWithControls(controls);
    slimmingSteps.push(label);
  };

  // Step 1: Drop imagery/vision sub-points for lower-weight cards
  maybeSlim('drop-low-weight-imagery', () => {
    controls = { ...controls, omitLowWeightImagery: true };
  });

  // Step 2: Remove forecast (future events) if over budget
  maybeSlim('drop-forecast', () => {
    controls = { ...controls, includeForecast: false };
  });

  // Step 3: Remove ephemeris/astrological context if over budget
  maybeSlim('drop-ephemeris', () => {
    controls = { ...controls, includeEphemeris: false };
  });

  // Step 4: Remove GraphRAG block if still over budget
  maybeSlim('drop-graphrag-block', () => {
    controls = { ...controls, includeGraphRAG: false };
  });

  // Step 5: Remove deck geometry/context tables (Thoth/Marseille)
  maybeSlim('drop-deck-geometry', () => {
    controls = { ...controls, includeDeckContext: false };
  });

  // Step 6: Remove diagnostics (vision validation, verbose notes)
  maybeSlim('drop-diagnostics', () => {
    controls = { ...controls, includeDiagnostics: false };
  });

  const promptMeta = {
    estimatedTokens: {
      system: built.systemTokens,
      user: built.userTokens,
      total: built.totalTokens,
      budget: promptBudget,
      budgetTarget,
      overBudget: Boolean(promptBudget && built.totalTokens > promptBudget)
    },
    slimmingSteps,
    appliedOptions: {
      omitLowWeightImagery: Boolean(controls.omitLowWeightImagery),
      includeForecast: Boolean(controls.includeForecast),
      includeEphemeris: Boolean(controls.includeEphemeris),
      includeGraphRAG: Boolean(controls.includeGraphRAG),
      includeDeckContext: Boolean(controls.includeDeckContext),
      includeDiagnostics: Boolean(controls.includeDiagnostics)
    }
  };

  if (controls.graphRAGPayload?.retrievalSummary) {
    promptMeta.graphRAG = controls.graphRAGPayload.retrievalSummary;
  }

  if (controls.ephemerisContext?.available) {
    promptMeta.ephemeris = {
      available: true,
      moonPhase: controls.ephemerisContext.moonPhase?.phaseName,
      retrogradeCount: controls.ephemerisContext.retrogrades?.length || 0,
      transitResonances: controls.transitResonances?.length || 0
    };
  }

  if (controls.ephemerisForecast?.available) {
    promptMeta.forecast = {
      available: true,
      days: controls.ephemerisForecast.forecastDays,
      eventCount: controls.ephemerisForecast.events?.length || 0
    };
  }

  return { systemPrompt: built.systemPrompt, userPrompt: built.userPrompt, promptMeta, contextDiagnostics: diagnostics };
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

function buildSystemPrompt(spreadKey, themes, context, deckStyle, userQuestion = '', options = {}) {
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

  const includeDeckContext = options.includeDeckContext !== false;

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

  const reversalLens = formatReversalLens(themes, { includeExamples: true, includeReminder: true });
  if (reversalLens.lines.length) {
    lines.push('', 'REVERSAL FRAMEWORK', ...reversalLens.lines, '');
  }

  const includeGraphRAG = options.includeGraphRAG !== false;

  // GraphRAG: Inject traditional wisdom passages from pre-fetched payload
  if (includeGraphRAG && isGraphRAGEnabled(options.env) && themes?.knowledgeGraph?.graphKeys) {
    try {
      // Use pre-fetched payload from options (computed in buildEnhancedClaudePrompt)
      const payload = options.graphRAGPayload || themes?.knowledgeGraph?.graphRAGPayload || null;
      let retrievedPassages = Array.isArray(payload?.passages) && payload.passages.length
        ? payload.passages
        : null;

      if (retrievedPassages && retrievedPassages.length > 0) {
        // Adaptive passage count based on spread complexity
        const effectiveSpreadKey = spreadKey || 'general';
        const maxPassages = getPassageCountForSpread(effectiveSpreadKey);

        // Trim if needed
        if (retrievedPassages.length > maxPassages) {
          retrievedPassages = retrievedPassages.slice(0, maxPassages);
        }

        // Log quality metrics if passages have relevance scores
        const hasRelevanceScores = retrievedPassages.some(p => typeof p.relevanceScore === 'number');
        if (hasRelevanceScores) {
          const avgRelevance = retrievedPassages.reduce((sum, p) => sum + (p.relevanceScore || 0), 0) / retrievedPassages.length;
          console.log(`[GraphRAG] Injecting ${retrievedPassages.length} passages (avg relevance: ${(avgRelevance * 100).toFixed(1)}%)`);
        }

        let formattedPassages = payload.formattedBlock;
        if (!formattedPassages) {
          formattedPassages = formatPassagesForPrompt(retrievedPassages, {
            includeSource: true,
            markdown: true
          });
        }

        if (formattedPassages) {
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
      }
    } catch (err) {
      // GraphRAG failure should not break readings; log and continue
      console.error('[GraphRAG] Passage injection failed:', err.message);
    }
  }

  // Archetypal patterns are reading-specific - they go in user prompt only

  // Ephemeris: Real-time astrological context
  const includeEphemeris = options.includeEphemeris !== false;
  if (includeEphemeris && options.ephemerisContext?.available) {
    try {
      const astroSection = buildAstrologicalWeatherSection(options.ephemerisContext);
      if (astroSection) {
        lines.push('', astroSection, '');
      }
    } catch (err) {
      console.error('[Ephemeris] Astrological context build failed:', err.message);
    }
  }

  // Ephemeris Forecast: Upcoming astrological events (for seasonal/monthly questions)
  const includeForecast = options.includeForecast !== false;
  if (includeForecast && options.ephemerisForecast?.available) {
    try {
      const forecastSection = buildForecastSection(options.ephemerisForecast);
      if (forecastSection) {
        lines.push('', forecastSection, '');
      }
    } catch (err) {
      console.error('[Ephemeris] Forecast section build failed:', err.message);
    }
  }

  lines.push(
    '',
    'ETHICS',
    '- Emphasize choice, agency, and trajectory language; forbid deterministic guarantees or fatalism.',
    '- Do NOT provide diagnosis, treatment, or directives about medical, mental health, legal, financial, or abuse-safety matters.',
    '- When restricted themes surface, gently suggest consulting qualified professionals or trusted support resources.'
  );

  if (context && context !== 'general') {
    lines.push(
      '',
      `CONTEXT LENS: The query falls within the ${getContextDescriptor(context)} realm. Ensure interpretations address this context while prioritizing the specific nuances of the user's actual text.`
    );
  }

  const deckNotes = getDeckStyleNotes(deckStyle);
  if (deckNotes && includeDeckContext) {
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

  const personalization = options.personalization || null;
  const toneKey = personalization?.readingTone;
  const frameKey = personalization?.spiritualFrame;
  const depthPreference = personalization?.preferredSpreadDepth;
  const depthProfile = depthPreference ? getDepthProfile(depthPreference) : null;
  const hasToneSection = toneKey && TONE_GUIDANCE[toneKey];
  const hasFrameSection = frameKey && FRAME_GUIDANCE[frameKey];

  if (hasToneSection || hasFrameSection) {
    const basePrompt = lines.join('\n');
    const maxTokenBudget = Number.isFinite(options.maxTokenBudget) ? options.maxTokenBudget : null;
    const baseTokens = estimateTokenCount(basePrompt);
    const remainingBudget = maxTokenBudget ? maxTokenBudget - baseTokens : Infinity;
    if (remainingBudget > 400) {
      if (hasToneSection) {
        lines.push('', '## Reading Tone', TONE_GUIDANCE[toneKey], '');
      }
      if (hasFrameSection) {
        lines.push('', '## Interpretive Frame', FRAME_GUIDANCE[frameKey], '');
      }
    }
  }

  if (depthProfile && depthProfile.systemGuidance && depthProfile.key !== 'standard') {
    lines.push('', '## Narrative Depth Preference', depthProfile.systemGuidance, '');
  }

  return lines.join('\n');
}

function buildUserPrompt(
  spreadKey,
  cardsInfo,
  userQuestion,
  reflectionsText,
  themes = {},
  spreadAnalysis,
  context,
  visionInsights,
  deckStyle,
  promptOptions = {}
) {
  const personalization = promptOptions.personalization || null;
  const displayName =
    typeof personalization?.displayName === 'string'
      ? personalization.displayName.trim()
      : '';
  const depthPreference = personalization?.preferredSpreadDepth;
  const depthProfile = depthPreference ? getDepthProfile(depthPreference) : null;
  const activeThemes = typeof themes === 'object' && themes !== null ? themes : {};
  const reversalDescriptor = activeThemes.reversalDescription || { ...DEFAULT_REVERSAL_DESCRIPTION };
  let prompt = ``;

  const includeDeckContext = promptOptions.includeDeckContext !== false;
  const includeDiagnostics = promptOptions.includeDiagnostics !== false;

  // Question
  let questionLine = userQuestion || '(No explicit question; speak to the energy most present for the querent.)';
  if (displayName && userQuestion) {
    questionLine = `${displayName}, you asked: ${userQuestion}`;
  } else if (displayName && !userQuestion) {
    questionLine = `${displayName} did not pose a question—attune to the energy most present for them.`;
  }
  prompt += `**Question**: ${questionLine}\n\n`;

  if (displayName) {
    prompt += `**Name Usage**:\n- Weave the querent's name naturally in key transitions (for example, "For you, ${displayName}, this suggests...").\n- Open with a direct acknowledgement such as "${displayName}, you asked..." and close with "Remember, ${displayName}, ..." to keep the reading personal without overusing the name.\n\n`;
  }

  if (depthProfile && depthProfile.promptReminder && depthProfile.key !== 'standard') {
    prompt += `**Depth Preference**: ${depthProfile.promptReminder}\n\n`;
  }

  // Deck style name only - detailed tips are in system prompt
  const deckNotes = getDeckStyleNotes(deckStyle);
  if (deckNotes && deckStyle !== 'rws-1909') {
    prompt += `**Deck Style**: ${deckNotes.label} (see system prompt for interpretation guidelines)\n\n`;
  }

  // Thematic context
  const thematicLines = [];
  if (context && context !== 'general') {
    thematicLines.push(`- Context lens: Focus the narrative through ${getContextDescriptor(context)}`);
  }
  if (activeThemes.suitFocus) thematicLines.push(`- ${activeThemes.suitFocus}`);
  if (activeThemes.archetypeDescription) thematicLines.push(`- ${activeThemes.archetypeDescription}`);
  if (activeThemes.elementalBalance) thematicLines.push(`- ${activeThemes.elementalBalance}`);
  if (activeThemes.timingProfile) {
    const timingDescriptions = {
      'near-term-tilt': 'Timing: This reading leans toward near-term shifts if you engage actively with the guidance.',
      'longer-arc-tilt': 'Timing: This pattern unfolds across a longer structural arc requiring patience and sustained attention.',
      'developing-arc': 'Timing: Expect this to emerge as a meaningful chapter rather than a single moment.'
    };
    const timingText = timingDescriptions[activeThemes.timingProfile];
    if (timingText) {
      thematicLines.push(`- ${timingText}`);
    }
  }
  thematicLines.push(`- Reversal framework: ${reversalDescriptor.name}`);
  prompt += `**Thematic Context**:\n${thematicLines.join('\n')}\n\n`;

  if (activeThemes?.knowledgeGraph?.narrativeHighlights?.length) {
    prompt += '**Archetypal Patterns** (weave naturally, not mechanically):\n';
    activeThemes.knowledgeGraph.narrativeHighlights.slice(0, 5).forEach((highlight, index) => {
      const label = highlight?.text || '';
      if (!label) return;
      prompt += `- ${label}\n`;
    });
    prompt += '\n';
  }

  // Transit resonances from ephemeris
  const includeEphemeris = promptOptions.includeEphemeris !== false;
  if (includeEphemeris && promptOptions.transitResonances?.length > 0) {
    const transitNotes = buildCardTransitNotes(promptOptions.transitResonances);
    if (transitNotes) {
      prompt += transitNotes + '\n\n';
    }
  }

  // Timing guidance from ephemeris
  if (includeEphemeris && promptOptions.ephemerisContext?.available) {
    const timingHints = generateTimingGuidance(promptOptions.ephemerisContext, spreadKey);
    if (timingHints?.length > 0) {
      prompt += '**Astrological Timing**:\n';
      timingHints.forEach(hint => {
        prompt += `- ${hint}\n`;
      });
      prompt += '\n';
    }
  }

  // Spread-specific card presentation
  if (spreadKey === 'celtic' && spreadAnalysis) {
    prompt += buildCelticCrossPromptCards(cardsInfo, spreadAnalysis, activeThemes, context, userQuestion, visionInsights, promptOptions);
  } else if (spreadKey === 'threeCard' && spreadAnalysis) {
    prompt += buildThreeCardPromptCards(cardsInfo, spreadAnalysis, activeThemes, context, userQuestion, visionInsights, promptOptions);
  } else if (spreadKey === 'fiveCard' && spreadAnalysis) {
    prompt += buildFiveCardPromptCards(cardsInfo, spreadAnalysis, activeThemes, context, visionInsights, promptOptions);
  } else if (spreadKey === 'relationship') {
    prompt += buildRelationshipPromptCards(cardsInfo, activeThemes, context, visionInsights, promptOptions);
  } else if (spreadKey === 'decision') {
    prompt += buildDecisionPromptCards(cardsInfo, activeThemes, context, visionInsights, promptOptions);
  } else if (spreadKey === 'single') {
    prompt += buildSingleCardPrompt(cardsInfo, activeThemes, context, visionInsights, promptOptions);
  } else {
    prompt += buildStandardPromptCards(spreadKey, cardsInfo, activeThemes, context, visionInsights, promptOptions);
  }

  const deckSpecificContext = buildDeckSpecificContext(deckStyle, cardsInfo, { includeDeckContext });
  if (deckSpecificContext) {
    prompt += deckSpecificContext;
  }

  // Reflections (Fallback for legacy/aggregate usage)
  const hasPerCardReflections = cardsInfo.some(c => c.userReflection);
  if (!hasPerCardReflections && reflectionsText && reflectionsText.trim()) {
    const sanitizedReflections = sanitizeAndTruncate(reflectionsText, MAX_REFLECTION_TEXT_LENGTH);
    if (sanitizedReflections) {
      prompt += `\n**Querent's Reflections**:\n${sanitizedReflections}\n\n`;
    }
  }

  const visionSection = buildVisionValidationSection(visionInsights, { includeDiagnostics });
  if (visionSection) {
    prompt += visionSection;
  }

  // Instructions (minimal - detailed rules are in system prompt)
  prompt += `\nPlease now write the reading following the system prompt guidelines. Ensure you:
- Reference each card by name at least once
- Close with a trajectory reminder (choices shape outcomes)
- Apply the reversal lens consistently throughout`;

  return prompt;
}

function buildVisionValidationSection(visionInsights, options = {}) {
  if (options.includeDiagnostics === false) {
    return '';
  }

  if (!Array.isArray(visionInsights) || visionInsights.length === 0) {
    return '';
  }

  const safeEntries = visionInsights.slice(0, 5);
  const verifiedMatches = safeEntries.filter((entry) => entry.matchesDrawnCard === true).length;
  const mismatches = safeEntries.filter((entry) => entry.matchesDrawnCard === false).length;
  const unverified = safeEntries.length - verifiedMatches - mismatches;

  let coverageLine = 'Vision uploads include verification notes below.';
  if (mismatches === 0 && unverified === 0) {
    coverageLine = 'All uploaded cards align with the declared spread.';
  } else {
    const parts = [];
    if (mismatches > 0) {
      parts.push(`${mismatches} upload(s) did not match the selected cards—address gently if relevant.`);
    }
    if (unverified > 0) {
      parts.push(`${unverified} upload(s) could not be verified against the drawn spread; treat these as unverified evidence if you reference them.`);
    }
    coverageLine = parts.join(' ');
  }

  const lines = ['\n**Vision Validation**:', coverageLine];

  safeEntries.forEach((entry) => {
    const safeLabel = formatVisionLabelForPrompt(entry.label);
    const confidenceText = typeof entry.confidence === 'number'
      ? `${(entry.confidence * 100).toFixed(1)}%`
      : 'confidence unavailable';
    const basisText = entry.basis ? ` via ${entry.basis}` : '';
    let validationNote = '';
    if (entry.matchesDrawnCard === false) {
      validationNote = ' [not in drawn spread]';
    } else if (entry.matchesDrawnCard === null || typeof entry.matchesDrawnCard === 'undefined') {
      validationNote = ' [unverified upload]';
    }
    lines.push(`- ${safeLabel}: recognized as ${entry.predictedCard}${basisText} (${confidenceText})${validationNote}`);

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

function sanitizeAndTruncate(text = '', maxLength = 100) {
  if (!text || typeof text !== 'string') return '';
  const truncated = text.length > maxLength
    ? text.slice(0, maxLength).trim() + '...'
    : text.trim();
  return truncated
    .replace(/[#*`_[\]]/g, '')
    .replace(/\s+/g, ' ');
}

function buildCelticCrossPromptCards(cardsInfo, analysis, themes, context, userQuestion, visionInsights, promptOptions = {}) {
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
    ? `Outcome — likely path for "${sanitizeAndTruncate(userQuestion)}" if unchanged (Card 10)`
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

function buildThreeCardPromptCards(cardsInfo, analysis, themes, context, userQuestion, visionInsights, promptOptions = {}) {
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

  const futureLabel = userQuestion
    ? `Future — likely trajectory for "${sanitizeAndTruncate(userQuestion)}" if nothing shifts`
    : 'Future — trajectory if nothing shifts';

  const futurePosition = future.position || futureLabel;
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
  if (allowImagery && isMajorArcana(cardInfo.number)) {
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
    text += `*Querent's Reflection: "${sanitizeAndTruncate(cardInfo.userReflection)}"*\n`;
  }

  return text;
}

function buildDeckSpecificContext(deckStyle, cardsInfo, options = {}) {
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

function buildFiveCardPromptCards(cardsInfo, fiveCardAnalysis, themes, context, visionInsights, promptOptions = {}) {
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

function buildRelationshipPromptCards(cardsInfo, themes, context, visionInsights, promptOptions = {}) {
  const baseOptions = { ...getPositionOptions(themes, context), visionInsights };
  const optionsFor = (index, extra = {}) => ({
    ...makeCardOptions('relationship', index, baseOptions, promptOptions),
    ...extra
  });

  const [youCard, themCard, connectionCard, ...extraCards] = cardsInfo;

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
    out += `\n**ADDITIONAL INSIGHT CARDS**\n`;
    extraCards.forEach((card, idx) => {
      if (!card) return;
      const label = card.position || `Additional insight ${idx + 1}`;
      out += buildCardWithImagery(card, label, optionsFor(idx + 3));
    });
  }

  return out;
}

function buildDecisionPromptCards(cardsInfo, themes, context, visionInsights, promptOptions = {}) {
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

function buildSingleCardPrompt(cardsInfo, themes, context, visionInsights, promptOptions = {}) {
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

function buildStandardPromptCards(spreadKey, cardsInfo, themes, context, visionInsights, promptOptions = {}) {
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

function formatMeaning(meaning) {
  const sentence = meaning.includes('.') ? meaning.split('.')[0] : meaning;
  const lowerCased = sentence.trim();
  if (!lowerCased) {
    return 'fresh perspectives that are still unfolding';
  }
  return lowerCased.charAt(0).toLowerCase() + lowerCased.slice(1);
}
