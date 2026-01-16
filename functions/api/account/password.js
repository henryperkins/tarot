/**
 * Account Password Update Endpoint
 * POST /api/account/password
 *
 * Updates the password for the authenticated user.
 */

import {
  getUserFromRequest,
  verifyPassword,
  hashPassword,
  isValidPassword
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

    if (!record?.password_hash || !record?.password_salt) {
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

    return jsonResponse({ success: true });
  } catch (error) {
    console.error(`[${requestId}] [account] Password update error:`, error);
    return jsonResponse({ error: 'Failed to update password' }, { status: 500 });
  }
}
