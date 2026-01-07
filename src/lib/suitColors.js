/**
 * Suit color utilities for tarot card reveal effects
 * Colors match the theme swatch design system (docs/theme-swatch.html)
 */

/**
 * RGB values for each tarot suit
 * Used to construct rgba() colors with variable opacity
 */
const SUIT_RGB = {
  Wands: [201, 168, 118],      // #C9A876 - Fire element
  Cups: [139, 149, 165],        // #8B95A5 - Water element  
  Swords: [107, 114, 128],      // #6B7280 - Air element
  Pentacles: [138, 153, 133],   // #8A9985 - Earth element
};

/**
 * Default gold color for Major Arcana and fallback
 */
const DEFAULT_RGB = [212, 184, 150]; // #D4B896 - Gold champagne

/**
 * Get glow color for a card based on its suit
 * @param {object|null} card - Card object with suit property
 * @param {number} opacity - Opacity value (0-1), defaults to 0.3
 * @returns {string} rgba color string
 */
export function getSuitGlowColor(card, opacity = 0.3) {
  const rgb = SUIT_RGB[card?.suit] || DEFAULT_RGB;
  return `rgba(${rgb.join(', ')}, ${opacity})`;
}

/**
 * Get border color for a card based on its suit
 * @param {object|null} card - Card object with suit property
 * @returns {string} Hex color string
 */
export function getSuitBorderColor(card) {
  const borderColors = {
    Wands: '#C9A876',
    Cups: '#8B95A5',
    Swords: '#6B7280',
    Pentacles: '#8A9985',
  };
  return borderColors[card?.suit] || '#D4B896';
}

/**
 * Get suit accent CSS variable name
 * @param {object|null} card - Card object with suit property
 * @returns {string} CSS variable reference
 */
export function getSuitCSSVar(card) {
  const suit = card?.suit?.toLowerCase();
  if (suit && ['wands', 'cups', 'swords', 'pentacles'].includes(suit)) {
    return `var(--color-${suit})`;
  }
  return 'var(--brand-primary)';
}

/**
 * Check if a card is a Major Arcana card
 * @param {object|null} card - Card object
 * @returns {boolean} True if Major Arcana
 */
export function isMajorArcana(card) {
  return !card?.suit;
}

/**
 * Get the appropriate glow box-shadow for a revealed card
 * @param {object|null} card - Card object with suit property
 * @returns {string} CSS box-shadow value
 */
export function getRevealedCardGlow(card) {
  const glowColor = getSuitGlowColor(card, 0.3);
  const glowColorFaint = getSuitGlowColor(card, 0.15);
  return `0 0 30px ${glowColor}, 0 0 60px ${glowColorFaint}, 0 4px 20px rgba(0, 0, 0, 0.4)`;
}

/**
 * Get the mystic panel gradient background
 * This matches the theme swatch "Mystic Panel" gradient
 * @returns {string} CSS background value
 */
export function getMysticPanelGradient() {
  return `
    radial-gradient(circle at 0% 18%, var(--glow-gold), transparent 40%),
    radial-gradient(circle at 100% 0%, var(--glow-blue), transparent 38%),
    radial-gradient(circle at 52% 115%, var(--glow-pink), transparent 46%),
    linear-gradient(135deg, var(--panel-dark-1), var(--panel-dark-2) 55%, var(--panel-dark-3))
  `;
}

/**
 * Get the drawer gradient background for mobile panels
 * @returns {string} CSS background value
 */
export function getDrawerGradient() {
  return `
    radial-gradient(circle at 16% -8%, rgba(229, 196, 142, 0.18), transparent 46%),
    radial-gradient(circle at 88% -12%, rgba(124, 164, 255, 0.16), transparent 50%),
    linear-gradient(170deg, rgba(24, 18, 33, 0.96), rgba(10, 8, 16, 0.98))
  `;
}
