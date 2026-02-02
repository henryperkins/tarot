/**
 * User Login Endpoint
 * POST /api/auth/login
 *
 * Authenticates a user and creates a new session.
 * 
 * Security: Rate limited to prevent brute-force attacks
 * (max 5 failed attempts per 5-minute window per IP).
 */

import {
  verifyPassword,
  createSession,
  createSessionCookie,
  validateSession,
  isSecureRequest
} from '../../lib/auth.js';
import { getClientIdentifier } from '../../lib/clientId.js';

const LOGIN_RATE_LIMIT_KEY_PREFIX = 'login-attempt';
const LOGIN_RATE_LIMIT_MAX = 5;
const LOGIN_RATE_LIMIT_WINDOW_SECONDS = 300; // 5 minutes

/**
 * Check and enforce rate limit for login attempts.
 * Only counts failed attempts - successful logins don't increment.
 */
async function checkLoginRateLimit(env, request, requestId) {
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

/**
 * Increment failed login counter after an authentication failure.
 */
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

export async function onRequestPost(context) {
  const { request, env } = context;
  const requestId = crypto.randomUUID();

  try {
    // Check rate limit before processing
    const rateLimit = await checkLoginRateLimit(env, request, requestId);
    if (rateLimit.limited) {
      return new Response(
        JSON.stringify({
          error: 'Too many login attempts. Please try again later.',
          retryAfter: rateLimit.retryAfter
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(rateLimit.retryAfter)
          }
        }
      );
    }

    // Parse request body
    const body = await request.json();
    const { email, password } = body;

    // Validate inputs
    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Find user by email
    const user = await env.DB.prepare(`
      SELECT id, email, username, password_hash, password_salt, is_active
      FROM users
      WHERE email = ?
    `)
      .bind(email.toLowerCase())
      .first();

    if (!user) {
      // Increment failed attempt counter
      await incrementLoginFailure(env, rateLimit.rateLimitKey, rateLimit.currentCount, requestId);
      return new Response(
        JSON.stringify({ error: 'Invalid email or password' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if account is active
    if (!user.is_active) {
      // Don't count inactive account as failed login attempt (not brute force)
      return new Response(
        JSON.stringify({ error: 'Account is inactive' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash, user.password_salt);

    if (!isValid) {
      // Increment failed attempt counter
      await incrementLoginFailure(env, rateLimit.rateLimitKey, rateLimit.currentCount, requestId);
      return new Response(
        JSON.stringify({ error: 'Invalid email or password' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Update last_login_at
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare('UPDATE users SET last_login_at = ? WHERE id = ?')
      .bind(now, user.id)
      .run();

    // Create session
    const metadata = {
      userAgent: request.headers.get('User-Agent'),
      ipAddress: request.headers.get('CF-Connecting-IP')
    };

    const { token, expiresAt } = await createSession(env.DB, user.id, metadata);
    const sessionUser = await validateSession(env.DB, token);

    if (!sessionUser) {
      throw new Error('Session validation failed after login');
    }

    const isHttps = isSecureRequest(request);
    const cookie = createSessionCookie(token, expiresAt, { secure: isHttps });

    // Return success with session cookie
    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: sessionUser.id,
          email: sessionUser.email,
          username: sessionUser.username,
          subscription_tier: sessionUser.subscription_tier || 'free',
          subscription_status: sessionUser.subscription_status || 'inactive',
          subscription_provider: sessionUser.subscription_provider || null,
          stripe_customer_id: sessionUser.stripe_customer_id || null,
          email_verified: Boolean(sessionUser.email_verified),
          auth_provider: sessionUser.auth_provider || null,
          full_name: sessionUser.full_name || null,
          avatar_url: sessionUser.avatar_url || null
        }
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': cookie
        }
      }
    );
  } catch (error) {
    const message = String(error?.message || '');
    if (message.includes('no such table')) {
      return new Response(
        JSON.stringify({
          error: 'Database not initialized',
          code: 'db_not_initialized',
          hint: 'Run `npm run migrations:apply:local` (or apply D1 migrations)'
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.error(`[${requestId}] [auth] Login error:`, error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
