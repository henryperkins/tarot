import {
  filterInstructionPatterns,
  normalizeUnicodeForPatternMatch,
  sanitizeText
} from './utils.js';
import { detectPromptInjection } from './promptInjectionDetector.js';

/**
 * Clean card context without imposing a second length budget. Once an
 * instruction-like sentence starts, discard its continuation as well: replacing
 * only the trigger can leave an output directive behind in the next sentence.
 * Remaining text is still untrusted data when it is placed in a prompt.
 */
export function sanitizeReadingContext(text) {
  if (typeof text !== 'string') return '';

  const accepted = [];
  const sentences = text.match(/[^.!?]+(?:[.!?]+|$)/g) || [];
  for (const sentence of sentences) {
    const normalized = normalizeUnicodeForPatternMatch(sentence);
    const detection = detectPromptInjection(sentence, { confidenceThreshold: 0.6 });
    const hasInstructionPattern = filterInstructionPatterns(normalized) !== normalized;
    const hasInstructionSignal = detection.reasons.some((reason) =>
      /^(instruction_override|role_manipulation|boundary_confusion|output_manipulation|encoding_obfuscation):/.test(reason)
    );
    if (hasInstructionPattern || hasInstructionSignal || detection.isInjection) break;
    accepted.push(sentence);
  }

  return sanitizeText(accepted.join(''), { stripMarkdown: true, stripControlChars: true });
}

/** Return a fresh card object; canonical identity and the caller's object stay intact. */
export function sanitizeReadingCard(card) {
  if (!card || typeof card !== 'object' || Array.isArray(card)) return card;

  const safeCard = { ...card };
  for (const field of ['position', 'meaning', 'userReflection']) {
    if (Object.hasOwn(card, field)) safeCard[field] = sanitizeReadingContext(card[field]);
  }
  return safeCard;
}
