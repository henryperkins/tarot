import { getUserFromRequest } from '../../lib/auth.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const user = await getUserFromRequest(request, env);
  
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Last 90 days
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const startMonth = ninetyDaysAgo.toISOString().slice(0, 7);

  try {
    const recurring = await env.DB.prepare(`
      SELECT pattern_type, pattern_id, COUNT(*) as occurrence_count,
             MAX(created_at) as last_seen
      FROM pattern_occurrences
      WHERE user_id = ? AND year_month >= ?
      GROUP BY pattern_type, pattern_id
      HAVING COUNT(*) >= 3
      ORDER BY occurrence_count DESC
    `).bind(user.id, startMonth).all();

    return new Response(JSON.stringify({
      alerts: recurring.results || []
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
