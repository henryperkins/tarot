/**
 * Highlight Utilities
 *
 * Shared utilities for text highlighting in narrative display components.
 * Used by both StreamingNarrative (word-by-word reveal) and MarkdownRenderer
 * (static markdown with highlights).
 *
 * @module highlightUtils
 */

/**
 * Normalize and deduplicate highlight phrases.
 * Returns phrases sorted by length (longest first) for proper overlap handling.
 *
 * @param {Array<string>} phrases - Array of phrases to highlight
 * @returns {Array<string>} Normalized, deduplicated, sorted phrases
 */
export function normalizeHighlightPhrases(phrases) {
  if (!Array.isArray(phrases)) return [];
  const seen = new Set();
  const next = [];
  for (const raw of phrases) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(trimmed);
  }
  // Prefer longer matches first when overlaps exist.
  next.sort((a, b) => b.length - a.length);
  return next;
}

/**
 * Check if a character is a word character (letter, number, or underscore).
 * Uses Unicode property escapes with ASCII fallback for older environments.
 *
 * @param {string} char - Single character to test
 * @returns {boolean} True if the character is a word character
 */
export function isWordChar(char) {
  if (!char) return false;
  try {
    return /[\p{L}\p{N}_]/u.test(char);
  } catch {
    // Fallback for environments without Unicode property escapes.
    return /[A-Za-z0-9_]/.test(char);
  }
}

/**
 * Check if a match passes word boundary constraints.
 * Ensures highlights don't start/end in the middle of words.
 *
 * @param {string} text - The full text being searched
 * @param {number} start - Start index of the match
 * @param {number} end - End index of the match
 * @returns {boolean} True if the match is at word boundaries
 */
export function passesWordBoundary(text, start, end) {
  const before = start > 0 ? text[start - 1] : '';
  const after = end < text.length ? text[end] : '';
  return !(isWordChar(before) || isWordChar(after));
}

/**
 * Compute highlight ranges for a text string.
 * Returns merged, non-overlapping ranges sorted by position.
 *
 * @param {string} text - Text to search for highlights
 * @param {Array<string>} phrases - Normalized phrases to highlight
 * @returns {Array<[number, number]>} Array of [start, end] ranges
 */
export function computeHighlightRanges(text, phrases) {
  if (!text || typeof text !== 'string') return [];
  if (!phrases || phrases.length === 0) return [];

  const lower = text.toLowerCase();
  const phrasesLower = phrases.map(p => p.toLowerCase());
  const ranges = [];

  for (let p = 0; p < phrasesLower.length; p++) {
    const phraseLower = phrasesLower[p];
    const phrase = phrases[p];
    if (!phraseLower) continue;

    let from = 0;
    while (from < lower.length) {
      const idx = lower.indexOf(phraseLower, from);
      if (idx === -1) break;
      const start = idx;
      const end = idx + phrase.length;
      if (passesWordBoundary(text, start, end)) {
        ranges.push([start, end]);
      }
      from = idx + 1;
    }
  }

  if (ranges.length <= 1) return ranges;

  // Merge overlapping ranges
  ranges.sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
  const merged = [ranges[0]];
  for (let i = 1; i < ranges.length; i++) {
    const [start, end] = ranges[i];
    const last = merged[merged.length - 1];
    if (start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }
  return merged;
}
