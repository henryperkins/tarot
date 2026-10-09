/**
 * Email and password sign-in shared by POST /api/auth/login and the ChatGPT
 * connection page (/oauth/authorize).
 *
 * Failed attempts are rate limited per client: at most 5 in a 5-minute
 * window. Successful sign-ins don't count, and neither does an inactive
 * account, which is not a guessing attempt.
 */

import {
  createSession,
  createSessionCookie,
  isSecureRequest,
  validateSession,
  verifyPassword
} from './auth.js';
import { getClientIdentifier } from './clientId.js';

const LOGIN_RATE_LIMIT_KEY_PREFIX = 'login-attempt';
const LOGIN_RATE_LIMIT_MAX = 5;
const LOGIN_RATE_LIMIT_WINDOW_SECONDS = 300;

/**
 * Check the failed-attempt budget before reading credentials.
 * @returns {Promise<{ limited: boolean, retryAfter?: number, rateLimitKey?: string, currentCount?: number }>}
 */
export async function checkLoginRateLimit(env, request, requestId) {
  const store = env?.RATELIMIT;
  if (!store) {
    return { limited: false };
  }

  try {
    const now = Date.now();
    const windowBucket = Math.floor(now / (LOGIN_RATE_LIMIT_WINDOW_SECONDS * 1000));
    const identifier = getClientIdentifier(request);
    const rateLimitKey = `${LOGIN_RATE_LIMIT_KEY_PREFIX}:${identifier}:${windowBucket}`;

    const existing = await store.get(rateLimitKey);
    const currentCount = existing ? Number(existing) || 0 : 0;

    if (currentCount >= LOGIN_RATE_LIMIT_MAX) {
      const windowBoundary = (windowBucket + 1) * LOGIN_RATE_LIMIT_WINDOW_SECONDS * 1000;
      const retryAfter = Math.max(1, Math.ceil((windowBoundary - now) / 1000));
      return { limited: true, retryAfter, rateLimitKey };
    }

    return { limited: false, currentCount, rateLimitKey };
  } catch (error) {
    console.warn(`[${requestId}] [auth] Rate limit check failed, allowing request:`, error);
    return { limited: false };
  }
}

async function incrementLoginFailure(env, rateLimitKey, currentCount, requestId) {
  const store = env?.RATELIMIT;
  if (!store || !rateLimitKey) return;

  try {
    const nextCount = (currentCount || 0) + 1;
    await store.put(rateLimitKey, String(nextCount), {
      expirationTtl: LOGIN_RATE_LIMIT_WINDOW_SECONDS
    });
  } catch (error) {
    console.warn(`[${requestId}] [auth] Failed to increment login failure count:`, error);
  }
}

/**
 * Verify credentials and open a session. Call checkLoginRateLimit first and
 * pass its result, so a limited client is refused before credentials are read.
 *
 * @returns {Promise<
 *   | { ok: true, user: object, cookie: string }
 *   | { ok: false, status: 400|401|403, error: string }
 * >}
 */
export async function authenticateWithPassword(env, request, { email, password, rateLimit = {}, requestId }) {
  if (!email || !password) {
    return { ok: false, status: 400, error: 'Email and password are required' };
  }

  const user = await env.DB.prepare(`
    SELECT id, email, username, password_hash, password_salt, is_active
    FROM users
    WHERE email = ?
  `)
    .bind(String(email).toLowerCase())
    .first();

  if (!user) {
    await incrementLoginFailure(env, rateLimit.rateLimitKey, rateLimit.currentCount, requestId);
    return { ok: false, status: 401, error: 'Invalid email or password' };
  }

  if (!user.is_active) {
    return { ok: false, status: 403, error: 'Account is inactive' };
  }

  const isValid = await verifyPassword(password, user.password_hash, user.password_salt);
  if (!isValid) {
    await incrementLoginFailure(env, rateLimit.rateLimitKey, rateLimit.currentCount, requestId);
    return { ok: false, status: 401, error: 'Invalid email or password' };
  }

  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare('UPDATE users SET last_login_at = ? WHERE id = ?')
    .bind(now, user.id)
    .run();

  const { token, expiresAt } = await createSession(env.DB, user.id, {
    userAgent: request.headers.get('User-Agent'),
    ipAddress: request.headers.get('CF-Connecting-IP')
  });
  const sessionUser = await validateSession(env.DB, token);
  if (!sessionUser) {
    throw new Error('Session validation failed after login');
  }

  const cookie = createSessionCookie(token, expiresAt, { secure: isSecureRequest(request) });
  return { ok: true, user: sessionUser, cookie };
}
