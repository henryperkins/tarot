/**
 * /oauth/authorize: Tableu's consent page for linking ChatGPT (spec §5.2).
 *
 * The page is server-rendered with no scripts and reads the normal Tableu
 * session cookie. Only allowlisted accounts (MCP_ALLOWED_USER_IDS) can
 * approve; a refused account is shown its own id so the owner can configure
 * the allowlist. The approve/deny POST is CSRF-protected (a double-submit
 * cookie plus an Origin check). A denial redirects only to a redirect URI
 * the OAuth library has already validated.
 */
import { getSessionFromCookie, isSecureRequest, validateSession } from '../auth.js';
import { timingSafeEqual } from '../crypto.js';
import { isAllowedMcpUser, MCP_SCOPE } from './config.js';

export const CSRF_COOKIE = 'tableu_oauth_csrf';
const CSRF_MAX_AGE_SECONDS = 600;

const PAGE_HEADERS = Object.freeze({
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Frame-Options': 'DENY',
  // Same-origin forms need a real Origin header in Chromium. This policy
  // still withholds the referrer when OAuth redirects to another origin.
  'Referrer-Policy': 'same-origin',
  // form-action is deliberately omitted: Chromium applies it to the redirect
  // that follows the form POST, which would block the hop back to the client.
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'"
});

const STYLES = [
  'body{margin:0;font:16px/1.5 system-ui,sans-serif;background:#14111c;color:#efe9f7}',
  'main{max-width:34rem;margin:3rem auto;padding:0 1.25rem}',
  'h1{font-size:1.4rem}',
  'code{background:#2a2438;padding:.1rem .35rem;border-radius:.25rem}',
  '.actions{display:flex;gap:.75rem;margin-top:1.5rem}',
  'button,.button{font:inherit;padding:.6rem 1.2rem;border-radius:.5rem;border:1px solid #8f7ab8;background:#2a2438;color:#efe9f7;text-decoration:none;cursor:pointer}',
  'button[value=allow]{background:#8f7ab8;color:#14111c}'
].join('');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

function page(status, title, body, extraHeaders = {}) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)} · Tableu</title><style>${STYLES}</style></head><body><main><h1>${escapeHtml(title)}</h1>${body}</main></body></html>`;
  return new Response(html, { status, headers: { ...PAGE_HEADERS, ...extraHeaders } });
}

function readCookie(request, name) {
  for (const part of (request.headers.get('Cookie') || '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return '';
}

function csrfCookie(request, value, maxAge) {
  const parts = [`${CSRF_COOKIE}=${value}`, 'HttpOnly', 'SameSite=Strict', 'Path=/oauth/authorize', `Max-Age=${maxAge}`];
  if (isSecureRequest(request)) parts.push('Secure');
  return parts.join('; ');
}

function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function redirect(location, extraHeaders = {}) {
  return new Response(null, {
    status: 302,
    headers: { Location: location, 'Cache-Control': 'no-store', ...extraHeaders }
  });
}

function redirectWithError(redirectUri, { error, description, state, issuer }, extraHeaders = {}) {
  const url = new URL(redirectUri);
  url.searchParams.set('error', error);
  if (description) url.searchParams.set('error_description', description);
  if (state) url.searchParams.set('state', state);
  if (issuer) url.searchParams.set('iss', issuer);
  return redirect(url.href, extraHeaders);
}

async function signedInUser(request, env) {
  const token = getSessionFromCookie(request.headers.get('Cookie'));
  if (!token || !env?.DB) return null;
  return validateSession(env.DB, token);
}

function accountLabel(user) {
  return user.username || user.email || user.id;
}

function signInPage(request) {
  const origin = new URL(request.url).origin;
  return page(200, 'Sign in to Tableu to continue', `
<p>ChatGPT wants to connect to your Tableu account, but you're not signed in to Tableu in this browser.</p>
<p><a class="button" href="${escapeHtml(origin)}/" target="_blank" rel="noopener">Open Tableu and sign in</a></p>
<p>Then come back to this tab and continue.</p>
<p><a class="button" href="${escapeHtml(request.url)}">Continue</a></p>`);
}

function notAllowedPage(user) {
  return page(403, "This account can't connect to ChatGPT", `
<p>You're signed in as <strong>@${escapeHtml(accountLabel(user))}</strong>. This private integration only links allowlisted Tableu accounts.</p>
<p>Account ID: <code>${escapeHtml(user.id)}</code></p>
<p>If this is your account, add that ID to the <code>MCP_ALLOWED_USER_IDS</code> secret and start linking again from ChatGPT.</p>`);
}

function consentPage(request, clientName, user) {
  const csrf = randomToken();
  const action = new URL(request.url);
  return page(200, 'Connect ChatGPT to Tableu', `
<p><strong>${escapeHtml(clientName)}</strong> is asking to use your Tableu account, <strong>@${escapeHtml(accountLabel(user))}</strong>.</p>
<p>If you allow it, it can:</p>
<ul>
<li>draw tarot readings for you (each one counts against your reading quota),</li>
<li>save readings to your Tableu journal,</li>
<li>add your reflections to readings it saved.</li>
</ul>
<p>It can't list, search or delete your journal entries.</p>
<form method="post" action="${escapeHtml(action.pathname + action.search)}">
<input type="hidden" name="csrf" value="${csrf}">
<div class="actions"><button type="submit" name="decision" value="allow">Allow</button><button type="submit" name="decision" value="deny">Deny</button></div>
</form>`, { 'Set-Cookie': csrfCookie(request, csrf, CSRF_MAX_AGE_SECONDS) });
}

function refusedPostPage(title) {
  return page(403, title, '<p>For your security, the approval page is only valid for a few minutes. Start linking again from ChatGPT.</p>');
}

/**
 * GET/POST /oauth/authorize. Served through the OAuth provider's
 * defaultHandler, so env.OAUTH_PROVIDER holds the library helpers.
 */
export async function handleAuthorize(request, env) {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, POST' } });
  }

  let authRequest;
  try {
    authRequest = await env.OAUTH_PROVIDER.parseAuthRequest(request);
  } catch (error) {
    // The library attaches redirectUri only after validating it against the
    // client; such errors go back to the client, others stay on this page.
    if (error?.redirectUri) {
      return redirectWithError(error.redirectUri, {
        error: error.code || 'invalid_request',
        description: error.description,
        state: error.state,
        issuer: error.issuer
      });
    }
    return page(400, "This link can't be used", '<p>The authorization request is incomplete or names an unknown client. Start linking again from ChatGPT.</p>');
  }

  const user = await signedInUser(request, env);
  if (!user) return signInPage(request);
  if (!isAllowedMcpUser(env, user.id)) return notAllowedPage(user);

  if (request.method === 'GET') {
    const client = await env.OAUTH_PROVIDER.lookupClient(authRequest.clientId);
    return consentPage(request, client?.clientName || 'An application', user);
  }

  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) {
    return refusedPostPage('This request was refused');
  }

  const form = await request.formData();
  const submitted = String(form.get('csrf') || '');
  const expected = readCookie(request, CSRF_COOKIE);
  if (!submitted || !expected || !timingSafeEqual(submitted, expected)) {
    return refusedPostPage('This confirmation expired');
  }

  const clearCsrf = { 'Set-Cookie': csrfCookie(request, '', 0) };
  const decision = form.get('decision');
  if (decision === 'deny') {
    return redirectWithError(authRequest.redirectUri, {
      error: 'access_denied',
      description: 'The user declined to connect Tableu.',
      state: authRequest.state,
      issuer: authRequest.issuer
    }, clearCsrf);
  }
  if (decision !== 'allow') {
    return page(400, 'Choose Allow or Deny', '<p>Start linking again from ChatGPT.</p>');
  }

  const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
    request: authRequest,
    userId: user.id,
    metadata: { username: user.username || null },
    scope: [MCP_SCOPE],
    props: { userId: user.id }
  });
  return redirect(redirectTo, clearCsrf);
}
