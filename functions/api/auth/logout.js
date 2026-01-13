/**
 * User Logout Endpoint
 * POST /api/auth/logout
 *
 * Destroys the current session and clears the session cookie
 */

import {
  deleteSession,
  getSessionFromCookie,
  clearSessionCookie,
  isSecureRequest
} from '../../lib/auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // Get session token from cookie
    const cookieHeader = request.headers.get('Cookie');
    const token = getSessionFromCookie(cookieHeader);

    if (token) {
      // Delete session from database
      await deleteSession(env.DB, token);
    }

    const isHttps = isSecureRequest(request);

    // Return success with cleared cookie
    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': clearSessionCookie({ secure: isHttps })
        }
      }
    );
  } catch (error) {
    const message = String(error?.message || '');
    if (message.includes('no such table')) {
      // If auth tables aren't available yet, treat logout as a no-op.
      const isHttps = isSecureRequest(request);
      return new Response(
        JSON.stringify({ success: true, skipped: true }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': clearSessionCookie({ secure: isHttps })
          }
        }
      );
    }

    console.error('Logout error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
