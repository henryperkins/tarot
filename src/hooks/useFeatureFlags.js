/**
 * Centralized feature flag checking
 *
 * Provides consistent feature flag evaluation across the application.
 * All environment-based feature flags should be checked through this hook.
 *
 * Flag types:
 * - ops-only: Only controllable via build-time env vars (experimental/incomplete features)
 * - user-overridable: Can be toggled via URL params or localStorage (stable features)
 *
 * For ops-only flags:
 * - Priority: env var only
 *
 * For user-overridable flags:
 * - Priority: URL param > localStorage > env var > default
 */

import { useMemo } from 'react';

/**
 * Get a feature flag value from multiple sources.
 *
 * @param {string} flagKey - Flag key (used in localStorage/URL as ff_{flagKey})
 * @param {string} envVar - Environment variable name
 * @param {boolean} defaultValue - Default if no source sets the flag
 * @param {boolean} userOverridable - If false, only env var is checked (ops-only flag)
 * @returns {boolean} The resolved flag value
 */
function getFlag(flagKey, envVar, defaultValue = false, userOverridable = false) {
  // For ops-only flags, skip URL/localStorage and only check env var
  if (userOverridable) {
    // Check URL param first (?ff_flag_name=true)
    if (typeof window !== 'undefined' && window.location) {
      try {
        const params = new URLSearchParams(window.location.search);
        const urlValue = params.get(`ff_${flagKey}`);
        if (urlValue === 'true') return true;
        if (urlValue === 'false') return false;
      } catch (_urlParseError) {
        // URL parsing errors are non-fatal; fall through to other sources
      }
    }

    // Check localStorage (?ff_flag_name in localStorage)
    if (typeof localStorage !== 'undefined') {
      try {
        const localValue = localStorage.getItem(`ff_${flagKey}`);
        if (localValue === 'true') return true;
        if (localValue === 'false') return false;
      } catch (_storageError) {
        // localStorage errors (e.g., private browsing) are non-fatal; fall through
      }
    }
  }

  // Check environment variable
  if (envVar && import.meta.env?.[envVar] === 'true') {
    return true;
  }

  return defaultValue;
}

export function useFeatureFlags() {
  const flags = useMemo(() => ({
    // Vision Research Mode (ops-only: experimental camera/vision features)
    visionResearch: getFlag('vision_research', 'VITE_ENABLE_VISION_RESEARCH', false, false),

    // New Deck Ritual Interface (ops-only: reimagined deck interface)
    // Set VITE_NEW_DECK_INTERFACE=true to enable
    newDeckInterface: getFlag('new_deck_interface', 'VITE_NEW_DECK_INTERFACE', false, false),
  }), []);

  return flags;
}

/**
 * Direct feature flag check (for non-hook contexts)
 * Note: All flags are ops-only (userOverridable=false) to prevent
 * users from enabling incomplete/experimental features via URL/localStorage.
 */
export function isVisionResearchEnabled() {
  return getFlag('vision_research', 'VITE_ENABLE_VISION_RESEARCH', false, false);
}
