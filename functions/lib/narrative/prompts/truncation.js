import { createTokenEstimator, PromptBudgetError } from './budgeting.js';
import { USER_PROMPT_INSTRUCTION_HEADER } from './constants.js';
import { parseUserContext, fitUserContext } from './userContext.js';

function dropIncompleteReadingContextLines(text) {
  // Reading context is serialized on one line. Keep each data boundary intact
  // when a budget cut lands within it, before appending trusted instructions.
  return text.split('\n').filter((line) => {
    const outsideCompleteBlocks = line.replace(/<reading_memory slot="memory-[0-2]">[^\n]*?<\/reading_memory>|<reading_context>[^\n]*?<\/reading_context>|<user_context source="[^"]+">[^\n]*?<\/user_context>/g, '');
    return !/<\/?(?:reading_context|user_context|reading_memory)\b/.test(outsideCompleteBlocks);
  }).join('\n').trim();
}

function truncatePrefixToTokenBudget(text, maxTokens, estimator) {
  if (maxTokens <= 0) return '';

  // Find a prefix length that reliably fits under the budget according to our
  // estimator. This avoids drift when repeated truncation is applied.
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = text.slice(0, mid);
    if (estimator.estimate(candidate) <= maxTokens) {
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
  while (truncated && estimator.estimate(truncated) > maxTokens) {
    const nextLen = Math.floor(truncated.length * 0.9);
    if (nextLen <= 0) {
      truncated = '';
      break;
    }
    truncated = truncated.slice(0, nextLen).trim();
  }

  return dropIncompleteReadingContextLines(truncated);
}

function truncateSuffixToTokenBudget(text, maxTokens, estimator) {
  if (maxTokens <= 0) return '';

  // Find a suffix length that reliably fits under the budget.
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = text.slice(text.length - mid);
    if (estimator.estimate(candidate) <= maxTokens) {
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

  while (truncated && estimator.estimate(truncated) > maxTokens) {
    const nextLen = Math.floor(truncated.length * 0.9);
    if (nextLen <= 0) {
      truncated = '';
      break;
    }
    truncated = truncated.slice(truncated.length - nextLen).trim();
  }

  return dropIncompleteReadingContextLines(truncated);
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
  const estimator = options.estimator ?? createTokenEstimator();
  if (!text || typeof text !== 'string') {
    return { text: '', truncated: false, originalTokens: 0 };
  }

  const originalTokens = estimator.estimate(text);
  if (originalTokens <= maxTokens) {
    return { text, truncated: false, originalTokens };
  }

  const tailTokens = Number.isFinite(options.tailTokens) ? Math.max(0, options.tailTokens) : 0;
  const separator = typeof options.separator === 'string' ? options.separator : '\n\n';

  if (!tailTokens) {
    return {
      text: truncatePrefixToTokenBudget(text, maxTokens, estimator),
      truncated: true,
      originalTokens
    };
  }

  const separatorTokens = estimator.estimate(separator);
  const tailBudget = Math.min(tailTokens, Math.max(0, maxTokens - separatorTokens));
  const headBudget = Math.max(0, maxTokens - separatorTokens - tailBudget);

  if (headBudget <= 0) {
    return {
      text: truncateSuffixToTokenBudget(text, maxTokens, estimator),
      truncated: true,
      originalTokens
    };
  }

  let headText = truncatePrefixToTokenBudget(text, headBudget, estimator);
  const tailText = truncateSuffixToTokenBudget(text, tailBudget, estimator);
  let combined = [headText, tailText].filter(Boolean).join(separator).trim();

  while (combined && estimator.estimate(combined) > maxTokens) {
    if (!headText) {
      combined = truncateSuffixToTokenBudget(text, maxTokens, estimator);
      break;
    }
    const nextLen = Math.floor(headText.length * 0.9);
    if (nextLen <= 0) {
      headText = '';
      combined = tailText.trim();
      break;
    }
    headText = dropIncompleteReadingContextLines(headText.slice(0, nextLen));
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
const USER_PROMPT_GRAPHRAG_SUMMARY_MARKER = '## TRADITIONAL WISDOM SIGNALS (GraphRAG Summary)';
const USER_PROMPT_CARD_BOUNDARY_MARKERS = [
  '**Thoth Titles & Decans**',
  '**Marseille Pip Themes**',
  '**Querent\'s Reflections**',
  '**VISION VALIDATION**',
  '**Vision Validation**',
  '**Returning Querent Context**:',
  USER_PROMPT_GRAPHRAG_MARKER,
  USER_PROMPT_GRAPHRAG_SUMMARY_MARKER
];

const USER_PROMPT_GRAPHRAG_MARKERS = [
  USER_PROMPT_GRAPHRAG_MARKER,
  USER_PROMPT_GRAPHRAG_SUMMARY_MARKER
];

const CRITICAL_INSTRUCTION_PATTERNS = [
  /Do not introduce any card names/i,
  /Reference each card by name/i,
  /Tie each card's insight/i,
  /Use the (?:current )?question and (?:focus areas|reflections)/i,
  /Apply the reversal lens consistently/i,
  /Offer (?:one|1|2[-–]4) specific/i,
  /Close with a trajectory reminder/i
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

function splitAtFirstMarker(text, markers = []) {
  const safeText = typeof text === 'string' ? text : '';
  const idx = findFirstMarkerIndex(safeText, markers);
  if (idx === -1) {
    return { before: safeText.trim(), after: '' };
  }
  return {
    before: safeText.slice(0, idx).trim(),
    after: safeText.slice(idx).trim()
  };
}

function appendInstructionLine(parts, line, maxTokens, estimator) {
  const text = typeof line === 'string' ? line.trim() : '';
  if (!text) return false;
  const candidate = [...parts, text].join('\n').trim();
  if (estimator.estimate(candidate) > maxTokens) {
    return false;
  }
  parts.push(text);
  return true;
}

function fitInstructionBlockToBudget(instructions, maxTokens, estimator) {
  const safeInstructions = typeof instructions === 'string' ? instructions.trim() : '';
  if (!safeInstructions || maxTokens <= 0) {
    return '';
  }
  if (estimator.estimate(safeInstructions) <= maxTokens) {
    return safeInstructions;
  }

  const lines = safeInstructions
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return '';
  }

  const header = lines[0];
  const bullets = lines.slice(1);
  const selected = [];
  const seen = new Set();

  for (const pattern of CRITICAL_INSTRUCTION_PATTERNS) {
    const match = bullets.find((line) => pattern.test(line));
    if (match && !seen.has(match)) {
      selected.push(match);
      seen.add(match);
    }
  }

  for (const line of bullets) {
    if (!seen.has(line)) {
      selected.push(line);
      seen.add(line);
    }
  }

  const parts = [];
  if (!appendInstructionLine(parts, header, maxTokens, estimator)) {
    return truncatePrefixToTokenBudget(header, maxTokens, estimator);
  }

  for (const line of selected) {
    appendInstructionLine(parts, line, maxTokens, estimator);
  }

  return parts.join('\n').trim();
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
  const estimator = options.estimator ?? createTokenEstimator();
  const raw = typeof segmentText === 'string' ? segmentText.trim() : '';
  if (!raw) return { added: false, truncated: false };

  const currentText = parts.filter(Boolean).join('\n\n').trim();
  const candidate = [currentText, raw].filter(Boolean).join('\n\n').trim();
  if (estimator.estimate(candidate) <= maxTokens) {
    parts.push(raw);
    return { added: true, truncated: false };
  }

  const remainingTokens = Math.max(0, maxTokens - estimator.estimate(currentText));
  if (remainingTokens <= 0) {
    return { added: false, truncated: true };
  }

  const truncateFn = options.keepTail ? truncateSuffixToTokenBudget : truncatePrefixToTokenBudget;
  const fitted = truncateFn(raw, remainingTokens, estimator);
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
  const splitOptional = splitAtFirstMarker(betweenCardsAndInstructions, USER_PROMPT_GRAPHRAG_MARKERS);
  const optionalContext = splitOptional.before;
  const graphRAGText = splitOptional.after;
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

  if (!resolvedGraphRAGText && findFirstMarkerIndex(resolvedIntroRemainder, USER_PROMPT_GRAPHRAG_MARKERS) !== -1) {
    const fallbackSplit = splitAtFirstMarker(resolvedIntroRemainder, USER_PROMPT_GRAPHRAG_MARKERS);
    resolvedGraphRAGText = fallbackSplit.after;
    resolvedIntroRemainder = fallbackSplit.before;
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
 * @param {string} [options.cardInventory] - Complete canonical card data reserved atomically when fitting
 * @returns {{ text: string, truncated: boolean, originalTokens: number, preservedSections: string[] }}
 */
export function truncateUserPromptSafely(text, maxTokens, options = {}) {
  const estimator = options.estimator ?? createTokenEstimator();
  if (!text || typeof text !== 'string') {
    return { text: '', truncated: false, originalTokens: 0, preservedSections: [] };
  }

  const originalTokens = estimator.estimate(text);
  if (originalTokens <= maxTokens) {
    return { text, truncated: false, originalTokens, preservedSections: [] };
  }

  if (typeof options.cardInventory === 'string' && options.cardInventory.trim() && !options.inventoryAllocated) {
    // Reserve the complete canonical spread before fitting verbose prose. A
    // later card may lose optional detail, but never its identity or position.
    const inventory = options.cardInventory.trim();
    const available = maxTokens - estimator.estimate(inventory) - estimator.estimate('\n\n') - 12;
    if (available <= 0) throw new PromptBudgetError();
    const body = truncateUserPromptSafely(text, available, {
      ...options, estimator, cardInventory: undefined, inventoryAllocated: true
    });
    const result = [inventory, body.text].filter(Boolean).join('\n\n');
    if (estimator.estimate(result) > maxTokens) throw new PromptBudgetError();
    return {
      text: result,
      truncated: true,
      originalTokens,
      preservedSections: ['drawn-cards', ...body.preservedSections]
    };
  }

  const userContext = parseUserContext(text);
  if (userContext.size && !options.contextAllocated) {
    // Allocate explicit current context separately from verbose derived card
    // prose. Keep the question first, share the remainder across reflections,
    // and retain both ends of each field instead of silently losing its tail.
    const stripped = text.replace(/^.*<user_context source="[^"]+">[^\n]*?<\/user_context>[^\n]*\n?/gm, '');
    const instructionIdx = stripped.indexOf(USER_PROMPT_INSTRUCTION_MARKER);
    const instructions = instructionIdx < 0 ? '' : stripped.slice(instructionIdx).trim();
    const instructionTokens = estimator.estimate(instructions);
    const baseReserve = Math.min(
      estimator.estimate(stripped),
      instructionTokens + Math.ceil(Math.max(0, maxTokens - instructionTokens) * 0.5)
    );
    const contextBudget = Math.max(0, maxTokens - baseReserve - 10);
    const parts = [];
    const question = userContext.get('question');
    if (question !== undefined) {
      const fitted = fitUserContext('question', question, contextBudget, { estimator });
      if (fitted) parts.push(`**Question**: ${fitted}`);
    }
    const remaining = [...userContext.entries()].filter(([source]) => source !== 'question');
    // Small sources go first so unused shares flow to larger fields.
    remaining.sort((a, b) => JSON.stringify(a[1]).length - JSON.stringify(b[1]).length);
    remaining.forEach(([source, value], index) => {
      const available = Math.max(0, contextBudget - estimator.estimate(parts.join('\n\n')));
      const share = Math.max(0, Math.floor(available / (remaining.length - index)) - 20);
      const fitted = fitUserContext(source, value, share, { estimator });
      if (fitted) parts.push(`${source === 'reflections' ? "**Querent's Reflections**:" : source === 'pathA' || source === 'pathB' ? `Path ${source.slice(-1)} (card ${source === 'pathA' ? 2 : 3}):` : source.startsWith('interpretation-') ? `Untrusted caller interpretation for card ${Number(source.slice(15)) + 1}:` : `Reflection for card ${Number(source.slice(5)) + 1}:`} ${fitted}`);
    });
    const contextText = parts.join('\n\n');
    const baseBudget = Math.max(0, maxTokens - estimator.estimate(contextText) - 10);
    const base = truncateUserPromptSafely(stripped, baseBudget, { ...options, estimator, contextAllocated: true });
    const baseInstructionIdx = base.text.indexOf(USER_PROMPT_INSTRUCTION_MARKER);
    const body = baseInstructionIdx < 0 ? base.text : base.text.slice(0, baseInstructionIdx).trim();
    const tail = baseInstructionIdx < 0 ? '' : base.text.slice(baseInstructionIdx);
    const result = [contextText, body, tail].filter(Boolean).join('\n\n');
    return { text: result, truncated: true, originalTokens, preservedSections: ['user-context', ...base.preservedSections] };
  }

  const {
    questionBlock,
    introRemainder,
    cardsText,
    optionalContext,
    graphRAGText,
    instructions
  } = splitUserPromptSections(text, options.spreadKey);

  const separatorTokens = estimator.estimate('\n\n');
  // The full footer outranks optional intro/enrichment when it fits alongside
  // the question and drawn cards. A percentage-only reserve lets those optional
  // sections crowd out action, card-name and ethics instructions unnecessarily.
  const coreWithInstructions = [questionBlock, cardsText, instructions].filter(Boolean).join('\n\n');
  const instructionReserve = instructions
    ? Math.min(
      estimator.estimate(instructions),
      estimator.estimate(coreWithInstructions) <= maxTokens
        ? estimator.estimate(instructions)
        : Math.max(80, Math.floor(maxTokens * 0.18))
    )
    : 0;
  const bodyBudget = Math.max(0, maxTokens - instructionReserve - (instructions ? separatorTokens : 0));

  const bodyParts = [];
  const preservedSections = [];
  const bodySegments = [
    { key: 'question', value: questionBlock },
    { key: 'cards', value: cardsText },
    { key: 'intro', value: introRemainder },
    { key: 'optional-context', value: optionalContext },
    { key: 'graphrag', value: graphRAGText }
  ];

  for (const segment of bodySegments) {
    if (!segment.value) continue;
    if (segment.key === 'graphrag') {
      const raw = typeof segment.value === 'string' ? segment.value.trim() : '';
      if (!raw) continue;
      const currentText = bodyParts.filter(Boolean).join('\n\n').trim();
      const candidate = [currentText, raw].filter(Boolean).join('\n\n').trim();
      if (estimator.estimate(candidate) <= bodyBudget) {
        bodyParts.push(raw);
        preservedSections.push(segment.key);
      }
      continue;
    }
    const result = appendWithinBudget(bodyParts, segment.value, bodyBudget, { estimator });
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
    const currentTokens = estimator.estimate(finalParts.join('\n\n').trim());
    const availableForInstructions = Math.max(
      0,
      maxTokens - currentTokens - (finalParts.length > 0 ? separatorTokens : 0)
    );
    const fittedInstructions = fitInstructionBlockToBudget(instructions, availableForInstructions, estimator);
    if (fittedInstructions) {
      finalParts.push(fittedInstructions);
      preservedSections.push('instructions');
    }
  }

  let resultText = finalParts.join('\n\n').trim();
  if (!resultText) {
    resultText = truncatePrefixToTokenBudget(text, maxTokens, estimator);
  }
  if (estimator.estimate(resultText) > maxTokens) {
    resultText = truncatePrefixToTokenBudget(resultText, maxTokens, estimator);
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
  { start: 'AGE AND TIME', end: null },      // Conditional personal-fact timing guidance
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

function buildMinimalCriticalPrompt(criticalSections, maxTokens, estimator) {
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
    if (estimator.estimate(candidate) <= maxTokens) {
      parts.push(content);
      preservedSections.push(section.marker);
      continue;
    }

    if (parts.length === 0) {
      const truncated = truncateToTokenBudget(content, maxTokens, { estimator });
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
export function truncateSystemPromptSafely(text, maxTokens, options = {}) {
  const estimator = options.estimator ?? createTokenEstimator();
  if (!text || typeof text !== 'string') {
    return { text: '', truncated: false, originalTokens: 0, preservedSections: [] };
  }

  const originalTokens = estimator.estimate(text);
  if (originalTokens <= maxTokens) {
    return { text, truncated: false, originalTokens, preservedSections: [] };
  }

  // Extract critical sections that must be preserved
  const { sections: criticalSections } = extractCriticalSections(text);
  if (criticalSections.length === 0) {
    const result = truncateToTokenBudget(text, maxTokens, { estimator });
    return { text: result.text, truncated: result.truncated, originalTokens, preservedSections: [] };
  }

  const criticalText = criticalSections.map((section) => section.content).join('\n\n');
  const criticalTokens = estimator.estimate(criticalText); // Rough estimate

  // Provider-bound builds must retain the complete safety contract. Compatibility
  // callers may still request the historical minimal-section behavior.
  if (options.requireCompleteCriticalSections && criticalTokens > maxTokens) {
    throw new PromptBudgetError();
  }

  const criticalFraction = maxTokens > 0 ? (criticalTokens / maxTokens) : 1;
  if (criticalTokens >= maxTokens || criticalFraction >= 0.8) {
    if (options.requireCompleteCriticalSections) {
      return {
        text: criticalText,
        truncated: true,
        originalTokens,
        preservedSections: criticalSections.map(section => section.marker)
      };
    }
    const minimal = buildMinimalCriticalPrompt(criticalSections, maxTokens, estimator);
    const minimalTokens = estimator.estimate(minimal.text);
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
  const introResult = truncateToTokenBudget(intro, availableForOther, { estimator });

  const preservedSections = criticalSections.map((section) => section.marker);
  const parts = [];
  if (introResult.text) {
    parts.push(introResult.text.trim());
  }
  parts.push(criticalText);

  let result = parts.join('\n\n').trim();

  // Guardrail: if budgeting drift still pushes us over, drop the intro entirely.
  if (estimator.estimate(result) > maxTokens) {
    result = criticalText.trim();
  }

  console.log(`[prompts] Section-aware truncation: ${originalTokens} -> ~${estimator.estimate(result)} tokens, preserved: [${preservedSections.join(', ')}]`);

  return { text: result, truncated: true, originalTokens, preservedSections };
}
