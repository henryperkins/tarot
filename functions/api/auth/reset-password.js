import { hashPassword, isValidPassword, deleteAllUserSessions } from '../../lib/auth.js';
import { TOKEN_TYPES, findValidToken, markTokenUsed, deleteTokensByUserAndType } from '../../lib/authTokens.js';
import { jsonResponse, readJsonBody } from '../../lib/utils.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const requestId = crypto.randomUUID();

  try {
    const body = await readJsonBody(request).catch(() => ({}));
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!token) {
      return jsonResponse({ error: 'missing_token' }, { status: 400 });
    }

    if (!isValidPassword(password)) {
      return jsonResponse({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const tokenRecord = await findValidToken(env.DB, token, TOKEN_TYPES.PASSWORD_RESET);
    if (!tokenRecord) {
      return jsonResponse({ error: 'invalid_or_expired_token' }, { status: 400 });
    }

    const user = await env.DB.prepare('SELECT id, is_active FROM users WHERE id = ?')
      .bind(tokenRecord.user_id)
      .first();

    if (!user || !user.is_active) {
      return jsonResponse({ error: 'invalid_or_expired_token' }, { status: 400 });
    }

    const { hash, salt } = await hashPassword(password);
    const nowSeconds = Math.floor(Date.now() / 1000);

    await env.DB.prepare(`
      UPDATE users
      SET password_hash = ?, password_salt = ?, updated_at = ?
      WHERE id = ?
    `).bind(hash, salt, nowSeconds, user.id).run();

    await markTokenUsed(env.DB, tokenRecord.id);
    await deleteTokensByUserAndType(env.DB, user.id, TOKEN_TYPES.PASSWORD_RESET);
    await deleteAllUserSessions(env.DB, user.id);

    return jsonResponse({ success: true });
  } catch (error) {
    const message = String(error?.message || '');
    if (message.includes('no such table: user_tokens')) {
      return jsonResponse(
        {
          error: 'Database not initialized',
          code: 'db_not_initialized',
          hint: 'Apply migration 0024_add_user_tokens'
        },
        { status: 503 }
      );
    }

    console.error(`[${requestId}] [auth] Reset password error:`, error);
    return jsonResponse({ error: 'Failed to reset password' }, { status: 500 });
  }
}
