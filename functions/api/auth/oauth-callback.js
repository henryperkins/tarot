import { jsonResponse } from '../../lib/utils.js';
import { createSession, createSessionCookie, isSecureRequest } from '../../lib/auth.js';
import { resolveAppUrl, sanitizeRedirectUrl } from '../../lib/urlSafety.js';

const USERNAME_CLAIM_CANDIDATES = ['preferred_username', 'nickname', 'email', 'name'];
const OAUTH_STATE_COOKIE = 'oauth_state';
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

async function fetchUserInfo(request, env, token) {
  const userInfoUrl = typeof env?.AUTH0_USERINFO_URL === 'string' ? env.AUTH0_USERINFO_URL.trim() : '';
  if (!userInfoUrl) {
    throw new Error('Auth0 userinfo endpoint not configured');
  }

  const response = await fetch(userInfoUrl, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || 'Failed to fetch user info');
  }

  return response.json();
}

function decodeState(value) {
  if (!value) return null;
  try {
    if (typeof atob === 'function') {
      return JSON.parse(atob(value));
    }
    return JSON.parse(Buffer.from(value, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function getCookieValue(cookieHeader, name) {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').map((cookie) => cookie.trim());
  const target = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  if (!target) return null;
  return target.split('=').slice(1).join('=');
}

async function exchangeCodeForTokens(request, env, code) {
  const baseUrl = typeof env?.AUTH0_DOMAIN === 'string' ? env.AUTH0_DOMAIN.trim() : '';
  const clientId = typeof env?.AUTH0_CLIENT_ID === 'string' ? env.AUTH0_CLIENT_ID.trim() : '';
  const clientSecret = typeof env?.AUTH0_CLIENT_SECRET === 'string' ? env.AUTH0_CLIENT_SECRET.trim() : '';

  if (!baseUrl || !clientId || !clientSecret) {
    throw new Error('Auth0 token exchange not configured');
  }

  const tokenUrl = `${baseUrl.replace(/\/$/, '')}/oauth/token`;
  const redirectUri = `${resolveAppUrl(env).replace(/\/$/, '')}/auth/callback`;
  const payload = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: payload.toString()
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || 'Failed to exchange OAuth code');
  }

  return response.json();
}

function normalizeProviderSubject(profile) {
  const sub = typeof profile?.sub === 'string' ? profile.sub.trim() : '';
  if (!sub) return { provider: null, subject: null };

  if (sub.startsWith('google-oauth2|')) {
    return { provider: 'google', subject: sub.slice('google-oauth2|'.length) };
  }

  if (sub.startsWith('apple|')) {
    return { provider: 'apple', subject: sub.slice('apple|'.length) };
  }

  if (sub.includes('|')) {
    const [provider, subject] = sub.split('|');
    return { provider: provider || 'auth0', subject: subject || sub };
  }

  return { provider: 'auth0', subject: sub };
}

function pickUsername(profile) {
  for (const key of USERNAME_CLAIM_CANDIDATES) {
    const value = typeof profile?.[key] === 'string' ? profile[key].trim() : '';
    if (value) {
      if (key === 'email') {
        return value.split('@')[0];
      }
      return value;
    }
  }
  return 'Seeker';
}

function sanitizeUsername(candidate) {
  const normalized = candidate.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_]/g, '');
  if (normalized.length >= 3) {
    return normalized.slice(0, 30);
  }
  const fallback = `user_${Math.random().toString(36).slice(2, 10)}`;
  return fallback.slice(0, 30);
}

async function generateUniqueUsername(db, base) {
  const candidate = sanitizeUsername(base);
  const baseStem = candidate.slice(0, 24);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = attempt === 0 ? '' : `_${Math.random().toString(36).slice(2, 6)}`;
    const next = (baseStem + suffix).slice(0, 30);
    const existing = await db.prepare('SELECT id FROM users WHERE username = ?')
      .bind(next)
      .first();
    if (!existing) return next;
  }

  return `${baseStem}_${crypto.randomUUID().slice(0, 6)}`.slice(0, 30);
}

async function findExistingUser(env, provider, subject, email) {
  if (provider && subject) {
    const bySubject = await env.DB.prepare(`
      SELECT id, email, username, auth_provider, auth_subject, full_name, avatar_url,
             subscription_tier, subscription_status, subscription_provider, stripe_customer_id
      FROM users
      WHERE auth_provider = ? AND auth_subject = ?
    `)
      .bind(provider, subject)
      .first();
    if (bySubject) return { user: bySubject, match: 'subject' };
  }

  if (email) {
    const byEmail = await env.DB.prepare(`
      SELECT id, email, username, auth_provider, auth_subject, full_name, avatar_url,
             subscription_tier, subscription_status, subscription_provider, stripe_customer_id
      FROM users
      WHERE email = ?
    `)
      .bind(email)
      .first();
    if (byEmail) return { user: byEmail, match: 'email' };
  }

  return { user: null, match: null };
}

async function upsertUser(env, profile) {
  const email = typeof profile?.email === 'string' ? profile.email.trim().toLowerCase() : '';
  const name = typeof profile?.name === 'string' ? profile.name.trim() : '';
  const picture = typeof profile?.picture === 'string' ? profile.picture.trim() : '';
  const emailVerified = Boolean(profile?.email_verified);
  const { provider, subject } = normalizeProviderSubject(profile);

  if (!provider || !subject) {
    throw new Error('Provider identity missing');
  }

  const { user: existing, match } = await findExistingUser(env, provider, subject, email);
  const now = Math.floor(Date.now() / 1000);

  if (existing) {
    const existingProvider = existing.auth_provider || null;
    if (match === 'email') {
      if (existingProvider && existingProvider !== 'session' && existingProvider !== provider) {
        throw new Error('Account already linked to another provider');
      }
      if (!emailVerified) {
        throw new Error('Email not verified with provider');
      }
    }

    await env.DB.prepare(`
      UPDATE users
      SET
        auth_provider = ?,
        auth_subject = ?,
        full_name = COALESCE(NULLIF(?, ''), full_name),
        avatar_url = COALESCE(NULLIF(?, ''), avatar_url),
        email_verified = 1,
        updated_at = ?
      WHERE id = ?
    `)
      .bind(provider, subject, name, picture, now, existing.id)
      .run();

    return {
      id: existing.id,
      email: existing.email,
      username: existing.username,
      subscription_tier: existing.subscription_tier || 'free',
      subscription_status: existing.subscription_status || 'inactive',
      subscription_provider: existing.subscription_provider || null,
      stripe_customer_id: existing.stripe_customer_id || null,
      email_verified: true,
      auth_provider: provider || null,
      full_name: name || existing.full_name || null,
      avatar_url: picture || existing.avatar_url || null
    };
  }

  if (!email) {
    throw new Error('Email not available from provider');
  }

  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const username = await generateUniqueUsername(env.DB, pickUsername(profile));
    const userId = crypto.randomUUID();
    try {
      await env.DB.prepare(`
        INSERT INTO users (
          id,
          email,
          username,
          password_hash,
          password_salt,
          created_at,
          updated_at,
          is_active,
          email_verified,
          auth_provider,
          auth_subject,
          full_name,
          avatar_url
        ) VALUES (?, ?, ?, '', '', ?, ?, 1, 1, ?, ?, ?, ?)
      `)
        .bind(userId, email, username, now, now, provider, subject, name, picture)
        .run();

      return {
        id: userId,
        email,
        username,
        subscription_tier: 'free',
        subscription_status: 'inactive',
        subscription_provider: null,
        stripe_customer_id: null,
        email_verified: true,
        auth_provider: provider || null,
        full_name: name || null,
        avatar_url: picture || null
      };
    } catch (error) {
      lastError = error;
      const message = String(error?.message || '');
      if (message.includes('UNIQUE') && (message.includes('users.email') || message.includes('users_email'))) {
        const { user: conflicted } = await findExistingUser(env, provider, subject, email);
        if (conflicted) {
          return {
            id: conflicted.id,
            email: conflicted.email,
            username: conflicted.username,
            subscription_tier: conflicted.subscription_tier || 'free',
            subscription_status: conflicted.subscription_status || 'inactive',
            subscription_provider: conflicted.subscription_provider || null,
            stripe_customer_id: conflicted.stripe_customer_id || null,
            email_verified: true,
            auth_provider: provider || null,
            full_name: name || conflicted.full_name || null,
            avatar_url: picture || conflicted.avatar_url || null
          };
        }
      }
      if (!message.includes('UNIQUE') || !message.includes('users.username')) {
        throw error;
      }
    }
  }

  throw lastError || new Error('Unable to create user');
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const requestId = crypto.randomUUID();

  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const cookieHeader = request.headers.get('Cookie');
    const expectedState = getCookieValue(cookieHeader, OAUTH_STATE_COOKIE);
    const decodedState = decodeState(state);
    const redirectTo = decodedState?.returnUrl || '';

    if (!code || !state || !decodedState?.id) {
      return jsonResponse({ error: 'Missing OAuth response' }, { status: 400 });
    }

    if (!expectedState || expectedState !== decodedState.id) {
      return jsonResponse({ error: 'Invalid OAuth state' }, { status: 400 });
    }

    const stateAge = Date.now() - (decodedState.ts || 0);
    if (!decodedState.ts || stateAge > OAUTH_STATE_TTL_MS) {
      return jsonResponse({ error: 'OAuth state expired' }, { status: 400 });
    }

    const tokenPayload = await exchangeCodeForTokens(request, env, code);
    const accessToken = typeof tokenPayload?.access_token === 'string' ? tokenPayload.access_token.trim() : '';
    if (!accessToken) {
      return jsonResponse({ error: 'OAuth token exchange failed' }, { status: 400 });
    }

    const profile = await fetchUserInfo(request, env, accessToken);
    const user = await upsertUser(env, profile);

    const metadata = {
      userAgent: request.headers.get('User-Agent'),
      ipAddress: request.headers.get('CF-Connecting-IP')
    };

    const { token: sessionToken, expiresAt } = await createSession(env.DB, user.id, metadata);
    const cookie = createSessionCookie(sessionToken, expiresAt, { secure: isSecureRequest(request) });
    const returnUrl = sanitizeRedirectUrl(redirectTo, request, env, '/account');
    const clearStateCookie = `${OAUTH_STATE_COOKIE}=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/`;

    const headers = new Headers({
      'Content-Type': 'application/json'
    });
    headers.append('Set-Cookie', cookie);
    headers.append('Set-Cookie', clearStateCookie);

    return new Response(JSON.stringify({ success: true, redirectTo: returnUrl, user }), {
      status: 200,
      headers
    });
  } catch (error) {
    const message = String(error?.message || '');
    if (message.includes('no such table')) {
      return jsonResponse(
        {
          error: 'Database not initialized',
          code: 'db_not_initialized',
          hint: 'Run `npm run migrations:apply:local` (or apply D1 migrations)'
        },
        { status: 503 }
      );
    }

    console.error(`[${requestId}] [auth] OAuth callback error:`, error);
    return jsonResponse({ error: 'OAuth login failed' }, { status: 500 });
  }
}
