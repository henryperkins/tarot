/**
 * Auth email templates for verification and password resets.
 */

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function baseTemplate({ title, body }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0b1021; color: #e9e7ef; padding: 0; margin: 0; }
    .container { max-width: 560px; margin: 0 auto; padding: 32px 24px 48px; }
    .card { background: linear-gradient(145deg, #11152c, #0d1122); border: 1px solid #1f2a44; border-radius: 16px; padding: 28px; box-shadow: 0 20px 40px rgba(0,0,0,0.35); }
    .title { font-size: 20px; font-weight: 700; color: #f5d76e; margin: 0 0 12px; }
    .text { color: #cfd3e0; line-height: 1.6; font-size: 15px; margin: 0 0 16px; }
    .button { display: inline-block; padding: 12px 18px; background: linear-gradient(135deg, #f5d76e, #f0b73a); color: #0b0f1c; font-weight: 700; border-radius: 12px; text-decoration: none; box-shadow: 0 12px 30px rgba(245, 215, 110, 0.25); }
    .muted { color: #8c94aa; font-size: 13px; }
    .link { color: #f5d76e; text-decoration: none; }
    .footer { margin-top: 20px; font-size: 12px; color: #6f778f; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="title">${title}</div>
      ${body}
    </div>
    <div class="footer">
      You received this email because your address was used in Tableu. If this wasn't you, you can ignore it.
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function buildVerificationEmail({ baseUrl, token, username }) {
  const safeName = escapeHtml(username) || 'there';
  const verifyUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(token)}`;

  const subject = 'Confirm your email for Tableu';
  const body = `
    <p class="text">Hi ${safeName},</p>
    <p class="text">Confirm your email to secure your account and enable password recovery.</p>
    <p><a class="button" href="${verifyUrl}">Verify email</a></p>
    <p class="text muted">Or paste this link into your browser:<br><a class="link" href="${verifyUrl}">${verifyUrl}</a></p>
  `;

  return {
    subject,
    html: baseTemplate({ title: 'Verify your email', body }),
    text: `Hi ${safeName},\n\nConfirm your email to secure your account.\n\n${verifyUrl}\n`
  };
}

export function buildPasswordResetEmail({ baseUrl, token, username }) {
  const safeName = escapeHtml(username) || 'there';
  const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;

  const subject = 'Reset your Tableu password';
  const body = `
    <p class="text">Hi ${safeName},</p>
    <p class="text">We received a request to reset your password. This link will expire in 30 minutes.</p>
    <p><a class="button" href="${resetUrl}">Reset password</a></p>
    <p class="text muted">If you didn't request this, you can safely ignore it.</p>
    <p class="text muted">Or paste this link into your browser:<br><a class="link" href="${resetUrl}">${resetUrl}</a></p>
  `;

  return {
    subject,
    html: baseTemplate({ title: 'Reset your password', body }),
    text: `Hi ${safeName},\n\nReset your password (link expires in 30 minutes):\n\n${resetUrl}\n\nIf you didn't request this, you can ignore it.\n`
  };
}
