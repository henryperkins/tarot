/**
 * Archetype Journey Backfill API
 *
 * POST /api/archetype-journey-backfill
 * Populates card_appearances from existing journal_entries for the authenticated user.
 * This enables Archetype Journey analytics for users with historical readings.
 *
 * Truly idempotent: Computes absolute counts from all entries and replaces existing data.
 * Running multiple times always produces the same result.
 */

import { getUserFromRequest } from '../lib/auth.js';

function buildCorsHeaders(request) {
  const origin = request.headers.get('Origin');
  const base = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
 * Parse cards from journal entry
 * Handles both JSON string and already-parsed array
 */
function parseCards(cardsJson) {
  if (!cardsJson) return [];

  if (Array.isArray(cardsJson)) {
    return cardsJson;
  }

  if (typeof cardsJson === 'string') {
    try {
      const parsed = JSON.parse(cardsJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

/**
 * Extract card number from card data
 * Major Arcana: 0-21 (from `number` field)
 * Minor Arcana: null (we track by name only)
 */
function getCardNumber(card) {
  // Major Arcana have a `number` field (0-21)
  if (typeof card.number === 'number' && card.number >= 0 && card.number <= 21) {
    return card.number;
  }
  return null;
}

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;
  const corsHeaders = buildCorsHeaders(request);

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
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

    if (user.auth_provider === 'api_key') {
      return new Response(JSON.stringify({ error: 'Session authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const db = env.DB;
    const userId = user.id;

    // Fetch all journal entries for this user
    const entriesQuery = await db.prepare(`
      SELECT id, cards_json, created_at
      FROM journal_entries
      WHERE user_id = ?
      ORDER BY created_at ASC
    `).bind(userId).all();

    const entries = entriesQuery.results || [];

    if (entries.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No journal entries to backfill',
        stats: { entriesProcessed: 0, cardsTracked: 0, badgesAwarded: 0 }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Step 1: Compute absolute counts from all entries
    // Key: "cardName|yearMonth" -> { count, cardNumber, firstSeen, lastSeen }
    const cardCounts = new Map();

    for (const entry of entries) {
      const cards = parseCards(entry.cards_json);
      if (cards.length === 0) continue;

      const timestamp = entry.created_at;
      const yearMonth = new Date(timestamp * 1000).toISOString().slice(0, 7);

      for (const card of cards) {
        const cardName = card.name;
        if (!cardName) continue;

        const key = `${cardName}|${yearMonth}`;
        const existing = cardCounts.get(key);

        if (existing) {
          existing.count += 1;
          existing.lastSeen = Math.max(existing.lastSeen, timestamp);
          existing.firstSeen = Math.min(existing.firstSeen, timestamp);
        } else {
          cardCounts.set(key, {
            cardName,
            cardNumber: getCardNumber(card),
            yearMonth,
            count: 1,
            firstSeen: timestamp,
            lastSeen: timestamp
          });
        }
      }
    }

    // Step 2: Delete existing card_appearances for this user (clean slate)
    await db.prepare(`
      DELETE FROM card_appearances WHERE user_id = ?
    `).bind(userId).run();

    // Step 3: Insert computed absolute counts
    let totalCardsTracked = 0;
    const processedMonths = new Set();

    for (const data of cardCounts.values()) {
      await db.prepare(`
        INSERT INTO card_appearances (user_id, card_name, card_number, year_month, count, last_seen, first_seen)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        userId,
        data.cardName,
        data.cardNumber,
        data.yearMonth,
        data.count,
        data.lastSeen,
        data.firstSeen
      ).run();

      totalCardsTracked += data.count;
      processedMonths.add(data.yearMonth);
    }

    // Step 4: Delete existing badges and recompute (for true idempotency)
    await db.prepare(`
      DELETE FROM archetype_badges WHERE user_id = ?
    `).bind(userId).run();

    // Award badges for any months with streaks
    let badgesAwarded = 0;
    for (const yearMonth of processedMonths) {
      const awarded = await checkAndAwardBadges(db, userId, yearMonth);
      badgesAwarded += awarded;
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Backfill complete',
      stats: {
        entriesProcessed: entries.length,
        cardsTracked: totalCardsTracked,
        uniqueCardMonths: cardCounts.size,
        monthsProcessed: processedMonths.size,
        badgesAwarded
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Backfill error:', error);
    return new Response(JSON.stringify({
      error: 'Backfill failed',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Check for and award badges based on card frequencies
 * Returns count of new badges awarded
 *
 * Note: This is called after all badges have been deleted for idempotency,
 * so we insert directly without checking for existing badges.
 */
async function checkAndAwardBadges(db, userId, yearMonth) {
  const now = Math.floor(Date.now() / 1000);
  let awarded = 0;

  // Get current month's card counts
  const cardsQuery = await db.prepare(`
    SELECT card_name, count
    FROM card_appearances
    WHERE user_id = ? AND year_month = ?
  `).bind(userId, yearMonth).all();

  const cards = cardsQuery.results || [];

  // Award streak badges for cards appearing 3+ times
  for (const card of cards) {
    if (card.count >= 3) {
      const badgeKey = `streak_3x_${card.card_name.toLowerCase().replace(/\s+/g, '_')}_${yearMonth}`;

      const metadata = JSON.stringify({
        count: card.count,
        month: yearMonth,
        context: `${card.card_name} appeared ${card.count} times in ${yearMonth}`
      });

      await db.prepare(`
        INSERT INTO archetype_badges (user_id, badge_type, badge_key, card_name, earned_at, metadata_json)
        VALUES (?, 'streak', ?, ?, ?, ?)
      `).bind(userId, badgeKey, card.card_name, now, metadata).run();

      awarded++;
    }
  }

  return awarded;
}
