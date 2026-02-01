/**
 * Position synthesis templates for contextual card interpretation.
 * Maps roleKeys to narrative phrases that connect card and position.
 *
 * These templates help users understand how the card's energy
 * manifests specifically in its spread position.
 */

/**
 * Synthesis templates keyed by roleKey from spreads.js
 * Each template takes the card name and returns a contextual phrase.
 */
export const POSITION_SYNTHESIS = {
  // Single card
  theme: (cardName) => `${cardName} emerges as the central energy guiding this moment`,

  // Three-Card Story
  past: (cardName) => `${cardName} in your past reveals what shaped this moment`,
  present: (cardName) => `${cardName} illuminates where you stand now`,
  future: (cardName) => `${cardName} shows the trajectory ahead if nothing shifts`,

  // Five-Card Clarity
  core: (cardName) => `${cardName} at the core reveals the heart of the matter`,
  challenge: (cardName) => `${cardName} as your challenge indicates tension around`,
  subconscious: (cardName) => `${cardName} in the hidden position suggests underlying currents`,
  support: (cardName) => `${cardName} offers supportive energy you can draw upon`,
  direction: (cardName) => `${cardName} points toward the likely direction ahead`,

  // Decision / Two-Path
  heart: (cardName) => `${cardName} at the heart reveals what truly matters in this choice`,
  pathA: (cardName) => `${cardName} on Path A suggests this direction would bring`,
  pathB: (cardName) => `${cardName} on Path B suggests this alternative would bring`,
  clarifier: (cardName) => `${cardName} as clarifier helps illuminate the right path`,
  freeWill: (cardName) => `${cardName} reminds you of your agency in this decision`,

  // Relationship
  you: (cardName) => `${cardName} reflects your energy in this connection`,
  them: (cardName) => `${cardName} reflects their energy and perspective`,
  connection: (cardName) => `${cardName} reveals the nature of your shared dynamic`,

  // Celtic Cross
  near_future: (cardName) => `${cardName} in the near future shows what approaches`,
  conscious: (cardName) => `${cardName} represents your conscious awareness and goals`,
  self_advice: (cardName) => `${cardName} offers guidance on how to approach this`,
  external: (cardName) => `${cardName} shows external influences and others' perspectives`,
  hopes_fears: (cardName) => `${cardName} touches on your deepest hopes and fears`,
  outcome: (cardName) => `${cardName} suggests the likely outcome if you continue unchanged`,

  // Default fallback
  _default: (cardName, positionLabel) => `${cardName} in ${positionLabel} brings its energy to bear`
};

/**
 * Get synthesis text for a card in a specific position.
 *
 * @param {string} cardName - The card's display name (e.g., "The Tower")
 * @param {string} roleKey - The position's roleKey from spreads.js (e.g., "challenge")
 * @param {string} positionLabel - The full position label (fallback context)
 * @returns {string} A contextual synthesis phrase
 */
export function getSynthesisText(cardName, roleKey, positionLabel) {
  const template = POSITION_SYNTHESIS[roleKey] || POSITION_SYNTHESIS._default;
  return template(cardName, positionLabel);
}

/**
 * Extract a short position anchor from the full position label.
 * Used for persistent position badges that survive the flip animation.
 *
 * @param {string} positionLabel - Full position label like "Past — influences that led here"
 * @returns {string} Short anchor like "Past"
 */
export function getPositionAnchor(positionLabel) {
  if (!positionLabel) return '';
  // Split on common delimiters and take the first meaningful segment
  const parts = positionLabel.split(/\s*[—–\-:\/]\s*/);
  const anchor = (parts[0] || positionLabel).trim();
  // Limit length for badge display
  return anchor.length <= 16 ? anchor : `${anchor.slice(0, 14)}...`;
}

export default { POSITION_SYNTHESIS, getSynthesisText, getPositionAnchor };
