/**
 * Get Current User Endpoint
 * GET /api/auth/me
 *
 * Returns the currently authenticated user's information
 */

import { getUserFromRequest } from '../../lib/auth.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const requestId = crypto.randomUUID();

  try {
    // Use the same identity resolver as journal writes so integrations can
    // compare their bearer identity with the signed-in app account.
    const user = await getUserFromRequest(request, env);

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
          email_verified: Boolean(user.email_verified),
          auth_provider: user.auth_provider || null,
          full_name: user.full_name || null,
          avatar_url: user.avatar_url || null
        }
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
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
