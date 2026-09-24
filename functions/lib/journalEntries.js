/**
 * Journal entry persistence shared by POST /api/journal (the app, API keys,
 * bearer sessions) and the ChatGPT MCP tools.
 *
 * App saves keep the journal contract: sessionSeed is the only
 * deduplication key. MCP reading saves (saveReadingJournalEntry) add an
 * atomic reading identity; see migration 0030.
 */

import { scheduleCoachExtraction } from './coachSuggestion.js';
import { insertFollowUps, sanitizeFollowUps } from './journalFollowups.js';
import { normalizeJournalContext } from './journalContext.js';
import { safeJsonParse } from './utils.js';

/**
 * Whether a D1/SQLite error is a unique-constraint failure on the given
 * journal_entries column. Production D1 wraps the SQLite text
 * ("D1_ERROR: UNIQUE constraint failed: journal_entries.user_id, ..."),
 * so this matches substrings rather than the whole message.
 *
 * @param {unknown} error
 * @param {string} column - journal_entries column, e.g. 'session_seed'
 * @returns {boolean}
 */
export function isUniqueViolation(error, column) {
  const message = String(error?.message || error || '');
  return /UNIQUE constraint failed/i.test(message) && message.includes(`journal_entries.${column}`);
}

async function findEntryBySeed(db, userId, sessionSeed) {
  return db.prepare(
    `SELECT id, created_at FROM journal_entries WHERE user_id = ? AND session_seed = ?`
  ).bind(userId, sessionSeed).first();
}

/**
 * Save an entry posted to POST /api/journal.
 *
 * Unchanged contract, plus one fix: a seeded save that loses a race on
 * idx_journal_user_session_seed_unique returns the winner's entry (200,
 * deduplicated) instead of a 500.
 *
 * @param {object} params
 * @param {object} params.env - Worker bindings; env.DB is required
 * @param {object} params.user - Authenticated, journal-entitled user
 * @param {object} params.body - Parsed request body
 * @param {Function} [params.waitUntil]
 * @returns {Promise<{ status: number, body: object }>}
 */
export async function saveAppJournalEntry({ env, user, body, waitUntil }) {
  const {
    spread,
    spreadKey,
    question,
    cards,
    personalReading,
    themes,
    reflections,
    context,
    provider,
    sessionSeed,
    // Optional: original timestamp in milliseconds (used for migrations)
    timestampMs,
    // User preferences snapshot at time of reading (Phase 5.2)
    userPreferences,
    // Deck style identifier (rws1909, marseille, thoth, etc.)
    deckId,
    // Request ID for API tracing/correlation
    requestId,
    // Optional: saved follow-up conversation (array of {question, answer, turnNumber, createdAt, journalContext})
    followUps,
    // Location data (only persisted if user explicitly consents)
    location,
    persistLocationConsent
  } = body || {};

  if (!spread || !spreadKey || !cards || !Array.isArray(cards)) {
    return { status: 400, body: { error: 'Invalid journal entry data' } };
  }
  const sanitizedFollowUps = sanitizeFollowUps(followUps);

  const returnExisting = async (existing) => {
    if (sanitizedFollowUps.length) {
      await insertFollowUps(env.DB, user.id, existing.id, sanitizedFollowUps, {
        readingRequestId: requestId,
        requestId
      });
    }
    return {
      status: 200,
      body: {
        success: true,
        entry: { id: existing.id, ts: existing.created_at * 1000 },
        deduplicated: true
      }
    };
  };

  // Deduplicate by session_seed to prevent double-saves
  if (sessionSeed) {
    const existing = await findEntryBySeed(env.DB, user.id, sessionSeed);
    if (existing) return returnExisting(existing);
  }

  const entryId = crypto.randomUUID();
  const nowSeconds = Math.floor(Date.now() / 1000);

  // Derive created_at/updated_at, allowing a **sanitized** client timestamp
  // for trusted flows like local-to-cloud migration.
  let createdAt = nowSeconds;
  if (typeof timestampMs === 'number' && Number.isFinite(timestampMs)) {
    const candidateSeconds = Math.floor(timestampMs / 1000);
    // Basic sanity window: >= 2000-01-01 and not more than 24h in the future
    const MIN_ALLOWED = 946684800; // 2000-01-01T00:00:00Z
    const MAX_ALLOWED = nowSeconds + 60 * 60 * 24;
    if (candidateSeconds >= MIN_ALLOWED && candidateSeconds <= MAX_ALLOWED) {
      createdAt = candidateSeconds;
    }
  }
  const updatedAt = createdAt;

  // Keep older/unknown context values nullable without rejecting the reading.
  const normalizedContext = normalizeJournalContext(context);

  // Location persistence: only store if BOTH location provided AND user explicitly consents
  const shouldPersistLocation = location?.latitude != null &&
                                location?.longitude != null &&
                                persistLocationConsent === true;
  const locationLatitude = shouldPersistLocation ? location.latitude : null;
  const locationLongitude = shouldPersistLocation ? location.longitude : null;
  const locationTimezone = shouldPersistLocation ? (location.timezone || null) : null;
  const locationConsent = shouldPersistLocation ? 1 : 0;

  try {
    const inserted = await env.DB.prepare(`
      INSERT INTO journal_entries (
        id,
        user_id,
        created_at,
        updated_at,
        spread_key,
        spread_name,
        question,
        cards_json,
        narrative,
        themes_json,
        reflections_json,
        context,
        provider,
        session_seed,
        user_preferences_json,
        deck_id,
        request_id,
        location_latitude,
        location_longitude,
        location_timezone,
        location_consent
      )
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      WHERE NOT EXISTS (
        SELECT 1 FROM journal_entries WHERE user_id = ? AND session_seed = ?
      )
    `)
      .bind(
        entryId,
        user.id,
        createdAt,
        updatedAt,
        spreadKey,
        spread,
        question || null,
        JSON.stringify(cards),
        personalReading || null,
        themes ? JSON.stringify(themes) : null,
        reflections ? JSON.stringify(reflections) : null,
        normalizedContext,
        provider || null,
        sessionSeed || null,
        userPreferences ? JSON.stringify(userPreferences) : null,
        deckId || null,
        requestId || null,
        locationLatitude,
        locationLongitude,
        locationTimezone,
        locationConsent,
        user.id,
        sessionSeed || null
      )
      .run();
    // Preserve the app's atomic seed admission even on older databases that
    // lack the unique index. NULL seeds deliberately never match this query.
    if (inserted.meta.changes === 0) {
      const existing = await findEntryBySeed(env.DB, user.id, sessionSeed);
      if (!existing) throw new Error('Seeded save could not be resolved');
      return returnExisting(existing);
    }
  } catch (error) {
    // A concurrent save of the same seed won the unique index; answer with
    // its entry, exactly as the pre-insert lookup would have.
    if (sessionSeed && isUniqueViolation(error, 'session_seed')) {
      const existing = await findEntryBySeed(env.DB, user.id, sessionSeed);
      if (existing) return returnExisting(existing);
    }
    throw error;
  }

  if (sanitizedFollowUps.length) {
    await insertFollowUps(env.DB, user.id, entryId, sanitizedFollowUps, {
      readingRequestId: requestId,
      requestId
    });
  }

  // Schedule async extraction of coach suggestion data (steps + embeddings)
  if (personalReading && waitUntil) {
    scheduleCoachExtraction(env, entryId, personalReading, {
      waitUntil,
      requestId: requestId || entryId
    });
  }

  return {
    status: 201,
    body: {
      success: true,
      entry: { id: entryId, ts: createdAt * 1000 }
    }
  };
}

// ---------------------------------------------------------------------------
// Reading saves from the ChatGPT MCP tools (spec §7.2)
// ---------------------------------------------------------------------------

export const READING_IDEMPOTENCY_PREFIX = 'reading:';

/**
 * Content identity of a reading: spread key plus each card's position,
 * canonical name and orientation, in order. A request ID that already holds
 * a different fingerprint belongs to a different reading.
 *
 * @param {string|null} spreadKey
 * @param {Array<object>} cards - Journal cards (canonical `name`)
 * @returns {string}
 */
export function cardFingerprint(spreadKey, cards) {
  const list = Array.isArray(cards) ? cards : [];
  return JSON.stringify([
    spreadKey ?? null,
    ...list.map((card) => [card?.position ?? null, card?.name ?? null, card?.orientation ?? null])
  ]);
}

async function findEntryByIdempotencyKey(db, userId, idempotencyKey) {
  return db.prepare(
    'SELECT id, created_at, spread_key, cards_json FROM journal_entries WHERE user_id = ? AND idempotency_key = ?'
  ).bind(userId, idempotencyKey).first();
}

function isSameReading(row, fingerprint) {
  return cardFingerprint(row.spread_key, safeJsonParse(row.cards_json, [])) === fingerprint;
}

function entryRef(row) {
  return { id: row.id, ts: row.created_at * 1000 };
}

async function insertReadingEntry(db, { entryId, userId, now, entry, sessionSeed, idempotencyKey }) {
  await db.prepare(`
    INSERT INTO journal_entries (
      id, user_id, created_at, updated_at, spread_key, spread_name, question, cards_json,
      narrative, themes_json, reflections_json, context, provider, session_seed,
      user_preferences_json, deck_id, request_id, location_latitude, location_longitude,
      location_timezone, location_consent, idempotency_key
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, 0, ?)
  `).bind(
    entryId,
    userId,
    now,
    now,
    entry.spreadKey,
    entry.spread,
    entry.question ?? null,
    JSON.stringify(entry.cards),
    entry.personalReading,
    entry.themes ? JSON.stringify(entry.themes) : null,
    normalizeJournalContext(entry.context),
    entry.provider ?? null,
    sessionSeed,
    entry.userPreferences ? JSON.stringify(entry.userPreferences) : null,
    entry.deckId ?? null,
    entry.requestId,
    idempotencyKey
  ).run();
}

async function verifyAfterError(db, userId, idempotencyKey, fingerprint, error) {
  console.error('[journal] Reading save failed; verifying before answering:', error?.message || error);
  let existing;
  try {
    existing = await findEntryByIdempotencyKey(db, userId, idempotencyKey);
  } catch (verifyError) {
    console.error('[journal] Verification after a failed reading save also failed:', verifyError?.message || verifyError);
    return { outcome: 'unconfirmed' };
  }
  if (!existing) return { outcome: 'not_saved' };
  return isSameReading(existing, fingerprint)
    ? { outcome: 'saved', entry: entryRef(existing) }
    : { outcome: 'conflict' };
}

/**
 * Save a completed reading from the MCP tools, from either a job snapshot or
 * a contract payload. The insert goes first, and the unique indexes decide:
 * - idempotency_key taken: the reading is already stored (same fingerprint,
 *   so already_saved), or the request ID belongs to a different reading
 *   (conflict, with nothing written);
 * - session_seed taken: a different reading holds the seed (for example a
 *   reused seed phrase), so store this reading without it (seedShared);
 * - anything else: re-read by identity before answering.
 *
 * @param {object} params
 * @param {object} params.env - Worker bindings; env.DB is required
 * @param {object} params.user - Authenticated, journal-entitled user
 * @param {object} params.entry - Normalized entry; see the plan's Task 3 interfaces
 * @param {Function} [params.waitUntil]
 */
export async function saveReadingJournalEntry({ env, user, entry, waitUntil }) {
  const db = env.DB;
  const idempotencyKey = `${READING_IDEMPOTENCY_PREFIX}${entry.requestId}`;
  const fingerprint = cardFingerprint(entry.spreadKey, entry.cards);

  const attempt = async (sessionSeed) => {
    const entryId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    try {
      await insertReadingEntry(db, { entryId, userId: user.id, now, entry, sessionSeed, idempotencyKey });
      return { outcome: 'saved', entry: { id: entryId, ts: now * 1000 }, inserted: true };
    } catch (error) {
      if (isUniqueViolation(error, 'idempotency_key')) {
        const existing = await findEntryByIdempotencyKey(db, user.id, idempotencyKey);
        if (existing && isSameReading(existing, fingerprint)) {
          return { outcome: 'already_saved', entry: entryRef(existing) };
        }
        return { outcome: 'conflict' };
      }
      if (sessionSeed && isUniqueViolation(error, 'session_seed')) {
        return { outcome: 'retry_without_seed' };
      }
      return verifyAfterError(db, user.id, idempotencyKey, fingerprint, error);
    }
  };

  let result = await attempt(entry.sessionSeed || null);
  let seedShared = false;
  if (result.outcome === 'retry_without_seed') {
    // The seed never identifies a reading on this path; the idempotency key
    // still dedupes retries of this one.
    seedShared = true;
    result = await attempt(null);
  }

  if (result.outcome !== 'saved') return result;

  if (result.inserted && entry.personalReading && waitUntil) {
    scheduleCoachExtraction(env, result.entry.id, entry.personalReading, {
      waitUntil,
      requestId: entry.requestId
    });
  }
  return { outcome: 'saved', entry: result.entry, ...(seedShared ? { seedShared: true } : {}) };
}
