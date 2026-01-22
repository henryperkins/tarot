/**
 * Token utilities for authentication flows (email verification, password reset).
 * Tokens are generated securely, hashed before storage, and include expirations.
 */

export const TOKEN_TYPES = {
  EMAIL_VERIFICATION: 'email_verification',
  PASSWORD_RESET: 'password_reset'
};

const TOKEN_BYTE_LENGTH = 32; // 256 bits of entropy

const DEFAULT_TTLS = {
  [TOKEN_TYPES.EMAIL_VERIFICATION]: 60 * 60 * 24, // 24 hours
  [TOKEN_TYPES.PASSWORD_RESET]: 60 * 30 // 30 minutes
};

/**
 * Generate a secure, URL-safe random token.
 */
export function generateSecureToken(byteLength = TOKEN_BYTE_LENGTH) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

/**
 * Hash a token using SHA-256 (hex-encoded).
 */
export async function hashToken(token) {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(digest));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Create and persist a token for a user.
 *
 * @param {D1Database} db
 * @param {string} userId
 * @param {string} type - One of TOKEN_TYPES
 * @param {object} [options]
 * @param {number} [options.expiresInSeconds]
 * @param {object} [options.metadata]
 * @param {boolean} [options.replaceExisting=true] - Delete existing tokens of the same type
 * @param {string} [options.ipAddress]
 * @param {string} [options.userAgent]
 * @returns {Promise<{ token: string, expiresAt: number }>}
 */
export async function createUserToken(db, userId, type, options = {}) {
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = options.expiresInSeconds || DEFAULT_TTLS[type] || (60 * 60);
  const expiresAt = now + expiresIn;

  if (options.replaceExisting !== false) {
    await deleteTokensByUserAndType(db, userId, type);
  }

  const token = generateSecureToken();
  const tokenHash = await hashToken(token);
  const metadataJson = options.metadata ? JSON.stringify(options.metadata) : null;

  await db
    .prepare(`
      INSERT INTO user_tokens (id, user_id, token_hash, type, created_at, expires_at, metadata, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      crypto.randomUUID(),
      userId,
      tokenHash,
      type,
      now,
      expiresAt,
      metadataJson,
      options.ipAddress || null,
      options.userAgent || null
    )
    .run();

  return { token, expiresAt };
}

/**
 * Fetch a valid (not expired, not used) token record by plaintext token.
 */
export async function findValidToken(db, token, type) {
  const tokenHash = await hashToken(token);
  const now = Math.floor(Date.now() / 1000);

  const record = await db
    .prepare(`
      SELECT *
      FROM user_tokens
      WHERE token_hash = ? AND type = ? AND expires_at > ? AND used_at IS NULL
    `)
    .bind(tokenHash, type, now)
    .first();

  if (!record) return null;

  return {
    ...record,
    metadata: parseMetadata(record.metadata)
  };
}

/**
 * Mark a token as used (one-time use).
 */
export async function markTokenUsed(db, tokenId) {
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare('UPDATE user_tokens SET used_at = ? WHERE id = ?')
    .bind(now, tokenId)
    .run();
}

/**
 * Delete tokens for a user/type (cleanup or to enforce single active token).
 */
export async function deleteTokensByUserAndType(db, userId, type) {
  await db
    .prepare('DELETE FROM user_tokens WHERE user_id = ? AND type = ?')
    .bind(userId, type)
    .run();
}

/**
 * Get the most recent token for cooldown/rate-limiting checks.
 */
export async function getMostRecentToken(db, userId, type) {
  const record = await db
    .prepare(`
      SELECT *
      FROM user_tokens
      WHERE user_id = ? AND type = ?
      ORDER BY created_at DESC
      LIMIT 1
    `)
    .bind(userId, type)
    .first();

  if (!record) return null;

  return {
    ...record,
    metadata: parseMetadata(record.metadata)
  };
}

function parseMetadata(metadata) {
  if (!metadata) return null;
  try {
    return JSON.parse(metadata);
  } catch {
    return null;
  }
}

function bytesToBase64Url(bytes) {
  const binary = Array.from(bytes)
    .map(b => String.fromCharCode(b))
    .join('');

  const base64 = typeof btoa === 'function'
    ? btoa(binary)
    : Buffer.from(binary, 'binary').toString('base64');

  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
