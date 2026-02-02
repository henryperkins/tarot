/**
 * Account Password Update Endpoint
 * POST /api/account/password
 *
 * Updates the password for the authenticated user.
 * 
 * Security: Invalidates all existing sessions after password change to prevent
 * compromised sessions from persisting.
 */

import {
  getUserFromRequest,
  verifyPassword,
  hashPassword,
  isValidPassword,
  deleteAllUserSessions,
  createSession,
  createSessionCookie,
  isSecureRequest
} from '../../lib/auth.js';
import { jsonResponse, readJsonBody } from '../../lib/utils.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const requestId = crypto.randomUUID();

  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return jsonResponse({ error: 'Authentication required' }, { status: 401 });
    }

    if (user.auth_provider === 'api_key') {
      return jsonResponse({ error: 'Session authentication required' }, { status: 401 });
    }

    const body = await readJsonBody(request).catch(() => ({}));
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

    if (!currentPassword || !newPassword) {
      return jsonResponse({ error: 'Current and new passwords are required' }, { status: 400 });
    }

    if (!isValidPassword(newPassword)) {
      return jsonResponse({ error: 'New password must be at least 8 characters' }, { status: 400 });
    }

    const record = await env.DB.prepare(
      'SELECT password_hash, password_salt FROM users WHERE id = ?'
    ).bind(user.id).first();

    if (!record?.password_hash || !record?.password_salt || record.password_hash === '') {
      return jsonResponse({ error: 'Password update unavailable for this account' }, { status: 400 });
    }

    const isMatch = await verifyPassword(currentPassword, record.password_hash, record.password_salt);
    if (!isMatch) {
      return jsonResponse({ error: 'Current password is incorrect' }, { status: 401 });
    }

    const { hash, salt } = await hashPassword(newPassword);
    const now = Math.floor(Date.now() / 1000);

    await env.DB.prepare(`
      UPDATE users
      SET password_hash = ?, password_salt = ?, updated_at = ?
      WHERE id = ?
    `).bind(hash, salt, now, user.id).run();

    // Security: Invalidate all existing sessions after password change
    // This ensures any compromised sessions are terminated
    await deleteAllUserSessions(env.DB, user.id);

    // Create a new session for the current user so they stay logged in
    const metadata = {
      userAgent: request.headers.get('User-Agent'),
      ipAddress: request.headers.get('CF-Connecting-IP')
    };
    const { token, expiresAt } = await createSession(env.DB, user.id, metadata);
    const isHttps = isSecureRequest(request);
    const cookie = createSessionCookie(token, expiresAt, { secure: isHttps });

    return jsonResponse(
      { success: true, sessionsInvalidated: true },
      {
        status: 200,
        headers: {
          'Set-Cookie': cookie
        }
      }
    );
  } catch (error) {
    console.error(`[${requestId}] [account] Password update error:`, error);
    return jsonResponse({ error: 'Failed to update password' }, { status: 500 });
  }
}
