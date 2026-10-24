// Editing reflections on saved readings through the real useJournal hook body:
// local journals rewrite this browser's bucket; cloud journals call the
// reflections endpoint and adopt its stored map.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { journalHookDriver, journalStorageFixture } from './helpers/journalHookDriver.mjs';

const owner = 'reflection-editor';
const key = `tarot_journal_${owner}`;
const cards = [{ position: 'Past', name: 'The Hermit' }, { position: 'Present', name: 'The Star' }];
const reading = (id, reflections = {}) => ({ id, readingResultId: id, ts: 1790000000000, question: `Question ${id}`,
  personalReading: `Prose ${id}`, cards, spreadKey: 'threeCard', reflections });
const stored = (storage, id) => JSON.parse(storage.getItem(key) || '[]').find(entry => entry.id === id);

async function loaded(t, options) {
  const driver = await journalHookDriver(owner, options);
  t.after(() => driver.close());
  await driver.render().loadEntries();
  driver.flush();
  return driver;
}

test('a local journal adds, rewrites and removes notes in the stored reading', async t => {
  const { storage } = journalStorageFixture(t);
  storage.setItem(key, JSON.stringify([reading('edit-me', { 0: 'first thought' }), reading('untouched', { 0: 'keep' })]));
  const driver = await loaded(t);
  const hook = driver.render();

  assert.deepEqual(await hook.saveReflection('edit-me', { key: '0', text: 'rewritten', mode: 'replace' }),
    { success: true, reflections: { 0: 'rewritten' } });
  assert.equal((await hook.saveReflection('edit-me', { key: 'Overall', text: 'whole', mode: 'append' })).success, true);
  assert.equal((await hook.saveReflection('edit-me', { key: 'Overall', text: 'more', mode: 'append' })).success, true);
  assert.deepEqual(stored(storage, 'edit-me').reflections, { 0: 'rewritten', Overall: 'whole\n\nmore' });

  assert.equal((await hook.saveReflection('edit-me', { key: '0', mode: 'remove' })).success, true);
  assert.deepEqual(stored(storage, 'edit-me').reflections, { Overall: 'whole\n\nmore' });
  assert.deepEqual(stored(storage, 'untouched').reflections, { 0: 'keep' });
  assert.equal(stored(storage, 'edit-me').personalReading, 'Prose edit-me');

  driver.flush();
  const entry = driver.render().entries.find(item => item.id === 'edit-me');
  assert.deepEqual(entry.reflections, { Overall: 'whole\n\nmore' });
});

test('blank, over-long and unknown edits fail without touching the journal', async t => {
  const { storage } = journalStorageFixture(t);
  const original = JSON.stringify([reading('edit-me', { 0: 'first thought' })]);
  storage.setItem(key, original);
  const driver = await loaded(t);
  const hook = driver.render();
  for (const edit of [
    { key: '0', text: '   ', mode: 'replace' },
    { key: '0', text: 'x'.repeat(2001), mode: 'replace' },
    { key: '0', text: 'note', mode: 'erase' },
    { text: 'note', mode: 'append' }
  ]) {
    const result = await hook.saveReflection('edit-me', edit);
    assert.equal(result.success, false, JSON.stringify(edit).slice(0, 60));
    assert.ok(result.error);
  }
  assert.equal((await hook.saveReflection('missing', { key: '0', text: 'note', mode: 'append' })).success, false);
  assert.equal(storage.getItem(key), original);
});

test('a cloud journal writes through the reflections endpoint and adopts its map', async t => {
  journalStorageFixture(t);
  const requests = [];
  const driver = await loaded(t, {
    cloud: true,
    fetchImpl: async (url, options = {}) => {
      if (String(url).startsWith('/api/journal?')) {
        return Response.json({ entries: [reading('cloud-entry', { 1: 'star note' })], pagination: { hasMore: false, total: 1 } });
      }
      const body = JSON.parse(options.body);
      requests.push({ url, method: options.method, body });
      if (body.mode === 'replace' && body.text === 'refused') {
        return Response.json({ error: 'Entry changed concurrently; reflection was not appended' }, { status: 409 });
      }
      const reflections = body.mode === 'remove' ? {} : { 1: 'star note', Overall: body.text };
      return Response.json({ success: true, entry: { id: 'cloud-entry' }, reflection: {}, reflections });
    }
  });

  const hook = driver.render();
  const added = await hook.saveReflection('cloud-entry', { key: 'Overall', text: 'whole reading', mode: 'append' });
  assert.deepEqual(added, { success: true, reflections: { 1: 'star note', Overall: 'whole reading' } });
  await hook.saveReflection('cloud-entry', { key: '1', mode: 'remove' });
  assert.deepEqual(requests, [
    { url: '/api/journal/cloud-entry/reflections', method: 'POST', body: { scope: 'reading', mode: 'append', text: 'whole reading', expectedText: '' } },
    { url: '/api/journal/cloud-entry/reflections', method: 'POST', body: { scope: 'card', cardIndex: 1, mode: 'remove' } }
  ]);
  driver.flush();
  assert.deepEqual(driver.render().entries[0].reflections, {});

  const refused = await hook.saveReflection('cloud-entry', { key: '0', text: 'refused', mode: 'replace' });
  assert.deepEqual(refused, { success: false, error: 'Entry changed concurrently; reflection was not appended' });
});

test('an offline cloud save explains the connection problem', async t => {
  journalStorageFixture(t);
  const driver = await loaded(t, {
    cloud: true,
    fetchImpl: async (url) => {
      if (String(url).startsWith('/api/journal?')) {
        return Response.json({ entries: [reading('cloud-entry')], pagination: { hasMore: false, total: 1 } });
      }
      throw new TypeError('Failed to fetch');
    }
  });
  const result = await driver.render().saveReflection('cloud-entry', { key: 'Overall', text: 'note', mode: 'append' });
  assert.deepEqual(result, { success: false, error: 'Your reflection could not be saved. Check your connection and try again.' });
});

test('an uncertain append keeps its original baseline across retry and starts fresh after success', async t => {
  journalStorageFixture(t);
  const bodies = [];
  const driver = await loaded(t, {
    cloud: true,
    fetchImpl: async (url, options = {}) => {
      if (String(url).startsWith('/api/journal?')) return Response.json({ entries: [reading('cloud-entry')], pagination: { hasMore: false, total: 1 } });
      const body = JSON.parse(options.body);
      bodies.push(body);
      if (bodies.length === 1) throw new TypeError('Response lost after commit');
      return Response.json({ reflections: { Overall: body.expectedText ? `${body.expectedText}\n\n${body.text}` : body.text } });
    }
  });
  const edit = { key: 'Overall', text: 'Leave room.', mode: 'append' };
  assert.equal((await driver.render().saveReflection('cloud-entry', edit)).success, false);
  assert.equal((await driver.render().saveReflection('cloud-entry', edit)).success, true);
  driver.flush();
  assert.equal((await driver.render().saveReflection('cloud-entry', edit)).success, true);
  assert.deepEqual(bodies.map(body => body.expectedText), ['', '', 'Leave room.']);
});
