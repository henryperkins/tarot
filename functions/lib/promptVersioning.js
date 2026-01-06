/**
 * Reading Prompt Versioning
 *
 * Tracks versions of the reading prompt system for quality correlation.
 * Increment version when making significant changes to:
 * - System prompt instructions (buildSystemPrompt)
 * - User prompt structure (buildUserPrompt)
 * - Position templates (POSITION_LANGUAGE)
 * - Spread-specific builders
 *
 * Version format: MAJOR.MINOR.PATCH
 * - MAJOR: Breaking changes to prompt structure
 * - MINOR: Significant additions/modifications
 * - PATCH: Bug fixes, minor tweaks
 */

export const READING_PROMPT_VERSION = '1.0.0';

/**
 * Version history for documentation and debugging.
 * Add entry when incrementing version.
 */
export const VERSION_HISTORY = [
  {
    version: '1.0.0',
    date: '2026-01-06',
    notes: 'Initial versioning - establishes baseline for quality tracking',
    changes: [
      'Added version tracking infrastructure',
      'Baseline for all existing prompt patterns',
    ],
  },
];

/**
 * Get combined version info for metrics.
 *
 * @param {string} evalPromptVersion - From evaluation.js EVAL_PROMPT_VERSION
 * @returns {Object} Version information
 */
export function getVersionInfo(evalPromptVersion = null) {
  return {
    reading: READING_PROMPT_VERSION,
    eval: evalPromptVersion,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get the current version string.
 * Use this in promptMeta and metrics.
 */
export function getReadingPromptVersion() {
  return READING_PROMPT_VERSION;
}

/**
 * Check if a version is newer than another.
 *
 * @param {string} version1
 * @param {string} version2
 * @returns {number} 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
export function compareVersions(version1, version2) {
  const v1Parts = version1.split('.').map(Number);
  const v2Parts = version2.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const v1 = v1Parts[i] || 0;
    const v2 = v2Parts[i] || 0;
    if (v1 > v2) return 1;
    if (v1 < v2) return -1;
  }

  return 0;
}

/**
 * Get version history entry for a specific version.
 *
 * @param {string} version
 * @returns {Object|null}
 */
export function getVersionHistoryEntry(version) {
  return VERSION_HISTORY.find((entry) => entry.version === version) || null;
}
