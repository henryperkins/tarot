import { appJournalResultId } from '../../../shared/journal/readingIdentity.js';
/**
 * Journal Search Endpoint
 * GET /api/journal/search?q=... - Search journal entries for authenticated user
 *
 * Exact substring matches come first; with none, the search falls back to
 * semantic matches. `mode=semantic` asks for semantic matches directly.
 */

import {
  validateSession,
  getSessionFromCookie
} from '../../lib/auth.js';
import { buildTierLimitedPayload, isEntitled } from '../../lib/entitlements.js';
import { safeJsonParse } from '../../lib/utils.js';
import { findSimilarJournalEntries } from '../../lib/journalSearch.js';
import { loadFollowUpsByEntry } from '../../lib/journalFollowups.js';

function isMissingColumnError(err) {
  const message = String(err?.message || err || '');
  return message.toLowerCase().includes('no such column');
}

function buildEntryFromRow(entry, { hasCoachColumns = true } = {}) {
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
      readingResultId: appJournalResultId(entry.idempotency_key),
    userPreferences: entry.user_preferences_json ? safeJsonParse(entry.user_preferences_json, null) : null,
    deckId: entry.deck_id,
    requestId: entry.request_id,
    extractedSteps: hasCoachColumns && entry.extracted_steps
      ? safeJsonParse(entry.extracted_steps, null)
      : null,
    extractionVersion: hasCoachColumns ? entry.extraction_version || null : null,
    location
  };
}

export async function onRequestGet(context) {
  const { request, env } = context;
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
            message: 'Cloud journal search requires an active Plus or Pro subscription',
            user,
            requiredTier: 'plus'
          })
        ),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(request.url);
    const query = (url.searchParams.get('q') || '').trim();
    let limit = parseInt(url.searchParams.get('limit') || '25', 10);
    if (!Number.isFinite(limit) || limit < 1) limit = 25;
    limit = Math.min(limit, 50);

    // Parse filters from query parameters
    const contexts = url.searchParams.getAll('contexts');
    const spreads = url.searchParams.getAll('spreads');
    const decks = url.searchParams.getAll('decks');
    const timeframe = (url.searchParams.get('timeframe') || 'all').toLowerCase();
    // Clients send their local window so "This year" starts at the reader's
    // midnight, not UTC midnight. The timeframe name is only a fallback.
    const windowStartParam = Number(url.searchParams.get('windowStart'));
    const windowEndParam = Number(url.searchParams.get('windowEnd'));
    const hasClientWindow = timeframe !== 'all'
      && url.searchParams.has('windowStart')
      && Number.isFinite(windowStartParam) && windowStartParam > 0
      && (!url.searchParams.has('windowEnd')
        || (Number.isFinite(windowEndParam) && windowEndParam >= windowStartParam));
    const timeframeEndMs = hasClientWindow && url.searchParams.has('windowEnd') ? windowEndParam : null;
    const timeframeCutoffMs = (() => {
      if (hasClientWindow) return windowStartParam;
      const now = Date.now();
      switch (timeframe) {
        case '30d':
          return now - 30 * 24 * 60 * 60 * 1000;
        case '90d':
          return now - 90 * 24 * 60 * 60 * 1000;
        case 'ytd': {
          const yearStart = new Date(new Date(now).getFullYear(), 0, 1).getTime();
          return yearStart;
        }
        default:
          return null;
      }
    })();
    const onlyReversals = url.searchParams.get('onlyReversals') === 'true';
    const semanticOnly = (url.searchParams.get('mode') || '').toLowerCase() === 'semantic';

    if (query.length < 3) {
      return new Response(
        JSON.stringify({ error: 'Search query is too short' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const pattern = `%${query.toLowerCase()}%`;

    // Filter conditions apply to exact and semantic matches alike.
    const filterClauses = [];
    const filterParams = [];
    if (contexts.length > 0) {
      const contextPlaceholders = contexts.map(() => '?').join(',');
      filterClauses.push(`context IN (${contextPlaceholders})`);
      filterParams.push(...contexts);
    }
    if (spreads.length > 0) {
      const spreadPlaceholders = spreads.map(() => '?').join(',');
      filterClauses.push(`spread_key IN (${spreadPlaceholders})`);
      filterParams.push(...spreads);
    }
    if (decks.length > 0) {
      const deckPlaceholders = decks.map(() => '?').join(',');
      filterClauses.push(`deck_id IN (${deckPlaceholders})`);
      filterParams.push(...decks);
    }
    if (timeframeCutoffMs) {
      filterClauses.push('created_at >= ?');
      filterParams.push(Math.floor(timeframeCutoffMs / 1000));
    }
    if (timeframeEndMs) {
      filterClauses.push('created_at <= ?');
      filterParams.push(Math.floor(timeframeEndMs / 1000));
    }
    if (onlyReversals) {
      filterClauses.push('cards_json LIKE ?');
      filterParams.push('%reversed%');
    }

    // Build WHERE clauses: owner, search pattern, then filters
    const whereClauses = ['user_id = ?'];
    const params = [user.id];

    whereClauses.push('(' +
      'LOWER(COALESCE(question, \'\')) LIKE ? OR ' +
      'LOWER(COALESCE(narrative, \'\')) LIKE ? OR ' +
      'LOWER(COALESCE(reflections_json, \'\')) LIKE ? OR ' +
      'LOWER(COALESCE(cards_json, \'\')) LIKE ? OR ' +
      'LOWER(COALESCE(spread_name, \'\')) LIKE ? OR ' +
      'LOWER(COALESCE(context, \'\')) LIKE ?' +
    ')');
    params.push(pattern, pattern, pattern, pattern, pattern, pattern);
    whereClauses.push(...filterClauses);
    params.push(...filterParams);

    const whereClause = whereClauses.join(' AND ');
    const paramsWithLimit = [...params, limit];
    const filterSql = filterClauses.length > 0 ? ` AND ${filterClauses.join(' AND ')}` : '';

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
        idempotency_key,
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
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ?
    `;
    const legacySelect = `
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
        idempotency_key,
        user_preferences_json,
        deck_id,
        request_id
      FROM journal_entries
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ?
    `;
    const legacyParams = [...paramsWithLimit];

    let rows = { results: [] };
    let hasCoachColumns = true;
    if (!semanticOnly) {
      try {
        rows = await env.DB.prepare(baseSelect).bind(...paramsWithLimit).all();
      } catch (err) {
        if (!isMissingColumnError(err)) {
          throw err;
        }
        hasCoachColumns = false;
        rows = await env.DB.prepare(legacySelect).bind(...legacyParams).all();
      }
    }

    const results = rows?.results || [];

    let entries = [];
    let mode = 'exact';

    if (results.length > 0) {
      entries = results.map((entry) => buildEntryFromRow(entry, { hasCoachColumns }));
    } else {
      mode = 'semantic';
      const semanticMatches = await findSimilarJournalEntries(env, user.id, query, {
        limit,
        requestId,
        timeframeCutoffMs,
        timeframeEndMs,
        contexts,
        spreads,
        decks,
        onlyReversals
      });
      const ids = semanticMatches.map((match) => match?.id).filter(Boolean);
      if (ids.length === 0) {
        return new Response(
          JSON.stringify({ entries: [], mode, query }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const placeholders = ids.map(() => '?').join(', ');
      const baseByIdSelect = `
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
        idempotency_key,
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
        WHERE user_id = ? AND id IN (${placeholders})${filterSql}
      `;

      const legacyByIdSelect = `
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
        idempotency_key,
          user_preferences_json,
          deck_id,
          request_id
        FROM journal_entries
        WHERE user_id = ? AND id IN (${placeholders})${filterSql}
      `;

      const byIdParams = [user.id, ...ids, ...filterParams];
      let rowsById;
      try {
        rowsById = await env.DB.prepare(baseByIdSelect).bind(...byIdParams).all();
      } catch (err) {
        if (!isMissingColumnError(err)) {
          throw err;
        }
        hasCoachColumns = false;
        rowsById = await env.DB.prepare(legacyByIdSelect).bind(...byIdParams).all();
      }

      const rowMap = new Map();
      (rowsById?.results || []).forEach((row) => {
        rowMap.set(row.id, buildEntryFromRow(row, { hasCoachColumns }));
      });

      entries = ids.map((id) => rowMap.get(id)).filter(Boolean).slice(0, limit);
    }

    const entryIds = entries.map((entry) => entry?.id).filter(Boolean);
    if (entryIds.length > 0) {
      const followupMap = await loadFollowUpsByEntry(env.DB, user.id, entryIds);
      entries = entries.map((entry) => {
        const followUps = followupMap.get(entry.id);
        return followUps?.length ? { ...entry, followUps } : entry;
      });
    }

    return new Response(
      JSON.stringify({ entries, mode, query }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error(`[${requestId}] [journal-search] Error:`, error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
