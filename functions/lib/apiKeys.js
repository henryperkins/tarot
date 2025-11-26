/**
 * API Key management library for Mystic Tarot
 *
 * Handles generation, hashing, and validation of API keys.
 * Keys are stored as SHA-256 hashes.
 */

/**
 * Generate a new API key
 * Format: sk_<64 hex chars>
 * @returns {string} The raw API key (do not store this!)
 */
export function generateApiKey() {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const hexString = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `sk_${hexString}`;
}

/**
 * Hash an API key for storage
 * @param {string} key - The raw API key
 * @returns {Promise<string>} Hex-encoded SHA-256 hash
 */
export async function hashApiKey(key) {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate an API key
 * @param {D1Database} db - D1 database binding
 * @param {string} key - The raw API key to check
 * @returns {Promise<object|null>} The key record (with user_id) if valid, null otherwise
 */
export async function validateApiKey(db, key) {
  if (!key || !key.startsWith('sk_')) return null;

  const hash = await hashApiKey(key);
  
  const result = await db.prepare(`
    SELECT k.*, u.email, u.username
    FROM api_keys k
    JOIN users u ON k.user_id = u.id
    WHERE k.key_hash = ? AND k.is_active = 1
  `)
  .bind(hash)
  .first();

  if (!result) return null;

  // Check expiration
  if (result.expires_at && result.expires_at < Math.floor(Date.now() / 1000)) {
    return null;
  }

  // Update last_used_at
  // Note: In high concurrency, this write might be a bottleneck. 
  // Consider moving stats to KV or sampling updates if this becomes an issue.
  const now = Math.floor(Date.now() / 1000);
  await db.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?')
    .bind(now, result.id)
    .run();

  return result;
}
