import { safeJsonParse } from './utils.js';

const MAX_FOLLOWUPS_PER_ENTRY = 50;
const MAX_TEXT_LENGTH = 4000; // prevent oversized payloads

function clampText(value, max = MAX_TEXT_LENGTH) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

function normalizeTimestamp(value) {
  if (!Number.isFinite(value)) return null;
  // Accept seconds or milliseconds epoch; normalize to seconds
  if (value > 0 && value < 1_000_000_000_000) return Math.floor(value);
  return Math.floor(value / 1000);
}

/**
 * Sanitize follow-up payloads from client/UI.
 * @param {Array} followUps
 * @param {Object} options
 * @param {number} options.max
 * @returns {Array} Cleaned follow-ups with shape { turnNumber, question, answer, journalContext, createdAt }
 */
export function sanitizeFollowUps(followUps, { max = MAX_FOLLOWUPS_PER_ENTRY } = {}) {
  if (!Array.isArray(followUps)) return [];

  const cleaned = [];
  const seenTurns = new Set();

  followUps.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;

    const question = clampText(item.question, 800);
    const answer = clampText(item.answer, MAX_TEXT_LENGTH);
    if (!question || !answer) return;

    const explicitTurn = Number.isFinite(item.turnNumber)
      ? Number(item.turnNumber)
      : null;
    const fallbackTurn = cleaned.length + 1;
    const turnNumber = explicitTurn && explicitTurn > 0 ? explicitTurn : fallbackTurn;

    if (turnNumber > 0 && seenTurns.has(turnNumber)) {
      return;
    }
    if (turnNumber > 0) {
      seenTurns.add(turnNumber);
    }

    const createdAt = normalizeTimestamp(item.createdAt);

    const journalContext = item.journalContext && typeof item.journalContext === 'object'
      ? item.journalContext
      : null;

    cleaned.push({
      turnNumber: turnNumber > 0 ? turnNumber : index + 1,
      question,
      answer,
      journalContext,
      createdAt
    });
  });

  return cleaned.slice(0, max);
}

/**
 * Persist an array of follow-up turns for a journal entry.
 */
export async function insertFollowUps(db, userId, entryId, followUps, { readingRequestId, requestId } = {}) {
  if (!db || !userId || !entryId) return { inserted: 0 };

  const cleaned = sanitizeFollowUps(followUps);
  if (!cleaned.length) return { inserted: 0 };

  let inserted = 0;
  const nowSeconds = Math.floor(Date.now() / 1000);

  for (const item of cleaned) {
    const id = crypto.randomUUID();
    const createdAt = item.createdAt ?? nowSeconds;
    const ctxJson = item.journalContext ? JSON.stringify(item.journalContext) : null;

    try {
      await db.prepare(`
        INSERT OR IGNORE INTO journal_followups (
          id, user_id, entry_id, reading_request_id, request_id,
          turn_number, question, answer, journal_context_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        userId,
        entryId,
        readingRequestId || null,
        requestId || null,
        item.turnNumber || null,
        item.question,
        item.answer,
        ctxJson,
        createdAt
      ).run();
      inserted += 1;
    } catch (error) {
      // Table may not exist yet; degrade gracefully
      console.warn('[insertFollowUps] Error inserting follow-up:', error?.message || error);
    }
  }

  return { inserted };
}

/**
 * Append a single follow-up turn for an entry.
 */
export async function appendFollowUp(db, userId, entryId, followUp, meta = {}) {
  return insertFollowUps(db, userId, entryId, [followUp], meta);
}

/**
 * Load follow-ups for a set of entry IDs.
 * Returns a Map of entryId -> array of follow-ups ordered by createdAt ASC.
 */
export async function loadFollowUpsByEntry(db, userId, entryIds, { limitPerEntry = MAX_FOLLOWUPS_PER_ENTRY } = {}) {
  const resultMap = new Map();
  if (!db || !userId || !Array.isArray(entryIds) || entryIds.length === 0) {
    return resultMap;
  }

  const uniqueIds = Array.from(new Set(entryIds.filter(Boolean)));
  if (!uniqueIds.length) return resultMap;

  const placeholders = uniqueIds.map(() => '?').join(', ');
  try {
    const rows = await db.prepare(`
      SELECT entry_id, turn_number, question, answer, journal_context_json, created_at
      FROM journal_followups
      WHERE user_id = ? AND entry_id IN (${placeholders})
      ORDER BY created_at ASC
    `).bind(userId, ...uniqueIds).all();

    const grouped = new Map();
    (rows?.results || []).forEach((row) => {
      const list = grouped.get(row.entry_id) || [];
      list.push({
        turnNumber: row.turn_number,
        question: row.question,
        answer: row.answer,
        createdAt: row.created_at ? row.created_at * 1000 : null,
        journalContext: safeJsonParse(row.journal_context_json, null)
      });
      grouped.set(row.entry_id, list);
    });

    grouped.forEach((list, entryId) => {
      resultMap.set(entryId, list.slice(0, limitPerEntry));
    });
  } catch (error) {
    console.warn('[loadFollowUpsByEntry] Error loading follow-ups:', error?.message || error);
  }

  return resultMap;
}
