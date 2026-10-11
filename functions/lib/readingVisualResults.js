import { canonicalVisualCueJSON, hashVisualCueText, sameVisualCueBinding, visualCueBindingSchema } from '../../shared/contracts/visualCueBatches.js';
import { createVisualCueLedger } from '../../shared/reading/visualCueLedger.js';
import { fingerprintVisualSource, normalizeVisualSource } from '../../shared/reading/visualSourceIdentity.js';
import { projectVisualReplayReadiness } from './readingVisualReplayReadiness.js';

export const computeSourceFingerprint = fingerprintVisualSource;
const nowSeconds = () => Math.floor(Date.now() / 1000);
const parse = value => { try { return JSON.parse(value); } catch { return null; } };
const changed = result => Number(result?.meta?.changes || 0) > 0;
const selectResult = (db, id) => db.prepare('SELECT * FROM reading_visual_results WHERE id = ?').bind(id).first();
const exactOwner = (row, userId) => !!row && (row.user_id || null) === (userId || null);

/** Trusted job initialization only. Public journal saves never register a result. */
export async function registerVisualResult({ db, userId = null, readingResultId, binding, expiresAt = null }) {
  if (!db) return { ok: true, skipped: true };
  if (!visualCueBindingSchema.safeParse(binding).success || binding.readingResultId !== readingResultId) {
    return { ok: false, reason: 'invalid-binding' };
  }
  const now = nowSeconds();
  await db.prepare(`INSERT INTO reading_visual_results
    (id, user_id, created_at, updated_at, binding_json, source_revision, raw_hash, observed_raw, ledger_revision, ledger_json, status, expires_at)
    SELECT ?, ?, ?, ?, ?, ?, ?, '', 0, ?, 'pending', ?
    WHERE (? IS NULL OR EXISTS (SELECT 1 FROM users WHERE id = ? AND is_active = 1))
      AND NOT EXISTS (SELECT 1 FROM visual_owner_revocations WHERE user_id = ?)
      AND NOT EXISTS (SELECT 1 FROM visual_result_revocations WHERE reading_result_id = ?)
    ON CONFLICT(id) DO NOTHING`).bind(
    readingResultId, userId, now, now, JSON.stringify(binding), binding.sourceRevision,
    await hashVisualCueText(''), JSON.stringify(createVisualCueLedger(binding)), expiresAt, userId, userId, userId, readingResultId
  ).run();
  const row = await selectResult(db, readingResultId);
  return exactOwner(row, userId) && sameVisualCueBinding(parse(row.binding_json), binding)
    ? { ok: true } : { ok: false, reason: 'registration-conflict' };
}

// Capture each current saved parent before asynchronous work. The final SQL
// matches source bytes, membership and state versions; timestamps prove nothing.
const RESULT_PARENTS_SELECT = `SELECT DISTINCT j.*, COALESCE(s.state_version, 0) AS visual_state_version FROM journal_entries j
  LEFT JOIN journal_visual_links l ON l.journal_entry_id = j.id
  LEFT JOIN journal_visual_state s ON s.journal_entry_id = j.id
  WHERE j.user_id = ? AND (l.reading_result_id = ? OR s.reading_result_id = ?)
    AND l.archived_visual_json IS NULL`;
async function captureResultParents({ db, userId, readingResultId, binding }) {
  const { results } = await db.prepare(RESULT_PARENTS_SELECT).bind(userId, readingResultId, readingResultId).all();
  for (const row of results) {
    const { source, artworkEdition, catalogVersion } = ownedSource(row);
    const hashes = await fingerprintVisualSource(source);
    if (binding.contextHash !== hashes.contextHash || binding.spreadHash !== hashes.spreadHash
        || binding.artworkEdition !== artworkEdition || binding.catalogVersion !== catalogVersion) return null;
  }
  return results;
}
// JSON keeps bound parameters below D1's limit even when many saved entries
// refer to one result. Each captured parent must still exist with exact fields.
const PARENT_FENCE = `AND (SELECT COUNT(*) FROM (${RESULT_PARENTS_SELECT})) = ?
  AND NOT EXISTS (SELECT 1 FROM json_each(?) p WHERE NOT EXISTS (
    SELECT 1 FROM journal_entries j WHERE j.id = json_extract(p.value, '$[0]') AND j.user_id = json_extract(p.value, '$[1]')
      AND j.narrative IS json_extract(p.value, '$[2]') AND j.cards_json IS json_extract(p.value, '$[3]')
      AND j.question IS json_extract(p.value, '$[4]') AND j.reflections_json IS json_extract(p.value, '$[5]')
      AND j.deck_id IS json_extract(p.value, '$[6]')
      AND COALESCE((SELECT state_version FROM journal_visual_state WHERE journal_entry_id = j.id), 0) = json_extract(p.value, '$[7]')
      AND EXISTS (SELECT 1 FROM users WHERE id = j.user_id AND is_active = 1)))`;
const parentFenceParams = (parents, userId, readingResultId) => [userId, readingResultId, readingResultId,
  parents.length, JSON.stringify(parents.map(row => [...sourceParams(row), row.visual_state_version]))];
const NO_ACTIVE_RETRY = `AND active_attempt_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM journal_visual_state s WHERE s.reading_result_id = reading_visual_results.id
    AND (s.attempt_id IS NOT NULL OR s.retry_status = 'revoked'))
  AND NOT EXISTS (SELECT 1 FROM visual_owner_revocations v WHERE v.user_id = reading_visual_results.user_id)
  AND NOT EXISTS (SELECT 1 FROM visual_result_revocations v WHERE v.reading_result_id = reading_visual_results.id)`;

/** Trusted original-work admission, rechecked after asynchronous preparation.
 * Result, claim/state supersession, parent source and owner deletion all fence
 * the final SQL read. No provider call or result mutation occurs here. */
export async function isOriginalVisualWorkAllowed({ db, userId = null, readingResultId, binding }) {
  if (!db) return true;
  const row = await selectResult(db, readingResultId);
  if (!row || !exactOwner(row, userId) || !sameVisualCueBinding(parse(row.binding_json), binding)) return false;
  const parents = await captureResultParents({ db, userId, readingResultId, binding });
  if (!parents) return false;
  const admitted = await db.prepare(`SELECT 1 AS admitted FROM reading_visual_results
    WHERE id = ? AND user_id IS ? AND binding_json = ?
      AND status NOT IN ('cancelled', 'revoked', 'expired')
      AND (expires_at IS NULL OR expires_at > ?)
      AND (? IS NULL OR EXISTS (SELECT 1 FROM users WHERE id = ? AND is_active = 1))
      ${NO_ACTIVE_RETRY} ${PARENT_FENCE}`)
    .bind(readingResultId, userId, row.binding_json, Date.now(), userId, userId,
      ...parentFenceParams(parents, userId, readingResultId)).first();
  return !!admitted;
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
  const parents = await captureResultParents({ db, userId, readingResultId, binding: priorBinding });
  if (!parents) return { ok: false, reason: 'source-conflict' };
  const hash = await hashVisualCueText(raw);
  const statements = [db.prepare(`UPDATE reading_visual_results SET
    updated_at = ?, binding_json = ?, source_revision = ?, raw_hash = ?, observed_raw = ?, final_raw = ?,
    ledger_revision = ?, ledger_json = ?, status = ?
    WHERE id = ? AND user_id IS ? AND binding_json = ? AND ledger_revision = ? AND observed_raw = ? AND ledger_json = ?
      ${NO_ACTIVE_RETRY} ${PARENT_FENCE}`).bind(
    nowSeconds(), JSON.stringify(binding), binding.sourceRevision, hash, raw,
    complete ? raw : (replacement ? null : row.final_raw),
    replacement ? 0 : row.ledger_revision,
    replacement ? JSON.stringify(createVisualCueLedger(binding)) : row.ledger_json,
    replacement ? 'pending' : row.status,
    readingResultId, userId, row.binding_json, row.ledger_revision, row.observed_raw, row.ledger_json, ...parentFenceParams(parents, userId, readingResultId)
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

/** Owned canonical source, used by attachment and future replay admission. */
export async function loadOwnedJournalVisualSource({ db, userId, entryId }) {
  if (!db || !userId || !entryId) return null;
  const row = await db.prepare(`SELECT j.* FROM journal_entries j JOIN users u ON u.id = j.user_id
    WHERE j.id = ? AND j.user_id = ? AND u.is_active = 1
      AND NOT EXISTS (SELECT 1 FROM visual_owner_revocations WHERE user_id = j.user_id)`)
    .bind(entryId, userId).first();
  if (!row) return null;
  return ownedSource(row);
}

function ownedSource(row) {
  const source = { raw: row.narrative || '', cards: parse(row.cards_json) || [],
    question: row.question || '', reflections: parse(row.reflections_json) || '', deckId: row.deck_id };
  const { artworkEdition, catalogVersion } = normalizeVisualSource(source);
  return { row, source, artworkEdition, catalogVersion };
}

export async function fingerprintSavedVisualSource({ source, artworkEdition, catalogVersion }) {
  const { rawHash, spreadHash, contextHash } = await fingerprintVisualSource(source);
  return hashVisualCueText(canonicalVisualCueJSON({ rawHash, spreadHash, contextHash, artworkEdition, catalogVersion }));
}

const SOURCE_MATCH = `j.id = ? AND j.user_id = ? AND j.narrative IS ? AND j.cards_json IS ?
  AND j.question IS ? AND j.reflections_json IS ? AND j.deck_id IS ?
  AND EXISTS (SELECT 1 FROM users u WHERE u.id = j.user_id AND u.is_active = 1)
  AND NOT EXISTS (SELECT 1 FROM visual_owner_revocations v WHERE v.user_id = j.user_id)`;
const sourceParams = row => [row.id, row.user_id, row.narrative, row.cards_json, row.question, row.reflections_json, row.deck_id];
const ATTACHMENT_STATUSES = new Set(['missing', 'pending', 'attached', 'failed', 'expired']);
const RETRY_STATUSES = new Set(['available', 'pending', 'complete', 'exhausted', 'unavailable', 'revoked']);
const PUBLIC_REASONS = new Set(['unregistered-result', 'ownership-mismatch', 'fingerprint-mismatch', 'entry-not-found',
  'source-conflict', 'existing-link', 'attachment-error', 'source-changed', 'annotation-failed', 'expired', 'missing-result',
  'configuration-unavailable', 'revoked', 'stale-state']);
const publicReason = reason => reason == null ? null : PUBLIC_REASONS.has(reason) ? reason : 'attachment-error';
const originalTransportExpired = row => row?.status === 'expired'
  || (['pending', 'running'].includes(row?.status)
    && Number.isFinite(row.expires_at) && row.expires_at <= Date.now());
const attachmentStatusFor = visual => visual?.status === 'complete' ? 'attached'
  : visual?.status === 'expired' ? 'expired' : ['failed', 'cancelled', 'revoked'].includes(visual?.status) ? 'failed' : 'pending';

/** Trusted internal state write. A client snapshot is never accepted on its own. */
export async function persistJournalVisualState({ db, userId, entryId, sourceFingerprint, attachmentStatus,
  reason = null, validatedSnapshot = null, readingResultId = null, retryStatus = 'unavailable',
  expectedStateVersion, expectedClaimVersion, attemptId = null, claimId = null, initialAdmission = null }) {
  if (!ATTACHMENT_STATUSES.has(attachmentStatus) || !RETRY_STATUSES.has(retryStatus)) return { ok: false, reason: 'invalid-state' };
  const owned = await loadOwnedJournalVisualSource({ db, userId, entryId });
  if (!owned) return { ok: false, reason: 'entry-not-found' };
  const fingerprint = await fingerprintSavedVisualSource(owned);
  if (sourceFingerprint && sourceFingerprint !== fingerprint) return { ok: false, reason: 'source-conflict' };
  const prior = await db.prepare('SELECT * FROM journal_visual_state WHERE journal_entry_id = ? AND user_id = ?').bind(entryId, userId).first();
  if ((expectedStateVersion !== undefined && expectedStateVersion !== (prior?.state_version || 0))
      || (prior?.attempt_id && prior.attempt_id !== attemptId)) return { ok: false, reason: 'stale-state' };
  let snapshot = null;
  if (attachmentStatus === 'attached' && !validatedSnapshot) return { ok: false, reason: 'unverified-snapshot' };
  if (validatedSnapshot) {
    const id = validatedSnapshot.readingResultId;
    const registered = id ? await selectResult(db, id) : null;
    const linked = await loadJournalVisualResult({ db, userId, entryId });
    const authoritative = registered && exactOwner(registered, userId) ? visualEnvelope(registered) : null;
    const hashes = await fingerprintVisualSource(owned.source);
    const candidates = [authoritative, linked].filter(Boolean);
    snapshot = candidates.find(candidate => canonicalVisualCueJSON(candidate) === canonicalVisualCueJSON(validatedSnapshot)
      && candidate.binding.spreadHash === hashes.spreadHash && candidate.binding.contextHash === hashes.contextHash
      && candidate.binding.artworkEdition === owned.artworkEdition && candidate.binding.catalogVersion === owned.catalogVersion
      && owned.source.raw.startsWith(candidate.cueLedger.raw)
      && (candidate.finalRaw == null || candidate.finalRaw === owned.source.raw)) || null;
    if (!snapshot) return { ok: false, reason: 'unverified-snapshot' };
  }
  const effectiveClaimId = claimId || prior?.claim_id || null;
  if (attemptId && !effectiveClaimId) return { ok: false, reason: 'stale-state' };
  const claim = effectiveClaimId ? await db.prepare('SELECT * FROM visual_retry_claims WHERE id = ? AND user_id = ?').bind(effectiveClaimId, userId).first() : null;
  if (effectiveClaimId && (!claim || claim.journal_entry_id !== entryId || claim.source_fingerprint !== fingerprint
      || claim.attempt_id !== attemptId || claim.retry_status === 'revoked' || claim.dispatch_status === 'revoked'
      || (expectedClaimVersion !== undefined && expectedClaimVersion !== claim.state_version))) return { ok: false, reason: 'stale-state' };
  const version = prior?.state_version || 0;
  const now = nowSeconds();
  // A pending registration may supply only a trusted result hint. Recheck the
  // exact admission at the final saved-source CAS so cleanup or expiry cannot
  // restore that hint after asynchronous hashing.
  const admissionFence = initialAdmission ? `AND EXISTS (SELECT 1 FROM visual_initial_admissions a
    WHERE a.reading_result_id = ? AND a.user_id = ? AND a.binding_json = ? AND a.token_hash = ? AND a.expires_at > ?)
    AND NOT EXISTS (SELECT 1 FROM visual_result_revocations WHERE reading_result_id = ?)` : '';
  const admissionParams = initialAdmission ? [readingResultId, userId, initialAdmission.binding_json,
    initialAdmission.token_hash, Date.now(), readingResultId] : [];
  const result = await db.prepare(`INSERT INTO journal_visual_state
    (journal_entry_id, user_id, source_fingerprint, reading_result_id, attachment_status, retry_status, reason,
      validated_snapshot_json, state_version, claim_id, attempt_id, created_at, updated_at)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    WHERE EXISTS (SELECT 1 FROM journal_entries j WHERE ${SOURCE_MATCH})
      ${admissionFence}
      AND (? IS NULL OR EXISTS (SELECT 1 FROM visual_retry_claims c WHERE c.id = ? AND c.user_id = ?
        AND c.journal_entry_id = ? AND c.source_fingerprint = ? AND c.attempt_id IS ?
        AND c.state_version = ? AND c.retry_status != 'revoked' AND c.dispatch_status != 'revoked'))
    ON CONFLICT(journal_entry_id) DO UPDATE SET source_fingerprint = excluded.source_fingerprint,
      reading_result_id = excluded.reading_result_id, attachment_status = excluded.attachment_status,
      retry_status = excluded.retry_status, reason = excluded.reason,
      validated_snapshot_json = COALESCE(excluded.validated_snapshot_json, journal_visual_state.validated_snapshot_json),
      state_version = excluded.state_version, claim_id = excluded.claim_id, attempt_id = excluded.attempt_id,
      updated_at = excluded.updated_at
    WHERE journal_visual_state.user_id = excluded.user_id AND journal_visual_state.state_version = ?
      AND journal_visual_state.attempt_id IS ? AND journal_visual_state.retry_status != 'revoked'`)
    .bind(entryId, userId, fingerprint, readingResultId || prior?.reading_result_id || null, attachmentStatus, retryStatus,
      publicReason(reason), snapshot ? JSON.stringify(snapshot) : null, version + 1, effectiveClaimId,
      attemptId, now, now, ...sourceParams(owned.row), ...admissionParams, effectiveClaimId, effectiveClaimId, userId, entryId, fingerprint, attemptId,
      expectedClaimVersion ?? claim?.state_version ?? 0, version, attemptId).run();
  return changed(result) ? { ok: true } : { ok: false, reason: 'source-conflict' };
}

/** Public field projection only: no capability or transport credentials. */
async function publicJournalVisualState({ env, owned, state, linked, registration, initialAdmission }) {
  const hashes = await fingerprintVisualSource(owned.source);
  const fingerprint = await hashVisualCueText(canonicalVisualCueJSON({ ...hashes,
    artworkEdition: owned.artworkEdition, catalogVersion: owned.catalogVersion }));
  // Old linked snapshots keep their original binding and are never silently rebound.
  const historical = publicSnapshot(parse(state?.validated_snapshot_json)) || linked;
  if (state && state.source_fingerprint !== fingerprint) return projectVisualReplayReadiness({
    attachmentStatus: 'missing', retryStatus: 'unavailable', sourceFingerprint: fingerprint,
    attemptId: null, stateVersion: state.state_version, reason: 'source-changed', visualSnapshot: historical
  }, env);
  const currentLinked = linked && linked.binding.spreadHash === hashes.spreadHash && linked.binding.contextHash === hashes.contextHash
    && linked.binding.artworkEdition === owned.artworkEdition && linked.binding.catalogVersion === owned.catalogVersion ? linked : null;
  const initialBinding = parse(initialAdmission?.binding_json);
  const pendingInitial = !registration && state?.attachment_status === 'pending'
    && initialAdmission?.user_id === owned.row.user_id && initialAdmission.reading_result_id === state.reading_result_id
    && visualCueBindingSchema.safeParse(initialBinding).success && initialBinding.readingResultId === state.reading_result_id
    && initialBinding.spreadHash === hashes.spreadHash && initialBinding.contextHash === hashes.contextHash
    && initialBinding.artworkEdition === owned.artworkEdition && initialBinding.catalogVersion === owned.catalogVersion;
  // Before registration, the trusted admission is the only transport deadline.
  // It cannot override a registered result or certify any cached cue data.
  const transport = registration || (pendingInitial ? { status: 'pending', expires_at: initialAdmission.expires_at } : null);
  const active = state?.attempt_id || ['exhausted', 'revoked'].includes(state?.retry_status);
  const attachmentStatus = !active && originalTransportExpired(transport) ? 'expired'
    : !active && currentLinked ? attachmentStatusFor(currentLinked) : state?.attachment_status || 'missing';
  return projectVisualReplayReadiness({ attachmentStatus, retryStatus: !active && attachmentStatus === 'expired' ? 'available'
    : attachmentStatus === 'attached' && !active ? 'complete' : state?.retry_status || 'unavailable',
    sourceFingerprint: fingerprint, attemptId: state?.attempt_id || null, stateVersion: state?.state_version || 0,
    reason: publicReason(!active && attachmentStatus === 'expired' ? 'expired' : state?.reason || (attachmentStatus === 'missing' ? 'missing-result' : attachmentStatus === 'failed' ? 'annotation-failed' : null)),
    visualSnapshot: !active && currentLinked ? currentLinked : historical || null }, env);
}

export async function loadJournalVisualState({ env, db, userId, entryId }) {
  const owned = await loadOwnedJournalVisualSource({ db, userId, entryId });
  if (!owned) return null;
  const initial = await initialVisualSchema(db);
  const state = await db.prepare('SELECT * FROM journal_visual_state WHERE journal_entry_id = ? AND user_id = ?').bind(entryId, userId).first();
  const linked = await loadJournalVisualResult({ db, userId, entryId });
  const registration = state?.reading_result_id && (!linked || state.attachment_status === 'pending')
    ? await db.prepare('SELECT status, expires_at FROM reading_visual_results WHERE id = ? AND user_id = ?')
      .bind(state.reading_result_id, userId).first() : null;
  const initialAdmission = initial && !registration && state?.attachment_status === 'pending' && state?.reading_result_id
    ? await db.prepare('SELECT reading_result_id, user_id, binding_json, expires_at FROM visual_initial_admissions WHERE reading_result_id = ? AND user_id = ?')
      .bind(state.reading_result_id, userId).first() : null;
  return publicJournalVisualState({ env, owned, state, linked, registration, initialAdmission });
}

export async function loadJournalVisualStates({ env, db, userId, entryIds, visualResults }) {
  if (!db || !userId || !entryIds?.length) return new Map();
  const initial = await initialVisualSchema(db);
  const linked = visualResults || await loadJournalVisualResults({ db, userId, entryIds });
  const entries = [];
  for (let offset = 0; offset < entryIds.length; offset += 90) {
    const chunk = entryIds.slice(offset, offset + 90);
    const { results } = await db.prepare(`SELECT j.*, s.source_fingerprint, s.attachment_status, s.retry_status,
      s.reason, s.validated_snapshot_json, s.state_version, s.attempt_id, s.reading_result_id,
      r.status AS registered_visual_status, r.expires_at AS registered_visual_expires_at
      ${initial ? ', a.reading_result_id AS initial_admission_result_id, a.binding_json AS initial_admission_binding, a.expires_at AS initial_admission_expires_at' : ''}
      FROM journal_entries j
      JOIN users u ON u.id = j.user_id LEFT JOIN journal_visual_state s ON s.journal_entry_id = j.id AND s.user_id = j.user_id
      LEFT JOIN reading_visual_results r ON r.id = s.reading_result_id AND r.user_id = j.user_id
      ${initial ? 'LEFT JOIN visual_initial_admissions a ON a.reading_result_id = s.reading_result_id AND a.user_id = j.user_id AND r.id IS NULL' : ''}
      WHERE j.user_id = ? AND u.is_active = 1 AND j.id IN (${chunk.map(() => '?').join(',')})
        AND NOT EXISTS (SELECT 1 FROM visual_owner_revocations v WHERE v.user_id = j.user_id)`)
      .bind(userId, ...chunk).all();
    entries.push(...await Promise.all(results.map(async row => [row.id, await publicJournalVisualState({
      env, owned: ownedSource(row), state: row.source_fingerprint ? row : null, linked: linked.get(row.id),
      registration: row.registered_visual_status == null ? null : { status: row.registered_visual_status, expires_at: row.registered_visual_expires_at },
      initialAdmission: row.initial_admission_result_id ? { reading_result_id: row.initial_admission_result_id, user_id: row.user_id,
        binding_json: row.initial_admission_binding, expires_at: row.initial_admission_expires_at } : null
    })])));
  }
  return new Map(entries);
}

export async function attachJournalVisualResult({ db, userId, entryId, readingResultId }) {
  if (!db || !userId || !entryId || !readingResultId) return { attached: false, reason: 'missing-arguments' };
  const row = await selectResult(db, readingResultId);
  const owned = await loadOwnedJournalVisualSource({ db, userId, entryId });
  if (!owned) return { attached: false, reason: row && row.user_id !== userId ? 'ownership-mismatch' : 'entry-not-found' };
  const state = await db.prepare('SELECT * FROM journal_visual_state WHERE journal_entry_id = ? AND user_id = ?').bind(entryId, userId).first();
  if (state?.attempt_id || state?.retry_status === 'revoked') return { attached: false, reason: 'stale-state' };
  const fingerprint = await computeSourceFingerprint(owned.source);
  const fullFingerprint = await fingerprintSavedVisualSource(owned);
  const fail = async (reason, validatedSnapshot = null) => {
    // Historical cues remain inspectable but cannot suppress current failure state.
    const existing = await loadJournalVisualResult({ db, userId, entryId });
    const current = existing && ['pending', 'running', 'complete'].includes(existing.status)
      && existing.binding.spreadHash === fingerprint.spreadHash && existing.binding.contextHash === fingerprint.contextHash
      && existing.binding.artworkEdition === owned.artworkEdition && existing.binding.catalogVersion === owned.catalogVersion
      && owned.source.raw.startsWith(existing.cueLedger.raw)
      && (existing.finalRaw == null || existing.finalRaw === owned.source.raw);
    if (!current) await persistJournalVisualState({ db, userId, entryId, sourceFingerprint: fullFingerprint,
      attachmentStatus: reason === 'expired' ? 'expired' : 'failed', reason, validatedSnapshot,
      readingResultId: validatedSnapshot ? readingResultId : null, expectedStateVersion: state?.state_version || 0 });
    return { attached: false, reason };
  };
  if (!row) {
    if (!await initialVisualSchema(db)) return fail('unregistered-result');
    const admission = await db.prepare(`SELECT * FROM visual_initial_admissions WHERE reading_result_id = ? AND user_id = ?
      AND expires_at > ? AND NOT EXISTS (SELECT 1 FROM visual_owner_revocations WHERE user_id = ?)
      AND NOT EXISTS (SELECT 1 FROM visual_result_revocations WHERE reading_result_id = ?)`)
      .bind(readingResultId, userId, Date.now(), userId, readingResultId).first();
    const trustedBinding = parse(admission?.binding_json);
    if (!visualCueBindingSchema.safeParse(trustedBinding).success || trustedBinding.readingResultId !== readingResultId
        || trustedBinding.spreadHash !== fingerprint.spreadHash || trustedBinding.contextHash !== fingerprint.contextHash
        || trustedBinding.artworkEdition !== owned.artworkEdition || trustedBinding.catalogVersion !== owned.catalogVersion) {
      return fail('unregistered-result');
    }
    const persisted = await persistJournalVisualState({ db, userId, entryId, sourceFingerprint: fullFingerprint,
      attachmentStatus: 'pending', readingResultId, expectedStateVersion: state?.state_version || 0, initialAdmission: admission });
    return { attached: false, status: persisted.ok ? 'pending' : undefined, reason: persisted.ok ? 'initialization-pending' : persisted.reason };
  }
  if (row.user_id !== userId) return fail('ownership-mismatch');
  const binding = parse(row.binding_json);
  if (!binding || binding.spreadHash !== fingerprint.spreadHash || binding.contextHash !== fingerprint.contextHash
      || binding.artworkEdition !== owned.artworkEdition || binding.catalogVersion !== owned.catalogVersion
      || (row.final_raw !== null && row.raw_hash !== fingerprint.rawHash)
      || !owned.source.raw.startsWith(row.observed_raw)) return fail('fingerprint-mismatch');
  let result;
  try { result = await db.prepare(`INSERT INTO journal_visual_links
    (journal_entry_id, reading_result_id, user_id, created_at, expected_raw_hash, source_revision)
    SELECT ?, id, user_id, ?, ?, source_revision FROM reading_visual_results
    WHERE id = ? AND user_id = ? AND binding_json = ? AND observed_raw = ?
      AND active_attempt_id IS NULL
      AND EXISTS (SELECT 1 FROM journal_entries j WHERE ${SOURCE_MATCH})
      AND NOT EXISTS (SELECT 1 FROM journal_visual_state s WHERE s.journal_entry_id = ? AND (s.attempt_id IS NOT NULL OR s.retry_status = 'revoked'))
      AND COALESCE((SELECT state_version FROM journal_visual_state WHERE journal_entry_id = ?), 0) = ?
    ON CONFLICT(journal_entry_id) DO NOTHING`).bind(
    entryId, nowSeconds(), fingerprint.rawHash, readingResultId, userId, row.binding_json, row.observed_raw,
    ...sourceParams(owned.row), entryId, entryId, state?.state_version || 0
  ).run(); } catch { return fail('attachment-error', visualEnvelope(row)); }
  const visual = await loadJournalVisualResult({ db, userId, entryId });
  if (visual?.readingResultId !== readingResultId) return fail(changed(result) ? 'source-conflict' : 'existing-link');
  const attachmentStatus = attachmentStatusFor(visual);
  const persisted = await persistJournalVisualState({ db, userId, entryId, sourceFingerprint: fullFingerprint, attachmentStatus,
    retryStatus: attachmentStatus === 'attached' ? 'complete' : attachmentStatus === 'expired' ? 'available' : 'unavailable',
    reason: attachmentStatus === 'failed' ? 'annotation-failed' : attachmentStatus === 'expired' ? 'expired' : null,
    validatedSnapshot: visual, readingResultId, expectedStateVersion: state?.state_version || 0 });
  if (!persisted.ok) return { attached: false, reason: persisted.reason };
  return { attached: true, status: visual.status, ledgerRevision: visual.ledgerRevision, snapshot: visual.cueLedger, binding: visual.binding };
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
  const parents = await captureResultParents({ db, userId, readingResultId, binding });
  if (!parents) return { ok: false, reason: 'source-conflict' };
  const result = await db.prepare(`UPDATE reading_visual_results SET updated_at = ?, ledger_revision = ?, ledger_json = ?, status = ?
    WHERE id = ? AND user_id IS ? AND binding_json = ? AND ledger_revision = ? AND observed_raw = ? AND ledger_json = ?
      ${NO_ACTIVE_RETRY} ${PARENT_FENCE}`)
    .bind(nowSeconds(), ledger.ledgerRevision, JSON.stringify(ledger), status, readingResultId, userId,
      row.binding_json, expectedLedgerRevision, row.observed_raw, row.ledger_json, ...parentFenceParams(parents, userId, readingResultId)).run();
  return changed(result) ? { ok: true } : { ok: false, reason: 'stale-ledger' };
}

const project = (value, fields) => Object.fromEntries(fields.filter(key => value?.[key] !== undefined).map(key => [key, value[key]]));
export function publicVisualLedger(ledger) {
  if (!ledger || !visualCueBindingSchema.safeParse(ledger.binding).success) return null;
  return {
    ...project(ledger, ['version', 'ledgerRevision', 'raw', 'analyzedEnd', 'analyzedHash']),
    binding: visualCueBindingSchema.parse(ledger.binding),
    cues: (ledger.cues || []).map(cue => ({
      ...project(cue, ['id', 'kind']), passage: project(cue.passage, ['start', 'end', 'quote']),
      targets: (cue.targets || []).map(target => project(target, ['spreadIndex', 'canonicalName', 'detailIds'])),
      ...(cue.provenance ? { provenance: project(cue.provenance, ['batchId', 'requestSequence', 'analyzedEnd', 'analyzedHash']) } : {}),
      ...(cue.establishedBy ? { establishedBy: cue.establishedBy } : {}),
      ...(cue.meaningRange ? { meaningRange: project(cue.meaningRange, ['start', 'end', 'quote']) } : {}),
      ...(cue.personalContext ? { personalContext: project(cue.personalContext, ['type', 'spreadIndex', 'quote']) } : {})
    })),
    introductions: (ledger.introductions || []).map(intro => project(intro, ['spreadIndex', 'canonicalName', 'start', 'namedEnd', 'descriptionStart', 'midpoint', 'end'])),
    receipts: (ledger.receipts || []).map(receipt => ({
      ...project(receipt, ['batchId', 'payloadDigest', 'requestSequence', 'baseLedgerRevision', 'analyzedEnd', 'analyzedHash', 'aliases', 'addedCueIds']),
      ...(receipt.binding && visualCueBindingSchema.safeParse(receipt.binding).success ? { binding: visualCueBindingSchema.parse(receipt.binding) } : {}),
      ...(receipt.rejected ? { rejected: receipt.rejected.map(rejected => project(rejected, ['localAlias', 'code', 'message'])) } : {})
    }))
  };
}
function publicSnapshot(snapshot) {
  if (!snapshot || !sameVisualCueBinding(snapshot.binding, snapshot.cueLedger?.binding)) return null;
  const ledger = publicVisualLedger(snapshot.cueLedger);
  if (!ledger) return null;
  return {
    ...project(snapshot, ['readingResultId', 'sourceRevision', 'ledgerRevision', 'status', 'finalRaw']),
    binding: visualCueBindingSchema.parse(snapshot.binding), cues: ledger.cues, introductions: ledger.introductions,
    cueLedger: ledger, snapshot: ledger
  };
}
function visualEnvelope(row) {
  const binding = parse(row.binding_json);
  const ledger = parse(row.ledger_json);
  if (!binding || !ledger || !sameVisualCueBinding(binding, ledger.binding)) return null;
  return publicSnapshot({ readingResultId: row.id, binding, sourceRevision: row.source_revision, ledgerRevision: row.ledger_revision,
    status: originalTransportExpired(row) ? 'expired' : row.status, cueLedger: ledger, finalRaw: row.final_raw });
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
    return publicSnapshot(archived);
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

// Content and capabilities are erased, while source uniqueness and aggregate
// reservation metadata remain so deletion cannot reset either allowance.
const PURGE_RETRY_CLAIM = `retry_status = 'revoked', dispatch_status = 'revoked', state_version = state_version + 1,
  source_json = NULL, saved_fields_json = NULL, binding_json = NULL, visual_token = NULL,
  journal_entry_id = NULL, reading_result_id = NULL, attempt_id = NULL, visual_job_id = NULL,
  journal_state_version = NULL, expires_at = NULL, updated_at = ?`;

async function initialVisualSchema(db) {
  const { results } = await db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'
    AND name IN ('visual_initial_admissions', 'visual_initial_reservations')`).all();
  if (results.length === 1) throw new Error('Incomplete initial visual admission schema');
  return results.length === 2;
}

/** Capture cleanup identities and revoke/purge in one transaction before slow
 * transport cancellation. Parent deletion cannot reset a source claim. */
export async function deleteJournalVisualLink({ db, env, userId, entryId, deleteEntry = false }) {
  if (!db || !userId || !entryId) return { deletedLink: false, cleanedResult: false };
  const initial = await initialVisualSchema(db);
  const ownedClaims = `user_id = ? AND (journal_entry_id = ? OR id IN
    (SELECT claim_id FROM journal_visual_state WHERE journal_entry_id = ? AND user_id = ?))`;
  const claimParams = () => [userId, entryId, entryId, userId];
  const candidates = `SELECT reading_result_id FROM journal_visual_links WHERE journal_entry_id = ? AND user_id = ?
    UNION SELECT reading_result_id FROM journal_visual_state WHERE journal_entry_id = ? AND user_id = ?
    UNION SELECT reading_result_id FROM visual_retry_claims WHERE ${ownedClaims}`;
  const candidateParams = () => [entryId, userId, entryId, userId, ...claimParams()];
  // Persisted public sidecar IDs are not ownership proof. Owned registration,
  // trusted replay claims and server admissions are the only revocation sources.
  const ownedIds = `SELECT id AS reading_result_id FROM reading_visual_results WHERE user_id = ? AND id IN (${candidates})
    UNION SELECT reading_result_id FROM visual_retry_claims WHERE ${ownedClaims}
    ${initial ? `UNION SELECT reading_result_id FROM visual_initial_admissions WHERE user_id = ? AND reading_result_id IN (${candidates})` : ''}`;
  const ownedParams = () => [userId, ...candidateParams(), ...claimParams(), ...(initial ? [userId, ...candidateParams()] : [])];
  const unreferenced = `NOT EXISTS (SELECT 1 FROM journal_visual_links l WHERE l.reading_result_id = owned.reading_result_id AND l.journal_entry_id != ?)
    AND NOT EXISTS (SELECT 1 FROM journal_visual_state s WHERE s.reading_result_id = owned.reading_result_id AND s.journal_entry_id != ?)`;
  const cleanupIds = `SELECT owned.reading_result_id FROM (${ownedIds}) owned WHERE owned.reading_result_id IS NOT NULL AND ${unreferenced}`;
  const cleanupParams = () => [...ownedParams(), entryId, entryId];
  const statements = [
    db.prepare(`SELECT visual_job_id FROM visual_retry_claims WHERE ${ownedClaims}`).bind(...claimParams()),
    db.prepare(cleanupIds).bind(...cleanupParams()),
    db.prepare('SELECT reading_result_id FROM journal_visual_links WHERE journal_entry_id = ? AND user_id = ?').bind(entryId, userId),
    db.prepare(`INSERT INTO visual_result_revocations (reading_result_id, user_id, revoked_at)
      SELECT reading_result_id, ?, ? FROM (${cleanupIds}) WHERE 1
      ON CONFLICT(reading_result_id) DO NOTHING`).bind(userId, nowSeconds(), ...cleanupParams())
  ];
  if (initial) statements.push(
    db.prepare(`UPDATE visual_initial_reservations SET reading_result_id = NULL WHERE reading_result_id IN (${cleanupIds})`)
      .bind(...cleanupParams()),
    db.prepare(`DELETE FROM visual_initial_admissions WHERE user_id = ? AND reading_result_id IN (${cleanupIds})`)
      .bind(userId, ...cleanupParams())
  );
  // The cleanup SELECT still sees the claims/state here. Only afterward are
  // their private identities purged and the parent's references removed.
  const resultDeleteIndex = statements.length;
  statements.push(db.prepare(`DELETE FROM reading_visual_results WHERE user_id = ? AND id IN (${cleanupIds})`)
    .bind(userId, ...cleanupParams()),
  db.prepare(`UPDATE visual_retry_claims SET ${PURGE_RETRY_CLAIM} WHERE ${ownedClaims}`)
    .bind(nowSeconds(), ...claimParams()),
  db.prepare('DELETE FROM journal_visual_state WHERE journal_entry_id = ? AND user_id = ?').bind(entryId, userId));
  const linkDeleteIndex = statements.length;
  statements.push(db.prepare('DELETE FROM journal_visual_links WHERE journal_entry_id = ? AND user_id = ?').bind(entryId, userId));
  if (deleteEntry) statements.push(db.prepare('DELETE FROM journal_entries WHERE id = ? AND user_id = ?').bind(entryId, userId));
  const results = await db.batch(statements);
  const ids = new Set([...results[0].results.map(row => row.visual_job_id), ...results[1].results.map(row => row.reading_result_id)].filter(Boolean));
  for (const id of ids) {
    try { await revokeVisualJob(env, id); } catch { /* Durable revocation already blocks late commits. */ }
  }
  return { deletedLink: changed(results[linkDeleteIndex]) || results[2].results.length > 0, cleanedResult: changed(results[resultDeleteIndex]) };
}

// Schema inspection is explicit: missing optional migrations are compatible;
// partial schema or any real read/write failure must never bypass revocation.
async function userVisualSchema(db) {
  const legacy = ['reading_visual_results', 'journal_visual_links'];
  const retry = ['visual_retry_claims', 'journal_visual_state', 'visual_owner_revocations', 'visual_result_revocations'];
  const { results } = await db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'
    AND name IN (${[...legacy, ...retry].map(name => `'${name}'`).join(',')})`).all();
  const tables = new Set(results.map(row => row.name));
  const legacyCount = legacy.filter(name => tables.has(name)).length;
  const retryCount = retry.filter(name => tables.has(name)).length;
  if ((legacyCount && legacyCount !== legacy.length) || (retryCount && retryCount !== retry.length)
      || (retryCount && legacyCount !== legacy.length)) throw new Error('Incomplete visual revocation schema');
  const initial = await initialVisualSchema(db);
  if (initial && retryCount !== retry.length) throw new Error('Incomplete initial visual revocation schema');
  return { legacy: legacyCount === legacy.length, retry: retryCount === retry.length, initial };
}

export async function revokeUserVisualResults({ env, userId }) {
  const schema = await userVisualSchema(env.DB);
  const statements = [];
  if (schema.legacy) statements.push(env.DB.prepare(`SELECT id FROM reading_visual_results WHERE user_id = ?
    ${schema.initial ? 'UNION SELECT reading_result_id AS id FROM visual_initial_admissions WHERE user_id = ?' : ''}`)
    .bind(userId, ...(schema.initial ? [userId] : [])));
  if (schema.retry) statements.push(env.DB.prepare('SELECT visual_job_id AS id FROM visual_retry_claims WHERE user_id = ?').bind(userId));
  const captureCount = statements.length;
  statements.push(...(schema.retry ? [
    env.DB.prepare('INSERT INTO visual_owner_revocations (user_id, revoked_at) VALUES (?, ?) ON CONFLICT(user_id) DO NOTHING').bind(userId, nowSeconds()),
    env.DB.prepare(`UPDATE visual_retry_claims SET ${PURGE_RETRY_CLAIM}, user_id = NULL WHERE user_id = ?`).bind(nowSeconds(), userId),
    env.DB.prepare('DELETE FROM journal_visual_state WHERE user_id = ?').bind(userId)
  ] : [
    // Before 0037 there are no replay claims or tombstones. Disable the owner
    // before external work and remove old results so late original CAS fails.
    env.DB.prepare('UPDATE users SET is_active = 0 WHERE id = ?').bind(userId)
  ]));
  if (schema.initial) statements.push(
    env.DB.prepare(`UPDATE visual_initial_reservations SET reading_result_id = NULL WHERE reading_result_id IN
      (SELECT id FROM reading_visual_results WHERE user_id = ? UNION SELECT reading_result_id FROM visual_initial_admissions WHERE user_id = ?)`)
      .bind(userId, userId),
    env.DB.prepare('DELETE FROM visual_initial_admissions WHERE user_id = ?').bind(userId)
  );
  if (schema.legacy) statements.push(
    env.DB.prepare('DELETE FROM journal_visual_links WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM reading_visual_results WHERE user_id = ?').bind(userId)
  );
  const results = await env.DB.batch(statements);
  for (const id of new Set(results.slice(0, captureCount).flatMap(result => result.results.map(row => row.id)).filter(Boolean))) {
    try { await revokeVisualJob(env, id); } catch { /* Owner/results remain durably revoked even if its DO is unavailable. */ }
  }
}

/** Capability expiry removes unsaved private results, retaining saved static cues. */
export async function expireVisualResult({ db, userId = null, readingResultId }) {
  if (!db) return { ok: true, skipped: true };
  await db.prepare(`UPDATE reading_visual_results SET status = 'expired', updated_at = ?
    WHERE id = ? AND user_id IS ? AND active_attempt_id IS NULL AND status IN ('pending', 'running')`)
    .bind(nowSeconds(), readingResultId, userId).run();
  const result = await db.prepare(`DELETE FROM reading_visual_results WHERE id = ? AND user_id IS ? AND active_attempt_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM journal_visual_links WHERE reading_result_id = ?)
    AND NOT EXISTS (SELECT 1 FROM journal_visual_state WHERE reading_result_id = reading_visual_results.id)`)
    .bind(readingResultId, userId, readingResultId).run();
  return { ok: true, deleted: changed(result) };
}

/** Trusted DO recovery reconciles a D1 commit that preceded storage persistence. */
export async function loadVisualResultState({ db, userId = null, readingResultId }) {
  if (!db) return null;
  const row = await selectResult(db, readingResultId);
  if (!row || !exactOwner(row, userId)) return null;
  const binding = parse(row.binding_json), ledger = parse(row.ledger_json);
  if (!visualCueBindingSchema.safeParse(binding).success || !sameVisualCueBinding(binding, ledger?.binding)) return null;
  // D1 is private, trusted job state. Public projection must never be used as
  // recovery input: stripping provenance changes the immutable cue-prefix CAS.
  return { ...visualEnvelope(row), cueLedger: ledger, activeAttemptId: row.active_attempt_id, activeClaimVersion: row.active_state_version, observedRaw: row.observed_raw, sourceComplete: row.final_raw !== null };
}
