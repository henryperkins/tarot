/**
 * Archetype Journey Analytics API
 *
 * Endpoints:
 * - GET /api/archetype-journey - Get analytics data for authenticated user
 * - POST /api/archetype-journey/track - Track card appearances (called automatically on reading save)
 * - GET /api/archetype-journey/preferences - Read analytics preferences
 * - PUT /api/archetype-journey/preferences - Update analytics preferences
 * - POST /api/archetype-journey/reset - Reset all analytics data
 */

import { getUserFromRequest } from '../lib/auth.js';
import { trackPatterns } from '../lib/patternTracking.js';
import { enforceApiCallLimit } from '../lib/apiUsage.js';
import { buildCorsHeaders } from '../lib/utils.js';

const defaultDeps = { getUserFromRequest };

function toMillis(value) {
  if (typeof value === 'number') {
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? (numeric < 1e12 ? numeric * 1000 : numeric) : null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function formatDateKey(tsMillis) {
  if (!tsMillis) return null;
  const date = new Date(tsMillis);
  if (Number.isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function computeCurrentStreak(db, userId) {
  // Limit rows to keep the query cheap while covering a year of history.
  const readingsQuery = await db.prepare(`
    SELECT created_at
    FROM journal_entries
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 400
  `).bind(userId).all();

  const results = readingsQuery.results || [];
  if (!results.length) return 0;

  const readingDates = new Set();
  for (const row of results) {
    const millis = toMillis(row.created_at);
    const key = formatDateKey(millis);
    if (key) readingDates.add(key);
  }

  if (readingDates.size === 0) return 0;

  let streak = 0;
  const today = new Date();

  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    const key = formatDateKey(checkDate.getTime());

    if (readingDates.has(key)) {
      streak += 1;
    } else if (i === 0) {
      // Grace period for “no reading yet today”
      continue;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Main handler for archetype journey endpoints
 */
export async function onRequest(context, deps = defaultDeps) {
  const { request, env } = context;
  const { getUserFromRequest: getUser } = deps;
  const url = new URL(request.url);
  const method = request.method;
  const isCardFrequency = url.pathname === '/api/archetype-journey/card-frequency';

  // CORS headers (credential-friendly)
  const corsHeaders = buildCorsHeaders(request);

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authenticated user
    const user = await getUser(request, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (user.auth_provider === 'api_key') {
      // Only allow API key access for card frequency; enforce plan/usage limits.
      if (!isCardFrequency) {
        return new Response(JSON.stringify({ error: 'Session authentication required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const apiLimit = await enforceApiCallLimit(env, user);
      if (!apiLimit.allowed) {
        return new Response(JSON.stringify(apiLimit.payload), {
          status: apiLimit.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Check user preferences
    const prefs = await getUserPreferences(env.DB, user.id);
    if (!prefs.archetype_journey_enabled && !url.pathname.includes('/preferences') && !url.pathname.includes('/reset')) {
      return new Response(JSON.stringify({
        error: 'Analytics disabled',
        enabled: false
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Route to appropriate handler
    if (url.pathname === '/api/archetype-journey' && method === 'GET') {
      return await handleGetAnalytics(env.DB, user.id, corsHeaders);
    } else if (url.pathname === '/api/archetype-journey/card-frequency' && method === 'GET') {
      return await handleGetCardFrequency(env.DB, user.id, corsHeaders);
    } else if (url.pathname === '/api/archetype-journey/preferences' && method === 'GET') {
      return await handleGetPreferences(env.DB, user.id, corsHeaders);
    } else if (url.pathname === '/api/archetype-journey/track' && method === 'POST') {
      const body = await request.json();
      return await handleTrackCards(env.DB, user.id, body, corsHeaders);
    } else if (url.pathname === '/api/archetype-journey/preferences' && method === 'PUT') {
      const body = await request.json();
      return await handleUpdatePreferences(env.DB, user.id, body, corsHeaders);
    } else if (url.pathname === '/api/archetype-journey/reset' && method === 'POST') {
      return await handleResetAnalytics(env.DB, user.id, corsHeaders);
    } else {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('Archetype journey error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get per-card frequency across all tracked months.
 *
 * Shape is designed for the Card Collection UI:
 * {
 *   success: true,
 *   cards: [{ card_name, card_number, total_count, first_seen, last_seen }, ...]
 * }
 */
async function handleGetCardFrequency(db, userId, corsHeaders) {
  // Aggregate across all months. Note that card_appearances stores one row per
  // (user_id, card_name, year_month), with per-month first_seen/last_seen.
  // We collapse to all-time stats by summing counts and taking min/max timestamps.
  const query = await db.prepare(`
    SELECT
      card_name,
      MAX(card_number) AS card_number,
      SUM(count) AS total_count,
      MIN(first_seen) AS first_seen,
      MAX(last_seen) AS last_seen
    FROM card_appearances
    WHERE user_id = ?
    GROUP BY card_name
    ORDER BY total_count DESC, last_seen DESC
  `).bind(userId).all();

  const cards = (query.results || []).map((row) => ({
    card_name: row.card_name,
    card_number: row.card_number,
    total_count: row.total_count,
    first_seen: row.first_seen,
    last_seen: row.last_seen
  }));

  // Compute aggregate stats for Card Collection UI
  const uniqueCardsSeen = cards.length;
  const totalDraws = cards.reduce((sum, c) => sum + (c.total_count || 0), 0);

  return new Response(JSON.stringify({
    success: true,
    cards,
    stats: {
      uniqueCardsSeen,
      totalDraws,
      totalDeckSize: 78 // Standard tarot deck
    }
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

/**
 * Get analytics data for user
 */
async function handleGetAnalytics(db, userId, corsHeaders) {
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

  // Get top 5 cards this month
  const topCardsQuery = await db.prepare(`
    SELECT card_name, card_number, count, last_seen, first_seen
    FROM card_appearances
    WHERE user_id = ? AND year_month = ?
    ORDER BY count DESC, last_seen DESC
    LIMIT 5
  `).bind(userId, currentMonth).all();

  const topCards = topCardsQuery.results || [];

  // Get all cards for current month (for trends)
  const allCardsQuery = await db.prepare(`
    SELECT card_name, card_number, count
    FROM card_appearances
    WHERE user_id = ? AND year_month = ?
    ORDER BY count DESC
  `).bind(userId, currentMonth).all();

  const allCards = allCardsQuery.results || [];

  // Get recent badges
  const badgesQuery = await db.prepare(`
    SELECT badge_type, badge_key, card_name, earned_at, metadata_json
    FROM archetype_badges
    WHERE user_id = ?
    ORDER BY earned_at DESC
    LIMIT 10
  `).bind(userId).all();

  const badges = (badgesQuery.results || []).map(badge => ({
    ...badge,
    metadata: badge.metadata_json ? JSON.parse(badge.metadata_json) : {}
  }));

  // Calculate streaks (cards appearing multiple times)
  const streaks = allCards.filter(card => card.count >= 2).map(card => ({
    cardName: card.card_name,
    cardNumber: card.card_number,
    count: card.count,
    month: currentMonth
  }));

  // Get historical data for trends (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const startMonth = sixMonthsAgo.toISOString().slice(0, 7);

  const trendsQuery = await db.prepare(`
    SELECT card_name, card_number, year_month, count
    FROM card_appearances
    WHERE user_id = ? AND year_month >= ?
    ORDER BY year_month DESC, count DESC
  `).bind(userId, startMonth).all();

  const trends = trendsQuery.results || [];

  // Calculate Major Arcana frequency distribution
  const majorArcanaFreq = allCards
    .filter(card => card.card_number !== null && card.card_number <= 21)
    .reduce((acc, card) => {
      acc[card.card_name] = card.count;
      return acc;
    }, {});

  // ---------------------------------------------------------------------------
  // Backfill diagnostics
  // ---------------------------------------------------------------------------
  // Reading Journey uses card_appearances for server-side analytics.
  // Older journal_entries (pre-analytics rollout, imports, migrations, etc.)
  // are not reflected in card_appearances unless the user runs backfill.
  //
  // We compute lightweight metadata so the UI can accurately decide whether
  // a backfill prompt should be shown (instead of relying on “topCards this month”).
  let stats = {
    needsBackfill: null,
    entriesProcessed: null,
    lastAnalyzedAt: null,
    totalJournalEntries: null,
    firstJournalMonth: null,
    lastJournalMonth: null,
    trackedCardRows: null,
    firstTrackedMonth: null,
    lastTrackedMonth: null,
  };

  try {
    const journalMeta = await db.prepare(`
      SELECT
        COUNT(*) AS total_entries,
        MIN(created_at) AS first_entry_at,
        MAX(created_at) AS last_entry_at
      FROM journal_entries
      WHERE user_id = ?
    `).bind(userId).first();

    const appearancesMeta = await db.prepare(`
      SELECT
        COUNT(*) AS tracked_rows,
        MIN(year_month) AS first_tracked_month,
        MAX(year_month) AS last_tracked_month,
        MAX(last_seen) AS last_analyzed_at
      FROM card_appearances
      WHERE user_id = ?
    `).bind(userId).first();

    const totalEntries = typeof journalMeta?.total_entries === 'number'
      ? journalMeta.total_entries
      : Number(journalMeta?.total_entries || 0);

    const firstEntryAt = typeof journalMeta?.first_entry_at === 'number'
      ? journalMeta.first_entry_at
      : (journalMeta?.first_entry_at ? Number(journalMeta.first_entry_at) : null);

    const lastEntryAt = typeof journalMeta?.last_entry_at === 'number'
      ? journalMeta.last_entry_at
      : (journalMeta?.last_entry_at ? Number(journalMeta.last_entry_at) : null);

    const firstJournalMonth = firstEntryAt
      ? new Date(firstEntryAt * 1000).toISOString().slice(0, 7)
      : null;

    const lastJournalMonth = lastEntryAt
      ? new Date(lastEntryAt * 1000).toISOString().slice(0, 7)
      : null;

    const trackedRows = typeof appearancesMeta?.tracked_rows === 'number'
      ? appearancesMeta.tracked_rows
      : Number(appearancesMeta?.tracked_rows || 0);

    const firstTrackedMonth = appearancesMeta?.first_tracked_month || null;
    const lastTrackedMonth = appearancesMeta?.last_tracked_month || null;
    const lastAnalyzedAt = appearancesMeta?.last_analyzed_at || null;

    // Determine if backfill is needed.
    // - If the user has journal entries but no tracked rows, backfill is required.
    // - If we have tracked rows but the earliest tracked month is later than the
    //   earliest journal month, we are missing historical data.
    let needsBackfill = false;
    if (totalEntries > 0) {
      if (!trackedRows) {
        needsBackfill = true;
      } else if (firstJournalMonth && firstTrackedMonth && firstTrackedMonth > firstJournalMonth) {
        needsBackfill = true;
      }
    }

    // If we're confident tracking covers history, expose entriesProcessed as
    // a “best effort” count for UI captions.
    const entriesProcessed = (!needsBackfill && totalEntries > 0) ? totalEntries : null;

    stats = {
      needsBackfill,
      entriesProcessed,
      lastAnalyzedAt,
      totalJournalEntries: totalEntries,
      firstJournalMonth,
      lastJournalMonth,
      trackedCardRows: trackedRows,
      firstTrackedMonth,
      lastTrackedMonth,
    };
  } catch (err) {
    // Degrade gracefully; analytics should still work without diagnostics.
    console.warn('Failed to compute archetype analytics stats:', err?.message || err);
  }

  let currentStreak = 0;
  try {
    currentStreak = await computeCurrentStreak(db, userId);
  } catch (err) {
    console.warn('Failed to compute current streak:', err?.message || err);
  }

  return new Response(JSON.stringify({
    success: true,
    analytics: {
      currentMonth,
      topCards,
      allCards,
      streaks,
      badges,
      trends,
      majorArcanaFrequency: majorArcanaFreq,
      totalReadingsThisMonth: allCards.reduce((sum, card) => sum + card.count, 0),
      stats: {
        ...stats,
        currentStreak
      }
    }
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

/**
 * Track card appearances from a reading
 */
async function handleTrackCards(db, userId, body, corsHeaders) {
  const { cards, timestamp, entryId, themes } = body;

  if (!Array.isArray(cards) || cards.length === 0) {
    return new Response(JSON.stringify({
      error: 'Invalid cards data'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const now = Math.floor((timestamp || Date.now()) / 1000);
  const yearMonth = new Date(now * 1000).toISOString().slice(0, 7);

  try {
    // Track each card
    for (const card of cards) {
      const cardName = card.name;
      const cardNumber = card.number !== undefined ? card.number : null;

      // Upsert card appearance
      await db.prepare(`
        INSERT INTO card_appearances (user_id, card_name, card_number, year_month, count, last_seen, first_seen)
        VALUES (?, ?, ?, ?, 1, ?, ?)
        ON CONFLICT(user_id, card_name, year_month) DO UPDATE SET
          count = count + 1,
          last_seen = ?
      `).bind(userId, cardName, cardNumber, yearMonth, now, now, now).run();
    }

    // Track archetypal patterns
    if (entryId && themes) {
      await trackPatterns(db, userId, entryId, themes);
    }

    // Check for new badges (streaks)
    await checkAndAwardBadges(db, userId, yearMonth, now);

    return new Response(JSON.stringify({
      success: true,
      tracked: cards.length
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to track cards:', error);
    return new Response(JSON.stringify({
      error: 'Failed to track cards',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Check for and award new badges based on card frequencies
 *
 * NOTE: This incremental version differs intentionally from the backfill version:
 * - Awards ONLY when count === 3 (exact match) to trigger badge once
 * - Checks for existing badge before awarding to prevent duplicates
 *
 * The backfill version (archetype-journey-backfill.js) uses count >= 3 and
 * skips the existence check because it deletes all badges first for idempotency.
 * Both produce the same badges when run correctly, but use different strategies
 * suited to their use cases (incremental tracking vs bulk reconstruction).
 */
async function checkAndAwardBadges(db, userId, yearMonth, now) {
  // Get current month's card counts
  const cardsQuery = await db.prepare(`
    SELECT card_name, count
    FROM card_appearances
    WHERE user_id = ? AND year_month = ?
  `).bind(userId, yearMonth).all();

  const cards = cardsQuery.results || [];

  // Award streak badges for cards appearing 3+ times
  for (const card of cards) {
    if (card.count === 3) {
      const badgeKey = `streak_3x_${card.card_name.toLowerCase().replace(/\s+/g, '_')}_${yearMonth}`;

      // Check if badge already exists
      const existingBadge = await db.prepare(`
        SELECT id FROM archetype_badges WHERE user_id = ? AND badge_key = ?
      `).bind(userId, badgeKey).first();

      if (!existingBadge) {
        // Award new badge
        const metadata = JSON.stringify({
          count: card.count,
          month: yearMonth,
          context: `${card.card_name} appeared ${card.count} times in ${yearMonth}`
        });

        await db.prepare(`
          INSERT INTO archetype_badges (user_id, badge_type, badge_key, card_name, earned_at, metadata_json)
          VALUES (?, 'streak', ?, ?, ?, ?)
        `).bind(userId, badgeKey, card.card_name, now, metadata).run();
      }
    }
  }
}

/**
 * Update user preferences
 */
async function handleUpdatePreferences(db, userId, body, corsHeaders) {
  const { archetype_journey_enabled, show_badges } = body;
  const now = Math.floor(Date.now() / 1000);

  try {
    await db.prepare(`
      INSERT INTO user_analytics_prefs (user_id, archetype_journey_enabled, show_badges, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        archetype_journey_enabled = COALESCE(?, archetype_journey_enabled),
        show_badges = COALESCE(?, show_badges),
        updated_at = ?
    `).bind(
      userId,
      archetype_journey_enabled !== undefined ? (archetype_journey_enabled ? 1 : 0) : 1,
      show_badges !== undefined ? (show_badges ? 1 : 0) : 1,
      now,
      archetype_journey_enabled !== undefined ? (archetype_journey_enabled ? 1 : 0) : null,
      show_badges !== undefined ? (show_badges ? 1 : 0) : null,
      now
    ).run();

    return new Response(JSON.stringify({
      success: true,
      preferences: {
        archetype_journey_enabled: archetype_journey_enabled !== undefined ? archetype_journey_enabled : true,
        show_badges: show_badges !== undefined ? show_badges : true
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to update preferences:', error);
    return new Response(JSON.stringify({
      error: 'Failed to update preferences',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get user analytics preferences
 */
async function handleGetPreferences(db, userId, corsHeaders) {
  try {
    const prefs = await getUserPreferences(db, userId);
    return new Response(JSON.stringify({
      success: true,
      preferences: prefs
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to load preferences:', error);
    return new Response(JSON.stringify({
      error: 'Failed to load preferences',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Reset all analytics data for user
 */
async function handleResetAnalytics(db, userId, corsHeaders) {
  try {
    await db.prepare(`DELETE FROM card_appearances WHERE user_id = ?`).bind(userId).run();
    await db.prepare(`DELETE FROM archetype_badges WHERE user_id = ?`).bind(userId).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Analytics data reset'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to reset analytics:', error);
    return new Response(JSON.stringify({
      error: 'Failed to reset analytics',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get user analytics preferences
 */
async function getUserPreferences(db, userId) {
  const result = await db.prepare(`
    SELECT archetype_journey_enabled, show_badges
    FROM user_analytics_prefs
    WHERE user_id = ?
  `).bind(userId).first();

  if (!result) {
    // Default preferences
    return {
      archetype_journey_enabled: true,
      show_badges: true
    };
  }

  return {
    archetype_journey_enabled: result.archetype_journey_enabled === 1,
    show_badges: result.show_badges === 1
  };
}
