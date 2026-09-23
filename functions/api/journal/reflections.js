/**
 * Journal Reflections
 * POST /api/journal/:id/reflections - Append a reflection to a saved entry
 *
 * The behaviour lives in functions/lib/journalReflections.js, which is
 * shared with the ChatGPT MCP tools.
 *
 * Auth goes through getUserFromRequest (session cookie, bearer session
 * token, `sk_` API key). The synthetic GPT service account is refused by
 * journalAccessDenied.
 */

import { getUserFromRequest } from '../../lib/auth.js';
import { journalAccessDenied } from '../../lib/journalAccess.js';
import { addJournalReflection } from '../../lib/journalReflections.js';

export {
  MAX_REFLECTION_LENGTH,
  READING_REFLECTION_KEY,
  resolveCardIndex
} from '../../lib/journalReflections.js';

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const logRequestId = crypto.randomUUID();

  try {
    const user = await getUserFromRequest(request, env);
    const denied = journalAccessDenied(user);
    if (denied) return denied;

    const input = await request.json().catch(() => null);
    const result = await addJournalReflection({ env, user, entryId: params?.id, input });
    return json(result.body, result.status);
  } catch (error) {
    console.error(`[${logRequestId}] [journal] Add reflection error:`, error);
    return json({ error: 'Internal server error' }, 500);
  }
}
