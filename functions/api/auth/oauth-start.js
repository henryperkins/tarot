import { jsonResponse } from '../../lib/utils.js';
import { resolveAppUrl, sanitizeRedirectUrl } from '../../lib/urlSafety.js';
import { isSecureRequest } from '../../lib/auth.js';

const OAUTH_STATE_COOKIE = 'oauth_state';
const OAUTH_STATE_TTL_SECONDS = 10 * 60;

function encodeState(payload) {
  const json = JSON.stringify(payload);
  if (typeof btoa === 'function') {
    return btoa(json);
  }
  return Buffer.from(json, 'utf8').toString('base64');
}

function createStateCookie(value, { secure = true } = {}) {
  const parts = [
    `${OAUTH_STATE_COOKIE}=${value}`,
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${OAUTH_STATE_TTL_SECONDS}`,
    'Path=/'
  ];

  if (secure) {
    parts.splice(3, 0, 'Secure');
  }

  return parts.join('; ');
}

function buildAuthorizeUrl(env, redirectUri, state, nonce, connection) {
  const baseUrl = typeof env?.AUTH0_DOMAIN === 'string' ? env.AUTH0_DOMAIN.trim() : '';
  const clientId = typeof env?.AUTH0_CLIENT_ID === 'string' ? env.AUTH0_CLIENT_ID.trim() : '';
  const audience = typeof env?.AUTH0_AUDIENCE === 'string' ? env.AUTH0_AUDIENCE.trim() : '';

  if (!baseUrl || !clientId) {
    throw new Error('Auth0 is not configured');
  }

  const authUrl = new URL(`${baseUrl.replace(/\/$/, '')}/authorize`);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_mode', 'query');
  authUrl.searchParams.set('scope', 'openid profile email');
  authUrl.searchParams.set('prompt', 'login');
  if (connection) {
    authUrl.searchParams.set('connection', connection);
  }
  authUrl.searchParams.set('state', state);
  if (nonce) {
    authUrl.searchParams.set('nonce', nonce);
  }
  if (audience) {
    authUrl.searchParams.set('audience', audience);
  }

  return authUrl.toString();
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const requestId = crypto.randomUUID();

  try {
    const body = await request.json().catch(() => ({}));
    const redirectTo = typeof body?.redirectTo === 'string' ? body.redirectTo.trim() : '';
    const connection = typeof body?.connection === 'string' ? body.connection.trim() : '';
    if (connection && !/^[a-z0-9._-]+$/i.test(connection)) {
      return jsonResponse({ error: 'Invalid connection' }, { status: 400 });
    }
    const returnUrl = sanitizeRedirectUrl(redirectTo, request, env, '/account');

    const appUrl = resolveAppUrl(env).replace(/\/$/, '');
    const redirectUri = `${appUrl}/auth/callback`;
    const stateId = crypto.randomUUID();
    const nonce = crypto.randomUUID();
    const statePayload = {
      id: stateId,
      returnUrl,
      ts: Date.now(),
      nonce
    };
    const state = encodeState(statePayload);

    const authorizeUrl = buildAuthorizeUrl(env, redirectUri, state, nonce, connection);
    const stateCookie = createStateCookie(stateId, { secure: isSecureRequest(request) });

    return jsonResponse(
      { authorizeUrl },
      {
        status: 200,
        headers: {
          'Set-Cookie': stateCookie
        }
      }
    );
  } catch (error) {
    console.error(`[${requestId}] [auth] OAuth start error:`, error);
    return jsonResponse({ error: 'OAuth start failed' }, { status: 500 });
  }
}
