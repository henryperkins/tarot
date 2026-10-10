import { getUserFromRequest } from '../../../lib/auth.js';
import { journalAccessDenied } from '../../../lib/journalAccess.js';
import { retryJournalVisuals } from '../../../lib/readingVisualRetry.js';
import { jsonResponse } from '../../../lib/utils.js';

export async function onRequestPost({ env, request, params }) {
  try {
    const user = await getUserFromRequest(request, env);
    const denied = journalAccessDenied(user);
    if (denied) return denied;
    const result = await retryJournalVisuals({ env, userId: user.id, entryId: params?.entryId });
    return jsonResponse(result, { status: result.state ? 200 : 404 });
  } catch { return jsonResponse({ error: 'Visual replay is unavailable.' }, { status: 503 }); }
}
