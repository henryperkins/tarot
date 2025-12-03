/**
 * Card context detection utilities
 * 
 * Provides functions for detecting explicit card references in text
 * while avoiding false positives from common vocabulary usage.
 */

/**
 * Escape special regex characters in a string
 * @param {string} text - Text to escape
 * @returns {string} Escaped text safe for use in RegExp
 */
export function escapeRegex(text = '') {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Card names that are also common vocabulary and prone to false positives
 * when scanning free-form narrative text.
 */
export const AMBIGUOUS_CARD_NAMES = new Set([
  'justice',
  'strength',
  'temperance',
  'death',
  'judgement'
]);

/**
 * Phrases that reference card names in tarot terminology but are NOT
 * actual card references (e.g., "Fool's Journey" refers to the archetypal
 * journey through the Major Arcana, not The Fool card itself).
 */
export const TAROT_TERMINOLOGY_EXCLUSIONS = [
  /fool['\u2019]?s\s+journey/gi,   // "Fool's Journey" - handles both ' and ' (U+2019) apostrophes
  /major\s+arcana\s+journey/gi,    // "Major Arcana journey"
  /hero['\u2019]?s\s+journey/gi,   // "Hero's Journey" (related concept)
  /journey\s+(?:of|through)\s+(?:the\s+)?fool/gi  // "journey of the Fool"
];

/**
 * Require explicit "card-like" context around ambiguous names so that phrases like
 * "restore a sense of justice in how you negotiate" do not count as hallucinated
 * mentions of the Justice card.
 *
 * Detects card mentions via:
 * - Explicit card reference: "Justice card", "the Death card"
 * - Major Arcana context: "Justice (Major Arcana)", "Major Arcana: Death"
 * - Archetypal framing: "The Death archetype", "Strength archetype"
 * - Orientation markers: "Death reversed", "Justice upright"
 * - Markdown formatting: "**Death**", "**Justice**" (bold card names)
 * - Position labels: "Present: Death", "Card 1: Justice", "Outcome — Death"
 * 
 * @param {string} text - The text to search
 * @param {string} name - The card name to look for
 * @returns {boolean} True if explicit card context is found
 */
export function hasExplicitCardContext(text = '', name = '') {
  if (!text || !name) return false;

  const namePattern = escapeRegex(name);

  const patterns = [
    // "Justice card", "Death card", "the Strength card", etc.
    new RegExp(`\\b(?:the\\s+)?${namePattern}\\s+card\\b`, 'i'),

    // "Justice (Major Arcana)", "Major Arcana Justice", "Major Arcana: Death"
    new RegExp(`\\b${namePattern}\\b[^\\n]{0,40}\\bmajor arcana\\b`, 'i'),
    new RegExp(`\\bmajor arcana\\b[^\\n]{0,40}\\b${namePattern}\\b`, 'i'),

    // "The Death archetype", "Strength archetype", "archetype of Death"
    new RegExp(`\\b(?:the\\s+)?${namePattern}\\s+archetype\\b`, 'i'),
    new RegExp(`\\barchetype\\s+(?:of\\s+)?(?:the\\s+)?${namePattern}\\b`, 'i'),

    // "Death reversed", "Justice upright", "Strength (reversed)"
    new RegExp(`\\b${namePattern}\\s+(?:reversed|upright)\\b`, 'i'),
    new RegExp(`\\b${namePattern}\\s*\\(\\s*(?:reversed|upright)\\s*\\)`, 'i'),

    // Markdown bold formatting: "**Death**", "**Justice**"
    new RegExp(`\\*\\*${namePattern}\\*\\*`, 'i'),

    // Position labels: "Present: Death", "Card 1: Justice", "Outcome — Death"
    // Common position words followed by colon/dash and the card name
    new RegExp(`\\b(?:present|past|future|challenge|outcome|advice|anchor|core|heart|theme|guidance|position|card\\s*\\d+)\\s*[:\\-–—]\\s*(?:the\\s+)?${namePattern}\\b`, 'i'),

    // Card name followed by position context: "Death in the Present position"
    new RegExp(`\\b${namePattern}\\s+(?:in\\s+(?:the\\s+)?)?(?:present|past|future|challenge|outcome|advice|anchor)\\s+position\\b`, 'i')
  ];

  return patterns.some((regex) => regex.test(text));
}

/**
 * Normalize a card name for comparison
 * @param {string} value - Card name to normalize
 * @returns {string} Normalized (trimmed, lowercase) name
 */
export function normalizeCardName(value = '') {
  return value.trim().toLowerCase();
}

/**
 * Check if a card name is ambiguous (also common vocabulary)
 * @param {string} name - Card name to check
 * @returns {boolean} True if the name is ambiguous
 */
export function isAmbiguousCardName(name) {
  return AMBIGUOUS_CARD_NAMES.has(normalizeCardName(name));
}