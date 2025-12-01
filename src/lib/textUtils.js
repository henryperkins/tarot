/**
 * Text formatting utilities
 */

/**
 * Converts a string to title case, capitalizing the first letter after
 * word boundaries (spaces, hyphens).
 * @param {string} text - The text to convert
 * @returns {string} The text in title case
 * @example
 * titleCase('the high priestess') // 'The High Priestess'
 * titleCase('two-of-wands') // 'Two-Of-Wands'
 */
export const titleCase = (text = '') =>
  text.replace(/(^|\s|-)([a-z])/g, (_, boundary, char) => `${boundary}${char.toUpperCase()}`);
