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
  isValidPassword,
  validateSession,
  isSecureRequest
} from '../../lib/auth.js';
import { sendVerificationEmail } from '../../lib/authNotifications.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const requestId = crypto.randomUUID();

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
    const sessionUser = await validateSession(env.DB, token);

    if (!sessionUser) {
      throw new Error('Session validation failed after registration');
    }

    const isHttps = isSecureRequest(request);

    // Send verification email (best effort, non-blocking on failure)
    const verification = await sendVerificationEmail(env, request, {
      id: userId,
      email: email.toLowerCase(),
      username
    }).catch((err) => {
      console.error(`[${requestId}] [auth] Verification email failure:`, err);
      return { sent: false, error: err?.message };
    });

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
        },
        verification_sent: verification?.sent || false,
        verification_error: verification?.error || null
      }),
      {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': createSessionCookie(token, expiresAt, { secure: isHttps })
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

    console.error(`[${requestId}] [auth] Registration error:`, error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
