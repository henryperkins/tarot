/**
 * Journal API Endpoints
 * GET /api/journal - List all journal entries for authenticated user
 * POST /api/journal - Save a new journal entry
 */

import {
  validateSession,
  getSessionFromCookie
} from '../lib/auth.js';

/**
 * GET /api/journal
 * Returns all journal entries for the authenticated user
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

    // Get all journal entries for user, ordered by most recent first
    const entries = await env.DB.prepare(`
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
        session_seed
      FROM journal_entries
      WHERE user_id = ?
      ORDER BY created_at DESC
    `)
      .bind(user.id)
      .all();

    // Parse JSON fields
    const parsedEntries = entries.results.map(entry => ({
      id: entry.id,
      ts: entry.created_at * 1000, // Convert to milliseconds for JS Date
      spread: entry.spread_name,
      spreadKey: entry.spread_key,
      question: entry.question,
      cards: JSON.parse(entry.cards_json),
      personalReading: entry.narrative,
      themes: entry.themes_json ? JSON.parse(entry.themes_json) : null,
      reflections: entry.reflections_json ? JSON.parse(entry.reflections_json) : {},
      context: entry.context,
      provider: entry.provider,
      sessionSeed: entry.session_seed
    }));

    return new Response(
      JSON.stringify({ entries: parsedEntries }),
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
      sessionSeed
    } = body;

    // Validate required fields
    if (!spread || !spreadKey || !cards || !Array.isArray(cards)) {
      return new Response(
        JSON.stringify({ error: 'Invalid journal entry data' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create journal entry
    const entryId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

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
        session_seed
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        entryId,
        user.id,
        now,
        now,
        spreadKey,
        spread,
        question || null,
        JSON.stringify(cards),
        personalReading || null,
        themes ? JSON.stringify(themes) : null,
        reflections ? JSON.stringify(reflections) : null,
        context || null,
        provider || null,
        sessionSeed || null
      )
      .run();

    return new Response(
      JSON.stringify({
        success: true,
        entry: {
          id: entryId,
          ts: now * 1000
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
