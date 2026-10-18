/**
 * Utilities for shaping narrative theme strings into concise,
 * user-friendly labels/questions for the intention coach.
 */

// Import and re-export for backward compatibility
import { ensureQuestionMark } from '../../shared/utils.js';
export { ensureQuestionMark };

import { normalizeThemeLabel } from '../../shared/journal/themes.js';
export { normalizeThemeLabel };

/**
 * Build a concise, human-friendly intention question from a theme.
 *
 * @param {string} theme - Raw or normalized theme text
 * @returns {string} Question text or empty string if no theme provided
 */
export function buildThemeQuestion(theme) {
  const label = normalizeThemeLabel(theme);
  if (!label) return '';
  return ensureQuestionMark(`How can I explore ${label} more deeply`);
}

