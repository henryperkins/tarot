import { TOKEN_TYPES, findValidToken, markTokenUsed, deleteTokensByUserAndType } from '../../lib/authTokens.js';
import { jsonResponse } from '../../lib/utils.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const requestId = crypto.randomUUID();

  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return jsonResponse({ error: 'missing_token' }, { status: 400 });
    }

    const tokenRecord = await findValidToken(env.DB, token, TOKEN_TYPES.EMAIL_VERIFICATION);
    if (!tokenRecord) {
      return jsonResponse({ error: 'invalid_or_expired_token' }, { status: 400 });
    }

    const now = Math.floor(Date.now() / 1000);

    await env.DB.prepare('UPDATE users SET email_verified = 1, updated_at = ? WHERE id = ?')
      .bind(now, tokenRecord.user_id)
      .run();

    await markTokenUsed(env.DB, tokenRecord.id);
    await deleteTokensByUserAndType(env.DB, tokenRecord.user_id, TOKEN_TYPES.EMAIL_VERIFICATION);

    return jsonResponse({ success: true, email_verified: true });
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

    console.error(`[${requestId}] [auth] Email verification error:`, error);
    return jsonResponse({ error: 'Failed to verify email' }, { status: 500 });
  }
}
