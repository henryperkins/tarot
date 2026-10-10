/**
 * User Login Endpoint
 * POST /api/auth/login
 *
 * Authenticates a user and creates a new session.
 * 
 * Security: Rate limited to prevent brute-force attacks
 * (max 5 failed attempts per 5-minute window per IP).
 */

import { authenticateWithPassword, checkLoginRateLimit } from '../../lib/passwordSignIn.js';

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

    const result = await authenticateWithPassword(env, request, { email, password, rateLimit, requestId });
    if (!result.ok) {
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: result.status, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const sessionUser = result.user;
    const cookie = result.cookie;

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
