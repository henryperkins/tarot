import { getContextDescriptor } from '../helpers.js';
import { buildCardTransitNotes, generateTimingGuidance } from '../../ephemerisIntegration.js';
import { sanitizeDisplayName, getDepthProfile } from '../styleHelpers.js';
import { sanitizeText } from '../../utils.js';
import { detectPromptInjection } from '../../promptInjectionDetector.js';
import {
  DEFAULT_REVERSAL_DESCRIPTION,
  MAX_QUESTION_TEXT_LENGTH,
  MAX_REFLECTION_TEXT_LENGTH,
  USER_PROMPT_INSTRUCTION_HEADER
} from './constants.js';
import { getDeckStyleNotes } from './deckStyle.js';
import { buildGraphRAGReferenceBlock } from './graphRAGReferenceBlock.js';
import { buildVisionValidationSection } from './visionValidation.js';
import {
  buildCelticCrossPromptCards,
  buildThreeCardPromptCards,
  buildFiveCardPromptCards,
  buildRelationshipPromptCards,
  buildDecisionPromptCards,
  buildSingleCardPrompt,
  buildStandardPromptCards,
  buildDeckSpecificContext
} from './cardBuilders.js';

function sanitizeReflectionForPrompt(reflectionText, maxLength = MAX_REFLECTION_TEXT_LENGTH) {
  if (typeof reflectionText !== 'string' || !reflectionText.trim()) {
    return '';
  }

  let sanitized = sanitizeText(reflectionText, {
    maxLength,
    addEllipsis: true,
    stripMarkdown: true,
    filterInstructions: true
  });

  if (!sanitized) {
    return '';
  }

  const reflectionCheck = detectPromptInjection(sanitized, { confidenceThreshold: 0.6, sanitize: true });
  if (reflectionCheck.isInjection) {
    console.warn('[PromptInjection] Potential injection detected in reflections:', {
      confidence: reflectionCheck.confidence,
      severity: reflectionCheck.severity,
      reasons: reflectionCheck.reasons.slice(0, 3)
    });
    sanitized = reflectionCheck.sanitizedText;
  }

  return sanitized || '';
}

function reflectionDedupKey(text) {
  if (typeof text !== 'string' || !text.trim()) return '';
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

function sanitizeReflectionForDedupe(reflectionText) {
  if (typeof reflectionText !== 'string' || !reflectionText.trim()) {
    return '';
  }
  return sanitizeText(reflectionText, {
    maxLength: 120,
    addEllipsis: true,
    stripMarkdown: true,
    filterInstructions: true
  });
}

export function buildUserPrompt(
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
  const displayName = sanitizeDisplayName(personalization?.displayName);
  const depthPreference = personalization?.preferredSpreadDepth;
  const depthProfile = depthPreference ? getDepthProfile(depthPreference) : null;
  const activeThemes = typeof themes === 'object' && themes !== null ? themes : {};
  const reversalDescriptor = activeThemes.reversalDescription || { ...DEFAULT_REVERSAL_DESCRIPTION };
  let prompt = ``;

  const includeDeckContext = promptOptions.includeDeckContext !== false;
  const includeDiagnostics = promptOptions.includeDiagnostics !== false;

  // Question - filter instruction patterns and detect semantic injection
  let safeQuestion = userQuestion ? sanitizeText(userQuestion, { maxLength: MAX_QUESTION_TEXT_LENGTH, addEllipsis: true, stripMarkdown: true, filterInstructions: true }) : '';
  
  // Semantic injection detection for novel attack patterns
  const injectionCheck = detectPromptInjection(safeQuestion, { confidenceThreshold: 0.6, sanitize: true });
  if (injectionCheck.isInjection) {
    console.warn('[PromptInjection] Potential injection detected:', {
      confidence: injectionCheck.confidence,
      severity: injectionCheck.severity,
      reasons: injectionCheck.reasons.slice(0, 3)
    });
    // Use sanitized version
    safeQuestion = injectionCheck.sanitizedText;
  }
  
  const questionLine = safeQuestion || '(No explicit question; speak to the energy most present for the querent.)';
  prompt += `**Question**: ${questionLine}\n\n`;

  if (displayName) {
    prompt += `**Querent Name**: ${displayName}\n\n`;
    prompt += `**Name Usage**:\n- Weave the querent's name naturally in key transitions (for example, "For you, ${displayName}, this suggests...").\n- If you acknowledge the question, do so after the opening felt-experience sentences; avoid rigid openers.\n- Close with "Remember, ${displayName}, ..." to keep the reading personal without overusing the name.\n\n`;
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
  if (Array.isArray(personalization?.focusAreas) && personalization.focusAreas.length > 0) {
    const focusList = personalization.focusAreas
      .slice(0, 5)
      .map((entry) => (typeof entry === 'string' ? sanitizeText(entry, { maxLength: 40, addEllipsis: true, stripMarkdown: true, filterInstructions: true }) : ''))
      .filter(Boolean)
      .join(', ');
    thematicLines.push(`- Focus areas (from onboarding): ${focusList}`);
  }
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
    activeThemes.knowledgeGraph.narrativeHighlights.slice(0, 5).forEach((highlight, _index) => {
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
      prompt += '- Use at most one of these hints in the final narrative (Opening or Synthesis).\n\n';
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
    prompt += buildRelationshipPromptCards(cardsInfo, spreadAnalysis, activeThemes, context, visionInsights, promptOptions);
  } else if (spreadKey === 'decision') {
    prompt += buildDecisionPromptCards(cardsInfo, spreadAnalysis, activeThemes, context, visionInsights, promptOptions);
  } else if (spreadKey === 'single') {
    prompt += buildSingleCardPrompt(cardsInfo, spreadAnalysis, activeThemes, context, visionInsights, promptOptions);
  } else {
    prompt += buildStandardPromptCards(spreadKey, cardsInfo, activeThemes, context, visionInsights, promptOptions);
  }

  const deckSpecificContext = buildDeckSpecificContext(deckStyle, cardsInfo, { includeDeckContext });
  if (deckSpecificContext) {
    prompt += deckSpecificContext;
  }

  // Global reflections are additive to per-card reflections unless duplicated.
  const perCardReflectionKeys = new Set(
    (Array.isArray(cardsInfo) ? cardsInfo : [])
      .map((card) => sanitizeReflectionForDedupe(card?.userReflection))
      .map(reflectionDedupKey)
      .filter(Boolean)
  );
  const sanitizedReflections = sanitizeReflectionForPrompt(reflectionsText);
  const globalReflectionKey = reflectionDedupKey(sanitizedReflections);
  const isDuplicateGlobalReflection = globalReflectionKey && perCardReflectionKeys.has(globalReflectionKey);

  if (sanitizedReflections && !isDuplicateGlobalReflection) {
    prompt += `\n**Querent's Reflections**:\n${sanitizedReflections}\n\n`;
  }

  const visionSection = buildVisionValidationSection(visionInsights, { includeDiagnostics, cardsInfo });
  if (visionSection) {
    prompt += visionSection;
  }

  const graphRAGSection = buildGraphRAGReferenceBlock(spreadKey, activeThemes, promptOptions);
  if (graphRAGSection) {
    prompt += `\n${graphRAGSection}\n`;
  }

  // Instructions (minimal - detailed rules are in system prompt)
  prompt += `\n${USER_PROMPT_INSTRUCTION_HEADER}
- Do not introduce any card names beyond the provided spread; treat Fool’s Journey references as stage context only.
- Reference each card by name at least once
- Tie each card's insight to its position and at least one concrete anchor (imagery, element, visual profile, or reflection)
- Use the question and focus areas as the throughline; avoid generic platitudes
- Offer 2-4 specific, low-stakes next steps linked to the question or focus areas
- Close with a trajectory reminder (choices shape outcomes)
- Apply the reversal lens consistently throughout`;

  return prompt;
}
