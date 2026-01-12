/**
 * Onboarding Variant Selection
 *
 * The trimmed 4-step onboarding is now the default for all users.
 * The control (7-step) variant can still be accessed via URL param for testing.
 */

import { safeStorage } from './safeStorage.js';

const VARIANT_STORAGE_KEY = 'tarot-onboarding-variant';
const VALID_VARIANTS = ['control', 'trimmed'];

/**
 * Get the onboarding variant.
 * Returns 'trimmed' (4-step) by default for all users.
 * Use ?onboarding=control to test the legacy 7-step flow.
 *
 * @param {Object} options
 * @param {string} options.forceVariant - Force a specific variant (for testing)
 * @returns {'control' | 'trimmed'} The variant
 */
export function getOnboardingVariant({ forceVariant } = {}) {
  // Allow forcing variant via parameter (useful for testing)
  if (forceVariant && VALID_VARIANTS.includes(forceVariant)) {
    return forceVariant;
  }

  // Check URL param for testing (e.g., ?onboarding=control)
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const urlVariant = urlParams.get('onboarding');
    if (urlVariant && VALID_VARIANTS.includes(urlVariant)) {
      return urlVariant;
    }
  }

  // Default: trimmed 4-step onboarding for all users
  return 'trimmed';
}

/**
 * Clear the stored variant assignment.
 * Useful for testing or allowing users to re-experience onboarding.
 */
export function clearOnboardingVariant() {
  safeStorage.removeItem(VARIANT_STORAGE_KEY);
}

/**
 * Get step configuration for a variant
 */
export const VARIANT_CONFIG = {
  control: {
    totalSteps: 7,
    labels: ['Welcome', 'Account', 'Spreads', 'Question', 'Ritual', 'Journal', 'Begin']
  },
  trimmed: {
    totalSteps: 4,
    labels: ['Welcome', 'Spread', 'Intention', 'Begin']
  }
};

/**
 * Get the total steps for a variant
 * @param {'control' | 'trimmed'} variant
 * @returns {number}
 */
export function getTotalSteps(variant) {
  return VARIANT_CONFIG[variant]?.totalSteps || 7;
}

/**
 * Get step labels for a variant
 * @param {'control' | 'trimmed'} variant
 * @returns {string[]}
 */
export function getStepLabels(variant) {
  return VARIANT_CONFIG[variant]?.labels || VARIANT_CONFIG.control.labels;
}
