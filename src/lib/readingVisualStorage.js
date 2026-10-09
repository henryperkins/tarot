import { sameVisualCueBinding, visualCueBindingSchema } from '../../shared/contracts/visualCueBatches.js';
import { boundVisualCueLedger } from './narrativeGestureSource.js';

const PRIVATE_PREFIX = 'tarot_visual_resume:';
export const VISUAL_SNAPSHOT_EVENT = 'reading-visual-snapshot';
const TERMINAL = new Set(['complete', 'error', 'failed', 'cancelled', 'expired']);

export function visualStorageNamespace(userId) {
  return userId ? `user:${encodeURIComponent(String(userId))}` : 'anon';
}

function storageOrDefault(storage) {
  try { return storage ?? globalThis.localStorage; } catch { return null; }
}

export function visualJournalKeys(namespace) {
  const userId = namespace.startsWith('user:') ? decodeURIComponent(namespace.slice(5)) : null;
  return userId ? [`tarot_journal_${userId}`, `tarot_journal_cache_${userId}`]
    : ['tarot_journal', 'tarot_journal_cache_anon'];
}

function privateKey(namespace, resultId) {
  return `${PRIVATE_PREFIX}${namespace}:${encodeURIComponent(resultId)}`;
}

// Capabilities are never part of entries, snapshots, export data or DOM events.
export function writeVisualResume({ namespace, binding, resumeHandle, expiresAt = Date.now() + 3600000, storage }) {
  const target = storageOrDefault(storage);
  if (!target || !visualCueBindingSchema.safeParse(binding).success || !resumeHandle?.visualJobToken
    || !sameVisualCueBinding(binding, resumeHandle.visualBinding) || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;
  try {
    target.setItem(privateKey(namespace, binding.readingResultId), JSON.stringify({ binding,
      visualJobToken: resumeHandle.visualJobToken, expiresAt }));
    return true;
  } catch { return false; }
}

export function removeVisualResume({ namespace, readingResultId, storage }) {
  try { storageOrDefault(storage)?.removeItem(privateKey(namespace, readingResultId)); } catch { /* Optional storage. */ }
}

export function clearVisualResumes(namespace, storage) {
  const target = storageOrDefault(storage);
  try {
    const prefix = `${PRIVATE_PREFIX}${namespace}:`;
    const keys = Array.from({ length: target?.length || 0 }, (_, index) => target.key(index));
    keys.filter(key => key?.startsWith(prefix)).forEach(key => target.removeItem(key));
  } catch { /* Optional storage. */ }
}

export function readVisualResume({ namespace, readingResultId, binding, storage, now = Date.now() }) {
  try {
    const record = JSON.parse(storageOrDefault(storage)?.getItem(privateKey(namespace, readingResultId)) || 'null');
    if (!record || record.expiresAt <= now || !sameVisualCueBinding(record.binding, binding)) {
      if (record) removeVisualResume({ namespace, readingResultId, storage });
      return null;
    }
    return { readingResultId, visualBinding: record.binding, visualJobToken: record.visualJobToken, expiresAt: record.expiresAt };
  } catch { return null; }
}

export function publicVisualSnapshot({ binding, cueLedger, status = 'pending', raw }) {
  if (!visualCueBindingSchema.safeParse(binding).success || typeof raw !== 'string') return null;
  const ledger = cueLedger && boundVisualCueLedger(cueLedger, { runId: binding.readingResultId,
    sourceRevision: binding.sourceRevision, visualBinding: binding, raw });
  if (cueLedger && !ledger) return null;
  // Pick the known public fields rather than copying provider/transport payloads.
  const snapshot = ledger ? { version: 1, binding, ledgerRevision: ledger.ledgerRevision,
    raw: ledger.raw, analyzedEnd: ledger.analyzedEnd, analyzedHash: ledger.analyzedHash,
    cues: ledger.cues, introductions: ledger.introductions, receipts: ledger.receipts || [] } : null;
  return { readingResultId: binding.readingResultId, binding, status, sourceRevision: binding.sourceRevision,
    ledgerRevision: snapshot?.ledgerRevision || 0, snapshot };
}

export function patchVisualEntry(entry, { binding, cueLedger, status }) {
  const oldVisual = entry?.visual || entry?.visualSnapshot;
  const oldBinding = entry?.visualBinding || oldVisual?.binding || oldVisual?.snapshot?.binding;
  if (!entry?.id || !sameVisualCueBinding(oldBinding, binding)
    || entry.readingResultId !== binding.readingResultId) return entry;
  const visual = publicVisualSnapshot({ binding, cueLedger, status, raw: entry.personalReading });
  if (!visual || visual.ledgerRevision < (oldVisual?.ledgerRevision || 0)
    || (visual.ledgerRevision === oldVisual?.ledgerRevision && TERMINAL.has(oldVisual?.status) && !TERMINAL.has(status))) return entry;
  if (visual.ledgerRevision === (oldVisual?.ledgerRevision || 0)
    && oldVisual?.snapshot && JSON.stringify(visual.snapshot) !== JSON.stringify(oldVisual.snapshot)) return entry;
  return { ...entry, visual, visualSnapshot: visual };
}

export function patchSavedVisualSnapshot({ namespace, binding, cueLedger, status, storage }) {
  const target = storageOrDefault(storage);
  let patched = 0;
  for (const key of visualJournalKeys(namespace)) {
    try {
      const entries = JSON.parse(target?.getItem(key) || 'null');
      if (!Array.isArray(entries)) continue;
      const next = entries.map(entry => patchVisualEntry(entry, { binding, cueLedger, status }));
      if (!next.some((entry, index) => entry !== entries[index])) continue;
      target.setItem(key, JSON.stringify(next));
      patched += next.filter((entry, index) => entry !== entries[index]).length;
    } catch { /* A cue cache failure must leave the existing prose intact. */ }
  }
  if (patched && TERMINAL.has(status)) removeVisualResume({ namespace, readingResultId: binding.readingResultId, storage });
  if (patched && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(VISUAL_SNAPSHOT_EVENT, {
    detail: { namespace, binding, cueLedger, status }
  }));
  return patched;
}

// Saving prose is the primary operation. Retry without optional cue data if it
// alone exhausts storage; report failure if even the prose cannot be persisted.
export function persistJournalWithVisualFallback({ key, entries, storage }) {
  const target = storageOrDefault(storage);
  try { target.setItem(key, JSON.stringify(entries)); return { ok: true, entries }; } catch {
    const withoutSnapshots = entries.map(({ visual: _visual, visualSnapshot: _snapshot, ...entry }) => entry);
    try { target.setItem(key, JSON.stringify(withoutSnapshots)); return { ok: true, entries: withoutSnapshots }; }
    catch { return { ok: false, entries: [] }; }
  }
}
