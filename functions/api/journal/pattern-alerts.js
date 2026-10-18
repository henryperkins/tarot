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
      SELECT pattern_type, pattern_id, COUNT(DISTINCT p.entry_id) as occurrence_count,
             MAX(p.created_at) as last_seen, json_group_array(DISTINCT p.entry_id) AS entry_ids_json
      FROM pattern_occurrences p
      JOIN journal_entries j ON j.id = p.entry_id AND j.user_id = p.user_id
      WHERE p.user_id = ? AND year_month >= ?
      GROUP BY pattern_type, pattern_id
      HAVING COUNT(DISTINCT p.entry_id) >= 3
      ORDER BY occurrence_count DESC
    `).bind(user.id, startMonth).all();

    return new Response(JSON.stringify({
      alerts: (recurring.results || []).map(({ entry_ids_json, ...alert }) => ({
        ...alert, entryIds: JSON.parse(entry_ids_json)
      }))
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
