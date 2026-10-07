import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { migrateLegacyPersonalization, safeSessionStorage } from '../src/lib/preferenceStorage.js';
import {
  DEFAULT_PERSONALIZATION,
  LEGACY_PERSONALIZATION_STORAGE_KEY,
  getPersonalizationStorageKey,
  sanitizePersonalization
} from '../src/utils/personalizationStorage.js';

function createStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
}

describe('personalization storage migration', () => {
  let storage;
  const legacy = { displayName: 'Reader', readingTone: 'gentle', focusAreas: ['growth'] };
  const legacyRaw = JSON.stringify(legacy);
  const storageKey = getPersonalizationStorageKey('reader-1');

  beforeEach(() => {
    storage = createStorage();
    storage.setItem(LEGACY_PERSONALIZATION_STORAGE_KEY, legacyRaw);
  });

  it('removes legacy data only after its owner-scoped copy is readable', () => {
    const migrated = migrateLegacyPersonalization(storageKey, { userId: 'reader-1', storage });
    assert.deepEqual(migrated, sanitizePersonalization(legacy));
    assert.equal(storage.getItem(storageKey), legacyRaw);
    assert.equal(storage.getItem(LEGACY_PERSONALIZATION_STORAGE_KEY), null);
  });

  it('retains legacy data without exposing private preferences when storage is full', () => {
    storage.setItem = () => { throw new DOMException('Storage is full', 'QuotaExceededError'); };
    const migrated = migrateLegacyPersonalization(storageKey, { userId: 'reader-1', storage });
    assert.equal(migrated, null);
    assert.equal(storage.getItem(LEGACY_PERSONALIZATION_STORAGE_KEY), legacyRaw);
    assert.equal(storage.getItem(storageKey), null);
  });

  it('does not delete the original when a browser silently drops its write', () => {
    storage.setItem = () => {};
    assert.equal(migrateLegacyPersonalization(storageKey, { userId: 'reader-1', storage }), null);
    assert.equal(storage.getItem(LEGACY_PERSONALIZATION_STORAGE_KEY), legacyRaw);
  });

  for (const writeFailure of ['throws', 'silently drops writes']) {
    it(`does not expose retained private legacy values across A → guest → B when storage ${writeFailure}`, () => {
      const ownerAKey = getPersonalizationStorageKey('owner-a');
      const guestKey = getPersonalizationStorageKey(null);
      const ownerBKey = getPersonalizationStorageKey('owner-b');
      const write = storage.setItem;
      storage.setItem = writeFailure === 'throws'
        ? () => { throw new DOMException('Storage is full', 'QuotaExceededError'); }
        : () => {};

      const ownerA = migrateLegacyPersonalization(ownerAKey, { userId: 'owner-a', storage });
      const guest = migrateLegacyPersonalization(guestKey, { storage });
      const ownerB = migrateLegacyPersonalization(ownerBKey, { userId: 'owner-b', storage });

      assert.equal(ownerB, null);
      assert.equal(ownerA, null);
      assert.equal(guest?.displayName || '', '');
      assert.deepEqual(guest?.focusAreas || [], []);
      assert.equal(storage.getItem(ownerAKey), null);
      assert.equal(storage.getItem(ownerBKey), null);
      assert.equal(storage.getItem(LEGACY_PERSONALIZATION_STORAGE_KEY), legacyRaw);

      storage.setItem = write;
      const recovered = migrateLegacyPersonalization(ownerAKey, { userId: 'owner-a', storage });
      assert.equal(recovered.displayName, 'Reader');
      assert.deepEqual(recovered.focusAreas, ['growth']);
      assert.equal(storage.getItem(ownerAKey), legacyRaw);
      assert.equal(storage.getItem(LEGACY_PERSONALIZATION_STORAGE_KEY), null);
    });
  }

  it('keeps an existing owner-scoped preference instead of replacing it with legacy data', () => {
    const existing = JSON.stringify({ readingTone: 'blunt' });
    storage.setItem(storageKey, existing);
    assert.equal(migrateLegacyPersonalization(storageKey, { userId: 'reader-1', storage }), null);
    assert.equal(storage.getItem(storageKey), existing);
    assert.equal(storage.getItem(LEGACY_PERSONALIZATION_STORAGE_KEY), null);
  });

  for (const [kind, scopedRaw] of [
    ['invalid JSON', '{invalid JSON'],
    ['null', 'null'],
    ['a boolean', 'true'],
    ['a number', '42'],
    ['a string', '"incomplete preference"'],
    ['an array', '[]']
  ]) {
    it(`recovers valid legacy preferences when the scoped value is ${kind}`, () => {
      storage.setItem(storageKey, scopedRaw);
      const migrated = migrateLegacyPersonalization(storageKey, { userId: 'reader-1', storage });
      assert.deepEqual(migrated, sanitizePersonalization(legacy));
      assert.equal(storage.getItem(storageKey), legacyRaw);
      assert.equal(storage.getItem(LEGACY_PERSONALIZATION_STORAGE_KEY), null);
    });

    it(`retains both originals after a failed migration over ${kind}`, () => {
      storage.setItem(storageKey, scopedRaw);
      storage.setItem = () => { throw new DOMException('Storage is full', 'QuotaExceededError'); };
      const migrated = migrateLegacyPersonalization(storageKey, { userId: 'reader-1', storage });
      assert.equal(migrated, null);
      assert.equal(storage.getItem(storageKey), scopedRaw);
      assert.equal(storage.getItem(LEGACY_PERSONALIZATION_STORAGE_KEY), legacyRaw);
    });
  }

  it('does not transfer legacy personal details to a guest scope', () => {
    const guestKey = getPersonalizationStorageKey(null);
    assert.deepEqual(migrateLegacyPersonalization(guestKey, { storage }), DEFAULT_PERSONALIZATION);
    assert.deepEqual(JSON.parse(storage.getItem(guestKey)), DEFAULT_PERSONALIZATION);
  });

  it('leaves inaccessible or corrupt originals intact without throwing', () => {
    const inaccessible = { getItem: () => { throw new DOMException('Denied', 'SecurityError'); } };
    assert.equal(migrateLegacyPersonalization(storageKey, { userId: 'reader-1', storage: inaccessible }), null);
    storage.setItem(LEGACY_PERSONALIZATION_STORAGE_KEY, '{invalid JSON');
    assert.equal(migrateLegacyPersonalization(storageKey, { userId: 'reader-1', storage }), null);
    assert.equal(storage.getItem(LEGACY_PERSONALIZATION_STORAGE_KEY), '{invalid JSON');
  });
});

describe('optional session preference storage', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let storage;

  beforeEach(() => {
    storage = createStorage();
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { sessionStorage: storage } });
  });

  afterEach(() => {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else delete globalThis.window;
  });

  it('reads, stores and clears available per-tab state', () => {
    safeSessionStorage.setItem('draft', 'reflection');
    assert.equal(safeSessionStorage.getItem('draft'), 'reflection');
    safeSessionStorage.removeItem('draft');
    assert.equal(safeSessionStorage.getItem('draft'), null);
  });

  it('tolerates method access failures without reporting stored state', () => {
    for (const method of ['getItem', 'setItem', 'removeItem']) {
      storage[method] = () => { throw new DOMException('Denied', 'SecurityError'); };
    }
    assert.equal(safeSessionStorage.getItem('draft'), null);
    assert.doesNotThrow(() => safeSessionStorage.setItem('draft', 'reflection'));
    assert.doesNotThrow(() => safeSessionStorage.removeItem('draft'));
  });

  it('tolerates a throwing sessionStorage property getter', () => {
    Object.defineProperty(globalThis.window, 'sessionStorage', {
      get() { throw new DOMException('Denied', 'SecurityError'); }
    });
    assert.equal(safeSessionStorage.getItem('draft'), null);
    assert.doesNotThrow(() => safeSessionStorage.setItem('draft', 'reflection'));
    assert.doesNotThrow(() => safeSessionStorage.removeItem('draft'));
  });
});
