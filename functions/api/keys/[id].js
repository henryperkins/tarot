/**
 * API Key Management - Delete/Revoke
 * /api/keys/[id]
 */

import { validateSession, getSessionFromCookie } from '../../lib/auth.js';

export async function onRequestDelete(context) {
  const { request, env, params } = context;
  const keyId = params.id;

  try {
    // Auth check
    const cookieHeader = request.headers.get('Cookie');
    const token = getSessionFromCookie(cookieHeader);
    const user = await validateSession(env.DB, token);

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    // Delete key (ensure it belongs to user)
    const result = await env.DB.prepare(`
      DELETE FROM api_keys
      WHERE id = ? AND user_id = ?
    `)
    .bind(keyId, user.id)
    .run();

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Key not found or permission denied' }), { status: 404 });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
