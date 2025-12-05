/**
 * Onboarding Metrics - Timer and tracking for A/B test validation
 *
 * Tracks time spent in onboarding flow to validate the trimmed variant
 * achieves the target 50-60% reduction in completion time.
 */

const METRICS_STORAGE_KEY = 'tarot-onboarding-metrics';
const MAX_STORED_ENTRIES = 50;

/**
 * Create a new onboarding timer instance.
 * Call recordStep() at each step transition and complete() when finished.
 *
 * @param {Object} options
 * @param {string} options.variant - The onboarding variant ('control' or 'trimmed')
 * @returns {Object} Timer instance with recordStep() and complete() methods
 */
export function startOnboardingTimer({ variant = 'control' } = {}) {
  const startTime = Date.now();
  const stepTimes = [];
  let completed = false;

  return {
    /**
     * Record timestamp when transitioning to a new step
     * @param {number} stepNumber - The step number being entered (1-indexed)
     */
    recordStep(stepNumber) {
      if (completed) return;

      const elapsed = Date.now() - startTime;
      const lastStep = stepTimes[stepTimes.length - 1];
      const delta = lastStep ? elapsed - lastStep.elapsed : elapsed;

      stepTimes.push({
        step: stepNumber,
        elapsed,
        delta
      });
    },

    /**
     * Mark onboarding as complete and store metrics
     * @param {Object} options
     * @param {boolean} options.skipped - Whether user skipped onboarding early
     * @returns {Object} The complete metrics object
     */
    complete({ skipped = false } = {}) {
      if (completed) return null;
      completed = true;

      const totalTime = Date.now() - startTime;
      const metrics = {
        variant,
        totalTime,
        stepTimes,
        stepCount: stepTimes.length,
        averageStepTime: stepTimes.length > 0 ? Math.round(totalTime / stepTimes.length) : 0,
        skipped,
        timestamp: new Date().toISOString(),
        device: getDeviceInfo()
      };

      // Store for analysis
      storeMetrics(metrics);

      return metrics;
    },

    /**
     * Get current elapsed time without completing
     * @returns {number} Elapsed milliseconds
     */
    getElapsed() {
      return Date.now() - startTime;
    },

    /**
     * Check if timer has been completed
     * @returns {boolean}
     */
    isCompleted() {
      return completed;
    }
  };
}

/**
 * Get device information for metrics context
 */
function getDeviceInfo() {
  if (typeof window === 'undefined') {
    return { ssr: true };
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
    pixelRatio: window.devicePixelRatio || 1,
    userAgent: navigator.userAgent,
    touchCapable: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
  };
}

/**
 * Store metrics to localStorage
 */
function storeMetrics(metrics) {
  try {
    const existing = JSON.parse(localStorage.getItem(METRICS_STORAGE_KEY) || '[]');
    existing.push(metrics);
    // Keep only the last N entries to prevent unbounded growth
    const trimmed = existing.slice(-MAX_STORED_ENTRIES);
    localStorage.setItem(METRICS_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    // localStorage not available or quota exceeded - silently fail
    console.debug('Failed to store onboarding metrics:', e);
  }
}

/**
 * Get all stored onboarding metrics
 * @returns {Array} Array of metrics objects
 */
export function getStoredMetrics() {
  try {
    return JSON.parse(localStorage.getItem(METRICS_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

/**
 * Clear all stored onboarding metrics
 */
export function clearStoredMetrics() {
  try {
    localStorage.removeItem(METRICS_STORAGE_KEY);
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Get summary statistics for stored metrics
 * @returns {Object} Summary with averages by variant
 */
export function getMetricsSummary() {
  const metrics = getStoredMetrics();

  if (metrics.length === 0) {
    return { control: null, trimmed: null, totalSessions: 0 };
  }

  const byVariant = {
    control: metrics.filter(m => m.variant === 'control' && !m.skipped),
    trimmed: metrics.filter(m => m.variant === 'trimmed' && !m.skipped)
  };

  const summarize = (entries) => {
    if (entries.length === 0) return null;
    const times = entries.map(e => e.totalTime);
    return {
      count: entries.length,
      avgTime: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      avgSteps: Math.round(entries.reduce((a, e) => a + e.stepCount, 0) / entries.length)
    };
  };

  return {
    control: summarize(byVariant.control),
    trimmed: summarize(byVariant.trimmed),
    totalSessions: metrics.length,
    skippedCount: metrics.filter(m => m.skipped).length
  };
}
