import { fingerprintVisualSource, normalizeVisualSource } from '../../shared/reading/visualSourceIdentity.js';
import { hashVisualCueText, sameVisualCueBinding } from '../../shared/contracts/visualCueBatches.js';
import { createVisualCueLedger } from '../../shared/reading/visualCueLedger.js';
import { getVisualCueReadiness } from './visualCueProvider.js';
import { attachJournalVisualResult, fingerprintSavedVisualSource, loadJournalVisualState, loadOwnedJournalVisualSource, publicVisualLedger } from './readingVisualResults.js';
import { getVisualJobStub } from './readingVisualJobs.js';

const admissions = new WeakSet();
const parse = value => { try { return JSON.parse(value); } catch { return null; } };
const changed = result => Number(result?.meta?.changes || 0) > 0;
export const REPLAY_TTL_MS = 24 * 60 * 60 * 1000;

/** Limits are explicitly configured, dedicated to replay, and never tier guesses. */
export function getVisualReplayLimits(env) {
  const limits = parse(env?.VISUAL_REPLAY_LIMITS);
  if (!limits || !['rateLimit', 'windowMs', 'totalLimit'].every(key => Number.isSafeInteger(limits[key]) && limits[key] > 0)) return null;
  return limits;
}

/** Internal only. Callers pass an identity already authenticated by the server. */
export async function createVisualReplayAdmission({ env, userId = null, request = null }) {
  if (!env?.DB || !getVisualReplayLimits(env)) return null;
  if (userId) {
    const user = await env.DB.prepare(`SELECT id FROM users WHERE id = ? AND is_active = 1
      AND NOT EXISTS (SELECT 1 FROM visual_owner_revocations WHERE user_id = users.id)`).bind(userId).first();
    if (!user) return null;
    const value = { userId, scope: `user:${userId}`, aggregateScope: `user:${userId}`, db: env.DB };
    admissions.add(value); return value;
  }
  // Cloudflare's edge identity is usable only on an actual edge request. Local
  // fixtures may supply an explicit trusted resolver; no forwarded header fallback.
  const identity = typeof env.VISUAL_REPLAY_TRUSTED_IDENTITY?.resolve === 'function'
    ? await env.VISUAL_REPLAY_TRUSTED_IDENTITY.resolve(request)
    : request?.cf ? request.headers.get('CF-Connecting-IP') : null;
  if (typeof identity !== 'string' || !identity.trim()) return null;
  const aggregateScope = `guest-edge:${await hashVisualCueText(identity)}`;
  const cookie = request?.headers.get('Cookie')?.match(/(?:^|;\s*)visual_replay_principal=([a-zA-Z0-9-]+)/)?.[1];
  let principal = cookie ? await env.DB.prepare(`SELECT * FROM visual_guest_principals WHERE token_hash = ?
    AND aggregate_scope = ? AND expires_at > ?`).bind(await hashVisualCueText(cookie), aggregateScope, Date.now()).first() : null;
  let issuedToken = null;
  if (!principal) {
    issuedToken = crypto.randomUUID();
    principal = { principal_id: crypto.randomUUID(), expires_at: Date.now() + REPLAY_TTL_MS };
    await env.DB.prepare('INSERT INTO visual_guest_principals VALUES (?, ?, ?, ?)')
      .bind(await hashVisualCueText(issuedToken), principal.principal_id, aggregateScope, principal.expires_at).run();
  }
  const value = { userId: null, scope: `guest:${principal.principal_id}`, aggregateScope, db: env.DB, issuedToken };
  admissions.add(value); return value;
}

// This predicate is reused at claim, init, reservation, validation and final
// commit. Actual saved source bytes and independent journal/claim versions matter.
export const ACTIVE_REPLAY_FENCE = `c.retry_status != 'revoked' AND c.dispatch_status != 'revoked'
  AND c.expires_at > ?
  AND (c.user_id IS NULL OR EXISTS (SELECT 1 FROM users u WHERE u.id = c.user_id AND u.is_active = 1))
  AND NOT EXISTS (SELECT 1 FROM visual_owner_revocations v WHERE v.user_id = c.user_id)
  AND NOT EXISTS (SELECT 1 FROM visual_result_revocations v WHERE v.reading_result_id = c.reading_result_id)
  AND (c.saved_fields_json IS NULL OR EXISTS (SELECT 1 FROM journal_entries j JOIN journal_visual_state s ON s.journal_entry_id = j.id
    WHERE j.id = c.journal_entry_id AND j.user_id = c.user_id
      AND j.narrative IS json_extract(c.saved_fields_json, '$.narrative')
      AND j.cards_json IS json_extract(c.saved_fields_json, '$.cards_json')
      AND j.question IS json_extract(c.saved_fields_json, '$.question')
      AND j.reflections_json IS json_extract(c.saved_fields_json, '$.reflections_json')
      AND j.deck_id IS json_extract(c.saved_fields_json, '$.deck_id')
      AND s.source_fingerprint = c.source_fingerprint AND s.claim_id = c.id
      AND s.attempt_id = c.attempt_id AND s.state_version = c.journal_state_version))`;

export async function loadActiveVisualReplay({ db, claimId, attemptId, expectedClaimVersion }) {
  if (!db) return null;
  return db.prepare(`SELECT c.* FROM visual_retry_claims c WHERE c.id = ? AND c.attempt_id = ?
    AND c.state_version = ? AND ${ACTIVE_REPLAY_FENCE}`)
    .bind(claimId, attemptId, expectedClaimVersion, Date.now()).first();
}

/** Atomic uniqueness plus actual-parent/version CAS. No call is reserved here. */
export async function claimVisualRetry({ db, admissionScope, sourceFingerprint, entryId = null, expectedStateVersion,
  admission, owned = null, source, binding, priorState = null }) {
  if (!db || !admissions.has(admission) || admission.db !== db || admission.scope !== admissionScope) return null;
  const old = await db.prepare('SELECT * FROM visual_retry_claims WHERE admission_scope = ? AND source_fingerprint = ?')
    .bind(admissionScope, sourceFingerprint).first();
  if (old) return old;
  const now = Date.now(), id = crypto.randomUUID(), attemptId = crypto.randomUUID(), visualJobId = crypto.randomUUID();
  const version = expectedStateVersion ?? 0;
  const fields = owned ? Object.fromEntries(['narrative', 'cards_json', 'question', 'reflections_json', 'deck_id'].map(key => [key, owned.row[key]])) : null;
  const parent = `(? IS NULL OR EXISTS (SELECT 1 FROM journal_entries j WHERE j.id = ? AND j.user_id = ?
    AND j.narrative IS ? AND j.cards_json IS ? AND j.question IS ? AND j.reflections_json IS ? AND j.deck_id IS ?
    AND COALESCE((SELECT state_version FROM journal_visual_state WHERE journal_entry_id = j.id), 0) = ?
    AND COALESCE((SELECT retry_status FROM journal_visual_state WHERE journal_entry_id = j.id), '') != 'revoked'))`;
  const params = [entryId, entryId, admission.userId, fields?.narrative ?? null, fields?.cards_json ?? null,
    fields?.question ?? null, fields?.reflections_json ?? null, fields?.deck_id ?? null, version];
  const statements = [db.prepare(`INSERT INTO visual_retry_claims
    (id, admission_scope, source_fingerprint, user_id, journal_entry_id, reading_result_id, attempt_id, visual_job_id,
      dispatch_status, retry_status, created_at, updated_at, aggregate_scope, source_json, saved_fields_json,
      journal_state_version, binding_json, visual_token, expires_at)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, 'prepared', 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?
    WHERE ${parent} AND (? IS NULL OR EXISTS (SELECT 1 FROM users WHERE id = ? AND is_active = 1))
      AND NOT EXISTS (SELECT 1 FROM visual_owner_revocations WHERE user_id = ?)
      AND NOT EXISTS (SELECT 1 FROM visual_result_revocations WHERE reading_result_id = ?)
    ON CONFLICT(admission_scope, source_fingerprint) DO NOTHING`)
    .bind(id, admissionScope, sourceFingerprint, admission.userId, entryId, binding.readingResultId, attemptId, visualJobId,
      now, now, admission.aggregateScope, JSON.stringify(source), fields ? JSON.stringify(fields) : null,
      entryId ? version + 1 : null, JSON.stringify(binding), crypto.randomUUID(), now + REPLAY_TTL_MS,
      ...params, admission.userId, admission.userId, admission.userId, binding.readingResultId)];
  if (entryId) statements.push(db.prepare(`INSERT INTO journal_visual_state
    (journal_entry_id, user_id, source_fingerprint, reading_result_id, attachment_status, retry_status, reason,
      validated_snapshot_json, state_version, claim_id, attempt_id, created_at, updated_at)
    SELECT ?, ?, ?, ?, 'pending', 'pending', NULL, ?, ?, ?, ?, ?, ?
    WHERE EXISTS (SELECT 1 FROM visual_retry_claims WHERE id = ?)
    ON CONFLICT(journal_entry_id) DO UPDATE SET source_fingerprint = excluded.source_fingerprint,
      reading_result_id = excluded.reading_result_id, attachment_status = 'pending', retry_status = 'pending', reason = NULL,
      validated_snapshot_json = COALESCE(journal_visual_state.validated_snapshot_json, excluded.validated_snapshot_json),
      state_version = excluded.state_version, claim_id = excluded.claim_id, attempt_id = excluded.attempt_id, updated_at = excluded.updated_at
    WHERE journal_visual_state.state_version = ? AND journal_visual_state.user_id = excluded.user_id
      AND journal_visual_state.retry_status != 'revoked'`)
    .bind(entryId, admission.userId, sourceFingerprint, binding.readingResultId,
      priorState?.visualSnapshot ? JSON.stringify(priorState.visualSnapshot) : null,
      version + 1, id, attemptId, Math.floor(now / 1000), Math.floor(now / 1000), id, version));
  await db.batch(statements);
  return db.prepare('SELECT * FROM visual_retry_claims WHERE admission_scope = ? AND source_fingerprint = ?')
    .bind(admissionScope, sourceFingerprint).first();
}

function localState(claim, fingerprint, snapshot = null) {
  return { attachmentStatus: claim?.retry_status === 'complete' ? 'attached' : claim?.retry_status === 'exhausted' ? 'failed' : claim ? 'pending' : 'missing',
    retryStatus: claim?.retry_status || 'unavailable', sourceFingerprint: fingerprint, attemptId: claim?.attempt_id || null,
    stateVersion: claim?.state_version || 0, reason: claim?.retry_status === 'exhausted' ? 'annotation-failed' : null, visualSnapshot: snapshot };
}
function resumeHandle(claim) {
  if (!claim || ['revoked', 'exhausted'].includes(claim.retry_status) || claim.expires_at <= Date.now()) return null;
  return { readingResultId: claim.reading_result_id, visualJobId: claim.visual_job_id, attemptId: claim.attempt_id,
    visualJobToken: claim.visual_token, visualBinding: parse(claim.binding_json), expiresAt: claim.expires_at };
}

async function retrySource({ env, admission, source, owned = null, state = null }) {
  const normalized = normalizeVisualSource(source);
  const fingerprint = await fingerprintSavedVisualSource({ source, ...normalized });
  const unavailable = () => ({ state: state || localState(null, fingerprint), resumeHandle: null });
  if (!admissions.has(admission) || admission.db !== env?.DB || !getVisualReplayLimits(env) || !env.READING_VISUAL_JOBS
    || !getVisualCueReadiness(env).ready) return unavailable();
  const hashes = await fingerprintVisualSource(source);
  const oldBinding = state?.visualSnapshot?.binding;
  const matching = oldBinding && oldBinding.spreadHash === hashes.spreadHash && oldBinding.contextHash === hashes.contextHash
    && oldBinding.artworkEdition === normalized.artworkEdition && oldBinding.catalogVersion === normalized.catalogVersion;
  let resultId = owned ? state?.visualSnapshot?.readingResultId
    || (await env.DB.prepare('SELECT reading_result_id FROM journal_visual_state WHERE journal_entry_id = ?').bind(owned.row.id).first())?.reading_result_id
    || crypto.randomUUID() : crypto.randomUUID();
  if (owned) {
    const registered = await env.DB.prepare('SELECT user_id FROM reading_visual_results WHERE id = ?').bind(resultId).first();
    // A persisted failed-sidecar ID is not proof of ownership. Recover the
    // explicitly owned prose in a fresh result instead of selecting foreign work.
    if (registered && registered.user_id !== admission.userId) resultId = crypto.randomUUID();
  }
  const binding = matching ? oldBinding : { readingResultId: resultId, sourceRevision: oldBinding ? oldBinding.sourceRevision + 1 : 0,
    spreadHash: hashes.spreadHash, contextHash: hashes.contextHash, artworkEdition: normalized.artworkEdition, catalogVersion: normalized.catalogVersion };
  const claim = await claimVisualRetry({ db: env.DB, admissionScope: admission.scope, sourceFingerprint: fingerprint,
    entryId: owned?.row.id || null, expectedStateVersion: state?.stateVersion ?? 0, admission, owned, source, binding, priorState: state });
  if (!claim) return unavailable();
  const active = await loadActiveVisualReplay({ db: env.DB, claimId: claim.id, attemptId: claim.attempt_id, expectedClaimVersion: claim.state_version });
  if (!active) return { state: state || localState({ ...claim, retry_status: 'revoked' }, fingerprint), resumeHandle: null };
  if (claim.dispatch_status === 'prepared') {
    const stub = getVisualJobStub(env, claim.reading_result_id, claim.visual_job_id);
    // Only this explicit POST can launch work. Repeated init is idempotent.
    try { await stub.fetch('https://reading-visual-jobs/replay-init', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claimId: claim.id, attemptId: claim.attempt_id, expectedClaimVersion: claim.state_version, visualJobId: claim.visual_job_id }) }); }
    catch { await deferVisualReplay({ db: env.DB, claim, available: true }); }
  }
  const current = await env.DB.prepare('SELECT * FROM visual_retry_claims WHERE id = ?').bind(claim.id).first();
  return { state: owned ? await loadJournalVisualState({ db: env.DB, userId: admission.userId, entryId: owned.row.id }) : localState(current, fingerprint),
    resumeHandle: resumeHandle(current) };
}

export async function retryJournalVisuals({ env, userId, entryId }) {
  const owned = await loadOwnedJournalVisualSource({ db: env?.DB, userId, entryId });
  if (!owned) return { state: null, resumeHandle: null };
  let state = await loadJournalVisualState({ db: env.DB, userId, entryId });
  if (state?.retryStatus === 'complete') return { state, resumeHandle: null };
  // Same-owner current registration may need only a link repair, never a call.
  const registeredId = !state?.attemptId ? state?.visualSnapshot?.readingResultId
    || (await env.DB.prepare('SELECT reading_result_id FROM journal_visual_state WHERE journal_entry_id = ? AND user_id = ?').bind(entryId, userId).first())?.reading_result_id : null;
  if (registeredId) {
    const repaired = await attachJournalVisualResult({ db: env.DB, userId, entryId, readingResultId: registeredId });
    state = await loadJournalVisualState({ db: env.DB, userId, entryId });
    if (repaired.attached && (state?.retryStatus === 'complete' || state?.attachmentStatus === 'pending')) return { state, resumeHandle: null };
  }
  const admission = await createVisualReplayAdmission({ env, userId });
  return retrySource({ env, admission, source: owned.source, owned, state });
}

export async function retryLocalVisuals({ env, admission, savedSource }) {
  // Explicit source only. IDs, opaque capabilities, bindings and sidecars confer
  // no authority and never enter the local source or fingerprint.
  const source = { raw: savedSource?.raw ?? savedSource?.personalReading, cards: savedSource?.cards,
    deckId: savedSource?.deckId, question: savedSource?.question, reflections: savedSource?.reflections };
  if (typeof source.raw !== 'string' || !source.raw || source.raw.length > 120000 || !Array.isArray(source.cards)
    || !source.cards.length || source.cards.length > 20) return { state: null, resumeHandle: null };
  return retrySource({ env, admission, source });
}

/** D1 writes the reservation before the provider can possibly be invoked. */
export async function reserveVisualReplay({ env, claim }) {
  const limits = getVisualReplayLimits(env);
  if (!limits || !getVisualCueReadiness(env).ready) return false;
  const now = Date.now();
  const reservation = env.DB.prepare(`UPDATE visual_retry_claims AS c SET dispatch_status = 'reserved', retry_status = 'pending',
    reserved_at = ?, updated_at = ? WHERE c.id = ? AND c.attempt_id = ? AND c.state_version = ?
    AND c.dispatch_status = 'prepared' AND ${ACTIVE_REPLAY_FENCE}
    AND (SELECT COUNT(*) FROM visual_retry_claims a WHERE a.aggregate_scope = c.aggregate_scope AND a.reserved_at IS NOT NULL) < ?
    AND (SELECT COUNT(*) FROM visual_retry_claims a WHERE a.aggregate_scope = c.aggregate_scope AND a.reserved_at > ?) < ?`)
    .bind(now, now, claim.id, claim.attempt_id, claim.state_version, now, limits.totalLimit, now - limits.windowMs, limits.rateLimit);
  const state = env.DB.prepare(`UPDATE journal_visual_state SET attachment_status = 'pending', retry_status = 'pending', reason = NULL
    WHERE claim_id = ? AND attempt_id = ? AND state_version = ? AND EXISTS (SELECT 1 FROM visual_retry_claims c
      WHERE c.id = ? AND c.attempt_id = ? AND c.state_version = ? AND c.reserved_at = ? AND c.dispatch_status = 'reserved')`)
    .bind(claim.id, claim.attempt_id, claim.journal_state_version, claim.id, claim.attempt_id, claim.state_version, now);
  const results = await env.DB.batch([reservation, state]);
  return changed(results[0]);
}

export async function initializeVisualReplay({ db, claim }) {
  const binding = parse(claim.binding_json), source = parse(claim.source_json);
  const normalized = normalizeVisualSource(source);
  if (await fingerprintSavedVisualSource({ source, ...normalized }) !== claim.source_fingerprint) return null;
  const result = await db.prepare('SELECT * FROM reading_visual_results WHERE id = ?').bind(claim.reading_result_id).first();
  if (result && (result.user_id || null) !== (claim.user_id || null)) return null;
  const existing = parse(result?.ledger_json);
  const ledger = existing && sameVisualCueBinding(existing.binding, binding) && source.raw.startsWith(existing.raw) ? existing : createVisualCueLedger(binding);
  const now = Math.floor(Date.now() / 1000);
  await db.prepare(`INSERT INTO reading_visual_results
    (id, user_id, created_at, updated_at, binding_json, source_revision, raw_hash, observed_raw, final_raw,
      ledger_revision, ledger_json, status, expires_at, active_attempt_id, active_state_version, saved_source_fingerprint, saved_entry_id)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'running', ?, ?, ?, ?, ?
    WHERE EXISTS (SELECT 1 FROM visual_retry_claims c WHERE c.id = ? AND c.attempt_id = ? AND c.state_version = ? AND ${ACTIVE_REPLAY_FENCE})
    ON CONFLICT(id) DO UPDATE SET active_attempt_id = excluded.active_attempt_id, active_state_version = excluded.active_state_version,
      saved_source_fingerprint = excluded.saved_source_fingerprint, saved_entry_id = excluded.saved_entry_id
    WHERE reading_visual_results.user_id IS excluded.user_id`)
    .bind(claim.reading_result_id, claim.user_id, now, now, JSON.stringify(binding), binding.sourceRevision,
      await hashVisualCueText(source.raw), source.raw, source.raw, ledger.ledgerRevision, JSON.stringify(ledger), claim.expires_at,
      claim.attempt_id, claim.state_version, claim.source_fingerprint, claim.journal_entry_id,
      claim.id, claim.attempt_id, claim.state_version, Date.now()).run();
  if (!await loadActiveVisualReplay({ db, claimId: claim.id, attemptId: claim.attempt_id, expectedClaimVersion: claim.state_version })) return null;
  return { ledger, binding, source, validationContext: normalized };
}

/** Conditional successor commit and claim/state settlement are one transaction. */
export async function settleVisualReplay({ db, claim, ledger = null, revoke = false }) {
  const now = Date.now();
  const guard = `EXISTS (SELECT 1 FROM visual_retry_claims c WHERE c.id = ? AND c.attempt_id = ?
    AND c.state_version = ? AND c.dispatch_status = 'reserved' AND ${ACTIVE_REPLAY_FENCE})`;
  const args = () => [claim.id, claim.attempt_id, claim.state_version, now];
  const statements = [];
  if (ledger) statements.push(db.prepare(`UPDATE reading_visual_results SET ledger_json = ?, ledger_revision = ?, binding_json = ?,
    source_revision = ?, observed_raw = ?, final_raw = ?, raw_hash = ?, status = 'complete', updated_at = ?, expires_at = ?
    WHERE id = ? AND user_id IS ? AND active_attempt_id = ? AND active_state_version = ? AND saved_source_fingerprint = ? AND ${guard}`)
    .bind(JSON.stringify(ledger), ledger.ledgerRevision, JSON.stringify(ledger.binding), ledger.binding.sourceRevision, ledger.raw, ledger.raw,
      ledger.analyzedHash, Math.floor(now / 1000), claim.expires_at, claim.reading_result_id, claim.user_id, claim.attempt_id,
      claim.state_version, claim.source_fingerprint, ...args()));
  const committed = ledger ? `AND EXISTS (SELECT 1 FROM reading_visual_results WHERE id = ? AND active_attempt_id = ? AND ledger_json = ?)` : '';
  const commitArgs = () => ledger ? [claim.reading_result_id, claim.attempt_id, JSON.stringify(ledger)] : [];
  if (claim.journal_entry_id && ledger) statements.push(db.prepare(`INSERT INTO journal_visual_links
    (journal_entry_id, user_id, reading_result_id, source_revision, expected_raw_hash, created_at)
    SELECT ?, ?, ?, ?, ?, ? WHERE ${guard} ${committed}
    ON CONFLICT(journal_entry_id) DO UPDATE SET reading_result_id = excluded.reading_result_id, source_revision = excluded.source_revision,
      expected_raw_hash = excluded.expected_raw_hash, archived_visual_json = NULL`)
    .bind(claim.journal_entry_id, claim.user_id, claim.reading_result_id, ledger.binding.sourceRevision, ledger.analyzedHash,
      Math.floor(now / 1000), ...args(), ...commitArgs()));
  const publicLedger = ledger ? publicVisualLedger(ledger) : null;
  const snapshot = ledger ? JSON.stringify({ readingResultId: claim.reading_result_id, sourceRevision: ledger.binding.sourceRevision,
    ledgerRevision: ledger.ledgerRevision, status: 'complete', finalRaw: ledger.raw, binding: ledger.binding, cues: publicLedger.cues,
    introductions: publicLedger.introductions, cueLedger: publicLedger, snapshot: publicLedger }) : null;
  if (claim.journal_entry_id) statements.push(db.prepare(`UPDATE journal_visual_state SET attachment_status = ?, retry_status = ?, reason = ?, updated_at = ?,
      validated_snapshot_json = COALESCE(?, validated_snapshot_json)
    WHERE journal_entry_id = ? AND user_id = ? AND claim_id = ? AND attempt_id = ? AND state_version = ? AND ${guard} ${committed}`)
    .bind(ledger ? 'attached' : 'failed', revoke ? 'revoked' : ledger ? 'complete' : 'exhausted', ledger ? null : revoke ? 'revoked' : 'annotation-failed',
      Math.floor(now / 1000), snapshot, claim.journal_entry_id, claim.user_id, claim.id, claim.attempt_id, claim.journal_state_version, ...args(), ...commitArgs()));
  statements.push(db.prepare(`UPDATE visual_retry_claims AS c SET dispatch_status = ?, retry_status = ?, updated_at = ?
    WHERE c.id = ? AND c.attempt_id = ? AND c.state_version = ? AND c.dispatch_status = 'reserved'
      ${ledger ? `AND ${ACTIVE_REPLAY_FENCE}` : ''} ${committed}`)
    .bind(revoke ? 'revoked' : 'settled', revoke ? 'revoked' : ledger ? 'complete' : 'exhausted', now, ...(ledger ? args() : [claim.id, claim.attempt_id, claim.state_version]), ...commitArgs()));
  const results = await db.batch(statements);
  return ledger ? changed(results[0]) : changed(results.at(-1));
}

/** The caller proves no provider invocation occurred through its own readiness
 * check. Never release an uncertain reservation from a provider error label. */
export async function releaseVisualReplayReadiness({ db, claim }) {
  return db.prepare(`UPDATE visual_retry_claims SET dispatch_status = 'prepared', reserved_at = NULL, retry_status = 'unavailable'
    WHERE id = ? AND attempt_id = ? AND state_version = ? AND dispatch_status = 'reserved'`)
    .bind(claim.id, claim.attempt_id, claim.state_version).run();
}

/** Trusted revocation invalidates settled as well as running transport, while
 * retaining accepted saved ledgers and the durable consumed reservation. */
export async function revokeVisualReplay({ db, replay }) {
  const { claimId, attemptId, expectedClaimVersion } = replay;
  await db.batch([
    db.prepare(`UPDATE journal_visual_state SET retry_status = 'revoked', reason = 'revoked', state_version = state_version + 1
      WHERE claim_id = ? AND attempt_id = ? AND EXISTS (SELECT 1 FROM visual_retry_claims c
        WHERE c.id = ? AND c.attempt_id = ? AND c.state_version = ? AND c.retry_status != 'revoked')`)
      .bind(claimId, attemptId, claimId, attemptId, expectedClaimVersion),
    db.prepare(`UPDATE visual_retry_claims SET retry_status = 'revoked', dispatch_status = 'revoked', state_version = state_version + 1
      WHERE id = ? AND attempt_id = ? AND state_version = ? AND retry_status != 'revoked'`)
      .bind(claimId, attemptId, expectedClaimVersion)
  ]);
}

/** Prepared attempts with no call retain their allowance and cached ledger. */
export async function deferVisualReplay({ db, claim, available = false }) {
  const retryStatus = available ? 'available' : 'unavailable';
  await db.batch([
    db.prepare(`UPDATE journal_visual_state SET attachment_status = 'failed', retry_status = ?, reason = 'configuration-unavailable'
      WHERE claim_id = ? AND attempt_id = ? AND state_version = ? AND EXISTS (SELECT 1 FROM visual_retry_claims c
        WHERE c.id = ? AND c.attempt_id = ? AND c.state_version = ? AND c.dispatch_status = 'prepared' AND ${ACTIVE_REPLAY_FENCE})`)
      .bind(retryStatus, claim.id, claim.attempt_id, claim.journal_state_version, claim.id, claim.attempt_id, claim.state_version, Date.now()),
    db.prepare(`UPDATE visual_retry_claims AS c SET retry_status = ? WHERE c.id = ? AND c.attempt_id = ? AND c.state_version = ?
      AND c.dispatch_status = 'prepared' AND ${ACTIVE_REPLAY_FENCE}`)
      .bind(retryStatus, claim.id, claim.attempt_id, claim.state_version, Date.now())
  ]);
}
