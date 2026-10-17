import { createWebVisualCapability } from '../../functions/lib/readingVisualWebAdmission.js';
import { startReadingJob as start } from '../../functions/lib/readingJobs.js';
import { createVisualReplayAdmission as admit, retryJournalVisuals as retry } from '../../functions/lib/readingVisualRetry.js';
import { getUserFromRequest } from '../../functions/lib/auth.js';
import { seedUser, seedSession } from './journalFixtures.mjs';

/** Explicit offline paid-web fixture; never used by denial regressions. */
export async function paidWebVisualArguments(env, userId = 'user-1') {
  if (!env.DB?.sqlite) return {};
  if (!env.DB.rows('SELECT id FROM users WHERE id = ?', [userId]).length) await seedUser(env.DB, { id: userId });
  const sessionId = `controlled-visual-${userId}`;
  if (!env.DB.rows('SELECT id FROM sessions WHERE id = ?', [sessionId]).length) await seedSession(env.DB, { id: sessionId, userId });
  env.VISUAL_CUE_ALLOWED_TIERS = '["plus","pro"]';
  const request = new Request('https://test/api/tarot-reading/jobs', { method: 'POST',
    headers: { Cookie: `session=${sessionId}`, 'X-Reading-Cue-Display': '1' } });
  const user = await getUserFromRequest(request, env);
  return { ownerUserId: userId, visualCapability: createWebVisualCapability({ env, request, user }) };
}

export async function startReadingJob(params) {
  return start({ ...await paidWebVisualArguments(params.env, params.ownerUserId), ...params });
}

export async function createVisualReplayAdmission(params) {
  const args = params.userId ? await paidWebVisualArguments(params.env, params.userId) : {};
  return admit({ ...args, ...params });
}

export async function retryJournalVisuals(params) {
  return retry({ ...await paidWebVisualArguments(params.env, params.userId), ...params });
}
