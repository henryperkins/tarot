import { isDeletedAccountStorageKey } from '../deletedAccountStorage.js';

/** Serialize cooperating tabs; ordered acquisition also protects guest imports. */
export async function withLocalJournalStorageLock(keys, operation, { storage, onOwnerDeleted } = {}) {
  const locks = globalThis.navigator?.locks;
  if (!locks?.request) {
    throw new Error('This browser cannot safely update your journal. Use a current browser over a secure connection. Your saved readings have been kept.');
  }
  const names = [...new Set(keys)].sort();
  const commit = async () => {
    let result;
    let failure;
    try { result = await operation(); } catch (error) { failure = error; }
    // Account deletion also runs outside Journal. If its durable marker won
    // during the write, erase any late copy before releasing the bucket lock.
    const target = storage ?? globalThis.localStorage;
    const deletedKeys = names.filter(key => isDeletedAccountStorageKey(key, { storage: target }));
    if (deletedKeys.length) {
      try { deletedKeys.forEach(key => target.removeItem(key)); }
      finally { onOwnerDeleted?.(); }
      throw new Error('This account has been deleted.');
    }
    if (failure) throw failure;
    return result;
  };
  const acquire = index => index === names.length ? commit()
    : locks.request(`tableu:journal:${names[index]}`, { mode: 'exclusive' }, () => acquire(index + 1));
  return acquire(0);
}
