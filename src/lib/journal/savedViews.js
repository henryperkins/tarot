import { isDeletedAccount } from '../deletedAccountStorage.js';

const LEGACY_KEY = 'journal_saved_filters_v1';
const storageKey = ownerId => ownerId ? `tarot_saved_views_user_${ownerId}` : 'tarot_saved_views_guest';

function parseViews(views) {
  if (!Array.isArray(views) || views.some(view => !view || typeof view.id !== 'string'
    || typeof view.name !== 'string' || !view.values || typeof view.values !== 'object' || Array.isArray(view.values)
    || (view.values.query !== undefined && typeof view.values.query !== 'string')
    || (view.values.timeframe !== undefined && typeof view.values.timeframe !== 'string')
    || (view.values.onlyReversals !== undefined && typeof view.values.onlyReversals !== 'boolean')
    || ['contexts', 'spreads', 'decks'].some(key => view.values[key] !== undefined
      && (!Array.isArray(view.values[key]) || view.values[key].some(value => typeof value !== 'string'))))) {
    throw new Error('Unreadable saved views.');
  }
  return views;
}

function readBucket(storage, ownerId) {
  const raw = storage.getItem(storageKey(ownerId));
  if (raw === null) return { views: [], legacyImported: false };
  const bucket = JSON.parse(raw);
  return { views: parseViews(bucket.views), legacyImported: bucket.legacyImported === true };
}

export function readSavedViews(storage, ownerId) {
  if (isDeletedAccount(ownerId, { storage })) return [];
  try { return readBucket(storage, ownerId).views; } catch { return []; }
}

export function hasLegacySavedViews(storage, ownerId) {
  if (isDeletedAccount(ownerId, { storage })) return false;
  try { return Boolean(storage.getItem(LEGACY_KEY)) && !readBucket(storage, ownerId).legacyImported; } catch { return false; }
}

export function writeSavedViews(storage, ownerId, views, { legacyImported } = {}) {
  try {
    if (isDeletedAccount(ownerId, { storage })) throw new Error('This account is no longer available.');
    const previous = readBucket(storage, ownerId);
    const value = JSON.stringify({ views: parseViews(views), legacyImported: legacyImported ?? previous.legacyImported });
    const key = storageKey(ownerId);
    storage.setItem(key, value);
    if (storage.getItem(key) !== value) throw new Error('The browser did not retain the saved view.');
    if (isDeletedAccount(ownerId, { storage })) {
      storage.removeItem(key);
      throw new Error('This account is no longer available.');
    }
    return { success: true, views };
  } catch {
    return { success: false, error: 'Your browser could not save this view. Existing saved views have been kept.' };
  }
}

/** Only an explicit user decision can assign views of unknown legacy ownership. */
export function importLegacySavedViews(storage, ownerId) {
  try {
    const legacy = parseViews(JSON.parse(storage.getItem(LEGACY_KEY) || '[]'));
    const existing = readBucket(storage, ownerId).views;
    const names = new Set(existing.map(view => view.name.toLowerCase()));
    const incoming = legacy.filter(view => {
      const name = view.name.toLowerCase();
      if (names.has(name)) return false;
      names.add(name); return true;
    });
    // Retain the unknown-owner source; another browser account must claim it explicitly too.
    return writeSavedViews(storage, ownerId, [...existing, ...incoming], { legacyImported: true });
  } catch {
    return { success: false, error: 'The older saved views could not be read. Their stored data has been kept.' };
  }
}
