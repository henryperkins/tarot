import { createWebVisualCapability } from '../lib/readingVisualWebAdmission.js';
import { isServiceAccount } from '../lib/journalAccess.js';
import { getUserFromRequest } from '../lib/auth.js';
import { createVisualReplayAdmission, retryLocalVisuals } from '../lib/readingVisualRetry.js';
import { jsonResponse } from '../lib/utils.js';

export async function onRequestPost({ env, request }) {
  try {
    const user = await getUserFromRequest(request, env);
    if (isServiceAccount(user)) return jsonResponse({ error: 'Service accounts cannot replay visuals.' }, { status: 403 });
    const body = await request.json();
    const admission = await createVisualReplayAdmission({ env, userId: user?.id || null, request, visualCapability: createWebVisualCapability({ env, request, user }) });
    const result = await retryLocalVisuals({ env, admission, savedSource: body.savedSource });
    const headers = admission?.issuedToken ? { 'Set-Cookie': `visual_replay_principal=${admission.issuedToken}; Path=/api/tarot-reading; HttpOnly; Secure; SameSite=Strict; Max-Age=86400` } : {};
    return jsonResponse(result, { status: result.state ? 200 : 400, headers });
  } catch { return jsonResponse({ error: 'Visual replay is unavailable.' }, { status: 503 }); }
}
