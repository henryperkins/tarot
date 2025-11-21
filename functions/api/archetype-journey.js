/**
 * Archetype Journey Analytics API
 *
 * Endpoints:
 * - GET /api/archetype-journey - Get analytics data for authenticated user
 * - POST /api/archetype-journey/track - Track card appearances (called automatically on reading save)
 * - PUT /api/archetype-journey/preferences - Update analytics preferences
 * - POST /api/archetype-journey/reset - Reset all analytics data
 */

import { getUserFromRequest } from '../lib/auth.js';

function buildCorsHeaders(request) {
  const origin = request.headers.get('Origin');
  const base = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (origin) {
    return {
      ...base,
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Vary': 'Origin'
    };
  }

  return {
    ...base,
    'Access-Control-Allow-Origin': '*'
  };
}

/**
 * Main handler for archetype journey endpoints
 */
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  // CORS headers (credential-friendly)
  const corsHeaders = buildCorsHeaders(request);

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authenticated user
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check user preferences
    const prefs = await getUserPreferences(env.DB, user.id);
    if (!prefs.archetype_journey_enabled && !url.pathname.includes('/preferences')) {
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
 * Get analytics data for user
 */
async function handleGetAnalytics(db, userId, corsHeaders) {
  const now = Math.floor(Date.now() / 1000);
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
      totalReadingsThisMonth: allCards.reduce((sum, card) => sum + card.count, 0)
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
  const { cards, timestamp } = body;

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
