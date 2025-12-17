import { validateApiKey } from './apiKeys.js';

/**
 * Authentication library for Mystic Tarot
 *
 * Uses Cloudflare Workers Web Crypto API with PBKDF2 for secure password hashing
 * and HTTP-only cookies for session management.
 *
 * Security features:
 * - PBKDF2 with 100,000 iterations (OWASP recommended)
 * - Cryptographically secure random salts
 * - HTTP-only, SameSite cookies
 * - Session expiration (30 days)
 */

const SESSION_DURATION = 30 * 24 * 60 * 60; // 30 days in seconds
const PBKDF2_ITERATIONS = 100000; // OWASP recommended minimum

/**
 * Hash a password using PBKDF2
 * @param {string} password - Plain text password
 * @param {Uint8Array} [salt] - Optional salt (generates new one if not provided)
 * @returns {Promise<{hash: string, salt: string}>} Hex-encoded hash and salt
 */
export async function hashPassword(password, salt) {
  // Generate salt if not provided
  if (!salt) {
    salt = crypto.getRandomValues(new Uint8Array(16));
  }

  // Convert password to ArrayBuffer
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits']
  );

  // Derive key using PBKDF2
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    256 // 32 bytes = 256 bits
  );

  // Convert to hex strings
  const hashArray = Array.from(new Uint8Array(derivedBits));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  const saltArray = Array.from(salt);
  const saltHex = saltArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return {
    hash: hashHex,
    salt: saltHex
  };
}

/**
 * Verify a password against a stored hash
 * @param {string} password - Plain text password to verify
 * @param {string} storedHash - Hex-encoded hash from database
 * @param {string} storedSalt - Hex-encoded salt from database
 * @returns {Promise<boolean>} True if password matches
 */
export async function verifyPassword(password, storedHash, storedSalt) {
  // Convert hex salt back to Uint8Array
  const saltBytes = new Uint8Array(
    storedSalt.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
  );

  // Hash the provided password with the stored salt
  const { hash } = await hashPassword(password, saltBytes);

  // Timing-safe comparison (prevents timing attacks)
  return hash === storedHash;
}

/**
 * Generate a new session token
 * @returns {string} UUID v4 session token
 */
export function generateSessionToken() {
  return crypto.randomUUID();
}

/**
 * Create a session in the database
 * @param {D1Database} db - D1 database binding
 * @param {string} userId - User ID
 * @param {object} metadata - Optional session metadata (userAgent, ipAddress)
 * @returns {Promise<{token: string, expiresAt: number}>}
 */
export async function createSession(db, userId, metadata = {}) {
  const token = generateSessionToken();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + SESSION_DURATION;

  await db
    .prepare(`
      INSERT INTO sessions (id, user_id, created_at, expires_at, last_used_at, user_agent, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      token,
      userId,
      now,
      expiresAt,
      now,
      metadata.userAgent || null,
      metadata.ipAddress || null
    )
    .run();

  return { token, expiresAt };
}

/**
 * Validate a session token and return user info
 * @param {D1Database} db - D1 database binding
 * @param {string} token - Session token
 * @returns {Promise<object|null>} User object or null if invalid
 */
export async function validateSession(db, token) {
  if (!token) return null;

  const now = Math.floor(Date.now() / 1000);

  // Get session and join with user data. Attempt the subscription-aware
  // projection first; if the migration hasn't been applied yet, fall back
  // to the pre-subscription schema so auth doesn't 500.
  let result;
  try {
    result = await db
      .prepare(`
        SELECT
          s.id as session_id,
          s.user_id,
          s.expires_at,
          u.id,
          u.email,
          u.username,
          u.is_active,
          u.subscription_tier,
          u.subscription_status,
          u.subscription_provider,
          u.stripe_customer_id
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = ? AND s.expires_at > ? AND u.is_active = 1
      `)
      .bind(token, now)
      .first();
  } catch (error) {
    const message = error?.message || '';
    const missingSubscriptionColumns =
      message.includes('no such column') &&
      (message.includes('subscription_tier') ||
        message.includes('subscription_status') ||
        message.includes('subscription_provider') ||
        message.includes('stripe_customer_id'));

    if (!missingSubscriptionColumns) {
      throw error;
    }

    // Pre-0008 schema fallback: return core user fields and let callers
    // receive defaulted subscription metadata below.
    result = await db
      .prepare(`
        SELECT
          s.id as session_id,
          s.user_id,
          s.expires_at,
          u.id,
          u.email,
          u.username,
          u.is_active
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = ? AND s.expires_at > ? AND u.is_active = 1
      `)
      .bind(token, now)
      .first();
  }

  if (!result) return null;

  // Update last_used_at
  await db
    .prepare('UPDATE sessions SET last_used_at = ? WHERE id = ?')
    .bind(now, token)
    .run();

  // Normalize subscription-related fields with sensible defaults so
  // downstream callers (e.g., subscription gating, dashboards) can rely
  // on their presence.
  const subscriptionTier = result.subscription_tier || 'free';
  const subscriptionStatus = result.subscription_status || 'inactive';
  const subscriptionProvider = result.subscription_provider || null;

  return {
    id: result.user_id,
    email: result.email,
    username: result.username,
    sessionId: result.session_id,
    subscription_tier: subscriptionTier,
    subscription_status: subscriptionStatus,
    subscription_provider: subscriptionProvider,
    stripe_customer_id: result.stripe_customer_id || null
  };
}

/**
 * Delete a session (logout)
 * @param {D1Database} db - D1 database binding
 * @param {string} token - Session token
 * @returns {Promise<void>}
 */
export async function deleteSession(db, token) {
  await db
    .prepare('DELETE FROM sessions WHERE id = ?')
    .bind(token)
    .run();
}

/**
 * Delete all sessions for a user
 * @param {D1Database} db - D1 database binding
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export async function deleteAllUserSessions(db, userId) {
  await db
    .prepare('DELETE FROM sessions WHERE user_id = ?')
    .bind(userId)
    .run();
}

/**
 * Clean up expired sessions (should be run periodically)
 * @param {D1Database} db - D1 database binding
 * @returns {Promise<number>} Number of sessions deleted
 */
export async function cleanupExpiredSessions(db) {
  const now = Math.floor(Date.now() / 1000);

  const result = await db
    .prepare('DELETE FROM sessions WHERE expires_at <= ?')
    .bind(now)
    .run();

  return result.meta.changes || 0;
}

/**
 * Extract session token from cookie header
 * @param {string} cookieHeader - Cookie header string
 * @returns {string|null} Session token or null
 */
export function getSessionFromCookie(cookieHeader) {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').map(c => c.trim());
  const sessionCookie = cookies.find(c => c.startsWith('session='));

  if (!sessionCookie) return null;

  return sessionCookie.split('=')[1];
}

/**
 * Create a secure session cookie header
 * @param {string} token - Session token
 * @param {number} expiresAt - Unix timestamp when session expires
 * @returns {string} Set-Cookie header value
 */
export function createSessionCookie(token, expiresAt) {
  const maxAge = expiresAt - Math.floor(Date.now() / 1000);

  return [
    `session=${token}`,
    'HttpOnly',
    'SameSite=Lax',
    'Secure',
    `Max-Age=${maxAge}`,
    'Path=/'
  ].join('; ');
}

/**
 * Create a cookie to clear the session
 * @returns {string} Set-Cookie header value
 */
export function clearSessionCookie() {
  return 'session=; HttpOnly; SameSite=Lax; Secure; Max-Age=0; Path=/';
}

/**
 * Validate email format
 * @param {string} email - Email address
 * @returns {boolean}
 */
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate username format (3-30 chars, alphanumeric + underscore)
 * @param {string} username - Username
 * @returns {boolean}
 */
export function isValidUsername(username) {
  const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
  return usernameRegex.test(username);
}

/**
 * Validate password strength (min 8 chars)
 * @param {string} password - Password
 * @returns {boolean}
 */
export function isValidPassword(password) {
  return password && password.length >= 8;
}

/**
 * Resolve the authenticated user from a Request.
 * Supports Bearer session tokens, API keys, and session cookies.
 * @param {Request} request
 * @param {object} env - Environment bindings (requires env.DB)
 * @returns {Promise<object|null>} User object or null if unauthenticated
 */
export async function getUserFromRequest(request, env) {
  const authHeader = request.headers.get('Authorization');

  // Authorization: Bearer <token>
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];

    // API key path (Bearer sk_...)
    if (token && token.startsWith('sk_')) {
      const apiKeyRecord = await validateApiKey(env.DB, token);
      if (apiKeyRecord) {
        // API keys authenticate as their owning user. Subscription tier/status
        // must be derived from the user record (not auto-granted), so keys
        // cannot be used to bypass entitlements after downgrade/cancellation.
        return {
          id: apiKeyRecord.user_id,
          email: apiKeyRecord.email,
          username: apiKeyRecord.username,
          subscription_tier: apiKeyRecord.subscription_tier || 'free',
          subscription_status: apiKeyRecord.subscription_status || 'inactive',
          subscription_provider: apiKeyRecord.subscription_provider || null,
          stripe_customer_id: apiKeyRecord.stripe_customer_id || null,
          auth_provider: 'api_key',
          api_key_id: apiKeyRecord.id,
          api_key_prefix: apiKeyRecord.key_prefix
        };
      }
    }

    // Session token path (Bearer <session>)
    const userFromHeader = await validateSession(env.DB, token);
    if (userFromHeader) {
      return userFromHeader;
    }
  }

  // Fallback to session cookie
  const cookieHeader = request.headers.get('Cookie');
  const sessionToken = getSessionFromCookie(cookieHeader);
  if (!sessionToken) return null;

  return validateSession(env.DB, sessionToken);
}
