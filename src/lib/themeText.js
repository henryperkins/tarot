/**
 * Utilities for shaping narrative theme strings into concise,
 * user-friendly labels/questions for the intention coach.
 */

// Import and re-export for backward compatibility
import { ensureQuestionMark } from '../../shared/utils.js';
export { ensureQuestionMark };

/**
 * Normalize verbose theme sentences (e.g., narrative summaries)
 * into short labels that read cleanly inside questions and chips.
 *
 * @param {string} theme - Raw theme text from journal stats or spread analysis
 * @returns {string} Concise label (or empty string if input is invalid)
 */
export function normalizeThemeLabel(theme) {
  if (!theme || typeof theme !== 'string') return '';

  const trimmed = theme.trim().replace(/[。.]+$/, '');
  const lower = trimmed.toLowerCase();

  // Major Arcana density phrases
  if (lower.startsWith('high major arcana')) {
    return 'High Major Arcana (soul-level shifts)';
  }
  if (lower.startsWith('moderate major arcana')) {
    return 'Moderate Major Arcana (archetypal lessons in daily life)';
  }
  if (lower.startsWith('primarily minor arcana')) {
    return 'Primarily Minor Arcana (everyday dynamics)';
  }

  // Suit balance phrasing
  if (/^balanced focus between\s+/i.test(trimmed)) {
    const match = trimmed.match(/^balanced focus between\s+([^,]+),/i);
    const pair = match?.[1]?.replace(/\s+and\s+/i, ' & ');
    return pair ? `Balanced focus: ${pair}` : 'Balanced suit focus';
  }

  // Elemental balance phrasing
  if (/^balanced elemental presence/i.test(trimmed)) {
    return 'Balanced elemental presence';
  }
  if (/^mixed elemental energies/i.test(trimmed)) {
    return 'Mixed elemental energies';
  }

  const strongElementMatch = trimmed.match(/^strong\s+([a-z]+)\s+emphasis dominates/i);
  if (strongElementMatch) {
    return `${strongElementMatch[1]} emphasis`;
  }

  const dominatesMatch = trimmed.match(/^([a-z]+)\s+energy strongly dominates/i);
  if (dominatesMatch) {
    return `${dominatesMatch[1]} energy dominance`;
  }

  const leadsMatch = trimmed.match(/^([a-z]+)\s+leads/i);
  if (leadsMatch) {
    return `${leadsMatch[1]} leads`;
  }

  // Default: return a cleaned-up, unmodified string
  return trimmed;
}

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

