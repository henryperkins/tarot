/**
 * Environment Detection Utilities
 *
 * Provides helpers for detecting the runtime environment (production vs development)
 * for security-sensitive decisions like fail-open vs fail-closed behavior.
 */

/**
 * Detect if running in a production environment.
 *
 * Checks multiple environment indicators in order of specificity:
 * 1. CF_PAGES_BRANCH - Cloudflare Pages deployment branch
 * 2. NODE_ENV - Standard Node.js environment variable
 * 3. ENVIRONMENT - Custom application environment variable
 *
 * Production is detected when:
 * - CF_PAGES_BRANCH is 'main', 'master', or matches CF_PAGES_BRANCH_PRODUCTION
 * - NODE_ENV is 'production'
 * - ENVIRONMENT is 'production'
 *
 * @param {Object} env - Environment bindings (from Cloudflare Workers context)
 * @returns {boolean} True if running in production, false otherwise
 *
 * @example
 * if (isProductionEnvironment(env)) {
 *   // Fail closed - reject requests with missing configuration
 * } else {
 *   // Dev mode - allow with warning for easier local development
 * }
 */
export function isProductionEnvironment(env) {
  // Check Cloudflare Pages branch
  const branch = (env?.CF_PAGES_BRANCH || '').toLowerCase();
  const prodBranches = new Set(['main', 'master']);

  // Allow custom production branch via CF_PAGES_BRANCH_PRODUCTION
  if (env?.CF_PAGES_BRANCH_PRODUCTION) {
    prodBranches.add(String(env.CF_PAGES_BRANCH_PRODUCTION).toLowerCase());
  }

  const isProdBranch = branch && prodBranches.has(branch);

  return (
    isProdBranch ||
    env?.NODE_ENV === 'production' ||
    env?.ENVIRONMENT === 'production'
  );
}

/**
 * Detect if running in a development environment.
 *
 * @param {Object} env - Environment bindings
 * @returns {boolean} True if running in development, false otherwise
 */
export function isDevelopmentEnvironment(env) {
  return !isProductionEnvironment(env);
}
