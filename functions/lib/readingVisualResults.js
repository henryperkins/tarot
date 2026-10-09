import { canonicalVisualCueJSON, hashVisualCueText, sameVisualCueBinding, visualCueBindingSchema } from '../../shared/contracts/visualCueBatches.js';
import { createVisualCueLedger } from '../../shared/reading/visualCueLedger.js';
import { fingerprintVisualSource } from '../../shared/reading/visualSourceIdentity.js';

export const computeSourceFingerprint = fingerprintVisualSource;
const nowSeconds = () => Math.floor(Date.now() / 1000);
const parse = value => { try { return JSON.parse(value); } catch { return null; } };
const changed = result => Number(result?.meta?.changes || 0) > 0;
const selectResult = (db, id) => db.prepare('SELECT * FROM reading_visual_results WHERE id = ?').bind(id).first();
const exactOwner = (row, userId) => (row.user_id || null) === (userId || null);

/** Trusted job initialization only. Public journal saves never register a result. */
export async function registerVisualResult({ db, userId = null, readingResultId, binding, expiresAt = null }) {
  if (!db) return { ok: true, skipped: true };
  if (!visualCueBindingSchema.safeParse(binding).success || binding.readingResultId !== readingResultId) {
    return { ok: false, reason: 'invalid-binding' };
  }
  const now = nowSeconds();
  await db.prepare(`INSERT INTO reading_visual_results
    (id, user_id, created_at, updated_at, binding_json, source_revision, raw_hash, observed_raw, ledger_revision, ledger_json, status, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, '', 0, ?, 'pending', ?)
    ON CONFLICT(id) DO NOTHING`).bind(
    readingResultId, userId, now, now, JSON.stringify(binding), binding.sourceRevision,
    await hashVisualCueText(''), JSON.stringify(createVisualCueLedger(binding)), expiresAt
  ).run();
  const row = await selectResult(db, readingResultId);
  return exactOwner(row, userId) && sameVisualCueBinding(parse(row.binding_json), binding)
    ? { ok: true } : { ok: false, reason: 'registration-conflict' };
}

/** Persist delivered prose independently of annotation completion. */
export async function updateVisualResultSource({ db, userId = null, readingResultId, binding, raw, complete = false }) {
  if (!db) return { ok: true, skipped: true };
  const row = await selectResult(db, readingResultId);
  if (!row) return { ok: false, reason: 'not-found' };
  if (!exactOwner(row, userId)) return { ok: false, reason: 'ownership-mismatch' };
  if (!visualCueBindingSchema.safeParse(binding).success || binding.readingResultId !== readingResultId || typeof raw !== 'string') {
    return { ok: false, reason: 'invalid-source' };
  }
  const priorBinding = parse(row.binding_json);
  const replacement = binding.sourceRevision > row.source_revision;
  if (!replacement && !sameVisualCueBinding(priorBinding, binding)) return { ok: false, reason: 'source-revision-conflict' };
  if (!replacement && (!raw.startsWith(row.observed_raw) || (row.final_raw !== null && raw !== row.final_raw))) {
    return { ok: false, reason: 'source-conflict' };
  }
  const hash = await hashVisualCueText(raw);
  const statements = [db.prepare(`UPDATE reading_visual_results SET
    updated_at = ?, binding_json = ?, source_revision = ?, raw_hash = ?, observed_raw = ?, final_raw = ?,
    ledger_revision = ?, ledger_json = ?, status = ?
    WHERE id = ? AND user_id IS ? AND binding_json = ? AND ledger_revision = ? AND observed_raw = ? AND ledger_json = ?`).bind(
    nowSeconds(), JSON.stringify(binding), binding.sourceRevision, hash, raw,
    complete ? raw : (replacement ? null : row.final_raw),
    replacement ? 0 : row.ledger_revision,
    replacement ? JSON.stringify(createVisualCueLedger(binding)) : row.ledger_json,
    replacement ? 'pending' : row.status,
    readingResultId, userId, row.binding_json, row.ledger_revision, row.observed_raw, row.ledger_json
  )];
  // A saved reading owns its accepted old-source snapshot even after regeneration.
  if (replacement) statements.push(db.prepare(`UPDATE journal_visual_links
    SET archived_visual_json = ? WHERE reading_result_id = ? AND source_revision = ?
      AND archived_visual_json IS NULL
      AND EXISTS (SELECT 1 FROM reading_visual_results WHERE id = ? AND source_revision = ?)`)
    .bind(JSON.stringify({ ...visualEnvelope(row), status: 'cancelled' }), readingResultId,
      row.source_revision, readingResultId, binding.sourceRevision));
  const results = await db.batch(statements);
  return changed(results[0]) ? { ok: true } : { ok: false, reason: 'source-conflict' };
}

export async function attachJournalVisualResult({ db, userId, entryId, readingResultId }) {
  if (!db || !userId || !entryId || !readingResultId) return { attached: false, reason: 'missing-arguments' };
  const row = await selectResult(db, readingResultId);
  if (!row) return { attached: false, reason: 'unregistered-result' };
  if (row.user_id !== userId) return { attached: false, reason: 'ownership-mismatch' };
  // Read the saved row, including on deduplication. Never trust incoming replacement prose.
  const entry = await db.prepare('SELECT * FROM journal_entries WHERE id = ? AND user_id = ?').bind(entryId, userId).first();
  if (!entry) return { attached: false, reason: 'entry-not-found' };
  const fingerprint = await computeSourceFingerprint({
    raw: entry.narrative || '', cards: parse(entry.cards_json) || [], question: entry.question || '',
    reflections: parse(entry.reflections_json) || '', deckId: entry.deck_id
  });
  const binding = parse(row.binding_json);
  if (!binding || binding.spreadHash !== fingerprint.spreadHash || binding.contextHash !== fingerprint.contextHash
      || (row.final_raw !== null && row.raw_hash !== fingerprint.rawHash)
      || !(entry.narrative || '').startsWith(row.observed_raw)) {
    return { attached: false, reason: 'fingerprint-mismatch' };
  }
  const result = await db.prepare(`INSERT INTO journal_visual_links
    (journal_entry_id, reading_result_id, user_id, created_at, expected_raw_hash, source_revision)
    SELECT ?, id, user_id, ?, ?, source_revision FROM reading_visual_results
    WHERE id = ? AND user_id = ? AND binding_json = ? AND observed_raw = ?
    ON CONFLICT(journal_entry_id) DO NOTHING`).bind(
    entryId, nowSeconds(), fingerprint.rawHash, readingResultId, userId, row.binding_json, row.observed_raw
  ).run();
  const visual = await loadJournalVisualResult({ db, userId, entryId });
  return visual?.readingResultId === readingResultId
    ? { attached: true, status: visual.status, ledgerRevision: visual.ledgerRevision, snapshot: visual.cueLedger, binding: visual.binding }
    : { attached: false, reason: changed(result) ? 'source-conflict' : 'existing-link' };
}

/** Compare-and-swap only; deleted results cannot be recreated by a late worker. */
export async function commitVisualResult({ db, userId = null, readingResultId, binding, expectedLedgerRevision, expectedReceiptCount = 0, ledger, status = 'complete', finalRaw = null }) {
  if (!db) return { ok: true, skipped: true };
  if (!readingResultId || !binding || !ledger) return { ok: false, reason: 'missing-arguments' };
  const row = await selectResult(db, readingResultId);
  if (!row) return { ok: false, reason: 'not-found' };
  if (!exactOwner(row, userId)) return { ok: false, reason: 'ownership-mismatch' };
  if (!sameVisualCueBinding(parse(row.binding_json), binding) || !sameVisualCueBinding(ledger.binding, binding)) {
    return { ok: false, reason: 'source-revision-conflict' };
  }
  if (!Number.isInteger(expectedLedgerRevision) || expectedLedgerRevision !== row.ledger_revision
      || !Number.isInteger(ledger.ledgerRevision) || ledger.ledgerRevision < row.ledger_revision) {
    return { ok: false, reason: 'stale-ledger' };
  }
  if (typeof ledger.raw !== 'string' || !row.observed_raw.startsWith(ledger.raw)
      || (finalRaw !== null && (finalRaw !== row.final_raw || finalRaw !== row.observed_raw))) {
    return { ok: false, reason: 'source-conflict' };
  }
  const prior = parse(row.ledger_json);
  const isPrefix = (before = [], after = []) => before.length <= after.length
    && before.every((value, index) => canonicalVisualCueJSON(value) === canonicalVisualCueJSON(after[index]));
  if ((prior?.receipts?.length || 0) !== expectedReceiptCount
      || !isPrefix(prior?.receipts, ledger.receipts)
      || !ledger.raw.startsWith(prior?.raw || '')
      || (prior?.cues || []).some(cue => !ledger.cues.some(next => next.id === cue.id && canonicalVisualCueJSON(next) === canonicalVisualCueJSON(cue)))
      || (ledger.ledgerRevision === row.ledger_revision && canonicalVisualCueJSON(prior?.cues || []) !== canonicalVisualCueJSON(ledger.cues || []))) {
    return { ok: false, reason: 'stale-ledger' };
  }
  const result = await db.prepare(`UPDATE reading_visual_results SET updated_at = ?, ledger_revision = ?, ledger_json = ?, status = ?
    WHERE id = ? AND user_id IS ? AND binding_json = ? AND ledger_revision = ? AND observed_raw = ? AND ledger_json = ?`)
    .bind(nowSeconds(), ledger.ledgerRevision, JSON.stringify(ledger), status, readingResultId, userId,
      row.binding_json, expectedLedgerRevision, row.observed_raw, row.ledger_json).run();
  return changed(result) ? { ok: true } : { ok: false, reason: 'stale-ledger' };
}

function visualEnvelope(row) {
  const binding = parse(row.binding_json);
  const ledger = parse(row.ledger_json);
  if (!binding || !ledger || !sameVisualCueBinding(binding, ledger.binding)) return null;
  return {
    readingResultId: row.id, binding, sourceRevision: row.source_revision, ledgerRevision: row.ledger_revision,
    cues: ledger.cues || [], introductions: ledger.introductions || [], status: row.status,
    cueLedger: ledger, snapshot: ledger, finalRaw: row.final_raw
  };
}

const JOURNAL_VISUAL_SELECT = `SELECT r.*, l.journal_entry_id, l.archived_visual_json,
  l.source_revision AS linked_source_revision, l.expected_raw_hash, j.narrative
  FROM journal_visual_links l JOIN reading_visual_results r ON l.reading_result_id = r.id
  JOIN journal_entries j ON j.id = l.journal_entry_id
  WHERE l.user_id = ? AND r.user_id = ? AND j.user_id = ?`;
function linkedEnvelope(row) {
  if (row.archived_visual_json) {
    const archived = parse(row.archived_visual_json);
    if (archived?.binding?.sourceRevision !== row.linked_source_revision
        || !sameVisualCueBinding(archived.binding, archived.cueLedger?.binding)
        || !row.narrative?.startsWith(archived.cueLedger?.raw || '')
        || (archived.finalRaw !== null && archived.finalRaw !== row.narrative)) return null;
    return archived;
  }
  if (row.linked_source_revision !== row.source_revision
      || !row.narrative?.startsWith(row.observed_raw)
      || (row.final_raw !== null && (row.expected_raw_hash !== row.raw_hash || row.narrative !== row.final_raw))) return null;
  return visualEnvelope(row);
}
export async function loadJournalVisualResult({ db, userId, entryId }) {
  if (!db || !userId || !entryId) return null;
  const row = await db.prepare(`${JOURNAL_VISUAL_SELECT} AND l.journal_entry_id = ?`)
    .bind(userId, userId, userId, entryId).first();
  return row ? linkedEnvelope(row) : null;
}

export async function loadJournalVisualResults({ db, userId, entryIds }) {
  if (!entryIds?.length) return new Map();
  const entries = [];
  // D1 allows at most 100 bound parameters per query; retain room for ownership.
  for (let offset = 0; offset < entryIds.length; offset += 90) {
    const chunk = entryIds.slice(offset, offset + 90);
    const { results } = await db.prepare(`${JOURNAL_VISUAL_SELECT} AND l.journal_entry_id IN (${chunk.map(() => '?').join(',')})`)
      .bind(userId, userId, userId, ...chunk).all();
    entries.push(...results.map(row => [row.journal_entry_id, linkedEnvelope(row)]));
  }
  return new Map(entries);
}

async function revokeVisualJob(env, readingResultId) {
  if (!env?.READING_VISUAL_JOBS) return;
  const stub = env.READING_VISUAL_JOBS.get(env.READING_VISUAL_JOBS.idFromName(readingResultId));
  const response = await stub.fetch('https://reading-visual-jobs/revoke', { method: 'POST' });
  if (!response.ok && response.status !== 404) throw new Error('Unable to revoke visual result');
}

/** Called before deleting the journal parent, whose FK cascade removes the link. */
export async function deleteJournalVisualLink({ db, env, userId, entryId, deleteEntry = false }) {
  if (!db || !userId || !entryId) return { deletedLink: false, cleanedResult: false };
  const link = await db.prepare('SELECT reading_result_id FROM journal_visual_links WHERE journal_entry_id = ? AND user_id = ?')
    .bind(entryId, userId).first();
  if (!link) {
    if (deleteEntry) await db.prepare('DELETE FROM journal_entries WHERE id = ? AND user_id = ?').bind(entryId, userId).run();
    return { deletedLink: false, cleanedResult: false };
  }
  const id = link.reading_result_id;
  const other = await db.prepare('SELECT COUNT(*) AS count FROM journal_visual_links WHERE reading_result_id = ? AND journal_entry_id != ?')
    .bind(id, entryId).first();
  if (!other.count) await revokeVisualJob(env, id);
  const statements = [db.prepare('DELETE FROM journal_visual_links WHERE journal_entry_id = ? AND user_id = ?').bind(entryId, userId)];
  if (deleteEntry) statements.push(db.prepare('DELETE FROM journal_entries WHERE id = ? AND user_id = ?').bind(entryId, userId));
  statements.push(db.prepare(`DELETE FROM reading_visual_results WHERE id = ? AND user_id = ?
      AND NOT EXISTS (SELECT 1 FROM journal_visual_links WHERE reading_result_id = ?)`)
      .bind(id, userId, id));
  const results = await db.batch(statements);
  const cleanedResult = changed(results.at(-1));
  // Two simultaneous deletions may both have observed another reference. The
  // transaction that actually removes the final result must still revoke it.
  if (cleanedResult && other.count) await revokeVisualJob(env, id);
  return { deletedLink: changed(results[0]), cleanedResult };
}

export async function revokeUserVisualResults({ env, userId }) {
  const { results } = await env.DB.prepare('SELECT id FROM reading_visual_results WHERE user_id = ?').bind(userId).all();
  for (const row of results) await revokeVisualJob(env, row.id);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM journal_visual_links WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM reading_visual_results WHERE user_id = ?').bind(userId)
  ]);
}

/** Capability expiry removes unsaved private results, retaining saved static cues. */
export async function expireVisualResult({ db, userId = null, readingResultId }) {
  if (!db) return { ok: true, skipped: true };
  await db.prepare(`UPDATE reading_visual_results SET status = 'expired', updated_at = ?
    WHERE id = ? AND user_id IS ? AND status IN ('pending', 'running')`)
    .bind(nowSeconds(), readingResultId, userId).run();
  const result = await db.prepare(`DELETE FROM reading_visual_results WHERE id = ? AND user_id IS ?
    AND NOT EXISTS (SELECT 1 FROM journal_visual_links WHERE reading_result_id = ?)`)
    .bind(readingResultId, userId, readingResultId).run();
  return { ok: true, deleted: changed(result) };
}

/** Trusted DO recovery reconciles a D1 commit that preceded storage persistence. */
export async function loadVisualResultState({ db, userId = null, readingResultId }) {
  if (!db) return null;
  const row = await selectResult(db, readingResultId);
  if (!row || !exactOwner(row, userId)) return null;
  return { ...visualEnvelope(row), observedRaw: row.observed_raw, sourceComplete: row.final_raw !== null };
}
