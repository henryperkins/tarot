/**
 * Middleware for Authentication and Rate Limiting
 */

import { validateSession, getSessionFromCookie } from './auth.js';
import { validateApiKey } from './apiKeys.js';
import { checkRateLimit, getRateLimitHeaders } from './rateLimit.js';

/**
 * Identify the requester (User, API Key, or Guest)
 * @param {Request} request
 * @param {object} env
 * @returns {Promise<{user: object|null, apiKey: object|null, ip: string, type: 'user'|'api'|'guest'}>}
 */
export async function identifyRequester(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  // 1. Check API Key (Authorization: Bearer sk_...)
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer sk_')) {
    const key = authHeader.split(' ')[1];
    const apiKeyRecord = await validateApiKey(env.DB, key);
    if (apiKeyRecord) {
      return {
        user: { id: apiKeyRecord.user_id, email: apiKeyRecord.email, username: apiKeyRecord.username },
        apiKey: apiKeyRecord,
        ip,
        type: 'api'
      };
    }
    // If API key provided but invalid, we might want to throw or treat as guest?
    // Usually invalid credentials should fail.
    // For now, we'll return null user to let downstream handle it, or maybe throw.
    // But to be safe, if an explicit attempt to auth fails, we should probably reject.
    // However, for this helper, we just identify.
  }

  // 2. Check Session Cookie
  const cookieHeader = request.headers.get('Cookie');
  const token = getSessionFromCookie(cookieHeader);
  if (token) {
    const user = await validateSession(env.DB, token);
    if (user) {
      return {
        user,
        apiKey: null,
        ip,
        type: 'user'
      };
    }
  }

  // 3. Guest
  return {
    user: null,
    apiKey: null,
    ip,
    type: 'guest'
  };
}

/**
 * Enforce Rate Limiting based on requester type
 * @param {Request} request
 * @param {object} env
 * @param {string} action - e.g., 'reading', 'tts'
 * @returns {Promise<Response|null>} Returns Response if blocked, null if allowed
 */
export async function enforceRateLimit(request, env, action = 'general') {
  const requester = await identifyRequester(request, env);
  
  let limit = 20; // Default guest limit
  let identifier = requester.ip;
  let type = 'guest';

  if (requester.type === 'api') {
    limit = 1000; // Higher limit for API keys
    identifier = requester.apiKey.id;
    type = 'api';
  } else if (requester.type === 'user') {
    limit = 100; // Higher limit for logged-in users
    identifier = requester.user.id;
    type = 'user';
  }

  const result = await checkRateLimit(env.RATELIMIT, identifier, `${action}:${type}`, limit);

  if (!result.success) {
    return new Response(
      JSON.stringify({ error: 'Too many requests' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...getRateLimitHeaders(result)
        }
      }
    );
  }
  
  // Attach requester info to request for downstream use (if mutable, else we need another way)
  // Cloudflare Pages Functions don't pass state easily besides request/env.
  // We can return the requester info.
  return null;
}
