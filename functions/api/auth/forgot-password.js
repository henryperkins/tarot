import { isValidEmail } from '../../lib/auth.js';
import { getMostRecentToken, TOKEN_TYPES } from '../../lib/authTokens.js';
import { sendPasswordResetEmail, sendVerificationEmail } from '../../lib/authNotifications.js';
import { jsonResponse, readJsonBody } from '../../lib/utils.js';

const RESET_COOLDOWN_SECONDS = 15 * 60; // 15 minutes
const VERIFICATION_COOLDOWN_SECONDS = 10 * 60; // 10 minutes

export async function onRequestPost(context) {
  const { request, env } = context;
  const requestId = crypto.randomUUID();

  try {
    const body = await readJsonBody(request).catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email || !isValidEmail(email)) {
      return jsonResponse({ error: 'Invalid email' }, { status: 400 });
    }

    const user = await env.DB.prepare(`
      SELECT id, email, username, email_verified, is_active
      FROM users
      WHERE email = ?
    `)
      .bind(email)
      .first();

    // Always return success to avoid account enumeration.
    if (!user) {
      return jsonResponse({ success: true });
    }

    if (!user.is_active) {
      return jsonResponse({ success: true });
    }

    // If email isn't verified, send a verification email instead of a reset.
    if (!user.email_verified) {
      const recentVerification = await getMostRecentToken(env.DB, user.id, TOKEN_TYPES.EMAIL_VERIFICATION);
      const nowSeconds = Math.floor(Date.now() / 1000);
      if (!recentVerification || recentVerification.created_at <= nowSeconds - VERIFICATION_COOLDOWN_SECONDS) {
        await sendVerificationEmail(env, request, user);
      }
      return jsonResponse({ success: true });
    }

    const mostRecent = await getMostRecentToken(env.DB, user.id, TOKEN_TYPES.PASSWORD_RESET);
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (mostRecent && mostRecent.created_at > nowSeconds - RESET_COOLDOWN_SECONDS) {
      return jsonResponse({ success: true });
    }

    await sendPasswordResetEmail(env, request, user);

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

    console.error(`[${requestId}] [auth] Forgot password error:`, error);
    return jsonResponse({ error: 'Unable to process request' }, { status: 500 });
  }
}
