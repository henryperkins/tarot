import assert from 'node:assert/strict';
import { test } from 'node:test';
import { journalHookDriver, journalStorageFixture } from './helpers/journalHookDriver.mjs';

const owner = 'durability-owner';
const key = `tarot_journal_${owner}`;
const reading = (id, index = 0) => ({ id, readingResultId: id, ts: 1790000000000 + index * 1000,
  question: `Question ${id}`, personalReading: `Private prose ${id}`, cards: [], spreadKey: 'single' });
const read = storage => JSON.parse(storage.getItem(key) || '[]');
async function setup(t) {
  const fixture = journalStorageFixture(t);
  const driver = await journalHookDriver(owner);
  t.after(() => driver.close());
  return { ...fixture, driver, hook: driver.render() };
}

test('saving a 101st local reading retains every existing reading', async t => {
  const { storage, hook } = await setup(t);
  const existing = Array.from({ length: 100 }, (_, i) => reading(`existing-${i}`, i));
  storage.setItem(key, JSON.stringify(existing));
  const result = await hook.saveEntry(reading('new-reading', 200));
  assert.equal(result.success, true);
  assert.equal(read(storage).length, 101);
  assert.equal(read(storage).find(entry => entry.id === 'existing-0').personalReading, 'Private prose existing-0');
});

for (const operation of ['save', 'import']) {
  test(`${operation} waits for another tab's complete journal transaction`, async t => {
    const { storage, hook } = await setup(t);
    storage.setItem(key, JSON.stringify([reading('keep')]));
    storage.setItem('tarot_journal', JSON.stringify([reading('incoming')]));
    let release, began;
    const started = new Promise(resolve => { began = resolve; });
    const concurrent = navigator.locks.request(`tableu:journal:${key}`, {}, async () => {
      const snapshot = read(storage);
      began(); await new Promise(resolve => { release = resolve; });
      storage.setItem(key, JSON.stringify([reading('other-tab'), ...snapshot]));
    });
    await started;
    const pending = operation === 'save' ? hook.saveEntry(reading('incoming')) : hook.importLegacyLocalEntries();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(read(storage).map(entry => entry.id), ['keep']);
    release(); await concurrent; const result = await pending;
    assert.equal(result.success, true);
    assert.deepEqual(new Set(read(storage).map(entry => entry.id)), new Set(['keep', 'other-tab', 'incoming']));
  });
}

test('unavailable browser locks fail without changing the original journal', async t => {
  const { storage, hook } = await setup(t);
  const original = JSON.stringify([reading('keep')]); storage.setItem(key, original);
  navigator.locks = null;
  assert.equal((await hook.saveEntry(reading('new'))).success, false);
  assert.equal(storage.getItem(key), original);
});

test('an account deletion during the final write cannot leave a late journal copy', async t => {
  const { storage } = journalStorageFixture(t);
  const deletedOwner = 'durability-deleted-during-write';
  const driver = await journalHookDriver(deletedOwner); t.after(() => driver.close());
  const write = storage.setItem;
  storage.setItem = (name, value) => {
    write(name, value);
    if (name === `tarot_journal_${deletedOwner}`) write(`tarot_deleted_account:${deletedOwner}`, '1');
  };
  assert.equal((await driver.render().saveEntry(reading('late'))).success, false);
  assert.equal(storage.getItem(`tarot_journal_${deletedOwner}`), null);
});

for (const stage of ['destination write', 'guest cleanup']) {
  test(`account deletion during import at ${stage} retains the guest source`, async t => {
    const { storage } = journalStorageFixture(t);
    const deletedOwner = `durability-import-deleted-${stage}`;
    const driver = await journalHookDriver(deletedOwner); t.after(() => driver.close());
    const original = JSON.stringify([reading('unowned-guest')]); storage.setItem('tarot_journal', original);
    const write = storage.setItem, remove = storage.removeItem;
    const mark = () => write(`tarot_deleted_account:${encodeURIComponent(deletedOwner)}`, '1');
    storage.setItem = (name, value) => { write(name, value); if (stage === 'destination write' && name === `tarot_journal_${deletedOwner}`) mark(); };
    storage.removeItem = name => { remove(name); if (stage === 'guest cleanup' && name === 'tarot_journal') mark(); };
    const result = await driver.render().importLegacyLocalEntries();
    assert.equal(result.success, false);
    assert.equal(storage.getItem('tarot_journal'), original);
    assert.equal(storage.getItem(`tarot_journal_${deletedOwner}`), null);
  });
}

test('importing three guest readings into 99 local records retains all 102 with truthful counts', async t => {
  const { storage, hook } = await setup(t);
  storage.setItem(key, JSON.stringify(Array.from({ length: 99 }, (_, i) => reading(`existing-${i}`, i))));
  storage.setItem('tarot_journal', JSON.stringify([reading('guest-a', 200), reading('guest-b', 201), reading('guest-c', 202)]));
  const result = await hook.importLegacyLocalEntries();
  assert.equal(result.success, true);
  assert.equal(result.imported, 3);
  assert.equal(result.skipped, 0);
  assert.equal(read(storage).length, 102);
  assert.equal(read(storage).some(entry => entry.id === 'existing-0'), true);
  assert.equal(storage.getItem('tarot_journal'), null);
});

test('duplicate guest import keeps the account copy and counts only new records', async t => {
  const { storage, hook } = await setup(t);
  storage.setItem(key, JSON.stringify([reading('same')]));
  storage.setItem('tarot_journal', JSON.stringify([{ ...reading('same'), personalReading: 'Older guest copy' }, reading('new', 2)]));
  const result = await hook.importLegacyLocalEntries();
  assert.equal(result.success, true);
  assert.equal(result.imported, 1);
  assert.equal(result.skipped, 1);
  assert.equal(read(storage).find(entry => entry.id === 'same').personalReading, 'Private prose same');
});

for (const operation of ['save', 'import']) {
  test(`${operation} merges a destination reading added after the initial read`, async t => {
    const { storage, hook } = await setup(t);
    storage.setItem(key, JSON.stringify([reading('keep')]));
    storage.setItem('tarot_journal', JSON.stringify([reading('incoming')]));
    const get = storage.getItem;
    let reads = 0;
    storage.getItem = name => {
      if (name === key && ++reads === (operation === 'save' ? 2 : 1)) storage.setItem(key, JSON.stringify([reading('other-tab'), reading('keep')]));
      return get(name);
    };
    const result = operation === 'save' ? await hook.saveEntry(reading('incoming')) : await hook.importLegacyLocalEntries();
    assert.equal(result.success, true);
    assert.deepEqual(new Set(read(storage).map(entry => entry.id)), new Set(['keep', 'other-tab', 'incoming']));
    if (operation === 'import') assert.equal(result.imported, 1, 'a concurrent destination record is not counted as imported');
  });
}

test('a newer destination copy wins an import collision and reports a skip', async t => {
  const { storage, hook } = await setup(t);
  storage.setItem(key, '[]'); storage.setItem('tarot_journal', JSON.stringify([reading('incoming')]));
  const get = storage.getItem;
  let reads = 0;
  storage.getItem = name => {
    if (name === key && ++reads === 1) storage.setItem(key, JSON.stringify([{ ...reading('incoming'), personalReading: 'Newer account copy' }]));
    return get(name);
  };
  const result = await hook.importLegacyLocalEntries();
  assert.equal(result.imported, 0); assert.equal(result.skipped, 1);
  assert.equal(read(storage)[0].personalReading, 'Newer account copy');
});

test('cloud migration preserves every bucket when any source is unreadable', async t => {
  const { storage } = journalStorageFixture(t);
  const posted = [];
  const driver = await journalHookDriver(owner, { cloud: true, fetchImpl: async (url, options) => {
    posted.push(url); return Response.json(options?.method === 'POST' ? { entry: reading('keep') } : { entries: [] });
  } });
  t.after(() => driver.close());
  const original = JSON.stringify([reading('keep')]);
  storage.setItem(key, original); storage.setItem('tarot_journal', '{broken');
  const result = await driver.render().migrateToCloud();
  assert.equal(result.success, false);
  assert.deepEqual(posted, [], 'validate all source snapshots before any request');
  assert.equal(storage.getItem(key), original); assert.equal(storage.getItem('tarot_journal'), '{broken');
});

test('cloud migration retains readings added to a source while the upload is pending', async t => {
  const { storage } = journalStorageFixture(t);
  const driver = await journalHookDriver(owner, { cloud: true, fetchImpl: async (_url, options) => {
    if (options?.method === 'POST') {
      storage.setItem('tarot_journal', JSON.stringify([reading('guest'), reading('new-during-upload')]));
      return Response.json({ entry: reading('guest') });
    }
    return Response.json({ entries: [] });
  } });
  t.after(() => driver.close());
  storage.setItem('tarot_journal', JSON.stringify([reading('guest')]));
  const result = await driver.render().migrateToCloud();
  assert.equal(result.success, true); assert.equal(result.migrated, 1); assert.equal(result.sourceRetained, true);
  assert.equal(JSON.parse(storage.getItem('tarot_journal')).some(entry => entry.id === 'new-during-upload'), true);
});

test('cloud migration reports partial upload failure and retains every original source', async t => {
  const { storage } = journalStorageFixture(t);
  const driver = await journalHookDriver(owner, { cloud: true, fetchImpl: async (_url, options) =>
    options?.method === 'POST' ? Response.json({ error: 'Synthetic upload failure' }, { status: 503 }) : Response.json({ entries: [] }) });
  t.after(() => driver.close());
  const original = JSON.stringify([reading('guest')]); storage.setItem('tarot_journal', original);
  const result = await driver.render().migrateToCloud();
  assert.equal(result.success, false); assert.equal(result.sourceRetained, true);
  assert.equal(storage.getItem('tarot_journal'), original);
});

test('account deletion during cloud migration cleanup preserves the unowned guest source', async t => {
  const { storage } = journalStorageFixture(t);
  const deletedOwner = 'durability-migration-deleted-cleanup';
  const driver = await journalHookDriver(deletedOwner, { cloud: true, fetchImpl: async (_url, options) =>
    Response.json(options?.method === 'POST' ? { entry: reading('guest') } : { entries: [] }) });
  t.after(() => driver.close());
  const original = JSON.stringify([reading('guest')]); storage.setItem('tarot_journal', original);
  const remove = storage.removeItem;
  storage.removeItem = name => { remove(name); if (name === 'tarot_journal') storage.setItem(`tarot_deleted_account:${deletedOwner}`, '1'); };
  assert.equal((await driver.render().migrateToCloud()).success, false);
  assert.equal(storage.getItem('tarot_journal'), original);
});

for (const malformed of ['{broken', '{}', '[null]']) {
  test(`a local save preserves unreadable source ${malformed}`, async t => {
    const { storage, hook } = await setup(t);
    storage.setItem(key, malformed);
    const result = await hook.saveEntry(reading('new'));
    assert.equal(result.success, false);
    assert.equal(storage.getItem(key), malformed);
  });
}

test('unreadable guest import reports failure and preserves both buckets', async t => {
  const { storage, hook } = await setup(t);
  const original = JSON.stringify([reading('keep')]);
  storage.setItem(key, original); storage.setItem('tarot_journal', '{broken');
  const result = await hook.importLegacyLocalEntries();
  assert.equal(result.success, false);
  assert.equal(storage.getItem('tarot_journal'), '{broken');
  assert.equal(storage.getItem(key), original);
});

test('loading invalid local records reports unavailability without claiming an empty journal', async t => {
  const { storage, hook } = await setup(t); storage.setItem(key, '[null]');
  const result = await hook.loadEntries();
  assert.equal(result.success, false);
  assert.equal(storage.getItem(key), '[null]');
});

test('a changing guest source cannot be cleared unless the exact copied snapshot is retained', async t => {
  const { storage, hook } = await setup(t);
  storage.setItem(key, '[]'); storage.setItem('tarot_journal', JSON.stringify([reading('guest-a')]));
  const get = storage.getItem;
  let reads = 0;
  storage.getItem = name => {
    if (name === 'tarot_journal' && ++reads > 1) {
      storage.setItem(name, JSON.stringify([reading(reads % 2 === 0 ? 'guest-b' : 'guest-a')]));
    }
    return get(name);
  };
  const result = await hook.importLegacyLocalEntries();
  assert.equal(result.success, true);
  const remainingGuest = JSON.parse(get('tarot_journal') || '[]');
  assert.deepEqual(new Set([...read(storage), ...remainingGuest].map(entry => entry.id)), new Set(['guest-a', 'guest-b']));
});

for (const failure of ['throw', 'silent']) {
  test(`${failure} destination write prevents success and preserves the guest import source`, async t => {
    const { storage, hook } = await setup(t);
    const original = JSON.stringify([reading('keep')]);
    const guest = JSON.stringify([reading('import')]);
    storage.setItem(key, original); storage.setItem('tarot_journal', guest);
    const write = storage.setItem;
    storage.setItem = (name, value) => {
      if (name !== key) return write(name, value);
      if (failure === 'throw') throw new Error('QuotaExceededError');
    };
    const result = await hook.importLegacyLocalEntries();
    assert.equal(result.success, false);
    assert.equal(storage.getItem(key), original);
    assert.equal(storage.getItem('tarot_journal'), guest);
  });

  test(`${failure} local save reports failure without evicting existing readings`, async t => {
    const { storage, hook } = await setup(t);
    const original = JSON.stringify([reading('keep')]); storage.setItem(key, original);
    const write = storage.setItem;
    storage.setItem = (name, value) => {
      if (name !== key) return write(name, value);
      if (failure === 'throw') throw new Error('QuotaExceededError');
    };
    const result = await hook.saveEntry(reading('new'));
    assert.equal(result.success, false);
    assert.equal(storage.getItem(key), original);
  });
}
