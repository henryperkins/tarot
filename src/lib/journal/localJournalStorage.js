import { persistJournalWithVisualFallback } from '../readingVisualStorage.js';
import { dedupeEntries } from '../../../shared/journal/dedupe.js';
import { filterDeletedJournalEntries, journalNamespaceForKey } from '../deletedJournalEntryStorage.js';

export { withLocalJournalStorageLock } from './storageLock.js';

/** A missing journal is empty; an unreadable journal must never be replaced. */
export function readLocalJournalEntries(storage, key, snapshot) {
  try {
    const raw = snapshot === undefined ? storage.getItem(key) : snapshot;
    if (raw === null) return [];
    const entries = JSON.parse(raw);
    if (!Array.isArray(entries) || entries.some(entry => !entry || typeof entry !== 'object' || Array.isArray(entry))) {
      throw new Error('Expected a journal entry list.');
    }
    return entries;
  } catch (cause) {
    throw new Error('Unable to read your saved journal. Your stored data has been kept.', { cause });
  }
}

/** Append to the latest durable history; existing account copies win collisions. */
export function writeLocalJournalEntries({ storage, key, entries }) {
  const namespace = journalNamespaceForKey(key);
  const previousEntries = filterDeletedJournalEntries(namespace, dedupeEntries(readLocalJournalEntries(storage, key)), { storage });
  const next = dedupeEntries([...previousEntries, ...entries]);
  const result = persistJournalWithVisualFallback({ storage, key, entries: next });
  if (!result.ok || storage.getItem(key) !== JSON.stringify(result.entries)) {
    return { ok: false, entries: [], error: 'Your browser could not save this reading. Free some storage and try again.' };
  }
  return { ...result, previousEntries };
}
