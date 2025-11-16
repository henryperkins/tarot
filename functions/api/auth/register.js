/**
 * User Registration Endpoint
 * POST /api/auth/register
 *
 * Creates a new user account with email/username/password
 */

import {
  hashPassword,
  createSession,
  createSessionCookie,
  isValidEmail,
  isValidUsername,
  isValidPassword
} from '../../lib/auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // Parse request body
    const body = await request.json();
    const { email, username, password } = body;

    // Validate inputs
    if (!email || !username || !password) {
      return new Response(
        JSON.stringify({ error: 'Email, username, and password are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!isValidEmail(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!isValidUsername(username)) {
      return new Response(
        JSON.stringify({
          error: 'Username must be 3-30 characters and contain only letters, numbers, and underscores'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!isValidPassword(password)) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 8 characters' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if user already exists
    const existingUser = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ? OR username = ?'
    )
      .bind(email.toLowerCase(), username.toLowerCase())
      .first();

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: 'Email or username already exists' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Hash password
    const { hash, salt } = await hashPassword(password);

    // Create user
    const userId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    await env.DB.prepare(`
      INSERT INTO users (id, email, username, password_hash, password_salt, created_at, updated_at, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `)
      .bind(userId, email.toLowerCase(), username, hash, salt, now, now)
      .run();

    // Create session
    const metadata = {
      userAgent: request.headers.get('User-Agent'),
      ipAddress: request.headers.get('CF-Connecting-IP')
    };

    const { token, expiresAt } = await createSession(env.DB, userId, metadata);

    // Return success with session cookie
    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: userId,
          email: email.toLowerCase(),
          username: username
        }
      }),
      {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': createSessionCookie(token, expiresAt)
        }
      }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
