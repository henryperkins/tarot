/**
 * Client Identification Utilities
 *
 * Provides privacy-aware client identification for rate limiting and usage tracking.
 * Raw IP addresses are hashed before storage to prevent PII accumulation.
 */

/**
 * Get raw client identifier from request headers.
 * Used internally - prefer getHashedClientIdentifier for storage.
 *
 * @param {Request} request - Incoming request
 * @returns {string} Raw client identifier (IP or 'anonymous')
 */
export function getClientIdentifier(request) {
  const headerCandidates = [
    'cf-connecting-ip',
    'x-forwarded-for',
    'x-real-ip'
  ];

  for (const header of headerCandidates) {
    const value = request?.headers?.get(header);
    if (value) {
      if (header === 'x-forwarded-for') {
        return value.split(',')[0].trim();
      }
      return value;
    }
  }

  return 'anonymous';
}

/**
 * Hash a client identifier for privacy-safe storage.
 *
 * Uses SHA-256 with a salt to prevent rainbow table attacks while
 * maintaining consistent hashing for the same IP within a deployment.
 *
 * @param {string} rawId - Raw client identifier (IP address)
 * @param {string} [salt] - Optional salt (defaults to built-in value)
 * @returns {Promise<string>} Hashed identifier (32 hex chars)
 */
export async function hashClientIdentifier(rawId, salt = 'tarot-guest-v1') {
  if (!rawId || rawId === 'anonymous') {
    return 'anonymous';
  }

  const data = new TextEncoder().encode(`${salt}:${rawId}`);

  // Use Web Crypto API (available in Workers)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Return first 32 characters - sufficient for uniqueness
  return hashHex.slice(0, 32);
}

/**
 * Get a privacy-safe hashed client identifier for storage.
 *
 * This is the preferred method for usage tracking and rate limiting
 * where the identifier will be persisted (D1, KV).
 *
 * @param {Request} request - Incoming request
 * @param {string} [salt] - Optional salt for hashing
 * @returns {Promise<string>} Hashed client identifier
 */
export async function getHashedClientIdentifier(request, salt) {
  const rawId = getClientIdentifier(request);
  return hashClientIdentifier(rawId, salt);
}

