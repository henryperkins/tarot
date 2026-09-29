/**
 * What a finished MCP reading job delivered. The status tools, the text they
 * expose and journal saves all follow this one decision, so ChatGPT is never
 * asked to present or save text that is not a reading.
 */

/**
 * Gate reasons that only record a failed first attempt. When a streamed draft
 * fails the quality gate, a buffered provider writes the reading instead and
 * the response keeps gateBlocked with this reason; that reading passed its
 * own checks.
 */
const NOTICE_ONLY_GATE_REASONS = new Set(['quality_gate_streaming']);

export const READING_OUTCOME = Object.freeze({
  /** A narrative to present and, on request, save. */
  READING: 'reading',
  /** The crisis gate answered with support resources instead of a reading. */
  SUPPORT: 'support_message',
  /** A safety check replaced the narrative with a generic fallback. */
  WITHHELD: 'withheld',
  /** Finished without any text. */
  EMPTY: 'empty'
});

/**
 * Classify a completed job's result. Any gate block other than a notice
 * withholds the text, so an unknown gate reason fails closed.
 *
 * @param {object|null|undefined} result - { reading, provider, gateBlocked, gateReason }
 * @returns {string} One of READING_OUTCOME
 */
export function classifyReadingResult(result) {
  if (result?.provider === 'safety-gate' || result?.gateReason === 'crisis_gate') {
    return READING_OUTCOME.SUPPORT;
  }
  if (typeof result?.reading !== 'string' || !result.reading.trim()) {
    return READING_OUTCOME.EMPTY;
  }
  if (result.provider === 'safe-fallback') return READING_OUTCOME.WITHHELD;
  if (result.gateBlocked && !NOTICE_ONLY_GATE_REASONS.has(result.gateReason)) {
    return READING_OUTCOME.WITHHELD;
  }
  return READING_OUTCOME.READING;
}
