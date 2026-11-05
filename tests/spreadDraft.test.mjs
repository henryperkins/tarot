import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import {
  SPREAD_DRAFT_STORAGE_KEY,
  clearSpreadDraft,
  loadSpreadDraft,
  saveSpreadDraft
} from '../src/lib/spreadDraft.js';

function createStorage() {
  const values = new Map();
  return {
    getItem: key => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    size: () => values.size
  };
}

describe('spread draft', () => {
  let storage;
  beforeEach(() => {
    storage = createStorage();
  });

  it('returns the spread chosen earlier in the tab', () => {
    saveSpreadDraft('fiveCard', storage);
    assert.equal(loadSpreadDraft(storage), 'fiveCard');
  });

  it('returns nothing before a choice is made', () => {
    assert.equal(loadSpreadDraft(storage), null);
  });

  it('ignores keys that no longer name a spread instead of mapping them to another', () => {
    storage.setItem(SPREAD_DRAFT_STORAGE_KEY, JSON.stringify({ spreadKey: 'retiredSpread' }));
    assert.equal(loadSpreadDraft(storage), null);
    storage.setItem(SPREAD_DRAFT_STORAGE_KEY, JSON.stringify({ spreadKey: 'toString' }));
    assert.equal(loadSpreadDraft(storage), null);
    storage.setItem(SPREAD_DRAFT_STORAGE_KEY, '{not json');
    assert.equal(loadSpreadDraft(storage), null);
  });

  it('does not store an unknown spread, and clears on request', () => {
    saveSpreadDraft('celtic', storage);
    saveSpreadDraft('unknown', storage);
    assert.equal(storage.size(), 0);
    saveSpreadDraft('celtic', storage);
    clearSpreadDraft(storage);
    assert.equal(storage.size(), 0);
  });

  it('keeps working in memory when storage is missing or throws', () => {
    const throwing = {
      getItem() { throw new Error('blocked'); },
      setItem() { throw new Error('full'); },
      removeItem() { throw new Error('blocked'); }
    };
    assert.equal(loadSpreadDraft(throwing), null);
    assert.doesNotThrow(() => saveSpreadDraft('single', throwing));
    assert.doesNotThrow(() => clearSpreadDraft(throwing));
    assert.equal(loadSpreadDraft(null), null);
  });
});
