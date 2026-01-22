/**
 * Get Current User Endpoint
 * GET /api/auth/me
 *
 * Returns the currently authenticated user's information
 */

import {
  validateSession,
  getSessionFromCookie
} from '../../lib/auth.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const requestId = crypto.randomUUID();

  try {
    // Get session token from cookie
    const cookieHeader = request.headers.get('Cookie');
    const token = getSessionFromCookie(cookieHeader);

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate session and get user
    const user = await validateSession(env.DB, token);

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Return user data, including subscription metadata so the frontend
    // can drive feature gating without extra round-trips.
    return new Response(
      JSON.stringify({
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          subscription_tier: user.subscription_tier || 'free',
          subscription_status: user.subscription_status || 'inactive',
          subscription_provider: user.subscription_provider || null,
          email_verified: Boolean(user.email_verified)
        }
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
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

    console.error(`[${requestId}] [auth] Get user error:`, error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
