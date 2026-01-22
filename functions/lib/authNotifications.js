import { TOKEN_TYPES, createUserToken } from './authTokens.js';
import { buildPasswordResetEmail, buildVerificationEmail } from './authEmails.js';
import { sendEmail } from './emailService.js';
import { getBaseUrl } from './utils.js';

function getRequestMetadata(request) {
  return {
    ipAddress: request.headers.get('CF-Connecting-IP'),
    userAgent: request.headers.get('User-Agent')
  };
}

function getEmailConfigError(env) {
  const apiKey = env?.RESEND_API_KEY;
  if (!apiKey || !String(apiKey).trim()) {
    return 'api_key_missing';
  }
  return null;
}

async function dispatchEmail(env, email, content) {
  const result = await sendEmail(env, {
    to: email,
    subject: content.subject,
    html: content.html,
    text: content.text
  });

  return {
    sent: Boolean(result?.success),
    error: result?.error || null,
    details: result?.details || null
  };
}

export async function sendVerificationEmail(env, request, user, options = {}) {
  try {
    const configError = getEmailConfigError(env);
    if (configError) {
      console.warn('[auth] Email delivery disabled; RESEND_API_KEY missing');
      return { sent: false, error: configError };
    }

    const { ipAddress, userAgent } = getRequestMetadata(request);
    const { token } = await createUserToken(env.DB, user.id, TOKEN_TYPES.EMAIL_VERIFICATION, {
      ipAddress,
      userAgent,
      replaceExisting: options.replaceExisting,
      expiresInSeconds: options.expiresInSeconds
    });

    const baseUrl = getBaseUrl(request);
    const emailContent = buildVerificationEmail({
      baseUrl,
      token,
      username: user.username
    });

    return dispatchEmail(env, user.email, emailContent);
  } catch (error) {
    const message = String(error?.message || '');
    if (message.includes('no such table: user_tokens')) {
      console.warn('[auth] user_tokens table missing; skip verification email until migration is applied');
      return { sent: false, error: 'tokens_table_missing' };
    }

    console.error('[auth] Failed to send verification email:', error);
    return { sent: false, error: 'send_failed' };
  }
}

export async function sendPasswordResetEmail(env, request, user, options = {}) {
  try {
    const configError = getEmailConfigError(env);
    if (configError) {
      console.warn('[auth] Email delivery disabled; RESEND_API_KEY missing');
      return { sent: false, error: configError };
    }

    const { ipAddress, userAgent } = getRequestMetadata(request);
    const { token } = await createUserToken(env.DB, user.id, TOKEN_TYPES.PASSWORD_RESET, {
      ipAddress,
      userAgent,
      replaceExisting: options.replaceExisting,
      expiresInSeconds: options.expiresInSeconds
    });

    const baseUrl = getBaseUrl(request);
    const emailContent = buildPasswordResetEmail({
      baseUrl,
      token,
      username: user.username
    });

    return dispatchEmail(env, user.email, emailContent);
  } catch (error) {
    const message = String(error?.message || '');
    if (message.includes('no such table: user_tokens')) {
      console.warn('[auth] user_tokens table missing; skip password reset email until migration is applied');
      return { sent: false, error: 'tokens_table_missing' };
    }

    console.error('[auth] Failed to send password reset email:', error);
    return { sent: false, error: 'send_failed' };
  }
}
