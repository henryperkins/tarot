import { isDeletedAccount } from './deletedAccountStorage.js';

const ENTRY_PREFIX = 'tarot_deleted_journal_entry:';
const RESULT_PREFIX = 'tarot_deleted_journal_result:';
const deletedEntries = new Map();
const deletedResults = new Map();
const listeners = new Set();
const DERIVED_PREFIXES = ['tarot_journal_insights', 'tarot_coach_recommendation', 'tarot_coach_stats_snapshot'];

function targetStorage(storage) {
  try { return storage ?? globalThis.localStorage; } catch { return null; }
}
function userForNamespace(namespace) {
  try { return namespace?.startsWith('user:') ? decodeURIComponent(namespace.slice(5)) : null; } catch { return null; }
}
function remember(map, namespace, id) {
  if (!map.has(namespace)) map.set(namespace, new Set());
  map.get(namespace).add(String(id));
}
function markerKey(prefix, namespace, id) { return `${prefix}${namespace}:${encodeURIComponent(String(id))}`; }
function journalKeys(namespace) {
  const userId = userForNamespace(namespace);
  return userId ? [`tarot_journal_${userId}`, `tarot_journal_cache_${userId}`] : ['tarot_journal', 'tarot_journal_cache_anon'];
}

export function journalNamespaceForKey(key) {
  if (key === 'tarot_journal_insights' || DERIVED_PREFIXES.some(prefix => key?.startsWith(`${prefix}_`)) || key === 'tarot_journal_share_tokens') return null;
  if (key === 'tarot_journal' || key === 'tarot_journal_cache_anon') return 'anon';
  const prefix = ['tarot_journal_cache', 'tarot_journal'].find(value => key?.startsWith(`${value}_`));
  return prefix ? `user:${encodeURIComponent(key.slice(prefix.length + 1))}` : null;
}
export function derivedJournalNamespaceForKey(key) {
  const prefix = DERIVED_PREFIXES.find(value => key?.startsWith(`${value}_`));
  if (!prefix) return null;
  const owner = key.slice(prefix.length + 1);
  return owner === 'anon' ? 'anon' : `user:${encodeURIComponent(owner)}`;
}

export function isDeletedJournalEntry(namespace, entryId, { storage } = {}) {
  if (!namespace || entryId == null) return false;
  if (isDeletedAccount(userForNamespace(namespace), { storage })) return true;
  if (deletedEntries.get(namespace)?.has(String(entryId))) return true;
  try {
    if (targetStorage(storage)?.getItem(markerKey(ENTRY_PREFIX, namespace, entryId)) != null) {
      remember(deletedEntries, namespace, entryId);
      return true;
    }
  } catch { /* Same-document deletion still fences unavailable storage. */ }
  return false;
}
export function isDeletedJournalResult(namespace, resultId, { storage } = {}) {
  if (!namespace || resultId == null) return false;
  if (isDeletedAccount(userForNamespace(namespace), { storage })) return true;
  if (deletedResults.get(namespace)?.has(String(resultId))) return true;
  try {
    if (targetStorage(storage)?.getItem(markerKey(RESULT_PREFIX, namespace, resultId)) === '1') {
      remember(deletedResults, namespace, resultId);
      return true;
    }
  } catch { /* The in-memory fence remains active. */ }
  return false;
}
export function filterDeletedJournalEntries(namespace, entries, { storage } = {}) {
  if (!Array.isArray(entries)) return [];
  const filtered = entries.filter(entry => !isDeletedJournalEntry(namespace, entry?.id, { storage }));
  return filtered.length === entries.length ? entries : filtered;
}
export function hasJournalEntryDeletions(namespace, { storage } = {}) {
  if (deletedEntries.get(namespace)?.size) return true;
  const target = targetStorage(storage);
  try {
    const prefix = `${ENTRY_PREFIX}${namespace}:`;
    return Array.from({ length: target?.length || 0 }, (_, i) => target.key(i)).some(key => key?.startsWith(prefix));
  } catch { return false; }
}
// Derived prose must name its inputs after deletion. A fresh derivation from
// surviving entries is allowed; a stale render/effect or legacy copy is not.
export function canPersistJournalDerivation(namespace, sourceEntryIds, { storage } = {}) {
  if (isDeletedAccount(userForNamespace(namespace), { storage })) return false;
  if (!hasJournalEntryDeletions(namespace, { storage })) return true;
  return Array.isArray(sourceEntryIds) && sourceEntryIds.every(id => !isDeletedJournalEntry(namespace, id, { storage }));
}

export function subscribeToDeletedJournalEntries(listener) {
  listeners.add(listener);
  const receive = event => {
    if (!event.key?.startsWith(ENTRY_PREFIX) || event.newValue == null) return;
    const suffix = event.key.slice(ENTRY_PREFIX.length);
    const split = suffix.lastIndexOf(':');
    if (split < 0) return;
    const namespace = suffix.slice(0, split);
    try {
      const entryId = decodeURIComponent(suffix.slice(split + 1));
      if (isDeletedJournalEntry(namespace, entryId)) listener(namespace);
    } catch { /* Invalid keys cannot affect another namespace. */ }
  };
  const target = typeof window !== 'undefined' ? window : null;
  target?.addEventListener('storage', receive);
  return () => { listeners.delete(listener); target?.removeEventListener('storage', receive); };
}

/** Called after server success, or after the required local journal write.
 * Only non-content entry/result IDs survive erasure. Shared result handles stay
 * live when another surviving entry in this exact namespace still uses them. */
export function purgeDeletedJournalEntryStorage({ namespace, entryId, entries = [], retiredReadingResultIds = null, storage } = {}) {
  if (!namespace || entryId == null) return { purged: false, entries: [] };
  const target = targetStorage(storage);
  let purged = Boolean(target);
  const buckets = [];
  const all = [...entries];
  for (const key of journalKeys(namespace)) {
    try {
      const raw = target?.getItem(key);
      if (raw == null) continue;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) { purged = false; continue; }
      buckets.push({ key, entries: parsed }); all.push(...parsed);
    } catch { purged = false; }
  }
  const resultIds = new Set(all.filter(entry => String(entry?.id) === String(entryId))
    .flatMap(entry => [entry.readingResultId, entry.visualBinding?.readingResultId])
    .filter(id => typeof id === 'string' && id.length > 0 && id.length <= 256));
  const replayKey = `tarot_visual_resume:${namespace}:entry:${encodeURIComponent(String(entryId))}`;
  try {
    const replay = JSON.parse(target?.getItem(replayKey) || 'null');
    if (typeof replay?.readingResultId === 'string' && replay.readingResultId.length > 0 && replay.readingResultId.length <= 256) resultIds.add(replay.readingResultId);
  } catch { /* The exact replay key can be removed even if malformed. */ }
  try {
    const prefix = `tarot_visual_resume:${namespace}:`;
    for (const key of Array.from({ length: target?.length || 0 }, (_, i) => target.key(i))) {
      if (!key?.startsWith(prefix) || key.startsWith(`${prefix}entry:`)) continue;
      const raw = target.getItem(key);
      let handle;
      try { handle = JSON.parse(raw || 'null'); } catch { continue; }
      if (handle?.entryId === String(entryId) && typeof handle.binding?.readingResultId === 'string'
        && handle.binding.readingResultId.length > 0 && handle.binding.readingResultId.length <= 256) resultIds.add(handle.binding.readingResultId);
    }
  } catch { purged = false; }
  remember(deletedEntries, namespace, entryId);
  const survivors = filterDeletedJournalEntries(namespace, all, { storage: target });
  // Cloud deletion supplies the atomic server retirement receipt. An explicit
  // empty list preserves aliases beyond the current loaded/cached journal.
  const candidates = Array.isArray(retiredReadingResultIds) ? retiredReadingResultIds : [...resultIds];
  const retired = [...new Set(candidates.filter(id => typeof id === 'string' && id.length > 0 && id.length <= 256))]
    .filter(id => !survivors.some(entry => entry.readingResultId === id || entry.visualBinding?.readingResultId === id));
  for (const id of retired) remember(deletedResults, namespace, id);
  try { target?.setItem(markerKey(ENTRY_PREFIX, namespace, entryId), JSON.stringify({ readingResultIds: [...resultIds] })); } catch { purged = false; }
  for (const id of retired) {
    try { target?.setItem(markerKey(RESULT_PREFIX, namespace, id), '1'); } catch { purged = false; }
    try { target?.removeItem(`tarot_visual_resume:${namespace}:${encodeURIComponent(id)}`); } catch { purged = false; }
  }
  try { target?.removeItem(replayKey); } catch { purged = false; }
  for (const bucket of buckets) {
    try { target.setItem(bucket.key, JSON.stringify(filterDeletedJournalEntries(namespace, bucket.entries, { storage: target }))); } catch { purged = false; }
  }
  const userId = userForNamespace(namespace);
  for (const prefix of DERIVED_PREFIXES) {
    try { target?.removeItem(`${prefix}_${userId || 'anon'}`); } catch { purged = false; }
  }
  // Legacy insights belong only to guests; never erase them for a signed owner.
  if (namespace === 'anon') { try { target?.removeItem('tarot_journal_insights'); } catch { purged = false; } }
  try {
    const raw = target?.getItem('journey_narrative_cache');
    if (raw) {
      const cache = JSON.parse(raw);
      if (!cache || typeof cache !== 'object' || Array.isArray(cache)) purged = false;
      else {
        const remaining = Object.fromEntries(Object.entries(cache).filter(([key]) => !key.startsWith(`${userId || 'anon'}:`)));
        if (Object.keys(remaining).length !== Object.keys(cache).length) target.setItem('journey_narrative_cache', JSON.stringify(remaining));
      }
    }
  } catch { purged = false; }
  // Notify after physical erasure, synchronously before the caller can await.
  for (const listener of listeners) { try { listener(namespace); } catch { /* One listener cannot prevent cleanup. */ } }
  return { purged, entries: [...new Map(survivors.map(entry => [entry?.id, entry])).values()] };
}
