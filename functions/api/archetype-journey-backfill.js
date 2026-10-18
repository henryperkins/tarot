import { getUserFromRequest } from '../lib/auth.js';
import { buildCorsHeaders } from '../lib/utils.js';
import { isMachineCredential } from '../lib/entitlements.js';
import { checkJournalAccess } from '../lib/journalAccess.js';
import { journeyRebuildStatements, journeyRebuildSummary } from '../lib/journeyAnalytics.js';

export async function onRequest({ request, env }) {
  const headers = { ...buildCorsHeaders(request, { methods: 'POST, OPTIONS' }), 'Content-Type': 'application/json' };
  const respond = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (request.method === 'OPTIONS') return new Response(null, { headers });
  if (request.method !== 'POST') return respond({ error: 'Method not allowed' }, 405);

  try {
    const user = await getUserFromRequest(request, env);
    if (!user || isMachineCredential(user)) return respond({ error: 'Session authentication required' }, 401);
    const denied = checkJournalAccess(user);
    if (denied) return respond(denied.body, denied.status);
    const prefs = await env.DB.prepare('SELECT archetype_journey_enabled FROM user_analytics_prefs WHERE user_id = ?').bind(user.id).first();
    if (prefs?.archetype_journey_enabled === 0) return respond({ error: 'Analytics disabled', enabled: false }, 403);

    // One atomic publication, including the source read and preference check.
    // Concurrent saves/deletes cannot be overwritten by a stale snapshot.
    const results = await env.DB.batch([
      ...journeyRebuildStatements(env.DB, user.id),
      journeyRebuildSummary(env.DB, user.id)
    ]);
    const { enabled, ...stats } = results.at(-1).results[0];
    if (!enabled) return respond({ error: 'Analytics disabled', enabled: false }, 403);
    return respond({ success: true, message: 'Backfill complete', stats });
  } catch (error) {
    console.error('Backfill error:', error);
    return respond({ error: 'Backfill failed' }, 500);
  }
}
