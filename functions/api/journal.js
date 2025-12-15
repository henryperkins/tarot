/**
 * Journal API Endpoints
 * GET /api/journal - List all journal entries for authenticated user
 * POST /api/journal - Save a new journal entry
 */

import {
  validateSession,
  getSessionFromCookie
} from '../lib/auth.js';
import { dedupeEntries } from '../../shared/journal/dedupe.js';

/**
 * Safely parse JSON with fallback to prevent single corrupt row from breaking entire journal
 * @param {string} json - JSON string to parse
 * @param {any} fallback - Fallback value if parsing fails
 * @returns {any} Parsed value or fallback
 */
function safeJsonParse(json, fallback) {
  if (!json) return fallback;
  try {
    return JSON.parse(json);
  } catch (e) {
    console.warn('JSON parse failed:', e.message);
    return fallback;
  }
}

/**
 * GET /api/journal
 * Returns journal entries for the authenticated user with optional pagination
 *
 * Query params:
 *   - limit: Max entries to return (default: 100, max: 500)
 *   - offset: Number of entries to skip (default: 0)
 *   - all: If "true", returns all entries (for backward compatibility)
 */
export async function onRequestGet(context) {
  const { request, env } = context;

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

    // Parse pagination params
    const url = new URL(request.url);
    const allParam = url.searchParams.get('all');
    const fetchAll = allParam === 'true' || allParam === '1';

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

    // Build query with optional pagination
    let query = `
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
      ORDER BY created_at DESC
    `;

    let entries;
    if (fetchAll) {
      // Backward compatibility: fetch all entries
      entries = await env.DB.prepare(query).bind(user.id).all();
    } else {
      // Paginated query
      query += ` LIMIT ? OFFSET ?`;
      entries = await env.DB.prepare(query).bind(user.id, limit, offset).all();
    }

    // Parse JSON fields with per-row error handling to prevent single corrupt row from 500ing
    const parsedEntries = entries.results.map(entry => {
      try {
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
          requestId: entry.request_id
        };
      } catch (parseErr) {
        console.warn(`Failed to parse journal entry ${entry.id}:`, parseErr);
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
          _parseError: true
        };
      }
    });

    const dedupedEntries = dedupeEntries(parsedEntries);

    // Build response with pagination metadata
    const response = {
      entries: dedupedEntries,
      pagination: {
        total,
        limit: fetchAll ? total : limit,
        offset,
        hasMore: !fetchAll && (offset + dedupedEntries.length) < total
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
    console.error('Get journal entries error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * POST /api/journal
 * Save a new journal entry for the authenticated user
 */
export async function onRequestPost(context) {
  const { request, env } = context;

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

    // Parse request body
    const body = await request.json();
    const {
      spread,
      spreadKey,
      question,
      cards,
      personalReading,
      themes,
      reflections,
      context,
      provider,
      sessionSeed,
      // Optional: original timestamp in milliseconds (used for migrations)
      timestampMs,
      // User preferences snapshot at time of reading (Phase 5.2)
      userPreferences,
      // Deck style identifier (rws1909, marseille, thoth, etc.)
      deckId,
      // Request ID for API tracing/correlation
      requestId
    } = body;

    // Validate required fields
    if (!spread || !spreadKey || !cards || !Array.isArray(cards)) {
      return new Response(
        JSON.stringify({ error: 'Invalid journal entry data' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Deduplicate by session_seed to prevent double-saves
    if (sessionSeed) {
      const existing = await env.DB.prepare(
        `SELECT id, created_at FROM journal_entries WHERE user_id = ? AND session_seed = ?`
      ).bind(user.id, sessionSeed).first();

      if (existing) {
        // Return existing entry instead of creating duplicate
        return new Response(
          JSON.stringify({
            success: true,
            entry: {
              id: existing.id,
              ts: existing.created_at * 1000
            },
            deduplicated: true
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // Create journal entry
    const entryId = crypto.randomUUID();
    const nowSeconds = Math.floor(Date.now() / 1000);

    // Derive created_at/updated_at, allowing a **sanitized** client timestamp
    // for trusted flows like local-to-cloud migration.
    let createdAt = nowSeconds;

    if (typeof timestampMs === 'number' && Number.isFinite(timestampMs)) {
      const candidateSeconds = Math.floor(timestampMs / 1000);

      // Basic sanity window: >= 2000-01-01 and not more than 24h in the future
      const MIN_ALLOWED = 946684800; // 2000-01-01T00:00:00Z
      const MAX_ALLOWED = nowSeconds + 60 * 60 * 24;

      if (candidateSeconds >= MIN_ALLOWED && candidateSeconds <= MAX_ALLOWED) {
        createdAt = candidateSeconds;
      }
    }

    const updatedAt = createdAt;

    // Ensure context is a string (not an object) to prevent "[object Object]" storage
    const normalizedContext = (typeof context === 'string') ? context : null;

    await env.DB.prepare(`
      INSERT INTO journal_entries (
        id,
        user_id,
        created_at,
        updated_at,
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
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        entryId,
        user.id,
        createdAt,
        updatedAt,
        spreadKey,
        spread,
        question || null,
        JSON.stringify(cards),
        personalReading || null,
        themes ? JSON.stringify(themes) : null,
        reflections ? JSON.stringify(reflections) : null,
        normalizedContext,
        provider || null,
        sessionSeed || null,
        userPreferences ? JSON.stringify(userPreferences) : null,
        deckId || null,
        requestId || null
      )
      .run();

    return new Response(
      JSON.stringify({
        success: true,
        entry: {
          id: entryId,
          ts: createdAt * 1000
        }
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Save journal entry error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
