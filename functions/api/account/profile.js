/**
 * Account Profile Update Endpoint
 * PATCH /api/account/profile
 *
 * Updates username and/or email for the authenticated user.
 */

import { getUserFromRequest, isValidEmail, isValidUsername } from '../../lib/auth.js';
import { jsonResponse, readJsonBody } from '../../lib/utils.js';

export async function onRequestPatch(context) {
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
    const nextEmailRaw = typeof body.email === 'string' ? body.email.trim() : '';
    const nextUsernameRaw = typeof body.username === 'string' ? body.username.trim() : '';

    const updates = {};
    if (nextEmailRaw) {
      const normalizedEmail = nextEmailRaw.toLowerCase();
      if (!isValidEmail(normalizedEmail)) {
        return jsonResponse({ error: 'Invalid email format' }, { status: 400 });
      }
      updates.email = normalizedEmail;
    }

    if (nextUsernameRaw) {
      if (!isValidUsername(nextUsernameRaw)) {
        return jsonResponse(
          { error: 'Username must be 3-30 characters and contain only letters, numbers, and underscores' },
          { status: 400 }
        );
      }
      updates.username = nextUsernameRaw;
    }

    if (Object.keys(updates).length === 0) {
      return jsonResponse({ error: 'No profile updates provided' }, { status: 400 });
    }

    if (updates.email) {
      const existingEmail = await env.DB.prepare(
        'SELECT id FROM users WHERE email = ? AND id != ?'
      ).bind(updates.email, user.id).first();
      if (existingEmail) {
        return jsonResponse({ error: 'Email already in use' }, { status: 409 });
      }
    }

    if (updates.username) {
      const existingUsername = await env.DB.prepare(
        'SELECT id FROM users WHERE username = ? AND id != ?'
      ).bind(updates.username, user.id).first();
      if (existingUsername) {
        return jsonResponse({ error: 'Username already in use' }, { status: 409 });
      }
    }

    const now = Math.floor(Date.now() / 1000);
    const fields = [];
    const bindings = [];

    if (updates.email) {
      fields.push('email = ?');
      bindings.push(updates.email);
    }

    if (updates.username) {
      fields.push('username = ?');
      bindings.push(updates.username);
    }

    fields.push('updated_at = ?');
    bindings.push(now);
    bindings.push(user.id);

    await env.DB.prepare(`
      UPDATE users
      SET ${fields.join(', ')}
      WHERE id = ?
    `).bind(...bindings).run();

    return jsonResponse({
      success: true,
      user: {
        id: user.id,
        email: updates.email || user.email,
        username: updates.username || user.username,
        subscription_tier: user.subscription_tier || 'free',
        subscription_status: user.subscription_status || 'inactive',
        subscription_provider: user.subscription_provider || null,
        auth_provider: user.auth_provider || null,
        full_name: user.full_name || null,
        avatar_url: user.avatar_url || null
      }
    });
  } catch (error) {
    console.error(`[${requestId}] [account] Profile update error:`, error);
    return jsonResponse({ error: 'Failed to update profile' }, { status: 500 });
  }
}
