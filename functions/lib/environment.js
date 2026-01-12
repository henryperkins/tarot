/**
 * Environment Detection and Resolution Utilities
 *
 * Provides helpers for:
 * - Detecting the runtime environment (production vs development)
 * - Resolving environment variables across Cloudflare Workers and Node.js
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

/**
 * Resolve an environment variable from Cloudflare Workers env or Node.js process.env.
 *
 * Checks Cloudflare Workers env object first, then falls back to process.env.
 * Returns undefined if the key is not found in either location.
 *
 * Note: This treats null and undefined as "not set", but will return
 * other falsy values like empty strings or 0. For stricter behavior
 * that treats all falsy values as missing, use resolveEnvStrict.
 *
 * @param {Object} env - Cloudflare Workers environment bindings
 * @param {string} key - Environment variable name
 * @returns {string | undefined} The environment variable value or undefined
 *
 * @example
 * const apiKey = resolveEnv(env, 'AZURE_OPENAI_API_KEY');
 * if (!apiKey) {
 *   throw new Error('AZURE_OPENAI_API_KEY is required');
 * }
 */
export function resolveEnv(env, key) {
  if (env && typeof env[key] !== 'undefined' && env[key] !== null) {
    return env[key];
  }

  if (typeof process !== 'undefined' && process.env && typeof process.env[key] !== 'undefined') {
    return process.env[key];
  }

  return undefined;
}

/**
 * Resolve an environment variable, treating all falsy values as missing.
 *
 * Similar to resolveEnv but returns undefined for empty strings, 0, false, etc.
 * Use this when you want stricter validation of environment variables.
 *
 * @param {Object} env - Cloudflare Workers environment bindings
 * @param {string} key - Environment variable name
 * @returns {string | undefined} The environment variable value or undefined
 *
 * @example
 * const apiKey = resolveEnvStrict(env, 'HUME_API_KEY');
 * // Returns undefined if HUME_API_KEY is '', 0, false, null, or undefined
 */
export function resolveEnvStrict(env, key) {
  if (env?.[key]) return env[key];
  if (typeof process !== 'undefined' && process.env?.[key]) {
    return process.env[key];
  }
  return undefined;
}
