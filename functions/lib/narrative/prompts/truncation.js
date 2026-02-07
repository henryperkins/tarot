import { estimateTokenCount } from './budgeting.js';
import { USER_PROMPT_INSTRUCTION_HEADER } from './constants.js';

function truncatePrefixToTokenBudget(text, maxTokens) {
  if (maxTokens <= 0) return '';

  // Find a prefix length that reliably fits under the budget according to our
  // estimator. This avoids drift when repeated truncation is applied.
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = text.slice(0, mid);
    if (estimateTokenCount(candidate) <= maxTokens) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  // Try to truncate at a paragraph boundary
  let truncated = text.slice(0, lo);
  const lastParagraph = truncated.lastIndexOf('\n\n');

  if (lastParagraph > truncated.length * 0.7) {
    truncated = truncated.slice(0, lastParagraph);
  }

  truncated = truncated.trim();

  // Very small budgets or aggressive heading penalties can still put us slightly
  // over; back off conservatively to guarantee the constraint.
  while (truncated && estimateTokenCount(truncated) > maxTokens) {
    const nextLen = Math.floor(truncated.length * 0.9);
    if (nextLen <= 0) {
      truncated = '';
      break;
    }
    truncated = truncated.slice(0, nextLen).trim();
  }

  return truncated;
}

function truncateSuffixToTokenBudget(text, maxTokens) {
  if (maxTokens <= 0) return '';

  // Find a suffix length that reliably fits under the budget.
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = text.slice(text.length - mid);
    if (estimateTokenCount(candidate) <= maxTokens) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  let truncated = text.slice(text.length - lo);
  const firstParagraph = truncated.indexOf('\n\n');

  if (firstParagraph !== -1 && firstParagraph < truncated.length * 0.3) {
    truncated = truncated.slice(firstParagraph + 2);
  }

  truncated = truncated.trim();

  while (truncated && estimateTokenCount(truncated) > maxTokens) {
    const nextLen = Math.floor(truncated.length * 0.9);
    if (nextLen <= 0) {
      truncated = '';
      break;
    }
    truncated = truncated.slice(truncated.length - nextLen).trim();
  }

  return truncated;
}

/**
 * Truncate prompt text to fit within a token budget.
 * Preserves structure by truncating from the end or middle when tail tokens
 * are requested.
 *
 * @param {string} text - Text to truncate
 * @param {number} maxTokens - Maximum tokens allowed
 * @param {Object} [options]
 * @param {number} [options.tailTokens] - Tokens to preserve from the end
 * @param {string} [options.separator] - Separator between head and tail
 * @returns {{ text: string, truncated: boolean, originalTokens: number }}
 */
export function truncateToTokenBudget(text, maxTokens, options = {}) {
  if (!text || typeof text !== 'string') {
    return { text: '', truncated: false, originalTokens: 0 };
  }

  const originalTokens = estimateTokenCount(text);
  if (originalTokens <= maxTokens) {
    return { text, truncated: false, originalTokens };
  }

  const tailTokens = Number.isFinite(options.tailTokens) ? Math.max(0, options.tailTokens) : 0;
  const separator = typeof options.separator === 'string' ? options.separator : '\n\n';

  if (!tailTokens) {
    return {
      text: truncatePrefixToTokenBudget(text, maxTokens),
      truncated: true,
      originalTokens
    };
  }

  const separatorTokens = estimateTokenCount(separator);
  const tailBudget = Math.min(tailTokens, Math.max(0, maxTokens - separatorTokens));
  const headBudget = Math.max(0, maxTokens - separatorTokens - tailBudget);

  if (headBudget <= 0) {
    return {
      text: truncateSuffixToTokenBudget(text, maxTokens),
      truncated: true,
      originalTokens
    };
  }

  let headText = truncatePrefixToTokenBudget(text, headBudget);
  const tailText = truncateSuffixToTokenBudget(text, tailBudget);
  let combined = [headText, tailText].filter(Boolean).join(separator).trim();

  while (combined && estimateTokenCount(combined) > maxTokens) {
    if (!headText) {
      combined = truncateSuffixToTokenBudget(text, maxTokens);
      break;
    }
    const nextLen = Math.floor(headText.length * 0.9);
    if (nextLen <= 0) {
      headText = '';
      combined = tailText.trim();
      break;
    }
    headText = headText.slice(0, nextLen).trim();
    combined = [headText, tailText].filter(Boolean).join(separator).trim();
  }

  return {
    text: combined,
    truncated: true,
    originalTokens
  };
}

const USER_PROMPT_INSTRUCTION_MARKER = USER_PROMPT_INSTRUCTION_HEADER;
const USER_PROMPT_GRAPHRAG_MARKER = '## TRADITIONAL WISDOM (GraphRAG)';
const USER_PROMPT_CARD_BOUNDARY_MARKERS = [
  '**Thoth Titles & Decans**',
  '**Marseille Pip Geometry**',
  '**Querent\'s Reflections**',
  '**VISION VALIDATION**',
  '**Vision Validation**',
  USER_PROMPT_GRAPHRAG_MARKER
];

const USER_PROMPT_CARD_MARKERS = Object.freeze({
  celtic: ['**NUCLEUS** (Heart of the Matter):'],
  threecard: ['**THREE-CARD STORY STRUCTURE**'],
  fivecard: ['**FIVE-CARD CLARITY STRUCTURE**'],
  relationship: ['**RELATIONSHIP SNAPSHOT STRUCTURE**'],
  decision: ['**DECISION / TWO-PATH STRUCTURE**'],
  single: ['**ONE-CARD INSIGHT STRUCTURE**']
});

const USER_PROMPT_CARD_MARKER_FALLBACK = Object.freeze([
  ...USER_PROMPT_CARD_MARKERS.celtic,
  ...USER_PROMPT_CARD_MARKERS.threecard,
  ...USER_PROMPT_CARD_MARKERS.fivecard,
  ...USER_PROMPT_CARD_MARKERS.relationship,
  ...USER_PROMPT_CARD_MARKERS.decision,
  ...USER_PROMPT_CARD_MARKERS.single
]);

function normalizeSpreadKey(spreadKey) {
  if (!spreadKey) return '';
  return String(spreadKey).replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function findFirstMarkerIndex(text, markers = [], fromIndex = 0) {
  let best = -1;
  for (const marker of markers) {
    const idx = text.indexOf(marker, fromIndex);
    if (idx === -1) continue;
    if (best === -1 || idx < best) {
      best = idx;
    }
  }
  return best;
}

function splitQuestionBlock(introText) {
  const intro = typeof introText === 'string' ? introText.trim() : '';
  if (!intro) {
    return { questionBlock: '', introRemainder: '' };
  }

  const questionIdx = intro.indexOf('**Question**:');
  if (questionIdx === -1) {
    return { questionBlock: '', introRemainder: intro };
  }

  const firstBreak = intro.indexOf('\n\n', questionIdx);
  if (firstBreak === -1) {
    return { questionBlock: intro, introRemainder: '' };
  }

  return {
    questionBlock: intro.slice(0, firstBreak).trim(),
    introRemainder: intro.slice(firstBreak).trim()
  };
}

const USER_PROMPT_CARD_LINE_PATTERN = /^[^\n:]{1,180}:\s+[^\n]*\b(?:Upright|Reversed)\b\.?/im;

function extractFallbackCardBlock(introRemainder) {
  const safeIntro = typeof introRemainder === 'string' ? introRemainder : '';
  if (!safeIntro) {
    return { cardsText: '', introRemainder: '' };
  }

  const match = USER_PROMPT_CARD_LINE_PATTERN.exec(safeIntro);
  if (!match) {
    return { cardsText: '', introRemainder: safeIntro.trim() };
  }

  const cardStartIdx = match.index;
  const afterCardStart = safeIntro.slice(cardStartIdx);
  const boundaryWithinCards = findFirstMarkerIndex(afterCardStart, USER_PROMPT_CARD_BOUNDARY_MARKERS);
  const cardEndIdx = boundaryWithinCards === -1 ? afterCardStart.length : boundaryWithinCards;

  const cardsText = afterCardStart.slice(0, cardEndIdx).trim();
  const beforeCards = safeIntro.slice(0, cardStartIdx).trim();
  const afterCards = afterCardStart.slice(cardEndIdx).trim();
  const remainingIntro = [beforeCards, afterCards].filter(Boolean).join('\n\n').trim();

  return {
    cardsText,
    introRemainder: remainingIntro
  };
}

function appendWithinBudget(parts, segmentText, maxTokens, options = {}) {
  const raw = typeof segmentText === 'string' ? segmentText.trim() : '';
  if (!raw) return { added: false, truncated: false };

  const currentText = parts.filter(Boolean).join('\n\n').trim();
  const candidate = [currentText, raw].filter(Boolean).join('\n\n').trim();
  if (estimateTokenCount(candidate) <= maxTokens) {
    parts.push(raw);
    return { added: true, truncated: false };
  }

  const remainingTokens = Math.max(0, maxTokens - estimateTokenCount(currentText));
  if (remainingTokens <= 0) {
    return { added: false, truncated: true };
  }

  const truncateFn = options.keepTail ? truncateSuffixToTokenBudget : truncatePrefixToTokenBudget;
  const fitted = truncateFn(raw, remainingTokens);
  if (!fitted) {
    return { added: false, truncated: true };
  }

  parts.push(fitted);
  return { added: true, truncated: true };
}

function splitUserPromptSections(text, spreadKey) {
  const safeText = typeof text === 'string' ? text : '';
  const instructionIdx = safeText.indexOf(USER_PROMPT_INSTRUCTION_MARKER);
  const instructionsStart = instructionIdx >= 0 ? instructionIdx : safeText.length;

  const normalizedSpreadKey = normalizeSpreadKey(spreadKey);
  const spreadMarkers = USER_PROMPT_CARD_MARKERS[normalizedSpreadKey] || USER_PROMPT_CARD_MARKER_FALLBACK;
  let cardStartIdx = findFirstMarkerIndex(safeText, spreadMarkers);
  if (cardStartIdx === -1 && spreadMarkers !== USER_PROMPT_CARD_MARKER_FALLBACK) {
    cardStartIdx = findFirstMarkerIndex(safeText, USER_PROMPT_CARD_MARKER_FALLBACK);
  }
  if (cardStartIdx >= instructionsStart) {
    cardStartIdx = -1;
  }

  const introEnd = cardStartIdx >= 0 ? cardStartIdx : instructionsStart;
  const introText = safeText.slice(0, introEnd).trim();
  let cardsText = '';
  let optionalStart = introEnd;

  if (cardStartIdx >= 0) {
    let cardEndIdx = instructionsStart;
    for (const marker of USER_PROMPT_CARD_BOUNDARY_MARKERS) {
      const idx = safeText.indexOf(marker, cardStartIdx + 1);
      if (idx === -1 || idx >= instructionsStart) continue;
      if (idx < cardEndIdx) {
        cardEndIdx = idx;
      }
    }
    cardsText = safeText.slice(cardStartIdx, cardEndIdx).trim();
    optionalStart = cardEndIdx;
  }

  const betweenCardsAndInstructions = safeText.slice(optionalStart, instructionsStart).trim();
  const graphRAGIdx = betweenCardsAndInstructions.indexOf(USER_PROMPT_GRAPHRAG_MARKER);
  const optionalContext = graphRAGIdx === -1
    ? betweenCardsAndInstructions
    : betweenCardsAndInstructions.slice(0, graphRAGIdx).trim();
  const graphRAGText = graphRAGIdx === -1
    ? ''
    : betweenCardsAndInstructions.slice(graphRAGIdx).trim();
  const instructions = instructionIdx >= 0 ? safeText.slice(instructionIdx).trim() : '';

  const { questionBlock, introRemainder } = splitQuestionBlock(introText);
  let resolvedCardsText = cardsText;
  let resolvedIntroRemainder = introRemainder;
  let resolvedGraphRAGText = graphRAGText;

  if (!resolvedCardsText && resolvedIntroRemainder) {
    const fallbackSplit = extractFallbackCardBlock(resolvedIntroRemainder);
    if (fallbackSplit.cardsText) {
      resolvedCardsText = fallbackSplit.cardsText;
      resolvedIntroRemainder = fallbackSplit.introRemainder;
    }
  }

  if (!resolvedGraphRAGText && resolvedIntroRemainder.includes(USER_PROMPT_GRAPHRAG_MARKER)) {
    const fallbackGraphRAGIdx = resolvedIntroRemainder.indexOf(USER_PROMPT_GRAPHRAG_MARKER);
    resolvedGraphRAGText = resolvedIntroRemainder.slice(fallbackGraphRAGIdx).trim();
    resolvedIntroRemainder = resolvedIntroRemainder.slice(0, fallbackGraphRAGIdx).trim();
  }

  return {
    questionBlock,
    introRemainder: resolvedIntroRemainder,
    cardsText: resolvedCardsText,
    optionalContext,
    graphRAGText: resolvedGraphRAGText,
    instructions
  };
}

/**
 * Section-aware truncation for user prompts.
 * Prioritizes card synthesis + explicit instructions and only then keeps lower-value
 * optional blocks (diagnostics, GraphRAG references, etc).
 *
 * @param {string} text - User prompt text
 * @param {number} maxTokens - Maximum tokens allowed
 * @param {Object} [options]
 * @param {string} [options.spreadKey] - Spread key for card-section marker detection
 * @returns {{ text: string, truncated: boolean, originalTokens: number, preservedSections: string[] }}
 */
export function truncateUserPromptSafely(text, maxTokens, options = {}) {
  if (!text || typeof text !== 'string') {
    return { text: '', truncated: false, originalTokens: 0, preservedSections: [] };
  }

  const originalTokens = estimateTokenCount(text);
  if (originalTokens <= maxTokens) {
    return { text, truncated: false, originalTokens, preservedSections: [] };
  }

  const {
    questionBlock,
    introRemainder,
    cardsText,
    optionalContext,
    graphRAGText,
    instructions
  } = splitUserPromptSections(text, options.spreadKey);

  const separatorTokens = estimateTokenCount('\n\n');
  const instructionReserve = instructions
    ? Math.min(
      estimateTokenCount(instructions),
      Math.max(80, Math.floor(maxTokens * 0.18))
    )
    : 0;
  const bodyBudget = Math.max(0, maxTokens - instructionReserve - (instructions ? separatorTokens : 0));

  const bodyParts = [];
  const preservedSections = [];
  const bodySegments = [
    { key: 'question', value: questionBlock },
    { key: 'cards', value: cardsText },
    { key: 'graphrag', value: graphRAGText },
    { key: 'intro', value: introRemainder },
    { key: 'optional-context', value: optionalContext }
  ];

  for (const segment of bodySegments) {
    if (!segment.value) continue;
    if (segment.key === 'graphrag') {
      const raw = typeof segment.value === 'string' ? segment.value.trim() : '';
      if (!raw) continue;
      const currentText = bodyParts.filter(Boolean).join('\n\n').trim();
      const candidate = [currentText, raw].filter(Boolean).join('\n\n').trim();
      if (estimateTokenCount(candidate) <= bodyBudget) {
        bodyParts.push(raw);
        preservedSections.push(segment.key);
      }
      continue;
    }
    const result = appendWithinBudget(bodyParts, segment.value, bodyBudget);
    if (result.added) {
      preservedSections.push(segment.key);
    }
  }

  const finalParts = [];
  const bodyText = bodyParts.join('\n\n').trim();
  if (bodyText) {
    finalParts.push(bodyText);
  }

  if (instructions) {
    const currentTokens = estimateTokenCount(finalParts.join('\n\n').trim());
    const availableForInstructions = Math.max(
      0,
      maxTokens - currentTokens - (finalParts.length > 0 ? separatorTokens : 0)
    );
    const fittedInstructions = truncatePrefixToTokenBudget(instructions, availableForInstructions);
    if (fittedInstructions) {
      finalParts.push(fittedInstructions);
      preservedSections.push('instructions');
    }
  }

  let resultText = finalParts.join('\n\n').trim();
  if (!resultText) {
    resultText = truncatePrefixToTokenBudget(text, maxTokens);
  }
  if (estimateTokenCount(resultText) > maxTokens) {
    resultText = truncatePrefixToTokenBudget(resultText, maxTokens);
  }

  return {
    text: resultText,
    truncated: true,
    originalTokens,
    preservedSections
  };
}

/**
 * Critical sections that MUST be preserved during system prompt truncation.
 * These contain safety, ethics, and core behavior guidance.
 * Ordered by priority (highest first).
 */
const CRITICAL_SECTION_MARKERS = [
  { start: 'ETHICS', end: null },           // Ethics guidance - never truncate
  { start: 'CORE PRINCIPLES', end: null },  // Core behavior rules - never truncate
  { start: 'MODEL DIRECTIVES:', end: null } // Model behavior directives - never truncate
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extract critical sections from a system prompt that must be preserved.
 *
 * @param {string} text - System prompt text
 * @returns {{ sections: Array<{marker: string, content: string, startIdx: number}>, totalChars: number }}
 */
function extractCriticalSections(text) {
  if (!text) return { sections: [], totalChars: 0 };

  const sections = [];
  let totalChars = 0;

  for (const marker of CRITICAL_SECTION_MARKERS) {
    const pattern = marker.pattern
      ? marker.pattern
      : new RegExp(`^(?:#+\\s*)?${escapeRegExp(marker.start)}\\s*$`, 'm');
    const match = pattern.exec(text);
    if (!match) continue;
    const startIdx = match.index;

    // Find the end of this section (next major section or end of text)
    let endIdx = text.length;
    const searchStart = startIdx + match[0].length;

    // Look for next section marker (common patterns: all-caps line or ## heading)
    const nextSectionMatch = text.slice(searchStart).match(
      /\n(?:##\s+|[A-Z][A-Z0-9\s()'&/-]+(?::[^\n]*)?\n)/
    );
    if (nextSectionMatch) {
      endIdx = searchStart + nextSectionMatch.index;
    }

    const content = text.slice(startIdx, endIdx).trim();
    sections.push({ marker: marker.start, content, startIdx });
    totalChars += content.length;
  }

  return { sections, totalChars };
}

function buildMinimalCriticalPrompt(criticalSections, maxTokens) {
  if (!Array.isArray(criticalSections) || criticalSections.length === 0) {
    return { text: '', preservedSections: [] };
  }

  const orderedSections = CRITICAL_SECTION_MARKERS
    .map((marker) => criticalSections.find((section) => section.marker === marker.start))
    .filter(Boolean);

  const parts = [];
  const preservedSections = [];

  for (const section of orderedSections) {
    const content = section?.content ? section.content.trim() : '';
    if (!content) continue;

    const candidate = [...parts, content].join('\n\n').trim();
    if (estimateTokenCount(candidate) <= maxTokens) {
      parts.push(content);
      preservedSections.push(section.marker);
      continue;
    }

    if (parts.length === 0) {
      const truncated = truncateToTokenBudget(content, maxTokens);
      return { text: truncated.text, preservedSections: [section.marker] };
    }

    break;
  }

  return { text: parts.join('\n\n').trim(), preservedSections };
}

/**
 * Section-aware truncation for system prompts.
 * Preserves critical safety sections (ETHICS, CORE PRINCIPLES, MODEL DIRECTIVES)
 * even when aggressive truncation is needed.
 *
 * @param {string} text - System prompt text to truncate
 * @param {number} maxTokens - Maximum tokens allowed
 * @returns {{ text: string, truncated: boolean, originalTokens: number, preservedSections: string[] }}
 */
export function truncateSystemPromptSafely(text, maxTokens) {
  if (!text || typeof text !== 'string') {
    return { text: '', truncated: false, originalTokens: 0, preservedSections: [] };
  }

  const originalTokens = estimateTokenCount(text);
  if (originalTokens <= maxTokens) {
    return { text, truncated: false, originalTokens, preservedSections: [] };
  }

  // Extract critical sections that must be preserved
  const { sections: criticalSections } = extractCriticalSections(text);
  if (criticalSections.length === 0) {
    const result = truncateToTokenBudget(text, maxTokens);
    return { text: result.text, truncated: result.truncated, originalTokens, preservedSections: [] };
  }

  const criticalText = criticalSections.map((section) => section.content).join('\n\n');
  const criticalTokens = estimateTokenCount(criticalText); // Rough estimate

  const criticalFraction = maxTokens > 0 ? (criticalTokens / maxTokens) : 1;
  if (criticalTokens >= maxTokens || criticalFraction >= 0.8) {
    const minimal = buildMinimalCriticalPrompt(criticalSections, maxTokens);
    const minimalTokens = estimateTokenCount(minimal.text);
    console.warn(
      `[prompts] Critical sections exceed budget; using minimal safety prompt (~${minimalTokens} tokens).`
    );
    return {
      text: minimal.text,
      truncated: true,
      originalTokens,
      preservedSections: minimal.preservedSections
    };
  }

  // Budget for non-critical content (reserve a small buffer for separators and estimation noise).
  const reservedBuffer = 20;
  const availableForOther = Math.max(0, maxTokens - criticalTokens - reservedBuffer);

  // Keep only the intro/context before the first critical marker; drop optional middle sections.
  const firstCriticalIdx = Math.min(...criticalSections.map(s => s.startIdx));
  const intro = text.slice(0, firstCriticalIdx).trim();
  const introResult = truncateToTokenBudget(intro, availableForOther);

  const preservedSections = criticalSections.map((section) => section.marker);
  const parts = [];
  if (introResult.text) {
    parts.push(introResult.text.trim());
  }
  parts.push(criticalText);

  let result = parts.join('\n\n').trim();

  // Guardrail: if budgeting drift still pushes us over, drop the intro entirely.
  if (estimateTokenCount(result) > maxTokens) {
    result = criticalText.trim();
  }

  console.log(`[prompts] Section-aware truncation: ${originalTokens} -> ~${estimateTokenCount(result)} tokens, preserved: [${preservedSections.join(', ')}]`);

  return { text: result, truncated: true, originalTokens, preservedSections };
}
