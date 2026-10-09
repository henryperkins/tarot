/**
 * /oauth/authorize: Tableu's consent page for linking ChatGPT (spec §5.2).
 *
 * The page is server-rendered with no scripts and reads the normal Tableu
 * session cookie. A signed-out visitor can sign in with email and password
 * on the page itself, so linking works inside ChatGPT's sign-in window on
 * desktop and mobile; accounts that use another sign-in method can still
 * sign in on Tableu and continue. MCP_ACCESS_MODE decides which accounts may
 * approve (see config.js). Every POST is CSRF-protected (a double-submit
 * cookie plus an Origin check), and password attempts share the login rate
 * limit. A denial redirects only to a redirect URI the OAuth library has
 * already validated.
 */
import { getSessionFromCookie, isSecureRequest, validateSession } from '../auth.js';
import { timingSafeEqual } from '../crypto.js';
import { authenticateWithPassword, checkLoginRateLimit } from '../passwordSignIn.js';
import { getMcpAccessMode, isAllowedMcpUser, MCP_SCOPE } from './config.js';

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
  'button[value=allow],button[value=signin]{background:#8f7ab8;color:#14111c}',
  'label{display:block;margin-top:1rem;font-weight:600}',
  'input{display:block;box-sizing:border-box;width:100%;margin-top:.35rem;font:inherit;padding:.6rem .75rem;border-radius:.5rem;border:1px solid #8f7ab8;background:#1d1828;color:#efe9f7}',
  'a{color:#cdb8f2}',
  '.error{border:1px solid #e0a3a3;background:#3a1f26;padding:.6rem .8rem;border-radius:.5rem}',
  '.fine{margin-top:2rem;font-size:.9rem;color:#c5bcd6}'
].join('');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

function page(status, title, body, extraHeaders = {}) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)} · Tableu</title><style>${STYLES}</style></head><body><main><h1>${escapeHtml(title)}</h1>${body}</main></body></html>`;
  const headers = extraHeaders instanceof Headers ? extraHeaders : { ...PAGE_HEADERS, ...extraHeaders };
  return new Response(html, { status, headers });
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
  return user.username || user.email || 'your account';
}

function policyLinks(request) {
  const origin = escapeHtml(new URL(request.url).origin);
  return `<p class="fine">You can disconnect Tableu at any time in ChatGPT's settings. Read the <a href="${origin}/privacy" target="_blank" rel="noopener">Privacy Policy</a> and <a href="${origin}/terms" target="_blank" rel="noopener">Terms of Service</a>.</p>`;
}

const SIGN_IN_ERRORS = Object.freeze({
  400: 'Enter the email and password for your Tableu account.',
  401: "That email and password don't match a Tableu account.",
  403: 'This Tableu account is inactive.',
  429: 'Too many sign-in attempts. Wait a few minutes, then try again.'
});

function signInPage(request, { status = 200, error = null, email = '', extraHeaders = {} } = {}) {
  const origin = new URL(request.url).origin;
  const action = new URL(request.url);
  const csrf = randomToken();
  const message = error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : '';
  const headers = new Headers({ ...PAGE_HEADERS, ...extraHeaders });
  headers.append('Set-Cookie', csrfCookie(request, csrf, CSRF_MAX_AGE_SECONDS));
  return page(status, 'Sign in to connect ChatGPT', `
<p>ChatGPT wants to connect to your Tableu account. Sign in to continue.</p>
${message}
<form method="post" action="${escapeHtml(action.pathname + action.search)}">
<input type="hidden" name="csrf" value="${csrf}">
<label for="email">Email</label>
<input id="email" name="email" type="email" autocomplete="username" required value="${escapeHtml(email)}">
<label for="password">Password</label>
<input id="password" name="password" type="password" autocomplete="current-password" required>
<div class="actions"><button type="submit" name="intent" value="signin">Sign in</button></div>
</form>
<p>Use Google or another sign-in method, or new to Tableu? <a href="${escapeHtml(origin)}/" target="_blank" rel="noopener">Open Tableu</a> to sign in or create an account, then come back here and select <a href="${escapeHtml(request.url)}">Continue</a>.</p>
${policyLinks(request)}`, headers);
}

function notAllowedPage(env) {
  if (getMcpAccessMode(env) === 'off') {
    return page(403, 'Connecting is paused', `
<p>Tableu isn't accepting new ChatGPT connections right now. Please try again later.</p>`);
  }
  return page(403, "This account can't connect to ChatGPT", `
<p>This Tableu account isn't able to connect to ChatGPT yet. If you think this is a mistake, contact Tableu support.</p>`);
}

function consentPage(request, clientName, user) {
  const csrf = randomToken();
  const action = new URL(request.url);
  return page(200, 'Connect ChatGPT to Tableu', `
<p><strong>${escapeHtml(clientName)}</strong> is asking to use your Tableu account, <strong>@${escapeHtml(accountLabel(user))}</strong>.</p>
<p>If you allow it, it can:</p>
<ul>
<li>draw tarot readings for you (each one counts toward your account's readings),</li>
<li>save readings to your Tableu journal when you ask,</li>
<li>add your reflections to readings it saved.</li>
</ul>
<p>It can't list, search or delete your journal entries.</p>
<form method="post" action="${escapeHtml(action.pathname + action.search)}">
<input type="hidden" name="csrf" value="${csrf}">
<div class="actions"><button type="submit" name="decision" value="allow">Allow</button><button type="submit" name="decision" value="deny">Deny</button></div>
</form>
${policyLinks(request)}`, { 'Set-Cookie': csrfCookie(request, csrf, CSRF_MAX_AGE_SECONDS) });
}

function refusedPostPage(title) {
  return page(403, title, '<p>For your security, the approval page is only valid for a few minutes. Start linking again from ChatGPT.</p>');
}

/**
 * Password sign-in from the connection page. On success the browser reloads
 * the same authorization request with its new session (post/redirect/get),
 * which then shows the consent page.
 */
async function handleSignIn(request, env, form) {
  const email = String(form.get('email') || '').trim();
  const password = String(form.get('password') || '');
  const requestId = crypto.randomUUID();

  const rateLimit = await checkLoginRateLimit(env, request, requestId);
  if (rateLimit.limited) {
    return signInPage(request, {
      status: 429,
      error: SIGN_IN_ERRORS[429],
      email,
      extraHeaders: { 'Retry-After': String(rateLimit.retryAfter) }
    });
  }

  let result;
  try {
    result = await authenticateWithPassword(env, request, { email, password, rateLimit, requestId });
  } catch (error) {
    console.error(`[${requestId}] [oauth] Sign-in failed: ${error?.message || 'unknown error'}`);
    return signInPage(request, { status: 503, error: "Tableu couldn't sign you in right now. Please try again.", email });
  }
  if (!result.ok) {
    return signInPage(request, { status: result.status, error: SIGN_IN_ERRORS[result.status] || SIGN_IN_ERRORS[401], email });
  }

  const headers = new Headers({ Location: request.url, 'Cache-Control': 'no-store' });
  headers.append('Set-Cookie', result.cookie);
  headers.append('Set-Cookie', csrfCookie(request, '', 0));
  return new Response(null, { status: 303, headers });
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

  if (request.method === 'GET') {
    if (!user) return signInPage(request);
    if (!isAllowedMcpUser(env, user.id)) return notAllowedPage(env);
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

  if (form.get('intent') === 'signin') return handleSignIn(request, env, form);
  if (!user) return signInPage(request);
  if (!isAllowedMcpUser(env, user.id)) return notAllowedPage(env);

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
