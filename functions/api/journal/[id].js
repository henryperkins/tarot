/**
 * Journal Entry Operations by ID
 * GET /api/journal/[id] - Fetch a specific journal entry
 * DELETE /api/journal/[id] - Delete a specific journal entry
 */

import {
  validateSession,
  getSessionFromCookie
} from '../../lib/auth.js';
import { buildTierLimitedPayload, isEntitled } from '../../lib/entitlements.js';
import { safeJsonParse } from '../../lib/utils.js';
import { deleteFollowUpsByEntry, loadFollowUpsByEntry } from '../../lib/journalFollowups.js';

function isMissingColumnError(err) {
  const message = String(err?.message || err || '');
  return message.toLowerCase().includes('no such column');
}

/**
 * GET /api/journal/[id]
 * Fetch a specific journal entry (with ownership verification)
 */
export async function onRequestGet(context) {
  const { request, env, params } = context;
  const requestId = crypto.randomUUID();

  try {
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

    const url = new URL(request.url);
    const includeFollowups = url.searchParams.get('includeFollowups') === 'true';

    const baseSelect = `
      SELECT
        id,
        user_id,
        created_at,
        spread_key,
        spread_name,
        question,
        cards_json,
        narrative,
        themes_json,
        reflections_json,
        context,
        provider,
        session_seed,
        user_preferences_json,
        deck_id,
        request_id,
        extracted_steps,
        step_embeddings,
        extraction_version,
        location_latitude,
        location_longitude,
        location_timezone,
        location_consent
      FROM journal_entries
      WHERE user_id = ? AND id = ?
      LIMIT 1
    `;

    const legacySelect = `
      SELECT
        id,
        user_id,
        created_at,
        spread_key,
        spread_name,
        question,
        cards_json,
        narrative,
        themes_json,
        reflections_json,
        context,
        provider,
        session_seed,
        user_preferences_json,
        deck_id,
        request_id
      FROM journal_entries
      WHERE user_id = ? AND id = ?
      LIMIT 1
    `;

    let entry;
    let hasCoachColumns = true;
    try {
      entry = await env.DB.prepare(baseSelect).bind(user.id, entryId).first();
    } catch (err) {
      if (!isMissingColumnError(err)) {
        throw err;
      }
      hasCoachColumns = false;
      entry = await env.DB.prepare(legacySelect).bind(user.id, entryId).first();
    }

    if (!entry) {
      return new Response(
        JSON.stringify({ error: 'Entry not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (entry.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized to access this entry' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const hasLocation = entry.location_consent === 1 &&
      entry.location_latitude != null &&
      entry.location_longitude != null;
    const location = hasLocation ? {
      latitude: entry.location_latitude,
      longitude: entry.location_longitude,
      timezone: entry.location_timezone || null
    } : null;

    const parsedEntry = {
      id: entry.id,
      ts: entry.created_at * 1000,
      spread: entry.spread_name,
      spreadKey: entry.spread_key,
      question: entry.question,
      cards: safeJsonParse(entry.cards_json, []),
      personalReading: entry.narrative,
      themes: entry.themes_json ? safeJsonParse(entry.themes_json, null) : null,
      reflections: entry.reflections_json ? safeJsonParse(entry.reflections_json, {}) : {},
      context: entry.context,
      provider: entry.provider,
      sessionSeed: entry.session_seed,
      userPreferences: entry.user_preferences_json ? safeJsonParse(entry.user_preferences_json, null) : null,
      deckId: entry.deck_id,
      requestId: entry.request_id,
      extractedSteps: entry.extracted_steps ? safeJsonParse(entry.extracted_steps, null) : null,
      stepEmbeddings: hasCoachColumns && entry.step_embeddings
        ? safeJsonParse(entry.step_embeddings, null)
        : null,
      extractionVersion: entry.extraction_version || null,
      location
    };

    if (includeFollowups) {
      const followupMap = await loadFollowUpsByEntry(env.DB, user.id, [entry.id]);
      const followUps = followupMap.get(entry.id);
      if (followUps?.length) {
        parsedEntry.followUps = followUps;
      }
    }

    return new Response(
      JSON.stringify({ entry: parsedEntry }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error(`[${requestId}] [journal] Get entry error:`, error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

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

    // Clean up follow-up turns before removing the entry to avoid orphans
    try {
      await deleteFollowUpsByEntry(env.DB, user.id, entryId);
    } catch (cleanupError) {
      console.warn(
        `[${requestId}] [journal] Failed to delete follow-ups for entry ${entryId}:`,
        cleanupError?.message || cleanupError
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
