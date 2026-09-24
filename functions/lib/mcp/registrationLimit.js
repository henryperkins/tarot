/**
 * Per-address rate limit for dynamic client registration. Registered clients
 * never expire (D13), so admission must be atomic across Worker isolates.
 * Workers KV is unsuitable for a read/modify/write counter and rejects rapid
 * writes to the same key. D1 serializes the conditional UPSERT.
 */
import { getHashedClientIdentifier } from '../clientId.js';

export const REGISTRATION_LIMIT_PER_HOUR = 10;
const WINDOW_MS = 3_600_000;

function unavailable() {
  return new Response(JSON.stringify({
    error: 'temporarily_unavailable',
    error_description: 'Client registration is temporarily unavailable.'
  }), {
    status: 503,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Retry-After': '60' }
  });
}

/**
 * @returns {Promise<Response|null>} A 429 response, or null when allowed
 */
export async function enforceRegistrationRateLimit(env, request, { now = Date.now() } = {}) {
  const db = env?.DB;
  if (!db?.prepare || !db?.batch) return unavailable();
  try {
    const windowStartHour = Math.floor(now / WINDOW_MS);
    const clientKey = await getHashedClientIdentifier(request);
    // D1 batches execute sequentially in one transaction. Keep the current
    // and prior hour; remove older buckets without a separate scheduled job.
    const [, admission] = await db.batch([
      db.prepare('DELETE FROM oauth_registration_counters WHERE window_start_hour < ?')
        .bind(windowStartHour - 1),
      db.prepare(`
        INSERT INTO oauth_registration_counters (client_key, window_start_hour, attempts)
        VALUES (?, ?, 1)
        ON CONFLICT (client_key, window_start_hour) DO UPDATE
          SET attempts = attempts + 1
          WHERE attempts < ?
        RETURNING attempts
      `).bind(clientKey, windowStartHour, REGISTRATION_LIMIT_PER_HOUR)
    ]);
    if (!admission?.success || !Array.isArray(admission.results)) return unavailable();
    if (admission.results.length === 1) return null;
    if (admission.results.length !== 0) return unavailable();
    const retryAfter = Math.max(1, Math.ceil(((windowStartHour + 1) * WINDOW_MS - now) / 1000));
    return new Response(
      JSON.stringify({
        error: 'too_many_requests',
        error_description: 'Too many client registrations from this address. Try again later.'
      }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Retry-After': String(retryAfter) } }
    );
  } catch {
    // Missing migration, D1 outage, or malformed response: never admit DCR.
    return unavailable();
  }
}
