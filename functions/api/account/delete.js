/**
 * Account Delete Endpoint
 * POST /api/account/delete
 *
 * Deletes the authenticated user's account and related data.
 */

import { getUserFromRequest, clearSessionCookie, isSecureRequest } from '../../lib/auth.js';
import { jsonResponse, readJsonBody } from '../../lib/utils.js';

async function runDelete(db, sql, bindings, requestId) {
  try {
    await db.prepare(sql).bind(...bindings).run();
  } catch (error) {
    const message = String(error?.message || '');
    if (message.includes('no such table')) {
      return;
    }
    console.warn(`[${requestId}] [account] Delete failed: ${message}`);
  }
}

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
    if (body?.confirm !== true) {
      return jsonResponse({ error: 'Account deletion not confirmed' }, { status: 400 });
    }

    const userId = user.id;

    await runDelete(env.DB, 'DELETE FROM journal_followups WHERE user_id = ?', [userId], requestId);
    await runDelete(env.DB, 'DELETE FROM pattern_occurrences WHERE user_id = ?', [userId], requestId);
    await runDelete(env.DB, 'DELETE FROM follow_up_usage WHERE user_id = ?', [userId], requestId);
    await runDelete(env.DB, 'DELETE FROM usage_tracking WHERE user_id = ?', [userId], requestId);
    await runDelete(env.DB, 'DELETE FROM user_memories WHERE user_id = ?', [userId], requestId);
    await runDelete(env.DB, 'DELETE FROM user_analytics_prefs WHERE user_id = ?', [userId], requestId);
    await runDelete(env.DB, 'DELETE FROM archetype_badges WHERE user_id = ?', [userId], requestId);
    await runDelete(env.DB, 'DELETE FROM card_appearances WHERE user_id = ?', [userId], requestId);
    await runDelete(env.DB, 'DELETE FROM api_keys WHERE user_id = ?', [userId], requestId);
    await runDelete(env.DB, 'DELETE FROM share_notes WHERE token IN (SELECT token FROM share_tokens WHERE user_id = ?)', [userId], requestId);
    await runDelete(env.DB, 'DELETE FROM share_token_entries WHERE token IN (SELECT token FROM share_tokens WHERE user_id = ?)', [userId], requestId);
    await runDelete(env.DB, 'DELETE FROM share_tokens WHERE user_id = ?', [userId], requestId);
    await runDelete(env.DB, 'DELETE FROM journal_entries WHERE user_id = ?', [userId], requestId);
    await runDelete(env.DB, 'DELETE FROM sessions WHERE user_id = ?', [userId], requestId);
    await runDelete(env.DB, 'DELETE FROM users WHERE id = ?', [userId], requestId);

    const isHttps = isSecureRequest(request);
    return jsonResponse(
      { success: true },
      {
        status: 200,
        headers: {
          'Set-Cookie': clearSessionCookie({ secure: isHttps })
        }
      }
    );
  } catch (error) {
    console.error(`[${requestId}] [account] Delete error:`, error);
    return jsonResponse({ error: 'Failed to delete account' }, { status: 500 });
  }
}
