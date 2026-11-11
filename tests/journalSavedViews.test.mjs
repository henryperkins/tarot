import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readSavedViews, writeSavedViews, importLegacySavedViews, hasLegacySavedViews } from '../src/lib/journal/savedViews.js';
import { purgeDeletedAccountStorage } from '../src/lib/deletedAccountStorage.js';

const view = { id: 'private-view', name: 'Private question', values: { query: 'Private account A query' } };
function fixture() {
  const values = new Map();
  return { values, get length() { return values.size; }, key: index => [...values.keys()][index], getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
}

test('a saved query stays with its owner across guest and other-account reads', () => {
  const storage = fixture();
  assert.equal(writeSavedViews(storage, 'owner-a', [view]).success, true);
  assert.deepEqual(readSavedViews(storage, 'owner-b'), []);
  assert.deepEqual(readSavedViews(storage, null), []);
  assert.equal(readSavedViews(storage, 'owner-a')[0].values.query, 'Private account A query');
});

test('legacy global names and queries require explicit import and stay isolated afterward', () => {
  const storage = fixture(); storage.setItem('journal_saved_filters_v1', JSON.stringify([view]));
  assert.deepEqual(readSavedViews(storage, 'owner-a'), []);
  assert.equal(hasLegacySavedViews(storage, 'owner-a'), true);
  assert.equal(importLegacySavedViews(storage, 'owner-a').success, true);
  assert.equal(readSavedViews(storage, 'owner-a')[0].name, 'Private question');
  assert.deepEqual(readSavedViews(storage, 'owner-b'), []);
  assert.equal(hasLegacySavedViews(storage, 'owner-a'), false);
  assert.equal(storage.getItem('journal_saved_filters_v1'), JSON.stringify([view]));
});

test('failed saved-view writes never report success or remove older views', () => {
  const storage = fixture(); writeSavedViews(storage, 'write-failure', [view]);
  storage.setItem = () => {};
  assert.equal(writeSavedViews(storage, 'write-failure', []).success, false);
  assert.equal(readSavedViews(storage, 'write-failure')[0].name, 'Private question');
});

test('malformed legacy data is preserved and not marked imported', () => {
  const storage = fixture(); storage.setItem('journal_saved_filters_v1', '{broken');
  assert.equal(importLegacySavedViews(storage, 'malformed-owner').success, false);
  assert.equal(storage.getItem('journal_saved_filters_v1'), '{broken');
  assert.equal(hasLegacySavedViews(storage, 'malformed-owner'), true);
});

test('legacy views with unreadable query values cannot enter the active filter state', () => {
  const storage = fixture();
  const raw = JSON.stringify([{ ...view, values: { query: { invalid: true } } }]);
  storage.setItem('journal_saved_filters_v1', raw);
  assert.equal(importLegacySavedViews(storage, 'invalid-values-owner').success, false);
  assert.deepEqual(readSavedViews(storage, 'invalid-values-owner'), []);
  assert.equal(storage.getItem('journal_saved_filters_v1'), raw);
});

test('explicit legacy import retains existing owner views with the same name', () => {
  const storage = fixture(); writeSavedViews(storage, 'merge-owner', [view]);
  storage.setItem('journal_saved_filters_v1', JSON.stringify([{ ...view, id: 'older', values: { query: 'Older query' } }]));
  assert.equal(importLegacySavedViews(storage, 'merge-owner').success, true);
  assert.equal(readSavedViews(storage, 'merge-owner').length, 1);
  assert.equal(readSavedViews(storage, 'merge-owner')[0].values.query, 'Private account A query');
});

test('confirmed account deletion purges only that owner saved views and fences stale writes', () => {
  const storage = fixture();
  writeSavedViews(storage, 'deleted-view-owner', [view]); writeSavedViews(storage, 'retained-view-owner', [view]);
  purgeDeletedAccountStorage('deleted-view-owner', { storage });
  assert.deepEqual(readSavedViews(storage, 'deleted-view-owner'), []);
  assert.equal(readSavedViews(storage, 'retained-view-owner').length, 1);
  assert.equal(writeSavedViews(storage, 'deleted-view-owner', [view]).success, false);
});

test('saved views round-trip presentation order separately from filter values without mutating inputs', () => {
  const storage = fixture();
  const oldestView = Object.freeze({ ...view, sortOrder: 'oldest', values: Object.freeze({ query: 'Older questions', contexts: ['love'] }) });
  const legacyView = Object.freeze({ ...view, id: 'default-order', name: 'Default order' });
  const input = Object.freeze([oldestView, legacyView]);
  const result = writeSavedViews(storage, 'sorted-owner', input);

  assert.equal(result.success, true);
  assert.deepEqual(result.views.map(item => item.sortOrder), ['oldest', 'newest']);
  assert.deepEqual(readSavedViews(storage, 'sorted-owner'), result.views);
  assert.deepEqual(result.views[0].values, oldestView.values);
  assert.equal(Object.hasOwn(result.views[0].values, 'sortOrder'), false);
  assert.equal(Object.hasOwn(legacyView, 'sortOrder'), false);
  assert.deepEqual(readSavedViews(storage, 'another-sorted-owner'), []);
});

test('pre-sort owner buckets default to newest when read without rewriting stored bytes', () => {
  const storage = fixture();
  const key = 'tarot_saved_views_user_existing-owner';
  const raw = JSON.stringify({ views: [view], legacyImported: true });
  storage.setItem(key, raw);

  const stored = readSavedViews(storage, 'existing-owner');
  assert.equal(stored[0].sortOrder, 'newest');
  assert.deepEqual(stored[0].values, view.values);
  assert.equal(storage.getItem(key), raw);
});

test('legacy import defaults missing order to newest while preserving the unknown-owner source', () => {
  const storage = fixture();
  const raw = JSON.stringify([view, { ...view, id: 'oldest-view', name: 'Oldest', sortOrder: 'oldest' }]);
  storage.setItem('journal_saved_filters_v1', raw);

  const result = importLegacySavedViews(storage, 'ordered-import-owner');
  assert.equal(result.success, true);
  assert.deepEqual(result.views.map(item => item.sortOrder), ['newest', 'oldest']);
  assert.deepEqual(readSavedViews(storage, 'ordered-import-owner'), result.views);
  assert.equal(storage.getItem('journal_saved_filters_v1'), raw);
});

test('invalid explicit saved sort orders are rejected without replacing valid owner views', () => {
  const storage = fixture();
  const existing = { ...view, sortOrder: 'oldest' };
  assert.equal(writeSavedViews(storage, 'invalid-sort-owner', [existing]).success, true);
  const key = 'tarot_saved_views_user_invalid-sort-owner';
  const before = storage.getItem(key);

  for (const sortOrder of ['relevance', '', null, 1, {}, []]) {
    assert.equal(writeSavedViews(storage, 'invalid-sort-owner', [{ ...view, sortOrder }]).success, false);
    assert.equal(storage.getItem(key), before);
    assert.equal(readSavedViews(storage, 'invalid-sort-owner')[0].sortOrder, 'oldest');
  }
});

test('invalid stored and legacy sort orders remain untouched and cannot enter active views', () => {
  const storage = fixture();
  const invalid = { ...view, sortOrder: { direction: 'oldest' } };
  const key = 'tarot_saved_views_user_invalid-stored-order';
  const ownerRaw = JSON.stringify({ views: [invalid] });
  const legacyRaw = JSON.stringify([invalid]);
  storage.setItem(key, ownerRaw);
  storage.setItem('journal_saved_filters_v1', legacyRaw);

  assert.deepEqual(readSavedViews(storage, 'invalid-stored-order'), []);
  assert.equal(storage.getItem(key), ownerRaw);
  assert.equal(importLegacySavedViews(storage, 'invalid-import-order').success, false);
  assert.equal(storage.getItem('journal_saved_filters_v1'), legacyRaw);
  assert.equal(hasLegacySavedViews(storage, 'invalid-import-order'), true);
});
