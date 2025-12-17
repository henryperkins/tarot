/**
 * Cryptographic Utilities
 *
 * Provides timing-safe comparison functions and other security-related utilities
 * for use in authentication, webhook verification, and other sensitive operations.
 */

/**
 * Constant-time string comparison to prevent timing attacks.
 *
 * This function compares two strings in a way that takes the same amount of time
 * regardless of where the first difference occurs. This prevents attackers from
 * using timing information to guess secrets character by character.
 *
 * @param {string} a - First string to compare
 * @param {string} b - Second string to compare
 * @returns {boolean} True if strings are identical, false otherwise
 *
 * @example
 * // Secure comparison of API keys
 * if (timingSafeEqual(providedKey, expectedKey)) {
 *   // Grant access
 * }
 */
export function timingSafeEqual(a, b) {
  // Reject non-string inputs
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  // Convert strings to byte arrays for comparison
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);

  // For constant-time behavior, we must always compare the same number of bytes.
  // If lengths differ, we still do the full comparison to avoid leaking length info
  // through timing, but we know the result will be false.
  const length = Math.max(aBytes.length, bBytes.length);
  let result = aBytes.length !== bBytes.length ? 1 : 0;

  for (let i = 0; i < length; i++) {
    // XOR each byte - if they're the same, XOR is 0
    // Using OR to accumulate any differences
    result |= (aBytes[i] || 0) ^ (bBytes[i] || 0);
  }

  return result === 0;
}
