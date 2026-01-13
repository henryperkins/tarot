/**
 * Journal Entry Operations by ID
 * DELETE /api/journal/[id] - Delete a specific journal entry
 */

import {
  validateSession,
  getSessionFromCookie
} from '../../lib/auth.js';
import { buildTierLimitedPayload, isEntitled } from '../../lib/entitlements.js';

/**
 * DELETE /api/journal/[id]
 * Delete a specific journal entry (with ownership verification)
 */
export async function onRequestDelete(context) {
  const { request, env, params } = context;
  const requestId = crypto.randomUUID();

  try {
    // Authenticate user
    const cookieHeader = request.headers.get('Cookie');
    const token = getSessionFromCookie(cookieHeader);
    const user = await validateSession(env.DB, token);

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
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

    const entryId = params.id;

    if (!entryId) {
      return new Response(
        JSON.stringify({ error: 'Entry ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify ownership before deleting
    const entry = await env.DB.prepare(
      'SELECT user_id FROM journal_entries WHERE id = ?'
    )
      .bind(entryId)
      .first();

    if (!entry) {
      return new Response(
        JSON.stringify({ error: 'Entry not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (entry.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized to delete this entry' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Delete the entry
    await env.DB.prepare('DELETE FROM journal_entries WHERE id = ?')
      .bind(entryId)
      .run();

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error(`[${requestId}] [journal] Delete entry error:`, error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
