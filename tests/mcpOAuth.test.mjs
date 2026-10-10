import assert from 'node:assert/strict';
import { register } from 'node:module';
import { describe, it } from 'node:test';

// @cloudflare/workers-oauth-provider imports `cloudflare:workers`; point it
// at the stub before anything imports the provider.
register('./helpers/cloudflareWorkersHooks.mjs', import.meta.url);

const { createD1 } = await import('./helpers/d1Sqlite.mjs');
const { seedSession, seedUser } = await import('./helpers/journalFixtures.mjs');
const { MemoryKV } = await import('./helpers/memoryKv.mjs');
const { getOAuthApi } = await import('@cloudflare/workers-oauth-provider');
const { buildOAuthProviderOptions, handleMcpOrOAuthRequest, isMcpOrOAuthPath } = await import('../functions/lib/mcp/oauthProvider.js');
const { enforceRegistrationRateLimit } = await import('../functions/lib/mcp/registrationLimit.js');
const { profileIdFor } = await import('../functions/lib/mcp/tools/profile.js');
const { hashPassword } = await import('../functions/lib/auth.js');

const ORIGIN = 'https://tarot.example';
const RESOURCE = `${ORIGIN}/mcp`;
const REDIRECT = 'https://chatgpt.com/connector_platform_oauth_redirect';

async function setup({ allowed = 'user-1', mode } = {}) {
  const d1 = await createD1();
  await seedUser(d1, { id: 'user-1', username: 'henry' });
  await seedSession(d1, { id: 'session-1', userId: 'user-1' });
  await seedUser(d1, { id: 'user-2', username: 'guest' });
  await seedSession(d1, { id: 'session-2', userId: 'user-2' });
  const env = {
    DB: d1,
    OAUTH_KV: new MemoryKV(),
    MCP_RESOURCE_URL: RESOURCE,
    MCP_ALLOWED_USER_IDS: allowed,
    ...(mode ? { MCP_ACCESS_MODE: mode } : {}),
    RATELIMIT: new MemoryKV()
  };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const call = (path, init = {}) => handleMcpOrOAuthRequest(new Request(`${ORIGIN}${path}`, init), env, ctx);
  return { d1, env, call };
}

async function registerClient(call, { redirectUris = [REDIRECT], ip = '203.0.113.7' } = {}) {
  const response = await call('/oauth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
    body: JSON.stringify({
      client_name: 'ChatGPT',
      redirect_uris: redirectUris,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code']
    })
  });
  return { response, client: response.status === 201 ? await response.json() : null };
}

async function pkce() {
  const verifier = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: Buffer.from(digest).toString('base64url') };
}

function authorizePath(clientId, challenge, overrides = {}) {
  const query = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: REDIRECT,
    state: 'state-1',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    scope: 'tableu',
    resource: RESOURCE,
    ...overrides
  });
  return `/oauth/authorize?${query}`;
}

function cookieFrom(response, name) {
  return new RegExp(`${name}=([^;]*)`).exec(response.headers.get('set-cookie') || '')?.[1];
}

async function openConsent(call, path, session = 'session-1') {
  const response = await call(path, { headers: { cookie: `session=${session}` } });
  const html = await response.text();
  return {
    response,
    html,
    csrf: /name="csrf" value="([0-9a-f]+)"/.exec(html)?.[1],
    csrfCookie: cookieFrom(response, 'tableu_oauth_csrf')
  };
}

function postDecision(call, path, { decision, csrf, csrfCookie, session = 'session-1', origin = ORIGIN }) {
  const cookie = [`session=${session}`, csrfCookie !== undefined ? `tableu_oauth_csrf=${csrfCookie}` : null]
    .filter(Boolean)
    .join('; ');
  return call(path, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie, ...(origin ? { origin } : {}) },
    body: new URLSearchParams({ decision, ...(csrf ? { csrf } : {}) }).toString()
  });
}

async function exchangeCode(call, { clientId, code, verifier }) {
  const response = await call('/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code', code, redirect_uri: REDIRECT, client_id: clientId, code_verifier: verifier, resource: RESOURCE
    }).toString()
  });
  return response.json();
}

async function linkOwner(call) {
  const { client } = await registerClient(call);
  const { verifier, challenge } = await pkce();
  const path = authorizePath(client.client_id, challenge);
  const consent = await openConsent(call, path);
  const approved = await postDecision(call, path, { decision: 'allow', csrf: consent.csrf, csrfCookie: consent.csrfCookie });
  const location = new URL(approved.headers.get('location'));
  const token = await exchangeCode(call, { clientId: client.client_id, code: location.searchParams.get('code'), verifier });
  return { client, approved, location, token };
}

function mcp(call, token, message = { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }) {
  return call('/mcp', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(message)
  });
}

describe('OAuth discovery and routing', () => {
  it('serves discovery documents for the pinned resource', async () => {
    const { call } = await setup();
    const resource = await (await call('/.well-known/oauth-protected-resource/mcp')).json();
    assert.equal(resource.resource, RESOURCE);
    assert.deepEqual(resource.scopes_supported, ['tableu']);

    const server = await (await call('/.well-known/oauth-authorization-server')).json();
    assert.equal(server.registration_endpoint, `${ORIGIN}/oauth/register`);
    assert.ok(server.code_challenge_methods_supported.includes('S256'));
  });

  it('routes only MCP and OAuth paths to the provider', () => {
    for (const path of ['/mcp', '/mcp/x', '/oauth/token', '/oauth/authorize', '/.well-known/oauth-authorization-server', '/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp']) {
      assert.equal(isMcpOrOAuthPath(path), true, path);
    }
    for (const path of ['/mcpx', '/api/journal', '/', '/oauthx', '/.well-known/security.txt']) {
      assert.equal(isMcpOrOAuthPath(path), false, path);
    }
  });

  it('answers 404 when OAUTH_KV is not bound', async () => {
    const response = await handleMcpOrOAuthRequest(new Request(`${ORIGIN}/mcp`, { method: 'POST' }), { MCP_RESOURCE_URL: RESOURCE }, {});
    assert.equal(response.status, 404);
  });
});

describe('linking the owner', () => {
  it('links the allowlisted owner and serves the tools with the token', async () => {
    const { call } = await setup();
    const { approved, location, token } = await linkOwner(call);

    assert.equal(approved.status, 302);
    assert.equal(`${location.origin}${location.pathname}`, REDIRECT);
    assert.equal(location.searchParams.get('state'), 'state-1');
    assert.equal(location.searchParams.get('iss'), ORIGIN);
    assert.equal(token.scope, 'tableu');

    const listed = await mcp(call, token.access_token);
    assert.equal(listed.status, 200);
    const names = (await listed.json()).result.tools.map((tool) => tool.name).sort();
    assert.deepEqual(names, [
      'add_reflection_to_journal_entry', 'cancel_tarot_reading', 'draw_tarot_reading', 'get_profile',
      'get_tarot_reading_status', 'save_reading_to_journal', 'start_tarot_reading', 'wait_for_tarot_reading'
    ]);

    const profile = await mcp(call, token.access_token, {
      jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'get_profile', arguments: {} }
    });
    assert.equal((await profile.json()).result.structuredContent.id, await profileIdFor('user-1'));
  });

  it('asks a signed-out visitor to sign in first', async () => {
    const { call } = await setup();
    const { client } = await registerClient(call);
    const { challenge } = await pkce();
    const response = await call(authorizePath(client.client_id, challenge));

    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /Sign in to connect ChatGPT/);
    assert.match(html, /name="email"[^>]*autocomplete="username"/);
    assert.match(html, /name="password"[^>]*autocomplete="current-password"/);
    assert.match(html, /href="https:\/\/tarot\.example\/privacy"/);
    assert.match(response.headers.get('set-cookie'), /^tableu_oauth_csrf=[0-9a-f]{64}; HttpOnly; SameSite=Strict/);
    assert.doesNotMatch(response.headers.get('set-cookie'), /session=/);
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.equal(response.headers.get('referrer-policy'), 'same-origin');
    assert.equal(response.headers.get('cache-control'), 'no-store');
  });

  it('refuses an account that is not allowlisted without revealing ids or configuration', async () => {
    const { call } = await setup();
    const { client } = await registerClient(call);
    const { challenge } = await pkce();
    const { response, html } = await openConsent(call, authorizePath(client.client_id, challenge), 'session-2');

    assert.equal(response.status, 403);
    assert.match(html, /isn't able to connect to ChatGPT yet/);
    assert.doesNotMatch(html, /user-2|MCP_ALLOWED_USER_IDS/);
    assert.doesNotMatch(html, /name="decision"/);
  });

  it('refuses everyone when the allowlist is empty', async () => {
    const { call } = await setup({ allowed: '' });
    const { client } = await registerClient(call);
    const { challenge } = await pkce();
    const { response } = await openConsent(call, authorizePath(client.client_id, challenge));
    assert.equal(response.status, 403);
  });

  it('refuses a consent POST with a mismatched CSRF token', async () => {
    const { call } = await setup();
    const { client } = await registerClient(call);
    const { challenge } = await pkce();
    const path = authorizePath(client.client_id, challenge);
    const consent = await openConsent(call, path);

    const response = await postDecision(call, path, { decision: 'allow', csrf: '0'.repeat(64), csrfCookie: consent.csrfCookie });

    assert.equal(response.status, 403);
    assert.equal(response.headers.get('location'), null);
  });

  it('treats an expired CSRF cookie as a fresh start', async () => {
    const { call } = await setup();
    const { client } = await registerClient(call);
    const { challenge } = await pkce();
    const path = authorizePath(client.client_id, challenge);
    const consent = await openConsent(call, path);

    const response = await postDecision(call, path, { decision: 'allow', csrf: consent.csrf, csrfCookie: undefined });

    assert.equal(response.status, 403);
    assert.match(await response.text(), /Start linking again/);
    assert.equal(response.headers.get('location'), null);
  });

  it('refuses a consent POST from another origin', async () => {
    const { call } = await setup();
    const { client } = await registerClient(call);
    const { challenge } = await pkce();
    const path = authorizePath(client.client_id, challenge);
    const consent = await openConsent(call, path);

    const response = await postDecision(call, path, {
      decision: 'allow', csrf: consent.csrf, csrfCookie: consent.csrfCookie, origin: 'https://evil.example'
    });

    assert.equal(response.status, 403);
    assert.equal(response.headers.get('location'), null);
  });

  it('redirects a denial to the registered redirect URI only', async () => {
    const { call } = await setup();
    const { client } = await registerClient(call);
    const { challenge } = await pkce();
    const path = authorizePath(client.client_id, challenge);
    const consent = await openConsent(call, path);

    const response = await postDecision(call, path, { decision: 'deny', csrf: consent.csrf, csrfCookie: consent.csrfCookie });

    assert.equal(response.status, 302);
    const location = new URL(response.headers.get('location'));
    assert.equal(`${location.origin}${location.pathname}`, REDIRECT);
    assert.equal(location.searchParams.get('error'), 'access_denied');
    assert.equal(location.searchParams.get('state'), 'state-1');
  });

  it('shows an error page, not a redirect, for an unregistered redirect URI', async () => {
    const { call } = await setup();
    const { client } = await registerClient(call);
    const { challenge } = await pkce();
    const response = await call(
      authorizePath(client.client_id, challenge, { redirect_uri: 'https://evil.example/cb' }),
      { headers: { cookie: 'session=session-1' } }
    );
    assert.equal(response.status, 400);
    assert.equal(response.headers.get('location'), null);
  });
});

describe('/mcp authorization', () => {
  it('answers 401 with a resource-metadata challenge without a token', async () => {
    const { call } = await setup();
    const response = await mcp(call, null);
    assert.equal(response.status, 401);
    assert.match(
      response.headers.get('www-authenticate'),
      /resource_metadata="https:\/\/tarot\.example\/\.well-known\/oauth-protected-resource\/mcp"/
    );
  });

  it('rejects a token that lacks the tableu scope', async () => {
    const { env, call } = await setup();
    const { client } = await registerClient(call);
    const { verifier, challenge } = await pkce();
    const helpers = getOAuthApi(buildOAuthProviderOptions(env), env);
    const authRequest = await helpers.parseAuthRequest(new Request(`${ORIGIN}${authorizePath(client.client_id, challenge)}`));
    const { redirectTo } = await helpers.completeAuthorization({
      request: authRequest, userId: 'user-1', metadata: {}, scope: [], props: { userId: 'user-1' }
    });
    const token = await exchangeCode(call, {
      clientId: client.client_id, code: new URL(redirectTo).searchParams.get('code'), verifier
    });

    const response = await mcp(call, token.access_token);

    assert.equal(response.status, 403);
    assert.match(response.headers.get('www-authenticate'), /error="insufficient_scope"/);
    assert.match(response.headers.get('www-authenticate'), /scope="tableu"/);
  });

  it('stops honouring tokens once the owner leaves the allowlist', async () => {
    const { env, call } = await setup();
    const { token } = await linkOwner(call);
    env.MCP_ALLOWED_USER_IDS = '';

    const response = await mcp(call, token.access_token);

    assert.equal(response.status, 401);
    assert.match(response.headers.get('www-authenticate'), /error="invalid_token"/);
  });

  it('stops honouring tokens for a deactivated account', async () => {
    const { d1, call } = await setup();
    const { token } = await linkOwner(call);
    d1.rows('UPDATE users SET is_active = 0 WHERE id = ?', ['user-1']);

    const response = await mcp(call, token.access_token);
    assert.equal(response.status, 401);
  });

  it('rejects GET on /mcp', async () => {
    const { call } = await setup();
    const { token } = await linkOwner(call);
    const response = await call('/mcp', {
      method: 'GET', headers: { authorization: `Bearer ${token.access_token}`, accept: 'text/event-stream' }
    });
    assert.equal(response.status, 405);
  });
});

describe('client registration', () => {
  it('stores registered clients without an expiry', async () => {
    const { env, call } = await setup();
    const { response } = await registerClient(call);
    assert.equal(response.status, 201);
    const clientPuts = env.OAUTH_KV.puts.filter(({ key }) => key.startsWith('client:'));
    assert.ok(clientPuts.length > 0);
    assert.ok(clientPuts.every(({ options }) => options?.expirationTtl === undefined));
  });

  it('accepts ChatGPT callback and loopback redirect URIs, and rejects others', async () => {
    const { call } = await setup();
    for (const uri of [REDIRECT, 'https://chatgpt.com/connector/oauth/abc_123', 'http://localhost:6274/oauth/callback', 'http://127.0.0.1:8976/callback']) {
      assert.equal((await registerClient(call, { redirectUris: [uri] })).response.status, 201, uri);
    }
    for (const uri of ['https://evil.example/cb', 'https://chatgpt.com.evil.example/connector_platform_oauth_redirect', 'https://chatgpt.com/other']) {
      const { response } = await registerClient(call, { redirectUris: [uri] });
      assert.equal(response.status, 400, uri);
      assert.equal((await response.json()).error, 'invalid_redirect_uri');
    }
  });

  it('atomically admits exactly ten simultaneous registrations per address', async () => {
    const { d1, call } = await setup();
    const attempts = await Promise.all(Array.from({ length: 20 }, () =>
      registerClient(call, { ip: '198.51.100.1' })));
    assert.equal(attempts.filter(({ response }) => response.status === 201).length, 10);
    assert.equal(attempts.filter(({ response }) => response.status === 429).length, 10);
    assert.deepEqual(d1.rows('SELECT attempts FROM oauth_registration_counters'), [{ attempts: 10 }]);
    const other = await registerClient(call, { ip: '198.51.100.2' });
    assert.equal(other.response.status, 201);
  });

  it('opens a new hourly bucket and removes buckets older than the prior hour', async () => {
    const { d1, env } = await setup();
    const request = new Request(`${ORIGIN}/oauth/register`, {
      headers: { 'cf-connecting-ip': '198.51.100.3' }
    });
    const hourStart = 1_800_000_000_000;
    for (let i = 0; i < 10; i += 1) {
      assert.equal(await enforceRegistrationRateLimit(env, request, { now: hourStart }), null);
    }
    const limited = await enforceRegistrationRateLimit(env, request, { now: hourStart + 1 });
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get('retry-after')) > 0);
    assert.equal(await enforceRegistrationRateLimit(env, request, { now: hourStart + 3_600_000 }), null);
    assert.equal(await enforceRegistrationRateLimit(env, request, { now: hourStart + 7_200_000 }), null);
    assert.deepEqual(d1.rows('SELECT attempts FROM oauth_registration_counters ORDER BY window_start_hour'), [
      { attempts: 1 }, { attempts: 1 }
    ]);
  });

  it('fails closed when D1 is missing or admission fails', async () => {
    const request = new Request(`${ORIGIN}/oauth/register`, {
      headers: { 'cf-connecting-ip': '198.51.100.4' }
    });
    assert.equal((await enforceRegistrationRateLimit({}, request)).status, 503);
    const broken = { DB: { prepare() { throw new Error('D1 unavailable'); }, batch() {} } };
    assert.equal((await enforceRegistrationRateLimit(broken, request)).status, 503);
  });
});


async function setPassword(d1, userId, password) {
  const { hash, salt } = await hashPassword(password);
  await d1.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').bind(hash, salt, userId).run();
}

async function openSignIn(call, path) {
  const response = await call(path);
  const html = await response.text();
  return {
    response,
    html,
    csrf: /name="csrf" value="([0-9a-f]+)"/.exec(html)?.[1],
    csrfCookie: cookieFrom(response, 'tableu_oauth_csrf')
  };
}

function postSignIn(call, path, { email, password, csrf, csrfCookie, origin = ORIGIN, ip = '198.51.100.9' }) {
  return call(path, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      ...(csrfCookie ? { cookie: `tableu_oauth_csrf=${csrfCookie}` } : {}),
      ...(origin ? { origin } : {}),
      'cf-connecting-ip': ip
    },
    body: new URLSearchParams({ intent: 'signin', email, password, ...(csrf ? { csrf } : {}) }).toString()
  });
}

async function authorizeFor(call) {
  const { client } = await registerClient(call);
  const { verifier, challenge } = await pkce();
  return { client, verifier, path: authorizePath(client.client_id, challenge) };
}

describe('public access mode', () => {
  it('links any active personal account when public', async () => {
    const { call } = await setup({ allowed: '', mode: 'public' });
    const { client, verifier, path } = await authorizeFor(call);
    const consent = await openConsent(call, path, 'session-2');
    assert.equal(consent.response.status, 200);
    assert.match(consent.html, /@guest/);

    const approved = await postDecision(call, path, { decision: 'allow', csrf: consent.csrf, csrfCookie: consent.csrfCookie, session: 'session-2' });
    const code = new URL(approved.headers.get('location')).searchParams.get('code');
    const token = await exchangeCode(call, { clientId: client.client_id, code, verifier });
    const listed = await mcp(call, token.access_token);
    assert.equal(listed.status, 200);
  });

  it('turns everything off, including existing tokens, when the mode is off', async () => {
    const { call, env } = await setup({ mode: 'public' });
    const { token } = await linkOwner(call);
    env.MCP_ACCESS_MODE = 'off';

    assert.equal((await mcp(call, token.access_token)).status, 401);
    const { path } = await authorizeFor(call);
    const { response, html } = await openConsent(call, path);
    assert.equal(response.status, 403);
    assert.match(html, /Connecting is paused/);
  });

  it('shows the paused page before any sign-in when the mode is off', async () => {
    const { call, env, d1 } = await setup({ mode: 'public' });
    await setPassword(d1, 'user-1', 'correct horse battery');
    const { path } = await authorizeFor(call);
    env.MCP_ACCESS_MODE = 'off';

    const opened = await call(path);
    const html = await opened.text();
    assert.equal(opened.status, 403);
    assert.match(html, /Connecting is paused/);
    assert.doesNotMatch(html, /name="password"/, 'no password is asked for');

    const posted = await postSignIn(call, path, {
      email: 'user.1@example.com', password: 'correct horse battery', csrf: 'token', csrfCookie: 'token'
    });
    assert.equal(posted.status, 403);
    assert.equal(cookieFrom(posted, 'session'), undefined, 'the password is not checked and no session starts');
  });

  it('fails closed on an unrecognized mode', async () => {
    const { call } = await setup({ mode: 'pubic' });
    const { path } = await authorizeFor(call);
    const { response } = await openConsent(call, path);
    assert.equal(response.status, 403);
  });
});

describe('signing in on the connection page', () => {
  it('signs in with email and password, then shows the consent page', async () => {
    const { call, d1 } = await setup();
    await setPassword(d1, 'user-1', 'correct horse battery');
    const { path } = await authorizeFor(call);
    const form = await openSignIn(call, path);

    const signedIn = await postSignIn(call, path, {
      email: 'User.1@example.com', password: 'correct horse battery', csrf: form.csrf, csrfCookie: form.csrfCookie
    });
    assert.equal(signedIn.status, 303);
    assert.equal(signedIn.headers.get('location'), `${ORIGIN}${path}`);
    const session = cookieFrom(signedIn, 'session');
    assert.ok(session, 'a session cookie is set');
    assert.match(signedIn.headers.get('set-cookie'), /tableu_oauth_csrf=;/, 'the sign-in CSRF cookie is cleared');

    const consent = await call(path, { headers: { cookie: `session=${session}` } });
    assert.equal(consent.status, 200);
    assert.match(await consent.text(), /Connect ChatGPT to Tableu/);
  });

  it('shows an error for a wrong password, then rate limits repeated failures', async () => {
    const { call, d1 } = await setup();
    await setPassword(d1, 'user-1', 'correct horse battery');
    const { path } = await authorizeFor(call);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const form = await openSignIn(call, path);
      const failed = await postSignIn(call, path, { email: 'user.1@example.com', password: 'wrong', csrf: form.csrf, csrfCookie: form.csrfCookie });
      assert.equal(failed.status, 401);
      const html = await failed.text();
      assert.match(html, /don&#39;t match a Tableu account/);
      assert.match(html, /value="user\.1@example\.com"/, 'the email is kept');
      assert.equal(cookieFrom(failed, 'session'), undefined);
    }
    const form = await openSignIn(call, path);
    const limited = await postSignIn(call, path, { email: 'user.1@example.com', password: 'correct horse battery', csrf: form.csrf, csrfCookie: form.csrfCookie });
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get('retry-after')) > 0);
    assert.equal(cookieFrom(limited, 'session'), undefined);
  });

  it('refuses a sign-in without the CSRF cookie or from another origin', async () => {
    const { call, d1 } = await setup();
    await setPassword(d1, 'user-1', 'correct horse battery');
    const { path } = await authorizeFor(call);
    const form = await openSignIn(call, path);

    const noCookie = await postSignIn(call, path, { email: 'user.1@example.com', password: 'correct horse battery', csrf: form.csrf });
    const foreign = await postSignIn(call, path, {
      email: 'user.1@example.com', password: 'correct horse battery', csrf: form.csrf, csrfCookie: form.csrfCookie, origin: 'https://evil.example'
    });
    for (const response of [noCookie, foreign]) {
      assert.equal(response.status, 403);
      assert.equal(cookieFrom(response, 'session'), undefined);
    }
  });
});
