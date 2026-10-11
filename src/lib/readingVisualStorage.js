import { canonicalVisualCueJSON, hashVisualCueText, sameVisualCueBinding, visualCueBindingSchema } from '../../shared/contracts/visualCueBatches.js';
import { fingerprintVisualSource, normalizeVisualSource } from '../../shared/reading/visualSourceIdentity.js';
import { boundVisualCueLedger } from './narrativeGestureSource.js';
import { postSavedVisualRetry } from './readingVisualStream.js';
import { isDeletedAccount, isDeletedAccountStorageKey } from './deletedAccountStorage.js';
import { filterDeletedJournalEntries, isDeletedJournalEntry, isDeletedJournalResult, journalNamespaceForKey } from './deletedJournalEntryStorage.js';

const PRIVATE_PREFIX = 'tarot_visual_resume:';
export const VISUAL_SNAPSHOT_EVENT = 'reading-visual-snapshot';
const TERMINAL = new Set(['complete', 'error', 'failed', 'cancelled', 'expired', 'revoked']);
const ATTACHMENT_STATUSES = new Set(['missing', 'pending', 'attached', 'failed', 'expired']);
const RETRY_STATUSES = new Set(['available', 'pending', 'complete', 'exhausted', 'unavailable', 'revoked']);
const FINGERPRINT = /^[a-f0-9]{64}$/;
const PUBLIC_REASON = /^[a-z][a-z-]{0,47}$/;
// Saved replay admission bounds enforced by the server retry routes.
const MAX_RETRY_RAW = 120000;
const MAX_RETRY_CARDS = 20;
// Pending/unavailable states with this reason offer status without an action.
export const CONFIGURATION_UNAVAILABLE = 'configuration-unavailable';
// An available prepared claim deliberately keeps its historical reason while
// remaining eligible for another explicit action after configuration returns.
const configurationRefusal = state => ['pending', 'unavailable'].includes(state?.retryStatus)
  && state.reason === CONFIGURATION_UNAVAILABLE;

export function visualStorageNamespace(userId) {
  return userId ? `user:${encodeURIComponent(String(userId))}` : 'anon';
}

function storageOrDefault(storage) {
  try { return storage ?? globalThis.localStorage; } catch { return null; }
}

function deletedVisualOwner(namespace, storage) {
  if (!namespace?.startsWith('user:')) return false;
  try { return isDeletedAccount(decodeURIComponent(namespace.slice(5)), { storage }); } catch { return false; }
}

export function visualJournalKeys(namespace) {
  const userId = namespace.startsWith('user:') ? decodeURIComponent(namespace.slice(5)) : null;
  return userId ? [`tarot_journal_${userId}`, `tarot_journal_cache_${userId}`]
    : ['tarot_journal', 'tarot_journal_cache_anon'];
}

function privateKey(namespace, resultId) {
  return `${PRIVATE_PREFIX}${namespace}:${encodeURIComponent(resultId)}`;
}

// Saved replay handles are scoped by owner and saved entry. An encoded result
// ID cannot contain ':', so these keys never collide with original handles.
function replayKey(namespace, entryId) {
  return `${PRIVATE_PREFIX}${namespace}:entry:${encodeURIComponent(entryId)}`;
}

const opaque = value => typeof value === 'string' && value.length > 0 && value.length <= 256;
function readJSON(target, key) {
  try { return JSON.parse(target?.getItem(key) || 'null'); } catch { return null; }
}

// Capabilities are never part of entries, snapshots, export data or DOM events.
// Original handles keep their result-keyed format. A handle carrying a fresh
// visualJobId/attemptId is a saved replay: it must name its entry and replaces
// another attempt only when the caller names the attempt it expects.
export function writeVisualResume({ namespace, binding, resumeHandle, expiresAt = resumeHandle?.expiresAt ?? Date.now() + 3600000,
  storage, entryId = null, sourceFingerprint = null, stateVersion = null, expectedAttemptId } = {}) {
  const target = storageOrDefault(storage);
  if (!target || deletedVisualOwner(namespace, target) || isDeletedJournalEntry(namespace, entryId, { storage: target })
    || isDeletedJournalResult(namespace, binding?.readingResultId, { storage: target }) || !visualCueBindingSchema.safeParse(binding).success || !resumeHandle?.visualJobToken
    || !sameVisualCueBinding(binding, resumeHandle.visualBinding) || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;
  if (resumeHandle.visualJobId == null && resumeHandle.attemptId == null) {
    try {
      target.setItem(privateKey(namespace, binding.readingResultId), JSON.stringify({ binding,
        ...(entryId != null ? { entryId: String(entryId) } : {}), visualJobToken: resumeHandle.visualJobToken, expiresAt }));
      return true;
    } catch { return false; }
  }
  if (entryId == null || !opaque(String(entryId)) || !opaque(resumeHandle.visualJobId) || !opaque(resumeHandle.attemptId)
    || resumeHandle.readingResultId !== binding.readingResultId) return false;
  const key = replayKey(namespace, String(entryId));
  const current = readJSON(target, key);
  if (expectedAttemptId !== undefined && current && current.expiresAt > Date.now()
    && current.attemptId !== expectedAttemptId && current.attemptId !== resumeHandle.attemptId) return false;
  try {
    target.setItem(key, JSON.stringify({ version: 2, entryId: String(entryId), readingResultId: resumeHandle.readingResultId,
      visualJobId: resumeHandle.visualJobId, attemptId: resumeHandle.attemptId, binding, visualJobToken: resumeHandle.visualJobToken,
      expiresAt, sourceFingerprint: FINGERPRINT.test(sourceFingerprint || '') ? sourceFingerprint : null,
      stateVersion: Number.isSafeInteger(stateVersion) ? stateVersion : null }));
    return true;
  } catch { return false; }
}

// Replay removal must name the attempt it ends; an original removal may name its
// binding. Neither path can delete a successor handle.
export function removeVisualResume({ namespace, readingResultId, storage, entryId = null, attemptId, binding } = {}) {
  const target = storageOrDefault(storage);
  try {
    if (entryId != null) {
      const key = replayKey(namespace, String(entryId));
      const record = readJSON(target, key);
      if (!record || !attemptId || record.attemptId !== attemptId) return false;
      target.removeItem(key);
      return true;
    }
    const key = privateKey(namespace, readingResultId);
    if (binding && !sameVisualCueBinding(readJSON(target, key)?.binding, binding)) return false;
    target?.removeItem(key);
    return true;
  } catch { return false; }
}

export function clearVisualResumes(namespace, storage) {
  const target = storageOrDefault(storage);
  try {
    const prefix = `${PRIVATE_PREFIX}${namespace}:`;
    const keys = Array.from({ length: target?.length || 0 }, (_, index) => target.key(index));
    keys.filter(key => key?.startsWith(prefix)).forEach(key => target.removeItem(key));
  } catch { /* Optional storage. */ }
}

export function readVisualResume({ namespace, readingResultId, binding, storage, now = Date.now(), entryId = null } = {}) {
  const target = storageOrDefault(storage);
  if (deletedVisualOwner(namespace, target) || isDeletedJournalEntry(namespace, entryId, { storage: target })
    || isDeletedJournalResult(namespace, readingResultId, { storage: target })) return null;
  if (entryId != null) {
    const key = replayKey(namespace, String(entryId));
    const record = readJSON(target, key);
    if (!record) return null;
    if (!(record.expiresAt > now) || record.entryId !== String(entryId) || !visualCueBindingSchema.safeParse(record.binding).success
      || !opaque(record.visualJobToken) || !opaque(record.visualJobId) || !opaque(record.attemptId)) {
      try { target.removeItem(key); } catch { /* Optional storage. */ }
      return null;
    }
    if (binding && !sameVisualCueBinding(record.binding, binding)) return null;
    return { entryId: record.entryId, readingResultId: record.readingResultId, visualJobId: record.visualJobId,
      attemptId: record.attemptId, visualBinding: record.binding, visualJobToken: record.visualJobToken, expiresAt: record.expiresAt,
      sourceFingerprint: record.sourceFingerprint ?? null, stateVersion: record.stateVersion ?? null };
  }
  try {
    const record = readJSON(target, privateKey(namespace, readingResultId));
    if (!record || record.expiresAt <= now || !sameVisualCueBinding(record.binding, binding)) {
      if (record) removeVisualResume({ namespace, readingResultId, storage });
      return null;
    }
    return { readingResultId, visualBinding: record.binding, visualJobToken: record.visualJobToken, expiresAt: record.expiresAt };
  } catch { return null; }
}

const project = (value, fields) => Object.fromEntries(fields.filter(key => value?.[key] !== undefined).map(key => [key, value[key]]));
// Mirrors the server's public ledger projection, so unknown nested provider,
// transport or attempt fields never enter saved entries or DOM events.
function publicCueLedger(ledger) {
  return {
    ...project(ledger, ['version', 'ledgerRevision', 'raw', 'analyzedEnd', 'analyzedHash']),
    binding: ledger.binding,
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
      ...(visualCueBindingSchema.safeParse(receipt.binding).success ? { binding: visualCueBindingSchema.parse(receipt.binding) } : {}),
      ...(receipt.rejected ? { rejected: receipt.rejected.map(item => project(item, ['localAlias', 'code', 'message'])) } : {})
    }))
  };
}

export function publicVisualSnapshot({ binding, cueLedger, status = 'pending', raw }) {
  if (!visualCueBindingSchema.safeParse(binding).success || typeof raw !== 'string') return null;
  const ledger = cueLedger && boundVisualCueLedger(cueLedger, { runId: binding.readingResultId,
    sourceRevision: binding.sourceRevision, visualBinding: binding, raw });
  if (cueLedger && !ledger) return null;
  // Pick the known public fields rather than copying provider/transport payloads.
  const visible = ledger ? publicCueLedger(ledger) : null;
  const snapshot = visible ? { version: 1, binding, ledgerRevision: visible.ledgerRevision,
    raw: visible.raw, analyzedEnd: visible.analyzedEnd, analyzedHash: visible.analyzedHash,
    cues: visible.cues, introductions: visible.introductions, receipts: visible.receipts } : null;
  return { readingResultId: binding.readingResultId, binding, status: typeof status === 'string' && status.length <= 32 ? status : 'pending',
    sourceRevision: binding.sourceRevision, ledgerRevision: snapshot?.ledgerRevision || 0, snapshot };
}

/** The validated public snapshot an entry can display, or null. */
export function displayEntryVisual(entry) {
  const candidate = entry?.visual || entry?.visualSnapshot;
  const binding = entry?.visualBinding || candidate?.binding || candidate?.snapshot?.binding;
  const cueLedger = candidate?.snapshot || candidate?.cueLedger || (candidate?.version === 1 ? candidate : null);
  return publicVisualSnapshot({ binding, cueLedger, status: candidate?.status || 'pending', raw: entry?.personalReading });
}

/** Task 9 public retry state without attempt, snapshot or any other field. */
export function publicVisualRetryState(state) {
  if (!state || typeof state !== 'object') return null;
  const { attachmentStatus, retryStatus, sourceFingerprint, stateVersion, reason } = state;
  if (!ATTACHMENT_STATUSES.has(attachmentStatus) || !RETRY_STATUSES.has(retryStatus) || !FINGERPRINT.test(sourceFingerprint || '')
    || !Number.isSafeInteger(stateVersion) || stateVersion < 0) return null;
  return { attachmentStatus, retryStatus, sourceFingerprint, stateVersion,
    reason: typeof reason === 'string' && PUBLIC_REASON.test(reason) ? reason : null };
}

// A replay attempt owns the entry's visual once claimed; an original stream can
// no longer patch it (the server also revokes superseded original work).
export function replayOwnsVisual(entry) {
  const state = publicVisualRetryState(entry?.visualState);
  return Boolean(state && (['pending', 'exhausted', 'revoked'].includes(state.retryStatus) || state.reason === CONFIGURATION_UNAVAILABLE));
}

const PRIVATE_ENTRY_FIELDS = ['visualJobToken', 'visualToken', 'visualJobId', 'attemptId', 'resumeHandle', 'visualResume'];
/** Explicit public projection for journal entries from server save/list/get
 * responses: private top-level fields are dropped, nested retry state is
 * rebuilt from known public fields, and prose/user fields stay untouched. */
export function projectJournalEntryVisuals(entry) {
  if (!entry || typeof entry !== 'object') return entry;
  const projected = { ...entry };
  for (const field of PRIVATE_ENTRY_FIELDS) delete projected[field];
  const state = publicVisualRetryState(entry.visualState);
  if (state) projected.visualState = state; else delete projected.visualState;
  if (projected.visual) {
    const visual = displayEntryVisual({ personalReading: projected.personalReading, visual: projected.visual });
    if (visual) projected.visual = visual; else delete projected.visual;
  }
  if (projected.visualSnapshot) {
    const snapshot = displayEntryVisual({ personalReading: projected.personalReading, visual: projected.visualSnapshot });
    if (snapshot) projected.visualSnapshot = snapshot; else delete projected.visualSnapshot;
  }
  // The server's validated historical snapshot stays readable without a current link.
  if (!displayEntryVisual(projected)) {
    const historical = displayEntryVisual({ personalReading: projected.personalReading, visual: entry.visualState?.visualSnapshot });
    if (historical) projected.visual = historical;
  }
  return projected;
}

/** The saved source a replay may annotate: exact prose plus spread/context. */
export function savedVisualSource(entry) {
  return { raw: typeof entry?.personalReading === 'string' ? entry.personalReading : '',
    cards: Array.isArray(entry?.cards) ? entry.cards : [], deckId: entry?.deckId ?? null,
    question: entry?.question ?? '', reflections: entry?.reflections ?? '' };
}

function stableJSON(value) {
  if (Array.isArray(value)) return `[${value.map(stableJSON).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().filter(key => value[key] !== undefined)
      .map(key => `${JSON.stringify(key)}:${stableJSON(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null) ?? 'null';
}

/** Synchronous identity of the exact saved source, compared at every commit. */
export function savedVisualSourceKey(entry) {
  return stableJSON(savedVisualSource(entry));
}

/** Same full fingerprint the server computes for the saved source. */
export async function fingerprintSavedVisualEntry(entry) {
  const source = savedVisualSource(entry);
  const { artworkEdition, catalogVersion } = normalizeVisualSource(source);
  const { rawHash, spreadHash, contextHash } = await fingerprintVisualSource(source);
  return hashVisualCueText(canonicalVisualCueJSON({ rawHash, spreadHash, contextHash, artworkEdition, catalogVersion }));
}

/** Plain recovery view. Only an eligible failed/expired/missing saved visual
 * offers an explicit retry; pending, exhausted, revoked and unavailable states
 * offer status only. `cloud` pending work resumes through owned polling, local
 * pending work through its private handle. */
export function savedVisualRecovery(entry, { cloud = false, originalResume = null, replayResume = null } = {}) {
  const raw = entry?.personalReading;
  const state = publicVisualRetryState(entry?.visualState);
  const view = (phase, canRetry = false) => ({ phase, canRetry, state });
  if (typeof raw !== 'string' || !raw || !Array.isArray(entry?.cards) || !entry.cards.length) return view('none');
  let result;
  if (state) {
    if (['exhausted', 'revoked'].includes(state.retryStatus)) result = view('unavailable');
    else if (state.retryStatus === 'complete' || state.attachmentStatus === 'attached') result = view('complete');
    else if (configurationRefusal(state)) result = view('unavailable');
    else if (state.retryStatus === 'available') result = view('eligible', true);
    else if (state.retryStatus === 'pending' || state.attachmentStatus === 'pending') {
      // Without a usable private handle, only an explicit POST (deduplicated by
      // the server's one-source claim) can resynchronize local pending state.
      result = cloud || replayResume || (state.retryStatus !== 'pending' && originalResume) ? view('pending') : view('eligible', true);
    } else if (['failed', 'expired', 'missing'].includes(state.attachmentStatus)) result = view('eligible', true);
    else result = view('unavailable');
  } else {
    const visual = displayEntryVisual(entry);
    if (visual?.status === 'complete' && visual.snapshot) result = view('complete');
    else if (visual && !TERMINAL.has(visual.status) && (originalResume || cloud)) result = view('pending');
    else result = view('eligible', true);
  }
  return result.canRetry && (raw.length > MAX_RETRY_RAW || entry.cards.length > MAX_RETRY_CARDS) ? view('unavailable') : result;
}

/** Whether a cloud entry still needs owned journal polling (never inference). */
export function needsCloudVisualRefresh(entry) {
  const state = publicVisualRetryState(entry?.visualState);
  if (configurationRefusal(state)) return false;
  if (state) return state.retryStatus === 'pending'
    || (state.attachmentStatus === 'pending' && !['complete', 'exhausted', 'revoked'].includes(state.retryStatus));
  return Boolean(entry?.visual) && !TERMINAL.has(entry.visual.status);
}

export function readSavedVisualEntry({ namespace, entryId, storage }) {
  const target = storageOrDefault(storage);
  if (deletedVisualOwner(namespace, target) || isDeletedJournalEntry(namespace, entryId, { storage: target })) return null;
  for (const key of visualJournalKeys(namespace)) {
    const entries = readJSON(target, key);
    const entry = Array.isArray(entries) ? entries.find(item => item?.id === entryId) : null;
    if (entry) return entry;
  }
  return null;
}

/** Synchronous compare-and-set on the current owner's saved entry. Late work
 * patches only an existing entry whose exact saved source and public state
 * version still match; it never inserts, recreates or touches another owner. */
export function commitSavedVisualEntry({ namespace, entryId, sourceKey, expectedStateVersion, update, storage, isCurrent = () => true }) {
  const target = storageOrDefault(storage);
  if (!target || deletedVisualOwner(namespace, target) || isDeletedJournalEntry(namespace, entryId, { storage: target }) || !isCurrent()) return { committed: false, reason: 'stale-owner', entry: null };
  const writes = [];
  let found = null;
  for (const key of visualJournalKeys(namespace)) {
    const entries = readJSON(target, key);
    const index = Array.isArray(entries) ? entries.findIndex(item => item?.id === entryId) : -1;
    if (index < 0) continue;
    found = entries[index];
    if (savedVisualSourceKey(found) !== sourceKey) return { committed: false, reason: 'source-changed', entry: found };
    const version = publicVisualRetryState(found.visualState)?.stateVersion ?? 0;
    if (expectedStateVersion !== undefined && version !== expectedStateVersion) return { committed: false, reason: 'stale-state', entry: found };
    const next = update(found);
    if (!next) return { committed: false, reason: 'unchanged', entry: found };
    writes.push({ key, entries, index, next });
  }
  if (!found) return { committed: false, reason: 'entry-not-found', entry: null };
  if (deletedVisualOwner(namespace, target) || isDeletedJournalEntry(namespace, entryId, { storage: target })) return { committed: false, reason: 'stale-owner', entry: null };
  try {
    for (const { key, entries, index, next } of writes) target.setItem(key, JSON.stringify(filterDeletedJournalEntries(namespace, entries.map((item, at) => at === index ? next : item), { storage: target })));
  } catch { return { committed: false, reason: 'storage-error', entry: found }; }
  return { committed: true, reason: null, entry: writes.at(-1).next };
}

const VISUAL_FIELDS = ['visual', 'visualSnapshot', 'visualBinding', 'visualState'];
/** Copy public visual fields from a committed copy of the same saved source.
 * Older public state never replaces newer state. */
export function adoptEntryVisuals(current, next) {
  if (!current || !next || current.id !== next.id || savedVisualSourceKey(current) !== savedVisualSourceKey(next)) return current;
  const before = publicVisualRetryState(current.visualState)?.stateVersion ?? -1;
  const after = publicVisualRetryState(next.visualState)?.stateVersion ?? -1;
  if (after < before) return current;
  const adopted = { ...current };
  for (const field of VISUAL_FIELDS) {
    if (next[field] === undefined) delete adopted[field]; else adopted[field] = next[field];
  }
  return VISUAL_FIELDS.every(field => JSON.stringify(adopted[field]) === JSON.stringify(current[field])) ? current : adopted;
}

/** Reload merge for cloud entries: a recorded explicit-unavailable outcome is
 * kept for the same server state, and a locally validated cache stays readable
 * when the cloud has none. Any newer server state or changed source wins. */
export function mergeCachedJournalVisuals(serverEntry, cachedEntry) {
  if (!serverEntry || !cachedEntry || cachedEntry.id !== serverEntry.id
    || savedVisualSourceKey(cachedEntry) !== savedVisualSourceKey(serverEntry)) return serverEntry;
  let merged = serverEntry;
  const server = publicVisualRetryState(serverEntry.visualState);
  const cached = publicVisualRetryState(cachedEntry.visualState);
  if (server && cached && cached.retryStatus === 'unavailable' && cached.reason === CONFIGURATION_UNAVAILABLE
    && server.retryStatus === 'unavailable' && server.sourceFingerprint === cached.sourceFingerprint
    && server.stateVersion === cached.stateVersion) merged = { ...merged, visualState: { ...server, reason: CONFIGURATION_UNAVAILABLE } };
  if (!displayEntryVisual(merged)) {
    const local = displayEntryVisual(cachedEntry);
    if (local?.snapshot) merged = { ...merged, visual: local, visualBinding: local.binding };
  }
  return merged;
}

function dispatchVisualEvent(detail) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(VISUAL_SNAPSHOT_EVENT, { detail }));
}

export function patchVisualEntry(entry, { binding, cueLedger, status }) {
  const oldVisual = entry?.visual || entry?.visualSnapshot;
  const oldBinding = entry?.visualBinding || oldVisual?.binding || oldVisual?.snapshot?.binding;
  if (!entry?.id || !sameVisualCueBinding(oldBinding, binding)
    || entry.readingResultId !== binding.readingResultId || replayOwnsVisual(entry)) return entry;
  const visual = publicVisualSnapshot({ binding, cueLedger, status, raw: entry.personalReading });
  if (!visual || visual.ledgerRevision < (oldVisual?.ledgerRevision || 0)
    || (visual.ledgerRevision === oldVisual?.ledgerRevision && TERMINAL.has(oldVisual?.status) && !TERMINAL.has(status))) return entry;
  if (visual.ledgerRevision === (oldVisual?.ledgerRevision || 0)
    && oldVisual?.snapshot && JSON.stringify(visual.snapshot) !== JSON.stringify(oldVisual.snapshot)) return entry;
  return { ...entry, visual, visualSnapshot: visual };
}

export function patchSavedVisualSnapshot({ namespace, binding, cueLedger, status, storage }) {
  const target = storageOrDefault(storage);
  if (deletedVisualOwner(namespace, target) || isDeletedJournalResult(namespace, binding?.readingResultId, { storage: target })) return 0;
  let patched = 0;
  for (const key of visualJournalKeys(namespace)) {
    try {
      const entries = JSON.parse(target?.getItem(key) || 'null');
      if (!Array.isArray(entries)) continue;
      const next = filterDeletedJournalEntries(namespace, entries, { storage: target }).map(entry => patchVisualEntry(entry, { binding, cueLedger, status }));
      if (!next.some((entry, index) => entry !== entries[index])) continue;
      if (deletedVisualOwner(namespace, target)) return patched;
      target.setItem(key, JSON.stringify(next));
      patched += next.filter((entry, index) => entry !== entries[index]).length;
    } catch { /* A cue cache failure must leave the existing prose intact. */ }
  }
  if (patched && TERMINAL.has(status)) removeVisualResume({ namespace, readingResultId: binding.readingResultId, binding, storage });
  if (patched) dispatchVisualEvent({ namespace, binding, status,
    cueLedger: cueLedger && typeof cueLedger === 'object' ? publicCueLedger(cueLedger) : null });
  return patched;
}

const FAILURE_STATES = { failed: ['exhausted', 'annotation-failed'], error: ['exhausted', 'annotation-failed'],
  cancelled: ['revoked', 'revoked'], revoked: ['revoked', 'revoked'], expired: ['revoked', 'expired'] };

/** Settle one subscribed saved replay attempt. Hashes are verified before the
 * synchronous commit, which then rechecks owner, entry, exact source, active
 * attempt and (local) state version. A failed or empty successor never
 * replaces a previously validated cached snapshot. Cloud state stays
 * server-authoritative: the owned journal is refreshed instead. */
export async function adoptSavedVisualReplay({ namespace, entryId, resume, cueLedger = null, status, cloud = false,
  storage, isCurrent = () => true }) {
  const target = storageOrDefault(storage);
  const reject = reason => ({ adopted: false, reason, entry: null });
  if (!target || !opaque(resume?.attemptId) || !visualCueBindingSchema.safeParse(resume?.visualBinding).success) return reject('invalid-handle');
  if (status !== 'complete' && !FAILURE_STATES[status]) return reject('not-terminal');
  const entry = readSavedVisualEntry({ namespace, entryId, storage: target });
  if (!entry && !cloud) return reject('entry-not-found');
  const endAttempt = () => removeVisualResume({ namespace, entryId, attemptId: resume.attemptId, storage: target });
  if (cloud) {
    if (!isCurrent()) return reject('stale-owner');
    if (readVisualResume({ namespace, entryId, storage: target })?.attemptId !== resume.attemptId) return reject('superseded');
    endAttempt();
    dispatchVisualEvent({ namespace, entryId, refresh: true });
    return { adopted: true, reason: null, entry };
  }
  const source = savedVisualSource(entry);
  const sourceKey = savedVisualSourceKey(entry);
  const [fingerprint, hashes] = await Promise.all([fingerprintSavedVisualEntry(entry), fingerprintVisualSource(source)]);
  const { artworkEdition, catalogVersion } = normalizeVisualSource(source);
  const binding = resume.visualBinding;
  if (resume.sourceFingerprint && resume.sourceFingerprint !== fingerprint) return reject('source-changed');
  if (binding.spreadHash !== hashes.spreadHash || binding.contextHash !== hashes.contextHash
    || binding.artworkEdition !== artworkEdition || binding.catalogVersion !== catalogVersion) return reject('binding-mismatch');
  if (!isCurrent()) return reject('stale-owner');
  if (readVisualResume({ namespace, entryId, storage: target })?.attemptId !== resume.attemptId) return reject('superseded');
  let update;
  if (status === 'complete') {
    const visual = publicVisualSnapshot({ binding, cueLedger, status: 'complete', raw: entry.personalReading });
    if (!visual?.snapshot || visual.snapshot.raw !== entry.personalReading) return reject('invalid-ledger');
    const empty = !visual.snapshot.cues.length && !visual.snapshot.introductions.length;
    const prior = displayEntryVisual(entry)?.snapshot;
    const keepPrior = empty && Boolean(prior?.cues?.length || prior?.introductions?.length);
    update = current => ({ ...current, ...(keepPrior ? {} : { visualBinding: binding, visual, visualSnapshot: visual }),
      visualState: { attachmentStatus: 'attached', retryStatus: 'complete', sourceFingerprint: fingerprint,
        stateVersion: (publicVisualRetryState(current.visualState)?.stateVersion ?? 0) + 1, reason: null } });
  } else {
    const [retryStatus, reason] = FAILURE_STATES[status];
    update = current => {
      const state = publicVisualRetryState(current.visualState);
      return { ...current, visualState: { attachmentStatus: ['failed', 'expired'].includes(state?.attachmentStatus) ? state.attachmentStatus : 'failed',
        retryStatus, sourceFingerprint: fingerprint, stateVersion: (state?.stateVersion ?? 0) + 1, reason } };
    };
  }
  const result = commitSavedVisualEntry({ namespace, entryId, sourceKey, update, storage: target, isCurrent,
    expectedStateVersion: Number.isSafeInteger(resume.stateVersion) ? resume.stateVersion : undefined });
  if (!result.committed) return reject(result.reason);
  endAttempt();
  dispatchVisualEvent({ namespace, entryId });
  return { adopted: true, reason: null, entry: result.entry };
}

function retryFailure(code) {
  return Object.assign(new Error(code === 'offline' ? 'Card connections could not be reached.' : 'Card connections are unavailable.'), { code });
}

/** One explicit saved-visual retry. The private handle and public state are
 * durable before this resolves; every asynchronous boundary rechecks owner,
 * entry, exact source and state version. Cloud commits go through the caller's
 * guarded in-memory journal (`commit`), local commits through scoped storage. */
export async function requestSavedVisualRetry({ namespace, entry, cloud = false, fetchImpl, storage, signal,
  isCurrent = () => true, commit = null } = {}) {
  const target = storageOrDefault(storage);
  if (!entry?.id || isDeletedJournalEntry(namespace, entry.id, { storage: target })) throw retryFailure('not-found');
  const current = () => isCurrent() && !deletedVisualOwner(namespace, target)
    && !isDeletedJournalEntry(namespace, entry.id, { storage: target });
  const replayResume = readVisualResume({ namespace, entryId: entry.id, storage: target });
  const restored = displayEntryVisual(entry);
  const originalResume = restored ? readVisualResume({ namespace, readingResultId: restored.readingResultId,
    binding: restored.binding, storage: target }) : null;
  if (!savedVisualRecovery(entry, { cloud, replayResume, originalResume }).canRetry) throw retryFailure('ineligible');
  const sourceKey = savedVisualSourceKey(entry);
  const expectedStateVersion = publicVisualRetryState(entry.visualState)?.stateVersion ?? 0;
  const fingerprint = await fingerprintSavedVisualEntry(entry);
  if (!current()) throw retryFailure('stale');
  const response = await postSavedVisualRetry({ cloud, entryId: entry.id, savedSource: savedVisualSource(entry), fetchImpl, signal });
  if (!current()) throw retryFailure('stale');
  if (!response.ok) throw retryFailure({ offline: 'offline', 'not-found': 'not-found', 'invalid-source': 'ineligible' }[response.reason] || 'server');
  const state = publicVisualRetryState(response.state);
  if (!state) throw retryFailure('server');
  if (state.sourceFingerprint !== fingerprint) throw retryFailure('stale');
  const handle = response.resumeHandle && visualCueBindingSchema.safeParse(response.resumeHandle.visualBinding).success
    && opaque(response.resumeHandle.attemptId) && opaque(response.resumeHandle.visualJobId) ? response.resumeHandle : null;
  let next = state;
  let visual = null;
  let keepHandle = null;
  const expired = { ...state, attachmentStatus: 'failed', retryStatus: 'revoked', reason: 'expired' };
  if (state.retryStatus === 'complete' || state.attachmentStatus === 'attached') {
    visual = displayEntryVisual({ personalReading: entry.personalReading, visual: response.state?.visualSnapshot });
    if (!visual?.snapshot) {
      visual = null;
      // A complete local claim is fetched through its replay transport.
      if (handle && !cloud) { keepHandle = handle; next = { ...state, attachmentStatus: 'pending', retryStatus: 'pending' }; }
      else if (!cloud) next = expired;
    }
  } else if (configurationRefusal(state)) {
    // A status-only refusal is authoritative even if a stale transport was
    // included. It never resumes work or replaces already accepted cues.
    if (!displayEntryVisual(entry)?.snapshot) {
      const candidate = displayEntryVisual({ personalReading: entry.personalReading, visual: response.state?.visualSnapshot });
      const source = savedVisualSource(entry);
      const hashes = await fingerprintVisualSource(source);
      const normalized = normalizeVisualSource(source);
      if (candidate?.snapshot && candidate.binding.spreadHash === hashes.spreadHash && candidate.binding.contextHash === hashes.contextHash
        && candidate.binding.artworkEdition === normalized.artworkEdition && candidate.binding.catalogVersion === normalized.catalogVersion) visual = candidate;
      if (!current()) throw retryFailure('stale');
    }
  } else if (state.retryStatus === 'pending' || state.attachmentStatus === 'pending') {
    if (handle) keepHandle = handle; else if (!cloud) next = expired;
  } else if (state.retryStatus === 'available') {
    // A prepared attempt waits for another explicit retry; nothing to subscribe to.
  } else if (!['exhausted', 'revoked'].includes(state.retryStatus) && !handle) {
    next = { ...state, retryStatus: 'unavailable', reason: CONFIGURATION_UNAVAILABLE };
  }
  const update = current => {
    const now = publicVisualRetryState(current.visualState);
    if (cloud && now && state.stateVersion < now.stateVersion) return null;
    const localRefusal = !cloud && configurationRefusal(next);
    const original = localRefusal && !now ? displayEntryVisual(current) : null;
    const savedAttachment = now?.sourceFingerprint === fingerprint ? now.attachmentStatus
      : original?.status === 'expired' ? 'expired' : ['failed', 'cancelled', 'revoked'].includes(original?.status) ? 'failed'
        : original ? 'pending' : null;
    const visualState = { ...next, sourceFingerprint: fingerprint,
      ...(localRefusal && savedAttachment ? { attachmentStatus: savedAttachment } : {}),
      stateVersion: cloud ? state.stateVersion : localRefusal ? (now?.stateVersion ?? 0) : (now?.stateVersion ?? 0) + 1 };
    return { ...current, visualState, ...(visual ? { visualBinding: visual.binding, visual, visualSnapshot: visual } : {}) };
  };
  const previousHandle = readVisualResume({ namespace, entryId: entry.id, storage: target });
  let wroteHandle = false;
  if (keepHandle && !cloud) {
    // The private handle is durable before the public pending state names it.
    if (!readSavedVisualEntry({ namespace, entryId: entry.id, storage: target })) throw retryFailure('not-found');
    wroteHandle = previousHandle?.attemptId !== keepHandle.attemptId;
    if (!writeVisualResume({ namespace, entryId: entry.id, binding: keepHandle.visualBinding, resumeHandle: keepHandle,
      expectedAttemptId: previousHandle?.attemptId ?? null, sourceFingerprint: fingerprint, stateVersion: expectedStateVersion + 1, storage: target })) {
      throw retryFailure('storage');
    }
  }
  const committed = commit ? commit({ entryId: entry.id, sourceKey, update })
    : commitSavedVisualEntry({ namespace, entryId: entry.id, sourceKey, expectedStateVersion, update, storage: target, isCurrent: current });
  if (!committed.committed) {
    if (wroteHandle) removeVisualResume({ namespace, entryId: entry.id, attemptId: keepHandle.attemptId, storage: target });
    // Another tab (or a newer cloud poll) already committed state for this exact source.
    const current = committed.entry && publicVisualRetryState(committed.entry.visualState);
    if (['stale-state', 'unchanged'].includes(committed.reason) && current?.sourceFingerprint === fingerprint) {
      return { state: { ...current, attemptId: response.state?.attemptId ?? null, visualSnapshot: displayEntryVisual(committed.entry) }, entry: committed.entry };
    }
    throw retryFailure(committed.reason === 'storage-error' ? 'storage' : committed.reason === 'entry-not-found' ? 'not-found' : 'stale');
  }
  if (keepHandle && cloud) {
    writeVisualResume({ namespace, entryId: entry.id, binding: keepHandle.visualBinding, resumeHandle: keepHandle,
      expectedAttemptId: previousHandle?.attemptId ?? null, sourceFingerprint: fingerprint, stateVersion: state.stateVersion, storage: target });
  }
  if (configurationRefusal(next) && previousHandle) {
    removeVisualResume({ namespace, entryId: entry.id, attemptId: previousHandle.attemptId, storage: target });
  }
  if (!cloud) dispatchVisualEvent({ namespace, entryId: entry.id });
  const committedState = publicVisualRetryState(committed.entry.visualState);
  return { state: { ...committedState, attemptId: response.state?.attemptId ?? null, visualSnapshot: displayEntryVisual(committed.entry) },
    entry: committed.entry };
}

// Saving prose is the primary operation. If optional cue data exhausts storage,
// drop only new or changed cue snapshots; snapshots already persisted for an
// entry stay intact. Report failure if even the prose cannot be persisted.
export function persistJournalWithVisualFallback({ key, entries, storage }) {
  const target = storageOrDefault(storage);
  if (isDeletedAccountStorageKey(key, { storage: target })) return { ok: false, entries: [] };
  const namespace = journalNamespaceForKey(key);
  if (namespace) entries = filterDeletedJournalEntries(namespace, entries, { storage: target });
  try { target.setItem(key, JSON.stringify(entries)); return { ok: true, entries }; } catch {
    const stored = readJSON(target, key);
    const persisted = new Map((Array.isArray(stored) ? stored : []).filter(item => item?.id).map(item => [item.id, item]));
    const fallback = entries.map(entry => {
      const previous = persisted.get(entry?.id);
      if (previous && JSON.stringify(previous.visual ?? null) === JSON.stringify(entry.visual ?? null)
        && JSON.stringify(previous.visualSnapshot ?? null) === JSON.stringify(entry.visualSnapshot ?? null)) return entry;
      const { visual: _visual, visualSnapshot: _snapshot, ...rest } = entry;
      return { ...rest, ...(previous?.visual ? { visual: previous.visual } : {}),
        ...(previous?.visualSnapshot ? { visualSnapshot: previous.visualSnapshot } : {}) };
    });
    try { target.setItem(key, JSON.stringify(fallback)); return { ok: true, entries: fallback }; }
    catch { return { ok: false, entries: [] }; }
  }
}
