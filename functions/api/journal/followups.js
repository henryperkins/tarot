import {
  validateSession,
  getSessionFromCookie
} from '../../lib/auth.js';
import { buildTierLimitedPayload, isEntitled } from '../../lib/entitlements.js';
import { insertFollowUps, sanitizeFollowUps } from '../../lib/journalFollowups.js';

export async function onRequestPost(context) {
  const { request, env, params } = context;

  try {
    const cookieHeader = request.headers.get('Cookie');
    const token = getSessionFromCookie(cookieHeader);
    const user = await validateSession(env.DB, token);

    if (!user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!isEntitled(user, 'plus')) {
      return new Response(
        JSON.stringify(
          buildTierLimitedPayload({
            message: 'Cloud journal sync requires an active Plus or Pro subscription',
            user,
            requiredTier: 'plus'
          })
        ),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const entryId = params?.id;
    if (!entryId) {
      return new Response(JSON.stringify({ error: 'Entry ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json().catch(() => null);
    const rawFollowUps = Array.isArray(body) ? body : body?.followUps;
    const sanitizedFollowUps = sanitizeFollowUps(rawFollowUps);
    if (!sanitizedFollowUps.length) {
      return new Response(JSON.stringify({ error: 'No follow-ups provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify entry ownership + fetch reading_request_id for linkage
    const entry = await env.DB.prepare(
      'SELECT id, user_id, request_id FROM journal_entries WHERE id = ?'
    ).bind(entryId).first();

    if (!entry) {
      return new Response(JSON.stringify({ error: 'Entry not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (entry.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized to modify this entry' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const requestId = body?.requestId || null;
    const readingRequestId = body?.readingRequestId || entry.request_id || null;

    const result = await insertFollowUps(env.DB, user.id, entryId, sanitizedFollowUps, {
      readingRequestId,
      requestId
    });

    return new Response(JSON.stringify({ success: true, inserted: result.inserted }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Append journal follow-ups error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
