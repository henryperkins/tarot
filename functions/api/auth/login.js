/**
 * User Login Endpoint
 * POST /api/auth/login
 *
 * Authenticates a user and creates a new session
 */

import {
  verifyPassword,
  createSession,
  createSessionCookie
} from '../../lib/auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
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
      return new Response(
        JSON.stringify({ error: 'Invalid email or password' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if account is active
    if (!user.is_active) {
      return new Response(
        JSON.stringify({ error: 'Account is inactive' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash, user.password_salt);

    if (!isValid) {
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

    // Return success with session cookie
    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          username: user.username
        }
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': createSessionCookie(token, expiresAt)
        }
      }
    );
  } catch (error) {
    console.error('Login error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
