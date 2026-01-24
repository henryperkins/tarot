import { estimateTokenCount } from './budgeting.js';

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
  let tailText = truncateSuffixToTokenBudget(text, tailBudget);
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

function makePromptSafetyBudgetError(details) {
  const err = new Error('PROMPT_SAFETY_BUDGET_EXCEEDED');
  err.details = details || null;
  return err;
}

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
    throw makePromptSafetyBudgetError({
      criticalTokens,
      maxTokens,
      budgetPercent: Number((criticalFraction * 100).toFixed(1))
    });
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
