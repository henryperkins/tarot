/**
 * Journal API Endpoints
 * GET /api/journal - List all journal entries for authenticated user
 * POST /api/journal - Save a new journal entry
 */

import { getUserFromRequest } from '../lib/auth.js';
import { journalAccessDenied } from '../lib/journalAccess.js';
import { dedupeEntries } from '../../shared/journal/dedupe.js';
import { safeJsonParse } from '../lib/utils.js';
import { loadFollowUpsByEntry } from '../lib/journalFollowups.js';
import { saveAppJournalEntry } from '../lib/journalEntries.js';

function isMissingColumnError(err) {
  const message = String(err?.message || err || '');
  return message.toLowerCase().includes('no such column');
}

/**
 * GET /api/journal
 * Returns journal entries for the authenticated user with optional pagination
 *
 * Query params:
 *   - limit: Max entries to return (default: 100, max: 500)
 *   - offset: Number of entries to skip (default: 0)
 *   - cursor: Optional timestamp (ms) to fetch entries created before this time (descending)
 *   - all: If "true", returns all entries (for backward compatibility)
 *   - includeFollowups: If "true", include saved follow-up conversations
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const requestId = crypto.randomUUID();

  try {
    // Authenticate user
    const user = await getUserFromRequest(request, env);

    const denied = journalAccessDenied(user);
    if (denied) return denied;

    // Parse pagination params
    const url = new URL(request.url);
    const allParam = url.searchParams.get('all');
    const fetchAll = allParam === 'true' || allParam === '1';
    const includeFollowups = url.searchParams.get('includeFollowups') === 'true';
    const cursorParam = url.searchParams.get('cursor');
    const cursorMs = cursorParam ? Number(cursorParam) : null;
    const cursorSeconds = Number.isFinite(cursorMs) ? Math.floor(cursorMs / 1000) : null;

    // Default limit: 100, max: 500 (unless fetching all)
    const DEFAULT_LIMIT = 100;
    const MAX_LIMIT = 500;
    let limit = parseInt(url.searchParams.get('limit') || String(DEFAULT_LIMIT), 10);
    if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT;
    if (limit > MAX_LIMIT && !fetchAll) limit = MAX_LIMIT;

    let offset = parseInt(url.searchParams.get('offset') || '0', 10);
    if (!Number.isFinite(offset) || offset < 0) offset = 0;

    // Get total count for pagination info
    const countResult = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM journal_entries WHERE user_id = ?`
    ).bind(user.id).first();
    const total = countResult?.total || 0;

    // Limit embedding data to recent entries to reduce response size.
    // IMPORTANT: don't select step_embeddings for every row; fetch it only for the newest entries.
    const MAX_ENTRIES_WITH_EMBEDDINGS = 10;

    // Base query (exclude step_embeddings; it is large).
    const baseSelect = `
      SELECT
        id,
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
        extraction_version,
        location_latitude,
        location_longitude,
        location_timezone,
        location_consent
      FROM journal_entries
      WHERE user_id = ?
      ${cursorSeconds ? 'AND created_at < ?' : ''}
      ORDER BY created_at DESC
    `;

    // Legacy base query for pre-migration databases.
    const legacyBaseSelect = `
      SELECT
        id,
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
      WHERE user_id = ?
      ${cursorSeconds ? 'AND created_at < ?' : ''}
      ORDER BY created_at DESC
    `;

    let entries;
    let hasCoachColumns = true;
    const selectParams = cursorSeconds ? [user.id, cursorSeconds] : [user.id];
    try {
      if (fetchAll) {
        entries = await env.DB.prepare(baseSelect).bind(...selectParams).all();
      } else {
        if (cursorSeconds) {
          entries = await env.DB.prepare(`${baseSelect} LIMIT ?`).bind(...selectParams, limit).all();
        } else {
          entries = await env.DB.prepare(`${baseSelect} LIMIT ? OFFSET ?`).bind(user.id, limit, offset).all();
        }
      }
    } catch (err) {
      if (!isMissingColumnError(err)) {
        throw err;
      }
      // Database hasn't applied coach extraction migration yet.
      hasCoachColumns = false;
      if (fetchAll) {
        entries = await env.DB.prepare(legacyBaseSelect).bind(...selectParams).all();
      } else {
        if (cursorSeconds) {
          entries = await env.DB.prepare(`${legacyBaseSelect} LIMIT ?`).bind(...selectParams, limit).all();
        } else {
          entries = await env.DB.prepare(`${legacyBaseSelect} LIMIT ? OFFSET ?`).bind(user.id, limit, offset).all();
        }
      }
    }

    const results = entries?.results || [];

    // Fetch embeddings only for newest N entries (and only if the column exists).
    const embeddingMap = new Map();
    const idsForEmbeddings = results.slice(0, MAX_ENTRIES_WITH_EMBEDDINGS).map((entry) => entry?.id).filter(Boolean);

    if (idsForEmbeddings.length > 0 && hasCoachColumns) {
      try {
        const placeholders = idsForEmbeddings.map(() => '?').join(', ');
        const embeddingRows = await env.DB.prepare(
          `SELECT id, step_embeddings FROM journal_entries WHERE user_id = ? AND id IN (${placeholders})`
        ).bind(user.id, ...idsForEmbeddings).all();

        (embeddingRows?.results || []).forEach((row) => {
          embeddingMap.set(row.id, row.step_embeddings);
        });
      } catch (err) {
        // If the migration is partially applied / column missing, degrade gracefully.
        if (!isMissingColumnError(err)) {
          console.warn(`[${requestId}] [journal] Failed to load embeddings:`, err?.message || err);
        }
      }
    }

    // Parse JSON fields with per-row error handling to prevent single corrupt row from 500ing
    const parsedEntries = results.map((entry, index) => {
      try {
        // Only include embeddings for recent entries (results are sorted by created_at DESC)
        const includeEmbeddings = index < MAX_ENTRIES_WITH_EMBEDDINGS;
        const rawEmbeddings = includeEmbeddings ? embeddingMap.get(entry.id) : null;

        // Only include location if consent was given and data exists
        const hasLocation = entry.location_consent === 1 &&
                           entry.location_latitude != null &&
                           entry.location_longitude != null;
        const location = hasLocation ? {
          latitude: entry.location_latitude,
          longitude: entry.location_longitude,
          timezone: entry.location_timezone || null
        } : null;

        return {
          id: entry.id,
          ts: entry.created_at * 1000, // Convert to milliseconds for JS Date
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
          // Pre-computed coach suggestion data (AI-extracted steps + embeddings)
          // extractedSteps are small strings, always include
          // stepEmbeddings are large (768 floats each), only include for recent entries
          extractedSteps: entry.extracted_steps ? safeJsonParse(entry.extracted_steps, null) : null,
          stepEmbeddings: rawEmbeddings ? safeJsonParse(rawEmbeddings, null) : null,
          extractionVersion: entry.extraction_version || null,
          // Location (only present if user consented to storage)
          location
        };
      } catch (parseErr) {
        console.warn(`[${requestId}] [journal] Failed to parse entry ${entry.id}:`, parseErr);
        // Return a minimal valid entry so the journal doesn't break completely
        return {
          id: entry.id,
          ts: entry.created_at * 1000,
          spread: entry.spread_name || 'Unknown',
          spreadKey: entry.spread_key || 'unknown',
          question: entry.question,
          cards: [],
          personalReading: entry.narrative,
          themes: null,
          reflections: {},
          context: entry.context,
          provider: entry.provider,
          sessionSeed: entry.session_seed,
          userPreferences: null,
          deckId: entry.deck_id,
          requestId: entry.request_id,
          extractedSteps: null,
          stepEmbeddings: null,
          extractionVersion: null,
          _parseError: true
        };
      }
    });

    const dedupedEntries = dedupeEntries(parsedEntries);

    // Optionally attach follow-up conversations
    if (includeFollowups && dedupedEntries.length > 0) {
      const followupMap = await loadFollowUpsByEntry(env.DB, user.id, dedupedEntries.map(entry => entry.id));
      dedupedEntries.forEach((entry) => {
        const followUps = followupMap.get(entry.id);
        if (followUps?.length) {
          entry.followUps = followUps;
        }
      });
    }

    // Build response with pagination metadata
    const lastEntry = dedupedEntries[dedupedEntries.length - 1];
    const nextCursor = !fetchAll && lastEntry ? lastEntry.ts : null;
    const hasMore = fetchAll
      ? false
      : cursorSeconds
        ? dedupedEntries.length === limit
        : (offset + dedupedEntries.length) < total;

    const response = {
      entries: dedupedEntries,
      pagination: {
        total,
        limit: fetchAll ? total : limit,
        offset: cursorSeconds ? null : offset,
        cursor: cursorSeconds ? cursorMs : null,
        nextCursor,
        hasMore
      }
    };

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error(`[${requestId}] [journal] Get entries error:`, error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * POST /api/journal
 * Save a new journal entry for the authenticated user.
 * Persistence and deduplication live in functions/lib/journalEntries.js.
 */
export async function onRequestPost(context) {
  const { request, env, waitUntil } = context;
  // Log-correlation id. Named distinctly because the request body carries its
  // own `requestId` (the reading's id).
  const logRequestId = crypto.randomUUID();

  try {
    // Authenticate user
    const user = await getUserFromRequest(request, env);

    const denied = journalAccessDenied(user);
    if (denied) return denied;

    const body = await request.json();
    const result = await saveAppJournalEntry({ env, user, body, waitUntil });
    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error(`[${logRequestId}] [journal] Save entry error:`, error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
