import { getUserFromRequest } from '../../lib/auth.js';

export async function onRequestGet(context) {
  const { request, env } = context;

  // CORS headers
  const origin = request.headers.get('Origin');
  const corsHeaders = {
    'Access-Control-Allow-Methods': 'GET',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Origin': origin || '*'
  };
  if (origin) {
    corsHeaders['Access-Control-Allow-Credentials'] = 'true';
    corsHeaders['Vary'] = 'Origin';
  }

  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Aggregate ALL card appearances
    const query = await env.DB.prepare(`
      SELECT
        card_name,
        MAX(card_number) as card_number,
        SUM(count) as total_count,
        MAX(last_seen) as last_seen,
        MIN(first_seen) as first_seen
      FROM card_appearances
      WHERE user_id = ?
      GROUP BY card_name
      ORDER BY total_count DESC
    `).bind(user.id).all();

    const cards = query.results || [];

    // Get basic stats
    const totalCardsSeen = cards.length;
    const totalDraws = cards.reduce((sum, c) => sum + (c.total_count || 0), 0);

    return new Response(JSON.stringify({
      cards,
      stats: {
        uniqueCardsSeen: totalCardsSeen,
        totalDraws,
        totalDeckSize: 78 // Standard tarot deck
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Card frequency API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
