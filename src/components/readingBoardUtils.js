/**
 * Extract short label from a full position string.
 * Handles formats like "Past — influences that led here" or "You / your energy"
 * @param {string} position - Full position text from spreads.js
 * @param {number} [maxLength=18] - Max chars before returning null (triggers fallback)
 * @returns {string|null} Short label or null if input is falsy or result too long
 */
export function extractShortLabel(position, maxLength = 18) {
  if (!position) return null;
  // Split on em-dash first, then handle parenthetical suffixes and slashes
  const label = position.split(' \u2014 ')[0].split(' (')[0].split(' / ')[0].trim();
  // Return null if too long (allows layout label fallback)
  return label.length <= maxLength ? label : null;
}

/**
 * Get the display label for a spread position
 * @param {Object} spreadInfo - Spread info from spreads.js
 * @param {number} index - Position index
 * @param {Object} [layoutPosition] - Optional layout position with label fallback
 * @returns {string} Position label
 */
export function getPositionLabel(spreadInfo, index, layoutPosition = null) {
  // First try spread definition
  const raw = spreadInfo?.positions?.[index];
  if (raw) {
    const shortLabel = extractShortLabel(raw);
    if (shortLabel) return shortLabel;
  }
  // Then try layout label
  if (layoutPosition?.label) {
    return layoutPosition.label;
  }
  // Final fallback
  return `Position ${index + 1}`;
}

export function getNextUnrevealedIndex(reading, revealedCards) {
  if (!Array.isArray(reading)) return -1;
  return reading.findIndex((_, index) => !revealedCards.has(index));
}

export function getDealtReading(reading, dealIndex) {
  if (!Array.isArray(reading)) return [];
  const dealtCount = Number.isFinite(dealIndex)
    ? Math.min(reading.length, Math.max(0, Math.floor(dealIndex)))
    : reading.length;

  return reading.map((card, index) => (index < dealtCount ? card : null));
}

export function getNextDealIndex(reading, dealIndex) {
  if (!Array.isArray(reading) || reading.length === 0) return 0;
  const dealtCount = Number.isFinite(dealIndex)
    ? Math.min(reading.length, Math.max(0, Math.floor(dealIndex)))
    : 0;

  return Math.min(reading.length, dealtCount + 1);
}

export function getNextTurnIndex(reading, revealedCards, dealIndex) {
  if (!Array.isArray(reading) || reading.length === 0) return -1;
  const dealtCount = Number.isFinite(dealIndex)
    ? Math.min(reading.length, Math.max(0, Math.floor(dealIndex)))
    : reading.length;
  if (dealtCount < reading.length) return -1;

  return getNextUnrevealedIndex(reading, revealedCards);
}
