const deletedOwners = new Set();
const listeners = new Set();
const DELETED_ACCOUNT_PREFIX = 'tarot_deleted_account:';
const OWNER_KEYS = ['tarot_journal', 'tarot_journal_cache', 'tarot_journal_insights',
  'tarot_coach_recommendation', 'tarot_coach_stats_snapshot', 'tarot_saved_views_user'];
const NARRATIVE_CACHE_KEY = 'journey_narrative_cache';

export function isDeletedAccount(userId, { storage } = {}) {
  if (typeof userId !== 'string' || !userId) return false;
  if (deletedOwners.has(userId)) return true;
  try {
    if ((storage ?? globalThis.localStorage)?.getItem(`${DELETED_ACCOUNT_PREFIX}${encodeURIComponent(userId)}`) === '1') {
      deletedOwners.add(userId);
      return true;
    }
  } catch { /* A same-document confirmed deletion remains fenced in memory. */ }
  return false;
}

export function isDeletedAccountStorageKey(key, { storage } = {}) {
  // Match longer prefixes first: a journal cache key is not a journal owner.
  const prefix = [...OWNER_KEYS].sort((a, b) => b.length - a.length).find(value => key?.startsWith(`${value}_`));
  return prefix ? isDeletedAccount(key.slice(prefix.length + 1), { storage }) : false;
}

/** Invalidate matching pending journal work before authentication can await. */
export function subscribeToDeletedAccounts(listener) {
  listeners.add(listener);
  const onStorage = event => {
    if (event.newValue !== '1' || !event.key?.startsWith(DELETED_ACCOUNT_PREFIX)) return;
    try {
      const userId = decodeURIComponent(event.key.slice(DELETED_ACCOUNT_PREFIX.length));
      if (!isDeletedAccount(userId)) return;
      listener(userId);
    } catch { /* Invalid or unavailable storage cannot change another owner. */ }
  };
  const target = typeof window !== 'undefined' ? window : null;
  target?.addEventListener('storage', onStorage);
  return () => { listeners.delete(listener); target?.removeEventListener('storage', onStorage); };
}

/** Called only after confirmed server deletion. Ordinary logout retains local
 * journals; this operation erases one owner's prose and private capabilities. */
export function purgeDeletedAccountStorage(userId, { storage } = {}) {
  if (typeof userId !== 'string' || !userId) return { purged: false };
  deletedOwners.add(userId);
  for (const listener of listeners) {
    try { listener(userId); } catch { /* One subscriber cannot prevent erasure. */ }
  }
  let target;
  try { target = storage ?? globalThis.localStorage; } catch { return { purged: false }; }
  if (!target) return { purged: false };
  let purged = true;
  // Other tabs read this non-content marker at the actual persistence boundary;
  // they need not wait for the asynchronous native storage notification.
  try { target.setItem(`${DELETED_ACCOUNT_PREFIX}${encodeURIComponent(userId)}`, '1'); } catch { purged = false; }
  for (const prefix of OWNER_KEYS) {
    try { target.removeItem(`${prefix}_${userId}`); } catch { purged = false; }
  }
  const handlePrefix = `tarot_visual_resume:user:${encodeURIComponent(userId)}:`;
  try {
    const keys = Array.from({ length: target.length }, (_, index) => target.key(index));
    for (const key of keys) {
      if (!key?.startsWith(handlePrefix)) continue;
      try { target.removeItem(key); } catch { purged = false; }
    }
  } catch { purged = false; }
  // This cache is shared. Preserve every other owner and the guest entry.
  try {
    const raw = target.getItem(NARRATIVE_CACHE_KEY);
    if (raw) {
      const cache = JSON.parse(raw);
      if (!cache || typeof cache !== 'object' || Array.isArray(cache)) return { purged: false };
      const remaining = Object.fromEntries(Object.entries(cache).filter(([key]) => !key.startsWith(`${userId}:`)));
      if (Object.keys(remaining).length !== Object.keys(cache).length) {
        if (Object.keys(remaining).length) target.setItem(NARRATIVE_CACHE_KEY, JSON.stringify(remaining));
        else target.removeItem(NARRATIVE_CACHE_KEY);
      }
    }
  } catch { purged = false; }
  return { purged };
}
