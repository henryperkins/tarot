/**
 * Onboarding A/B Test Variant Assignment
 *
 * Assigns users to either 'control' (7-step) or 'trimmed' (4-step) onboarding.
 * Assignment is persisted in localStorage for consistent experience across sessions.
 */

const VARIANT_STORAGE_KEY = 'tarot-onboarding-variant';
const VALID_VARIANTS = ['control', 'trimmed'];

/**
 * Get the user's assigned onboarding variant.
 * If no variant is assigned yet, randomly assigns one and persists it.
 *
 * @param {Object} options
 * @param {string} options.forceVariant - Force a specific variant (for testing)
 * @param {number} options.trimmedPercentage - Percentage of users to get trimmed variant (default: 50)
 * @returns {'control' | 'trimmed'} The assigned variant
 */
export function getOnboardingVariant({ forceVariant, trimmedPercentage = 50 } = {}) {
  // Allow forcing variant via parameter (useful for testing)
  if (forceVariant && VALID_VARIANTS.includes(forceVariant)) {
    return forceVariant;
  }

  // Check URL param for testing (e.g., ?onboarding=trimmed)
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const urlVariant = urlParams.get('onboarding');
    if (urlVariant && VALID_VARIANTS.includes(urlVariant)) {
      return urlVariant;
    }
  }

  // Check for existing assignment
  try {
    const stored = localStorage.getItem(VARIANT_STORAGE_KEY);
    if (stored && VALID_VARIANTS.includes(stored)) {
      return stored;
    }
  } catch {
    // localStorage not available - fall through to random assignment
  }

  // First visit: randomly assign variant
  const variant = Math.random() * 100 < trimmedPercentage ? 'trimmed' : 'control';

  // Persist assignment
  try {
    localStorage.setItem(VARIANT_STORAGE_KEY, variant);
  } catch {
    // localStorage not available - variant will be re-assigned on next visit
  }

  return variant;
}

/**
 * Clear the stored variant assignment.
 * Useful for testing or allowing users to re-experience onboarding.
 */
export function clearOnboardingVariant() {
  try {
    localStorage.removeItem(VARIANT_STORAGE_KEY);
  } catch {
    // Ignore localStorage errors
  }
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
