/**
 * API Key Management - List and Create
 * /api/keys
 */

import { validateSession, getSessionFromCookie } from '../../lib/auth.js';
import { generateApiKey, hashApiKey } from '../../lib/apiKeys.js';
import { buildTierLimitedPayload, isEntitled } from '../../lib/entitlements.js';

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    // Auth check
    const cookieHeader = request.headers.get('Cookie');
    const token = getSessionFromCookie(cookieHeader);
    const user = await validateSession(env.DB, token);

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    // Pro tier check - API key management requires Pro entitlements
    if (!isEntitled(user, 'pro')) {
      return new Response(
        JSON.stringify(
          buildTierLimitedPayload({
            message: 'API key management requires an active Pro subscription',
            user,
            requiredTier: 'pro'
          })
        ),
        { status: 403 }
      );
    }

    // List keys
    const keys = await env.DB.prepare(`
      SELECT id, name, key_prefix, created_at, last_used_at, is_active
      FROM api_keys
      WHERE user_id = ?
      ORDER BY created_at DESC
    `)
    .bind(user.id)
    .all();

    return new Response(JSON.stringify({ keys: keys.results }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // Auth check
    const cookieHeader = request.headers.get('Cookie');
    const token = getSessionFromCookie(cookieHeader);
    const user = await validateSession(env.DB, token);

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    // Pro tier check - API key creation requires Pro entitlements
    if (!isEntitled(user, 'pro')) {
      return new Response(
        JSON.stringify(
          buildTierLimitedPayload({
            message: 'API key creation requires an active Pro subscription',
            user,
            requiredTier: 'pro'
          })
        ),
        { status: 403 }
      );
    }

    // Accept empty or invalid JSON bodies so callers can omit payloads.
    let parsedBody = null;
    try {
      parsedBody = await request.json();
    } catch {
      parsedBody = null;
    }

    const providedName = typeof parsedBody?.name === 'string' ? parsedBody.name.trim() : '';
    const name = providedName || 'Untitled Key';

    // Generate key
    const rawKey = generateApiKey();
    const keyHash = await hashApiKey(rawKey);
    const keyPrefix = rawKey.substring(0, 10); // sk_ + 7 chars
    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    // Store
    await env.DB.prepare(`
      INSERT INTO api_keys (id, user_id, key_hash, key_prefix, name, created_at, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `)
    .bind(id, user.id, keyHash, keyPrefix, name, now)
    .run();

    // Return raw key ONLY ONCE
    return new Response(JSON.stringify({
      success: true,
      apiKey: {
        id,
        name,
        prefix: keyPrefix,
        key: rawKey, // The secret key
        createdAt: now
      }
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 201
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
